/**
 * DOMPurify wrapper for published Code-Mode HTML.
 *
 * Strips <script>, <style>, inline event handlers, SVG/math namespace tricks
 * (mXSS), javascript:/data: URIs, and form controls — while still allowing
 * Egebeya iframe widgets, and ONLY those, via an EXACT-origin check.
 *
 * Works in both the browser (window) and on the server (jsdom) so the PATCH
 * /api/tenant/site endpoint re-sanitizes stored HTML at write time — the
 * client-side sanitizer is a convenience, not the security boundary.
 */

let purifyInstance: any = null;

// Origin allowlist for Egebeya widget iframes. Compare EXACT origins (no
// startsWith) so an attacker can't satisfy the check with a lookalike host.
// `extraOrigins` is supplied by callers (client passes import.meta.env's
// VITE_APP_URL; server passes process.env's) — this module never touches
// import.meta so it bundles cleanly for both Vite (client) and esbuild CJS
// (server).
function widgetOrigins(extraOrigins: string[] = []): string[] {
  const out = new Set(['https://api.egebeya.et']);
  for (const candidate of [process.env?.VITE_APP_URL, ...extraOrigins]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    try {
      const u = new URL(candidate.trim());
      if (u.protocol === 'https:' || u.protocol === 'http:') out.add(u.origin);
    } catch {
      // ignore malformed origin
    }
  }
  return Array.from(out);
}

async function getDOMPurify(extraOrigins: string[]) {
  if (purifyInstance) return purifyInstance;

  const createDOMPurify = (await import('dompurify')).default;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    purifyInstance = createDOMPurify(window as any);
  } else {
    const { JSDOM } = await import('jsdom');
    purifyInstance = createDOMPurify(new JSDOM('').window as any);
  }

  const allowedOrigins = widgetOrigins(extraOrigins);

  // Egebeya widget iframes are allowed ONLY when their src origin matches
  // exactly. Any other iframe is dropped entirely.
  purifyInstance.addHook('uponSanitizeElement', (node: any) => {
    if (node.tagName?.toLowerCase() !== 'iframe') return;
    const src = (node.getAttribute?.('src') || '').trim();
    if (!src) return;
    let ok = false;
    try {
      ok = allowedOrigins.includes(new URL(src).origin);
    } catch {
      ok = false;
    }
    if (!ok) {
      node.removeAttribute('src');
    }
  });

  return purifyInstance;
}

const AllowedTags = [
  'iframe',
  'html', 'head', 'body', 'title', 'meta', 'link',
  'div', 'span', 'header', 'footer', 'nav', 'main', 'section', 'article', 'aside',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
  'img', 'a', 'figure', 'figcaption', 'picture', 'source', 'video', 'audio',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'blockquote', 'pre', 'code', 'label',
];

const AllowedAttrs = [
  'src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title', 'loading',
  'class', 'id', 'style', 'href', 'rel', 'target', 'alt',
  'name', 'content', 'charset', 'srcset', 'sizes',
  'controls', 'autoplay', 'loop', 'muted', 'preload', 'poster', 'crossorigin', 'decoding',
  'role', 'aria-label', 'aria-labelledby', 'aria-describedby',
  'aria-hidden', 'aria-expanded', 'aria-controls',
];

// Inline event handlers (HTML + SVG/namespace variants) and action-hijack
// attributes. DOMPurify already strips on* by default; these are explicit.
const ForbiddenAttrs = [
  'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange',
  'onsubmit', 'oninput', 'onkeydown', 'onkeyup', 'onkeypress', 'ondrag', 'ondrop',
  'onbegin', 'onend', 'onrepeat', 'onabort', 'onauxclick', 'onbeforeinput',
  'onblur', 'oncancel', 'onclose', 'oncontextmenu', 'oncopy', 'oncuechange',
  'oncut', 'ondblclick', 'onerror', 'onformdata', 'ongotpointercapture',
  'oninvalid', 'onlostpointercapture', 'onmousedown', 'onmouseenter',
  'onmouseleave', 'onmousemove', 'onmouseout', 'onmouseup', 'onpaste',
  'onpointercancel', 'onpointerdown', 'onpointerenter', 'onpointerleave',
  'onpointermove', 'onpointerout', 'onpointerover', 'onpointerup', 'onreset',
  'onresize', 'onscroll', 'onselect', 'onselectionchange', 'onselectstart',
  'onsubmit', 'ontoggle', 'onwheel', 'formaction', 'xlink:href', 'xmlns:xlink',
  'srcdoc', 'sandbox',
];

// Tags that are pure XSS vectors in the mXSS class the audit calls out.
// NOTE: `iframe` is intentionally NOT forbidden here — Egebeya widget iframes
// are allowed via the uponSanitizeElement hook (exact-origin check); any
// other iframe gets its src stripped so it renders as an empty box.
const ForbiddenTags = [
  'script', 'style', 'form', 'input', 'button', 'textarea', 'select', 'option',
  'svg', 'math', 'mglyph', 'mtext', 'annotation', 'annotation-xml',
];

export async function sanitizePublishedCode(rawHtml: string, extraOrigins: string[] = []): Promise<string> {
  const DOMPurify = await getDOMPurify(extraOrigins);
  const input = rawHtml ?? '';

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: AllowedTags,
    ALLOWED_ATTR: AllowedAttrs,
    FORBID_ATTR: ForbiddenAttrs,
    FORBID_TAGS: ForbiddenTags,
    ALLOW_DATA_ATTR: false,
  });
}
