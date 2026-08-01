import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  Trash2,
  Copy,
  Loader2,
  Image as ImageIcon,
  File as FileIcon,
  Check,
} from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { StaffRedirect } from './StaffRedirect';

interface MediaItem {
  id: string;
  tenantId?: string;
  path: string; // e.g. /uploads/<tenantId>/<file>
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: number;
}

type IngestionStatus = 'pending' | 'success' | 'error';

interface IngestionEntry {
  id: string;
  file: File;
  status: IngestionStatus;
  error?: string;
}

function isImage(mime: string): boolean {
  return mime?.startsWith('image/') ?? false;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function absoluteUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function MediaLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<IngestionEntry[]>([]);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/tenant/media');
      if (!res.ok) throw new Error('Failed to load media');
      const data = (await res.json()) as MediaItem[];
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load media');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const openFilePicker = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const uploadOne = async (file: File): Promise<MediaItem | null> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await authFetch('/api/tenant/upload', {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      let detail = `Upload failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) detail = body.error;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return (await res.json()) as MediaItem;
  };

  const onFilesPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const entries: IngestionEntry[] = Array.from(files).map((f: File, idx: number) => ({
      id: `${Date.now()}-${idx}-${f.name}`,
      file: f,
      status: 'pending',
    }));
    setUploadQueue(entries);
    setUploadError(null);
    setUploading(true);

    let firstError: string | null = null;

    for (const entry of entries) {
      try {
        await uploadOne(entry.file);
        setUploadQueue(prev =>
          prev.map(e => (e.id === entry.id ? { ...e, status: 'success' } : e)),
        );
      } catch (err: any) {
        const detail = err?.message || 'Upload failed';
        firstError = firstError ?? detail;
        setUploadQueue(prev =>
          prev.map(e =>
            e.id === entry.id ? { ...e, status: 'error', error: detail } : e,
          ),
        );
      }
    }

    setUploading(false);

    // Clear out successfully uploaded entries after a short delay so the
    // user sees the success state in the queue panel before it disappears.
    setTimeout(() => {
      setUploadQueue(prev => prev.filter(e => e.status !== 'success'));
    }, 1500);

    await fetchMedia();

    if (firstError) {
      setUploadError(firstError);
      showToast('Some uploads failed', firstError, 'destructive');
    } else if (entries.length > 0) {
      showToast('Upload complete', `${entries.length} file${entries.length === 1 ? '' : 's'} uploaded.`);
    }

    // Reset the input so the same file can be re-selected after a failure.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await authFetch(`/api/tenant/media/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete media');
      }
      setDeleteTarget(null);
      await fetchMedia();
      showToast('Media deleted', 'The file was removed.');
    } catch (e: any) {
      setDeleteError(e?.message || 'Something went wrong');
      showToast('Failed to delete media', e?.message || 'Please try again.', 'destructive');
    } finally {
      setDeleting(false);
    }
  };

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [items],
  );

  const handleCopy = async (item: MediaItem) => {
    const url = absoluteUrl(item.path);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedId(item.id);
      setTimeout(() => {
        setCopiedId(prev => (prev === item.id ? null : prev));
      }, 1500);
    } catch {
      // Non-fatal: just don't show the copied state.
    }
  };

  return (
    <StaffRedirect>
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Media Library</h2>
          <p className="text-sm text-gray-500">
            Upload images to use across your website, services, and staff profiles.
         </p>
       </div>
        <Button onClick={openFilePicker} disabled={uploading}>
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload Media
       </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={onFilesPicked}
        />
     </div>

      {uploadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {uploadError}
       </div>
      )}

      {uploadQueue.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Upload progress
         </p>
          <ul className="space-y-1.5">
            {uploadQueue.map(entry => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="truncate text-gray-700" title={entry.file.name}>
                  {entry.file.name}
               </span>
                <span className="shrink-0">
                  {entry.status === 'pending' && (
                    <Badge variant="secondary">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Uploading
                   </Badge>
                  )}
                  {entry.status === 'success' && (
                    <Badge variant="success">Done</Badge>
                  )}
                  {entry.status === 'error' && (
                    <Badge variant="destructive" title={entry.error}>
                      Failed
                   </Badge>
                  )}
               </span>
             </li>
            ))}
         </ul>
       </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading media…
         </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">{error}</div>
        ) : sortedItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <ImageIcon className="h-6 w-6 text-gray-400" />
           </div>
            <p className="font-medium text-gray-900">No media uploaded</p>
            <p className="text-sm text-gray-500 mt-1">
              Upload your first image to get started — logos, staff photos,
              service banners, and more.
           </p>
            <Button className="mt-4" onClick={openFilePicker} disabled={uploading}>
              <Upload className="h-4 w-4" />
              Upload Media
           </Button>
         </div>
        ) : (
          <ul
            role="list"
            className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
          >
            {sortedItems.map(item => (
              <MediaCard
                key={item.id}
                item={item}
                copied={copiedId === item.id}
                onCopy={() => handleCopy(item)}
                onDelete={() => {
                  setDeleteError(null);
                  setDeleteTarget(item);
                }}
              />
            ))}
         </ul>
        )}
     </div>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={o => !deleting && !o && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete media</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-gray-900">
                {deleteTarget?.originalName}
             </span>
              ? The file will be removed from storage and unlinked from any pages
              that reference it. This action cannot be undone.
           </DialogDescription>
         </DialogHeader>
          {deleteError && (
            <p className="text-sm text-red-600">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
           </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
           </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </StaffRedirect>
  );
}

interface MediaCardProps {
  // React reserves `key` for reconciliation; declared here to satisfy the
  // type-checker in some React JSX configurations.
  key?: React.Key;
  item: MediaItem;
  copied: boolean;
  onCopy: () => void;
  onDelete: () => void;
}

function MediaCard({ item, copied, onCopy, onDelete }: MediaCardProps) {
  const image = isImage(item.mimeType);
  const url = absoluteUrl(item.path);
  return (
    <li className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
        {image ? (
          // Native img with object-cover keeps the grid uniform without
          // pre-computed thumbnails on the server.
          <img
            src={item.path}
            alt={item.originalName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileIcon className="h-10 w-10 text-gray-400" />
         </div>
        )}

        <div className="absolute inset-x-2 top-2 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={onCopy}
            aria-label={copied ? 'Copied link' : 'Copy link'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-gray-700 shadow ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
         </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete media"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/90 text-red-600 shadow ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white"
          >
            <Trash2 className="h-4 w-4" />
         </button>
       </div>
     </div>

      <div className="flex flex-col gap-1 p-3">
        <p
          className="truncate text-sm font-medium text-gray-900"
          title={item.originalName}
        >
          {item.originalName}
       </p>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatBytes(item.size)}</span>
          <time dateTime={new Date(item.createdAt).toISOString()}>
            {formatDate(item.createdAt)}
         </time>
       </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-xs text-[#1E3A8A] hover:underline"
          title={url}
        >
          Open file
       </a>
     </div>
   </li>
  );
}

export default MediaLibraryPage;
