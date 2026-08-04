import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puck } from '@measured/puck';
import '@measured/puck/dist/index.css';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { Sparkles, Code2, PencilRuler, Loader2, Rocket, Send, Puzzle, PanelRightClose, PanelRightOpen, History, ExternalLink, RotateCcw, Check } from 'lucide-react';
import { authFetch } from '../../lib/api';
import { fetchSubscription, isProActive, type SubscriptionSummary } from '../../lib/subscription';
import { config } from '../../lib/puck.config';
import { showToast } from '../../components/ui/toast-helper';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { StaffRedirect } from './StaffRedirect';
import { useBuilderMode } from './BuilderModeContext';
import { getAllWidgets, type WidgetSpec } from '../../lib/widgetRoutes';
import { ShareSiteBar } from './ShareSiteBar';

type BuilderMode = 'puck' | 'code';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DEBOUNCE_MS = 2000;

const DEFAULT_CODE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Egebeya Site</title>
  <style>body{font-family:system-ui,sans-serif;max-width:760px;margin:0 auto;padding:2rem;}</style>
</head>
<body>
  <h1>Welcome to my business</h1>
  <p>Edit this page in Code Mode, then hit Publish.</p>
</body>
</html>
`;

/**
 * FUTURE PUBLISHING: The API route that serves the published Code Mode HTML
 * must include a Strict CSP header:
 *   Content-Security-Policy: default-src 'self'; script-src 'self'; frame-src https://api.egebeya.et;
 * to block any unapproved inline scripts from executing on the live site.
 */

export function WebsiteBuilder() {
  return (
    <StaffRedirect>
      <WebsiteBuilderInner />
    </StaffRedirect>
  );
}

function WebsiteBuilderInner() {
  const { mode, setMode } = useBuilderMode();

  const [planState, setPlanState] = useState<{ loading: boolean; isPro: boolean; summary: SubscriptionSummary | null }>({
    loading: true,
    isPro: false,
    summary: null,
  });

  const [siteConfig, setSiteConfig] = useState<{
    builderMode: 'puck' | 'code';
    publishedCodeHtml: string | null;
  } | null>(null);
  const [puckContent, setPuckContent] = useState<any>(null);
  const [codeHtml, setCodeHtml] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  const [disclaimer, setDisclaimer] = useState<BuilderMode | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [codeSaveStatus, setCodeSaveStatus] = useState<SaveStatus>('idle');

  const slug = typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') || '' : '';

  // ---- Load plan + site config + puck page on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summary, siteRes, pageRes] = await Promise.all([
          fetchSubscription(),
          authFetch('/api/tenant/site'),
          authFetch('/api/tenant/page'),
        ]);
        if (cancelled) return;

        setPlanState({ loading: false, isPro: isProActive(summary), summary });

        const site = siteRes.ok ? await siteRes.json() : null;
        const page = pageRes.ok ? await pageRes.json() : null;
        const isPro = isProActive(summary);
        const initialMode: BuilderMode = isPro && site?.builderMode === 'code' ? 'code' : 'puck';
        setSiteConfig(site);
        setMode(initialMode);
        setCodeHtml(site?.publishedCodeHtml ?? null);
        setPuckContent(page?.content ?? { content: [], root: {} });
      } catch (err: any) {
        if (cancelled) return;
        setBootError(err?.message || 'Failed to load your builder.');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Persist builder_mode ----
  const persistMode = useCallback(async (next: BuilderMode) => {
    try {
      await authFetch('/api/tenant/site', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ builderMode: next }),
      });
    } catch (err) {
      console.error('Failed to persist builder mode:', err);
    }
  }, []);

  const handleConfirmSwitch = useCallback(() => {
    if (!disclaimer) return;
    setMode(disclaimer);
    void persistMode(disclaimer);
    setDisclaimer(null);
  }, [disclaimer, setMode, persistMode]);

  // ---- Puck save (via Puck's own Publish button) ----
  const [puckSaveStatus, setPuckSaveStatus] = useState<SaveStatus>('idle');
  const [shareBarKey, setShareBarKey] = useState(0);
  const [deployHistoryKey, setDeployHistoryKey] = useState(0);
  const handlePuckPublish = useCallback(async (data: any) => {
    setPuckContent(data);
    setPuckSaveStatus('saving');
    try {
      const res = await authFetch('/api/tenant/page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: data }),
      });
      setPuckSaveStatus(res.ok ? 'saved' : 'error');
      if (res.ok) {
        showToast('Page saved', 'Your visual layout is persisted.');
        // Surfacing the share bar after a published save is the "share your
        // new site" hook — re-mount it so it re-reads the share link.
        setShareBarKey((k) => k + 1);
      }
    } catch {
      setPuckSaveStatus('error');
    }
  }, []);

  // ---- Free-user gating helpers ----
  const handleAiClick = () => {
    if (!planState.isPro) {
      setSubscribeOpen(true);
      return;
    }
    setAiOpen(true);
  };

  const handleCodeClick = () => {
    if (!planState.isPro) {
      setSubscribeOpen(true);
      return;
    }
    if (mode === 'puck') {
      setDisclaimer('code');
    }
  };

  const handleVisualClick = () => {
    if (mode === 'code') {
      setDisclaimer('puck');
    }
  };

  // ---- AI generate (stub, wired for future LLM) ----
  const handleAiGenerate = useCallback(() => {
    // FUTURE LLM INTEGRATION: Pass the `widgetRoutes.ts` routing config to the
    // AI's system prompt. The AI must use these exact routes and the user's
    // business_id to generate accurate iframe embeds.
    // Prompt + state are only ever logged in dev builds — never in production
    // (avoids leaking tenant content / AI prompts to the console).
    if (import.meta.env.DEV) {
      if (mode === 'puck') {
        console.log('AI Prompt (Visual Mode):', aiPrompt);
        console.log('Current Puck JSON state:', JSON.stringify(puckContent));
      } else {
        console.log('AI Prompt (Code Mode):', aiPrompt);
        console.log('Current Sandpack HTML state:', codeHtml);
      }
    }
    showToast('AI prompt logged', import.meta.env.DEV ? 'Check the browser console for prompt and current state.' : 'AI generation is staged for a future release.');
    setAiPrompt('');
    setAiOpen(false);
  }, [aiPrompt, mode, puckContent, codeHtml]);

  if (booting || planState.loading) {
    return <CenteredNotice icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Loading your builder…" />;
  }
  if (bootError) {
    return <CenteredNotice title="Something went wrong" subtitle={bootError} />;
  }

  return (
    <div className="flex h-[calc(100vh-128px)] flex-col gap-3">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-rule bg-paper-bleached px-4 py-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-ink/10 text-ink">
            {mode === 'puck' ? <PencilRuler className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
          </span>
          <h1 className="text-sm font-bold text-ink leading-tight">Website Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[0.7rem] text-ink-soft">
            {mode === 'puck' ? 'Visual mode — drag, drop, arrange.' : 'Code mode — edit raw HTML with a live preview.'}
          </p>
          <Badge variant={mode === 'puck' ? 'secondary' : 'default'} className="text-[0.65rem] px-1.5 py-0 h-4 leading-none">{mode === 'puck' ? 'Visual' : 'Code'}</Badge>
        </div>
      </div>

        <div className="flex flex-wrap items-center gap-3">
          <SaveStatusIndicator status={mode === 'puck' ? puckSaveStatus : codeSaveStatus} />
          <Badge variant={mode === 'puck' ? 'secondary' : 'default'}>{mode === 'puck' ? 'Visual' : 'Code'}</Badge>

          {mode === 'puck' ? (
            <Button size="sm" variant="outline" onClick={handleCodeClick} title="Switch to Code Editor">
              <Code2 className="h-4 w-4" /> Code
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleVisualClick} title="Switch to Visual Editor">
              <PencilRuler className="h-4 w-4" /> Visual
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleAiClick} title="AI Assistant">
            <Sparkles className="h-4 w-4 text-accent-secondary-deep" /> AI
          </Button>
        </div>
      </div>

      {/* Share hook — appears on load (if already published) and re-mounts
          after every successful publish so the owner can share instantly. */}
      <div className="flex-shrink-0">
        <ShareSiteBar key={shareBarKey} />
      </div>

        {/* Editor body */}
      {mode === 'puck' ? (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-ink-rule bg-white">
          <Puck config={config} data={puckContent} onPublish={handlePuckPublish} />
        </div>
      ) : (
        <CodeMode
          slug={slug}
          initialHtml={codeHtml}
          onHtmlChange={(html) => setCodeHtml(html)}
          saveStatus={codeSaveStatus}
          onSaveStatus={setCodeSaveStatus}
          onPublished={() => {
            // Refresh the share bar and deploy history after a successful publish.
            setShareBarKey((k) => k + 1);
            setDeployHistoryKey((k) => k + 1);
          }}
        />
      )}

      {/* Deploy history panel — Code Mode only */}
      {mode === 'code' && (
        <DeployHistory refreshKey={deployHistoryKey} onPublished={() => setDeployHistoryKey((k) => k + 1)} />
      )}

      {/* Disclaimer modal */}
      <DisclaimerModal
        open={disclaimer !== null}
        to={disclaimer}
        onConfirm={handleConfirmSwitch}
        onCancel={() => setDisclaimer(null)}
      />

      {/* Subscribe-to-Pro modal */}
      <SubscribeModal open={subscribeOpen} onClose={() => setSubscribeOpen(false)} />

      {/* AI prompt modal */}
      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAiOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent-secondary-deep" />
        <h2 className="text-lg font-bold text-ink">AI Assistant</h2>
            </div>
      <p className="mb-3 text-sm text-ink-soft">
        Describe the change. The prompt and current {mode === 'puck' ? 'Puck JSON' : 'Sandpack HTML'} state are logged
        to the console (LLM integration is staged for later).
      </p>
      <textarea
        value={aiPrompt}
        onChange={(e) => setAiPrompt(e.target.value)}
        rows={4}
        placeholder="e.g. Add a booking widget section…"
        className="w-full rounded-md border border-ink-rule px-3 py-2 text-sm text-ink placeholder-ink-stamp focus:outline-none focus:ring-2 focus:ring-accent-secondary/30"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAiOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAiGenerate}>
                <Send className="h-4 w-4" /> Generate
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// codeSaveStatus is owned by WebsiteBuilderInner (top bar) and threaded into
// CodeMode as a prop so the autosave status shows next to the editor header.

/**
 * Code Mode: Sandpack vanilla (static HTML/CSS/JS) so the published output
 * runs on cheap shared hosting without Node.js. Contains autosave, the
 * Egebeya-widget injector, and the Publish (sanitize) button.
 */
function CodeMode({
  slug,
  initialHtml,
  onHtmlChange,
  saveStatus,
  onSaveStatus,
  onPublished,
}: {
  slug: string;
  initialHtml: string | null;
  onHtmlChange: (html: string) => void;
  saveStatus: SaveStatus;
  onSaveStatus: (s: SaveStatus) => void;
  onPublished?: () => void;
}) {
  const [files, setFiles] = useState<Record<string, string>>(() => ({
    '/index.html': initialHtml || DEFAULT_CODE_TEMPLATE,
    '/styles.css': 'body { font-family: system-ui, sans-serif; }',
    '/script.js': '',
  }));

  return (
    <div className="min-h-0 flex-1 flex flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-ink-rule bg-white">
        <SandpackProvider
          template="vanilla"
          files={files}
          theme="light"
          options={{ recompileMode: 'immediate', recompileDelay: 300 }}
          style={{ height: '100%' }}
        >
          <CodeModeInner
            slug={slug}
            initialHtml={initialHtml}
            onHtmlChange={onHtmlChange}
            saveStatus={saveStatus}
            onSaveStatus={onSaveStatus}
            onPublished={onPublished}
          />
        </SandpackProvider>
      </div>
    </div>
  );
}

function CodeModeInner({
  slug,
  initialHtml,
  onHtmlChange,
  saveStatus,
  onSaveStatus,
  onPublished,
}: {
  slug: string;
  initialHtml: string | null;
  onHtmlChange: (html: string) => void;
  saveStatus: SaveStatus;
  onSaveStatus: (s: SaveStatus) => void;
  onPublished?: () => void;
}) {
  const { sandpack } = useSandpack();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishUrl, setPublishUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const widgets = useMemo(() => getAllWidgets(slug), [slug]);

  const setStatus = (s: SaveStatus) => onSaveStatus(s);

  // Build the single published HTML document by inlining styles + script.
  const getCurrentHtml = useCallback((): string => {
    const html = (sandpack.files['/index.html'] as any)?.code ?? '';
    const css = (sandpack.files['/styles.css'] as any)?.code ?? '';
    const js = (sandpack.files['/script.js'] as any)?.code ?? '';
    if (!css && !js) return html;
    const inlineCss = css ? `\n  <style>\n${css}\n  </style>` : '';
    const inlineJs = js ? `\n  <script>\n${js}\n  </script>` : '';
    if (html.includes('</head>')) {
      return html.replace('</head>', `${inlineCss}${inlineJs}\n</head>`);
    }
    return html + inlineCss + inlineJs;
  }, [sandpack.files]);

  // Debounced autosave (2s) → PATCH published_code_html.
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string | null>(initialHtml);
  const didInitRef = useRef(false);

  useEffect(() => {
    const html = getCurrentHtml();
    onHtmlChange(html);
    if (!didInitRef.current) {
      lastSavedRef.current = html;
      didInitRef.current = true;
      return;
    }
    if (html === lastSavedRef.current) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setStatus('saving');
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const res = await authFetch('/api/tenant/site', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ builderMode: 'code', publishedCodeHtml: html }),
        });
        if (res.ok) {
          lastSavedRef.current = html;
          setStatus('saved');
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandpack.files, getCurrentHtml]);

  // Inject a widget snippet at the CodeMirror cursor (fallback: before </body>).
  const injectWidgetAtCursor = useCallback(
    (snippet: string, label: string) => {
      const currentHtml = getCurrentHtml();
      if (currentHtml.includes(snippet.trim())) {
        showToast('Widget already present', `${label} is already in your HTML.`);
        return;
      }
      const editorEl = document.querySelector('.cm-content') as HTMLElement | null;
      const cmView = (editorEl as any)?.cmView?.view;
      if (cmView) {
        const { from, to } = cmView.state.selection.main;
        const transaction = cmView.state.update({ changes: { from, to, insert: snippet + '\n' } });
        cmView.dispatch(transaction);
        showToast('Widget injected at cursor', `${label} inserted.`);
        return;
      }
      const bodyCloseIdx = currentHtml.lastIndexOf('</body>');
      let next = currentHtml;
      if (bodyCloseIdx !== -1) {
        next = currentHtml.slice(0, bodyCloseIdx) + '\n  ' + snippet + '\n' + currentHtml.slice(bodyCloseIdx);
      } else {
        next = currentHtml + '\n' + snippet;
      }
      sandpack.updateFile('/index.html', next);
      showToast('Widget injected', `${label} added before </body>.`);
    },
    [getCurrentHtml, sandpack],
  );

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      // 1. Save the current Sandpack files to pro_site_files so the publish
      //    endpoint has something to read.
      const fileMap: Record<string, string> = {};
      const indexHtml = (sandpack.files['/index.html'] as any)?.code ?? '';
      const stylesCss = (sandpack.files['/styles.css'] as any)?.code ?? '';
      const scriptJs = (sandpack.files['/script.js'] as any)?.code ?? '';
      if (indexHtml) fileMap['index.html'] = indexHtml;
      if (stylesCss) fileMap['style.css'] = stylesCss;
      if (scriptJs) fileMap['script.js'] = scriptJs;

      const saveRes = await authFetch('/api/tenant/pro-site/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fileMap),
      });
      if (!saveRes.ok) {
        const errBody = await saveRes.json().catch(() => ({}));
        const errMsg = errBody?.error || `Failed to save files (HTTP ${saveRes.status})`;
        showToast('Save failed', errMsg, 'destructive');
        setPublishError(errMsg);
        return;
      }

      // 2. Call the real publish endpoint.
      const res = await authFetch('/api/tenant/site/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const errMsg = errBody?.error || `Publish failed (HTTP ${res.status})`;
        showToast('Publish failed', errMsg, 'destructive');
        setPublishError(errMsg);
        return;
      }

      const data = await res.json();
      const publicUrl: string | null = data.publicUrl ?? null;

      // Success: toast + show the live public URL.
      setPublishUrl(publicUrl);
      if (publicUrl) {
        showToast(
          'Published!',
          `Your site is live at ${publicUrl}`,
        );
      } else {
        showToast(
          'Published!',
          `Build ${data.buildId?.slice(0, 8) || ''} is live. Set a public slug to get a public URL.`,
        );
      }
      setPublishError(null);
      // Trigger DeployHistory refresh via onPublished callback.
      onPublished?.();
    } catch (err: any) {
      const msg = err?.message || 'An unexpected error occurred during publish.';
      console.error('Publish failed:', err);
      showToast('Publish failed', msg, 'destructive');
      setPublishError(msg);
    } finally {
      setPublishing(false);
    }
  }, [sandpack.files, onPublished]);

  return (
    <div className="flex h-full flex-row">
      {/* Sidebar */}
      <div
        className={`flex-shrink-0 border-r border-ink-rule bg-paper-bleached transition-all duration-200 ease-in-out ${
          sidebarOpen ? 'w-56' : 'w-10'
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar header with toggle */}
          <div className="flex items-center justify-between border-b border-ink-rule px-2 py-1.5">
            {sidebarOpen && (
              <span className="text-[0.7rem] font-bold uppercase tracking-wider text-ink-stamp">Widgets</span>
            )}
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="rounded p-1 text-ink-soft hover:bg-ink/5 hover:text-ink transition-colors"
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>

          {/* Widget list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sidebarOpen ? (
              /* Expanded: show full labels with descriptions */
              widgets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => injectWidgetAtCursor(w.snippet, w.label)}
                  className="w-full rounded-lg border border-ink-rule bg-white p-2.5 text-left transition-colors hover:border-accent-secondary/40 hover:bg-accent-secondary/5 active:bg-accent-secondary/10 group cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Puzzle className="h-3.5 w-3.5 text-accent-secondary flex-shrink-0" />
                    <span className="text-xs font-semibold text-ink">{w.label}</span>
                  </div>
                  <p className="mt-0.5 text-[0.65rem] leading-snug text-ink-soft">{w.description}</p>
                </button>
              ))
            ) : (
              /* Collapsed: icon-only buttons */
              widgets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => injectWidgetAtCursor(w.snippet, w.label)}
                  className="flex w-full items-center justify-center rounded-lg border border-ink-rule bg-white p-2 text-ink-soft transition-colors hover:border-accent-secondary/40 hover:text-accent-secondary group cursor-pointer"
                  title={w.label}
                >
                  <Puzzle className="h-4 w-4" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main editor area */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <SandpackLayout>
            <SandpackCodeEditor showLineNumbers showInlineErrors showTabs className="min-w-0 flex-1" />
            <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ flex: 1, minWidth: 380 }} />
          </SandpackLayout>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ink-rule bg-paper-bleached px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <SaveStatusIndicator status={publishing ? 'saving' : saveStatus} />
            <Button size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {publishing ? 'Publishing…' : 'Publish'}
            </Button>
            {publishError && (
              <span className="text-xs text-red-600 max-w-md truncate" title={publishError}>
                {publishError}
              </span>
            )}
            {publishUrl && !publishError && (
              <a
                href={publishUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Live at {publishUrl}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Deploy History panel — lists past builds and lets the owner reactivate
 * (rollback) to an earlier one. Reuses the pro-build rollback pattern: old
 * build directories stay on disk, and activating updates active_build_id +
 * published_code_html.
 */
function DeployHistory({ refreshKey, onPublished }: { refreshKey: number; onPublished?: () => void }) {
  const [builds, setBuilds] = useState<Array<{
    buildId: string;
    createdAt: number;
    createdAtIso: string;
    size: number;
    isActive: boolean;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const loadBuilds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/tenant/site/builds');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBuilds(data.builds ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load deploy history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBuilds();
  }, [loadBuilds, refreshKey]);

  const handleActivate = useCallback(async (buildId: string) => {
    setActivatingId(buildId);
    try {
      const res = await authFetch(`/api/tenant/site/builds/${buildId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = body?.error || `Failed to activate build (HTTP ${res.status})`;
        showToast('Reactivation failed', errMsg, 'destructive');
        return;
      }
      showToast(
        'Build reactivated',
        body.publicUrl
          ? `Your live site now serves an earlier build.\n${body.publicUrl}`
          : 'Your live site now serves the earlier build.',
      );
      onPublished?.();
      // Reload builds list to reflect the new active flag.
      loadBuilds();
    } catch (err: any) {
      showToast('Reactivation failed', err?.message || 'Unexpected error.', 'destructive');
    } finally {
      setActivatingId(null);
    }
  }, [loadBuilds, onPublished]);

  if (loading) {
    return (
      <div className="flex-shrink-0 rounded-xl border border-ink-rule bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-ink-soft">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading deploy history…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-shrink-0 rounded-xl border border-ink-rule bg-white px-4 py-2.5">
        <div className="text-xs text-red-600">{error}</div>
      </div>
    );
  }

  if (builds.length === 0) {
    return null; // Don't clutter the UI before the first publish.
  }

  return (
    <div className="flex-shrink-0 rounded-xl border border-ink-rule bg-paper-bleached px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="h-3.5 w-3.5 text-ink-soft" />
        <span className="text-xs font-bold uppercase tracking-wider text-ink-stamp">Deploy History</span>
        <Badge variant="secondary" className="text-[0.6rem] px-1.5 py-0 h-4 leading-none">{builds.length}</Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {builds.map((b) => {
          const date = new Date(b.createdAt);
          const label = date.toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          return (
            <div
              key={b.buildId}
              className={`flex-shrink-0 rounded-lg border px-3 py-2 text-left min-w-[140px] ${
                b.isActive
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-ink-rule bg-white'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                {b.isActive && (
                  <span className="inline-flex items-center gap-0.5 text-[0.6rem] font-semibold text-primary">
                    <Check className="h-3 w-3" /> Active
                  </span>
                )}
                <span className="text-[0.6rem] text-ink-stamp font-mono">
                  {b.buildId.slice(0, 8)}
                </span>
              </div>
              <p className="text-[0.7rem] text-ink-soft mb-1.5">{label}</p>
              {!b.isActive && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[0.65rem] w-full"
                  disabled={activatingId === b.buildId}
                  onClick={() => handleActivate(b.buildId)}
                >
                  {activatingId === b.buildId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                  Reactivate
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DisclaimerModal({
  open,
  to,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  to: BuilderMode | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || !to) return null;
  const isCode = to === 'code';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-lg font-bold text-ink">Switch to {isCode ? 'Code Editor' : 'Visual Editor'}?</h2>
      <p className="mt-2 text-sm text-ink-soft">
          {isCode
            ? 'WARNING: Switching to the Code Editor will overwrite your drag-and-drop progress. Are you sure?'
            : 'WARNING: Switching to Visual Editor will overwrite your custom code. Are you sure?'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm}>
            Yes, switch
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubscribeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent-secondary-deep" />
        <h2 className="text-lg font-bold text-ink">Code Editor & AI are Pro features</h2>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
          Upgrade to the Pro plan to edit your site's raw code, publish custom HTML, and use the AI assistant.
          Your visual editor remains available on every plan.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Not now
          </Button>
          <Button size="sm" onClick={() => (window.location.href = '/dashboard/settings')}>
            Manage plan
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-soft" aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
        <span className="inline-flex items-center gap-1 text-xs text-primary" aria-live="polite">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Saved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600" aria-live="polite">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Save failed
      </span>
    );
  }
  return null;
}

function CenteredNotice({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex h-[calc(100vh-128px)] flex-col items-center justify-center gap-3 rounded-xl border border-ink-rule bg-white p-8 text-center">
      {icon && <div className="text-ink-soft">{icon}</div>}
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {subtitle && <p className="max-w-md text-sm text-ink-soft">{subtitle}</p>}
    </div>
  );
}
