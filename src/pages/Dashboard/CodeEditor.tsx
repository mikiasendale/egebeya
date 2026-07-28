import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackLayout,
  SandpackFileExplorer,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { Save, Rocket, Sparkles, Send, Code2, Loader2 } from 'lucide-react';
import { authFetch } from '../../lib/api';
import {
  fetchSubscription,
  isProActive,
  type SubscriptionSummary,
} from '../../lib/subscription';
import { showToast } from '../../components/ui/toast-helper';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { StaffRedirect } from './StaffRedirect';

// Files we hide from the visible tab strip even though they live in the
// Sandpack bundle. /public/index.html is required by the CRA template but
// not interesting for the user to edit here.
const HIDDEN_FILES = new Set(['/public/index.html']);

// Names of the files the user is allowed to flip open in the editor. Keeping
// this constrained avoids exposing Sandpack's internal template-only files.
const EDITABLE_FILES = new Set([
  '/App.js',
  '/index.js',
  '/styles.css',
  '/package.json',
  '/public/index.html',
]);

type FileMap = Record<string, string>;

/**
 * Convert a pro_site_files path (no leading slash, e.g. "App.js" or
 * "public/index.html") to Sandpack's leading-slash path scheme.
 */
function toSandpackPath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`;
}

/**
 * Strip Sandpack's leading slash so we round-trip back to the on-disk scheme
 * the API stores in pro_site_files.
 */
function fromSandpackPath(p: string): string {
  return p.startsWith('/') ? p.slice(1) : p;
}

/**
 * Normalise the { path: content } map returned by the API into Sandpack's
 * `files` prop shape (path → string). Sandpack accepts plain strings as well
 * as { code, hidden } objects; we only mark /public/index.html as hidden so
 * it doesn't clutter the tab strip.
 */
function toSandpackFiles(map: FileMap): Record<string, string | { code: string; hidden?: boolean; active?: boolean }> {
  const out: Record<string, string | { code: string; hidden?: boolean; active?: boolean }> = {};
  for (const [path, code] of Object.entries(map)) {
    const sp = toSandpackPath(path);
    if (HIDDEN_FILES.has(sp)) {
      out[sp] = { code, hidden: true };
    } else if (sp === '/App.js') {
      // Pre-select the hero section file as the active tab so the editor
      // opens with something meaningful rather than package.json.
      out[sp] = { code, active: true };
    } else {
      out[sp] = code;
    }
  }
  return out;
}

export function CodeEditor() {
  return (
    <StaffRedirect>
      <CodeEditorInner />
    </StaffRedirect>
  );
}

function CodeEditorInner() {
  const [planState, setPlanState] = useState<{
    loading: boolean;
    isPro: boolean;
    summary: SubscriptionSummary | null;
  }>({
    loading: true,
    isPro: false,
    summary: null,
  });
  const [files, setFiles] = useState<FileMap | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  // 1) Resolve the tenant's subscription first — only Pro (active or trial
  //    within window) may enter the editor. This mirrors the server-side
  //    gate in `requireProPlan` so a Free tier user sees the upgrade screen
  //    before we even try to fetch their files (which the server would 403).
  useEffect(() => {
    let cancelled = false;
    fetchSubscription()
      .then((summary) => {
        if (cancelled) return;
        setPlanState({ loading: false, isPro: isProActive(summary), summary });
      })
      .catch(() => {
        if (cancelled) return;
        setPlanState({ loading: false, isPro: false, summary: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Fetch files (only if Pro). If the response is empty `{}` it means the
  //    tenant has not been seeded yet — call /init once, then re-fetch.
  const loadFiles = useCallback(async (): Promise<FileMap> => {
    const res = await authFetch('/api/tenant/pro-site/files');
    if (!res.ok) throw new Error(`Failed to load files (${res.status})`);
    let map = (await res.json()) as FileMap;
    if (!map || Object.keys(map).length === 0) {
      const initRes = await authFetch('/api/tenant/pro-site/init', { method: 'POST' });
      if (!initRes.ok) throw new Error(`Failed to seed (${initRes.status})`);
      map = {};
      // Re-fetch the freshly seeded files. (We could read the seeded count
      // from the init response, but a clean re-fetch is more robust and
      // avoids a small race where the seed inserts have not committed yet.)
      const refetch = await authFetch('/api/tenant/pro-site/files');
      if (refetch.ok) map = (await refetch.json()) as FileMap;
    }
    return map || {};
  }, []);

  useEffect(() => {
    if (planState.loading || planState.isPro === false) return;
    let cancelled = false;
    setBooting(true);
    setBootError(null);
    loadFiles()
      .then((map) => {
        if (cancelled) return;
        setFiles(map);
      })
      .catch((err: any) => {
        if (cancelled) return;
        console.error('CodeEditor boot error:', err);
        setBootError(err?.message || 'Failed to load your code editor. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planState, loadFiles]);

  if (planState.loading) {
    return (
      <CenteredNotice icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Checking your plan…" />
    );
  }
  if (planState.isPro === false) {
    return (
      <ProGate />
    );
  }
  if (bootError) {
    return <CenteredNotice title="Something went wrong" subtitle={bootError} />;
  }
  if (booting || !files) {
    return <CenteredNotice icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Loading your project…" />;
  }

  // Once we have files, hand off to the Sandpack-mounted sub-tree. The
  // provider owns the live editor state; SaveAndAIBar (a descendant of the
  // provider) reads `useSandpack()` on every Save click to pull the current
  // bundle and PUT it back to /api/tenant/pro-site/files.
  return (
    <div className="flex h-[calc(100vh-128px)] flex-col gap-3">
      <SandpackToolbar files={files} />
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200">
        <SandpackProvider
          template="react"
          files={toSandpackFiles(files)}
          theme="light"
          options={{
            recompileMode: 'immediate',
            recompileDelay: 300,
            classes: { 'sp-wrapper': 'custom-sandpack' },
          }}
          style={{ height: '100%' }}
        >
          <SandpackInner />
        </SandpackProvider>
      </div>
    </div>
  );
}

/**
 * Storage limits surfaced to the editor UI. The server enforces the
 * canonical values (see src/api/pro-site.ts). We mirror them here as
 * informational copy; if these drift the server remains authoritative.
 */
const STORAGE_MAX_FILE_MB = 1;
const STORAGE_MAX_TENANT_MB = 10;

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * Top toolbar: page title, file count, byte usage vs the per-tenant cap, and
 * the disabled Publish button. The live Save button lives in the bottom bar
 * (SaveAndAIBar) because it needs to be a descendant of <SandpackProvider>
 * to reach the useSandpack() hook.
 *
 * Showing byte usage proactively prevents surprises when saving: a user can
 * see they're at 9.5MB / 10MB before clicking Save and getting an opaque
 * 413 rejection.
 */
function SandpackToolbar({ files }: { files: FileMap }) {
  const fileCount = useMemo(() => Object.keys(files).length, [files]);
  const totalBytes = useMemo(
    () =>
      Object.values(files).reduce(
        (sum, content) => sum + Buffer.byteLength(content ?? '', 'utf8'),
        0,
      ),
    [files],
  );
  const usagePct = Math.min(
    100,
    Math.round(
      (totalBytes / 1024 / 1024 / STORAGE_MAX_TENANT_MB) * 100,
    ),
  );
  const nearLimit = usagePct >= 80;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-[#1E3A8A]">
          <Code2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Code Editor</h1>
          <p className="text-xs text-gray-500">
            {fileCount} files &middot; changes preview live as you type
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={
            'rounded-md border px-2.5 py-1 text-xs ' +
            (nearLimit
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-gray-200 bg-gray-50 text-gray-700')
          }
          title={`Per-file cap: ${STORAGE_MAX_FILE_MB}MB. Per-tenant cap: ${STORAGE_MAX_TENANT_MB}MB.`}
        >
          Storage: <span className="font-semibold">{formatMb(totalBytes)}</span>{' '}
          / {STORAGE_MAX_TENANT_MB}MB
        </div>
        <PublishButton />
      </div>
    </div>
  );
}

/**
 * The live editor (file explorer + CodeMirror editor + bundler preview) plus
 * a save/AI bar at the bottom. This component is rendered inside
 * <SandpackProvider>, so the save bar can pull `useSandpack()` to read the
 * current bundle state on every Save click.
 */
function SandpackInner() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <SandpackLayout>
          <SandpackFileExplorer />
          <SandpackCodeEditor showLineNumbers showInlineErrors showTabs closableTabs />
          <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ flex: 1, minWidth: 320 }} />
        </SandpackLayout>
      </div>
      <SaveAndAIBar />
    </div>
  );
}

/**
 * Build a stable, deterministic snapshot string of the editable files map we
 * persist. Used to decide whether the current editor contents differ from
 * what was last successfully saved — driving both the leave-site guard and
 * the autosave trigger. JSON-stringify with sorted file keys so reordering
 * the file explorer doesn't make us think the content changed.
 */
function snapshotEditableFiles(
  files: FileMap | Record<string, { code?: string } | string>,
  editable: Set<string>,
): string {
  const normalized: FileMap = {};
  for (const [path, file] of Object.entries(files)) {
    if (!editable.has(path)) continue;
    const code = typeof file === 'string' ? file : (file as any)?.code ?? '';
    normalized[path] = code;
  }
  const sortedKeys = Object.keys(normalized).sort();
  return JSON.stringify(normalized, sortedKeys);
}

// How long after the last keystroke we wait before issuing an autosave.
const AUTOSAVE_DEBOUNCE_MS = 7000;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Bottom bar (inside the SandpackProvider subtree so Save can read files
 * live from the context). Hosts the Save button, the save-status indicator,
 * the disabled Publish button, and the AI Assistant collapsible panel.
 *
 * Also wires up:
 *  - hasUnsavedChanges tracking (current bundle != last successfully saved
 *    snapshot), surfaced via a dedicated state and consumed by the
 *    beforeunload guard below.
 *  - A `beforeunload` listener that triggers the browser's native "leave
 *    site?" prompt iff there are unsaved changes. Mounted/unmounted with the
 *    boolean so it never fires when the editor is clean.
 *  - Debounced autosave (AUTOSAVE_DEBOUNCE_MS after the user stops typing)
 *    against the same PUT endpoint the manual Save button uses. Autosave
 *    runs silently (no toast); a small inline indicator near the Save
 *    button surfaces Saving/Saved/Error instead. On autosave failure we keep
 *    hasUnsavedChanges true so the leave guard stays armed.
 */
function SaveAndAIBar() {
  const { sandpack } = useSandpack();
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Last snapshot we successfully persisted; used to detect unsaved work by
  // diffing against the live bundle. Initialized to whatever was loaded by
  // the provider so we don't fire a spurious "unsaved" state on first paint.
  const lastSavedSnapshotRef = useRef<string>('');
  const didInitRef = useRef(false);

  const currentSnapshot = useMemo(
    () => snapshotEditableFiles(sandpack.files, EDITABLE_FILES),
    [sandpack.files],
  );

  // Initialize the saved snapshot on first mount so the initial load doesn't
  // count as "unsaved changes". Subsequent re-renders diff against whatever
  // was last successfully persisted.
  if (!didInitRef.current) {
    lastSavedSnapshotRef.current = currentSnapshot;
    didInitRef.current = true;
  }

  // Drive `hasUnsavedChanges` from the snapshot diff. Determined string
  // comparison so whitespace-only tweaks still count as a real change.
  useEffect(() => {
    setHasUnsavedChanges(currentSnapshot !== lastSavedSnapshotRef.current);
  }, [currentSnapshot]);

  // Put a fresh snapshot in scope of the autosave / save callbacks so the
  // debounce (which has no deps on `currentSnapshot`) always persists the
  // latest content, not a stale closure.
  const currentSnapshotRef = useRef(currentSnapshot);
  currentSnapshotRef.current = currentSnapshot;

  /**
   * Persist the current Sandpack bundle to the Save endpoint. Returns true
   * on success, false on failure. On success it advances the saved-snapshot
   * baseline (so hasUnsavedChanges flips back to false). On failure it does
   * NOT touch the baseline — hasUnsavedChanges stays true and the leave
   * guard remains armed, even if the failure came from autosave.
   *
   * @param opts.isAuto When true, errors surface only via the inline status
   *   indicator (no toast) so autosaves stay quiet. Manual save still shows
   *   a toast on both outcomes for explicit user feedback.
   */
  const persist = useCallback(
    async (opts: { isAuto: boolean } = { isAuto: false }): Promise<boolean> => {
      const fileMap: FileMap = {};
      for (const [path, file] of Object.entries(sandpack.files)) {
        if (!EDITABLE_FILES.has(path)) continue;
        fileMap[fromSandpackPath(path)] = (file as any).code ?? '';
      }
      if (Object.keys(fileMap).length === 0) {
        if (!opts.isAuto) {
          showToast('Nothing to save', 'There are no editable files in the project.', 'destructive');
        }
        return false;
      }
      setSaving(true);
      setSaveStatus('saving');
      try {
        const res = await authFetch('/api/tenant/pro-site/files', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fileMap),
        });
        if (!res.ok) {
          let msg = `Save failed (${res.status})`;
          let errorCode: string | undefined;
          try {
            const data = await res.json();
            if (data?.error) msg = data.error;
            if (data?.code) errorCode = data.code;
          } catch {
            // response had no JSON body; keep the generic status message
          }
          // Throw an Error enriched with the HTTP status + server code so
          // downstream branches can pick a precise title without having to
          // re-fetch the response. The message stays verbatim from the API.
          const err: any = new Error(msg);
          err.status = res.status;
          err.code = errorCode;
          throw err;
        }
        // Success: advance the persisted baseline so hasUnsavedChanges drops
        // back to false on the next diff effect run.
        lastSavedSnapshotRef.current = currentSnapshotRef.current;
        setHasUnsavedChanges(false);
        setSaveStatus('saved');
        setAutoSaveError(null);
        if (!opts.isAuto) {
          showToast('Saved', 'Your files are persisted. Reload the page anytime to verify.');
        }
        return true;
      } catch (err: any) {
        setSaveStatus('error');
        const msg = err?.message || 'Please try again.';
        // 413 + code => distinguishes the two storage-cap rejections. The
        // server's `error` field is the human-readable explanation; we wrap
        // it with a clearer title so the user understands what to do next.
        const title =
          err?.status === 413
            ? err?.code === 'FILE_TOO_LARGE'
              ? 'File too large'
              : err?.code === 'STORAGE_LIMIT_EXCEEDED'
                ? 'Project exceeds storage limit'
                : 'Storage limit reached'
            : 'Failed to save';
        if (opts.isAuto) {
          // Keep noise low for autosave: hang on to the error so it can be
          // surfaced inline, and deliberately leave hasUnsavedChanges true.
          setAutoSaveError(msg);
        } else if (fileMap && Object.keys(fileMap).length > 0) {
          showToast(title, msg, 'destructive');
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [sandpack.files],
  );

  // *Manual* Save button handler — always toasty feedback, both outcomes.
  const handleSave = useCallback(() => void persist({ isAuto: false }), [persist]);

  // beforeunload guard: arm only when there are unsaved changes so a clean
  // editor doesn't prompt on close. We attach/detach via this effect keyed
  // on hasUnsavedChanges to avoid keeping a no-op listener mounted while
  // the editor is clean (which would fire unnecessarily or trip lint).
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Setting returnValue to any non-empty string is what actually triggers
      // the browser's native "leave site?" confirmation. The string itself
      // is no longer shown by modern browsers (a fixed prompt is used), but
      // a non-empty value is still required.
      e.preventDefault();
      e.returnValue = 'You have unsaved changes that will be lost.';
      return 'You have unsaved changes that will be lost.';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedChanges]);

  // Autosave debounce: each time the live bundle changes and it differs from
  // the last saved snapshot, (re)start a timer. When it fires with the
  // bundle still dirty, persist silently. Reset the 'saved' inline status
  // back to 'idle' the moment a new edit lands so the indicator doesn't
  // claim "Saved" over a freshly-dirty buffer.
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasUnsavedChanges) {
      // Clean state — cancel any pending autosave and clear the timer.
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      return;
    }
    // Fresh edits: drop a stale "Saved" badge back to idle while we wait for
    // the next autosave to complete.
    if (saveStatus === 'saved') setSaveStatus('idle');
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void persist({ isAuto: true });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [hasUnsavedChanges, currentSnapshot, saveStatus, persist]);

  return (
    <div className="flex flex-col border-t border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving} size="sm" variant="default">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <SaveStatusIndicator status={saveStatus} error={autoSaveError} />
          <PublishButton />
        </div>
        <button
          type="button"
          onClick={() => setAiOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          aria-expanded={aiOpen}
        >
          <Sparkles className="h-4 w-4 text-[#1E3A8A]" />
          AI Assistant
        </button>
      </div>
      {aiOpen && <AIPanel />}
    </div>
  );
}

/**
 * Small, unobtrusive status chip shown inline next to the Save button. We
 * deliberately use this — not a toast — for autosave feedback so the UI
 * doesn't get noisy as the debounce fires every few seconds.
 */
function SaveStatusIndicator({
  status,
  error,
}: {
  status: SaveStatus;
  error: string | null;
}) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-500" aria-live="polite">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600" aria-live="polite">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Saved
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-red-600"
        title={error || 'Autosave failed — your changes are still unsaved.'}
        aria-live="polite"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {error ? 'Autosave failed' : 'Save failed'}
      </span>
    );
  }
  return null;
}


function PublishButton() {
  return (
    <span title="Coming soon" className="inline-flex">
      <Button disabled size="sm" variant="outline" className="cursor-not-allowed">
        <Rocket className="h-4 w-4" />
        Publish
      </Button>
    </span>
  );
}

/**
 * UI-only stub for the AI assistant. No backend, no API key, no Claude. The
 * Send button is always disabled; submitting (e.g. via Enter, which the
 * input swallows to avoid an accidental submit) shows a "coming soon" toast.
 */
function AIPanel() {
  const [text, setText] = useState('');
  return (
    <div className="border-t border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-amber-700 bg-amber-100">
            Coming soon
          </Badge>
          <span className="text-sm font-medium text-gray-700">AI Assistant</span>
        </div>
      </div>
      <p className="mb-3 text-sm text-gray-600">
        AI-powered editing is coming soon. For now, edit your code directly in the editor.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              setText('');
              showToast('AI assistant coming soon.');
            }
          }}
          placeholder="Describe a change you'd like to make…"
          className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30"
          aria-label="AI assistant prompt"
        />
        <Button disabled size="sm" variant="default">
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </div>
  );
}

function CenteredNotice({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex h-[calc(100vh-128px)] flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-center">
      {icon && <div className="text-gray-500">{icon}</div>}
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="max-w-md text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}

function ProGate() {
  return (
    <div className="flex h-[calc(100vh-128px)] flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white p-8 text-center">
      <Sparkles className="h-8 w-8 text-[#1E3A8A]" />
      <h2 className="text-lg font-bold text-gray-900">Code Editor is a Pro feature</h2>
      <p className="max-w-md text-sm text-gray-500">
        Upgrade to the Pro plan to edit your business site's raw code with a live preview. Your site's
        visual editor remains available on every plan.
      </p>
      <Button asChild variant="default" className="mt-2">
        <a href="/dashboard/settings">Manage plan</a>
      </Button>
    </div>
  );
}
