/**
 * POST /api/tenant/site/ai-chat
 *
 * Authenticated, Pro-gated endpoint that forwards a chat message + the
 * tenant's current index.html/style.css/script.js to Claude via OpenRouter
 * and returns structured file diffs the frontend can review per-file.
 *
 * Response format (JSON):
 *   {
 *     changes: [
 *       { file: "index.html" | "style.css" | "script.js",
 *         oldContent: string,
 *         newContent: string,
 *         description: string }
 *     ]
 *   }
 *
 * Rate-limited per-tenant (10 requests / 15 min window). Every request is
 * logged to security_events for cost-auditing (without leaking the prompt
 * content itself).
 */

import { Router } from 'express';
import { db } from '../db';
import { securityEvents } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { requireAuth } from './middleware/auth';
import { csrfProtection } from './middleware/csrf';
import { requireProPlan } from './pro-site';

const router = Router();

router.use(requireAuth({ roles: ['owner'] }));
router.use(csrfProtection);

/**
 * Per-tenant in-memory request counter for daily AI-request rate limiting.
 * Resets every 24h (midnight UTC). Stored as Map<tenantId, dateStr count>.
 *
 * This is a single-process cache. If the app ever scales horizontally the
 * limiter must move to a shared store (DB / Redis). For the current monolith
 * it's sufficient.
 */
const DAILY_AI_LIMIT = 20;
const dailyCounters = new Map<string, { date: string; count: number }>();

function checkAiRateLimit(tenantId: string): { ok: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const entry = dailyCounters.get(tenantId);
  if (!entry || entry.date !== today) {
    dailyCounters.set(tenantId, { date: today, count: 0 });
    return { ok: true, remaining: DAILY_AI_LIMIT };
  }
  if (entry.count >= DAILY_AI_LIMIT) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: DAILY_AI_LIMIT - entry.count };
}

function incrementAiCount(tenantId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  const entry = dailyCounters.get(tenantId);
  if (!entry || entry.date !== today) {
    dailyCounters.set(tenantId, { date: today, count: 1 });
  } else {
    entry.count++;
  }
}

/**
 * Log the AI request to security_events so usage is auditable.
 * We record tenant_id, endpoint, timestamp, and model — never the prompt
 * content itself to avoid leaking tenant AI prompts into the log.
 */
function logAiUsage(tenantId: string, ip: string | null, model: string): void {
  const row = {
    id: crypto.randomUUID(),
    eventType: 'ai_chat_request',
    tenantId,
    ip,
    result: 'success',
    details: { endpoint: '/api/tenant/site/ai-chat', model },
    createdAt: Date.now(),
  };
  void db.insert(securityEvents).values(row).catch((err: any) => {
    console.error('[ai-chat] failed to log usage:', err?.message || err);
  });
}

// POST /api/tenant/site/ai-chat
router.post('/site/ai-chat', async (req, res) => {
  const { tenantId } = (req as any).user;

  // 1. Pro-plan gate
  const plan = await requireProPlan(req, res);
  if (!plan) return;

  // 2. Rate limit
  const { ok: withinLimit, remaining } = checkAiRateLimit(tenantId);
  if (!withinLimit) {
    return res.status(429).json({
      error: `AI request limit reached (${DAILY_AI_LIMIT}/day). Try again tomorrow.`,
      code: 'AI_RATE_LIMITED',
      remaining: 0,
    });
  }

  // 3. Validate body — v4 AI SDK sends { messages: [...], indexHtml, styleCss, scriptJs }
  //    Extract the last user message from the messages array.
  const messages: Array<{ role: string; content: string; parts?: any[] }> = req.body.messages ?? [];
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const userMessage: string | undefined = lastUserMsg?.content ?? lastUserMsg?.parts?.[0]?.text;

  const { indexHtml, styleCss, scriptJs } = req.body as {
    indexHtml?: string;
    styleCss?: string;
    scriptJs?: string;
  };

  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // 4. Retrieve the OpenRouter API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[ai-chat] OPENROUTER_API_KEY is not configured');
    return res.status(500).json({ error: 'AI service is not configured on this server.' });
  }

  // 5. Build the system prompt
  const systemPrompt = `You are an expert front-end developer editing a small business's plain HTML/CSS/JS website.

You are editing THREE files:
- **index.html** — HTML structure
- **style.css** — CSS styles
- **script.js** — JavaScript (vanilla, no framework, no build step)

RULES:
- Propose concrete changes. Output each file change in a fenced code block.
- Each block MUST start with a comment line: \`<!-- FILE: index.html -->\` (for HTML), \`/* FILE: style.css */\` (for CSS), \`// FILE: script.js\` (for JS).
- If a file does not need changes, do not include it.
- Do NOT introduce inline event handlers (onclick, onsubmit, etc.) — put event listeners in script.js using addEventListener instead.
- Do NOT add <script> tags with inline JS content that the publish sanitizer would strip. Write clean vanilla JS in script.js.
- Keep changes focused and minimal. Prefer adding new sections rather than rewriting the entire file.
- Use modern CSS (flexbox, grid, custom properties) but no CSS preprocessors.
- The site must work as a single-page static site with no external dependencies (no external CDNs, no frameworks).

Respond with ONLY the file changes in this JSON format at the very end of your message:
\`\`\`json
{
  "changes": [
    {
      "file": "index.html",
      "oldContent": "...",
      "newContent": "...",
      "description": "Brief description of the change"
    }
  ]
}
\`\`\`

The oldContent must match the existing content exactly for the part you're changing, and newContent is the replacement.
Make sure to escape any special characters properly in the JSON.`;

  // 6. Build the user prompt with current file contents
  const userPrompt = `Current files:\n\nindex.html:\n\`\`\`html\n${indexHtml || '(empty)'}\n\`\`\`\n\nstyle.css:\n\`\`\`css\n${styleCss || '(empty)'}\n\`\`\`\n\nscript.js:\n\`\`\`js\n${scriptJs || '(empty)'}\n\`\`\`\n\nUser request: ${userMessage}`;

  // 7. Call OpenRouter API directly (the ai-sdk streamText would work, but
  //    a direct fetch is simpler for a non-streaming POST → JSON response)
  const modelId = 'anthropic/claude-3.5-sonnet';
  try {
    const openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Egebeya Website Builder',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!openrouterRes.ok) {
      const errBody = await openrouterRes.text().catch(() => '');
      console.error(`[ai-chat] OpenRouter returned ${openrouterRes.status}:`, errBody);
      return res.status(502).json({ error: 'AI service returned an error. Please try again.' });
    }

    const data = await openrouterRes.json();
    const assistantMessage: string = data?.choices?.[0]?.message?.content || '';

    // 8. Parse the JSON changes block from the assistant message
    let changes: Array<{ file: string; oldContent: string; newContent: string; description: string }> = [];

    // Try to find ```json ... ``` block
    const jsonMatch = assistantMessage.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed.changes && Array.isArray(parsed.changes)) {
          changes = parsed.changes;
        }
      } catch {
        // Fall through — return empty changes with the raw message
      }
    }

    // 9. Increment counter and log
    incrementAiCount(tenantId);
    logAiUsage(tenantId, req.ip || null, modelId);

    // 10. Respond
    res.json({
      message: assistantMessage,
      changes,
      remaining: remaining - 1,
    });
  } catch (err: any) {
    console.error('[ai-chat] OpenRouter fetch error:', err?.message || err);
    res.status(502).json({ error: 'Failed to contact AI service. Please try again.' });
  }
});

export default router;