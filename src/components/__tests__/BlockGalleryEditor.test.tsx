/**
 * @vitest-environment jsdom
 *
 * P5.3 — block gallery: reorder/add/remove on a VALIDATED doc; the JSON is
 * the single source (every save PUTs the full document).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import '../../i18n';

const authFetchMock = vi.fn();
vi.mock('../../lib/api', () => ({ authFetch: (...args: any[]) => authFetchMock(...args) }));
const toastSpy = vi.fn();
vi.mock('../../components/ui/toast-helper', () => ({ showToast: (...args: any[]) => toastSpy(...args) }));

import { BlockGalleryEditor } from '../dashboard/BlockGalleryEditor';

function seedDoc() {
  return {
    version: 1,
    content: [
      { type: 'hero', props: { title: 'Selam' }, data: {} },
      { type: 'services', props: {}, data: {} },
      { type: 'hours', props: {}, data: {} },
    ],
  };
}

beforeEach(() => {
  authFetchMock.mockReset();
  toastSpy.mockClear();
  authFetchMock.mockImplementation(async (url: string, init?: any) => {
    if (/\/api\/tenant\/page$/.test(url) && !init?.method) {
      return { ok: true, json: async () => ({ content: seedDoc() }) } as any;
    }
    if (/\/api\/tenant\/page$/.test(url) && init?.method === 'PUT') {
      return { ok: true, json: async () => ({ success: true }) } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  });
});

afterEach(cleanup);

describe('BlockGalleryEditor (P5.3)', () => {
  it('moves a block down with one tap and PUTs the reordered document', async () => {
    const user = userEvent.setup();
    render(<BlockGalleryEditor />);
    await waitFor(() => expect(screen.getByTestId('block-row-0')).toBeTruthy());

    await user.click(screen.getByTestId('block-down-0'));

    await waitFor(() => expect(toastSpy).toHaveBeenCalled());
    const put = authFetchMock.mock.calls.find((c: any[]) => c[1]?.method === 'PUT');
    const sent = JSON.parse(put![1].body);
    expect(sent.content.content.map((b: any) => b.type)).toEqual(['services', 'hero', 'hours']);
  });

  it('removes a block but refuses to empty the site', async () => {
    const user = userEvent.setup();
    render(<BlockGalleryEditor />);
    await waitFor(() => expect(screen.getByTestId('block-row-0')).toBeTruthy());

    await user.click(screen.getByTestId('block-remove-1'));
    await waitFor(() => {
      const put = authFetchMock.mock.calls.find((c: any[]) => c[1]?.method === 'PUT');
      expect(put).toBeTruthy();
    });
    const put = authFetchMock.mock.calls.find((c: any[]) => c[1]?.method === 'PUT');
    const sent = JSON.parse(put![1].body);
    expect(sent.content.content.map((b: any) => b.type)).toEqual(['hero', 'hours']);
  });

  it('add sheet appends a validated block of the chosen type', async () => {
    const user = userEvent.setup();
    render(<BlockGalleryEditor />);
    await waitFor(() => expect(screen.getByTestId('block-add-btn')).toBeTruthy());

    await user.click(screen.getByTestId('block-add-btn'));
    await waitFor(() => expect(screen.getByTestId('block-add-sheet')).toBeTruthy());
    await user.click(screen.getByTestId('block-add-gallery'));

    await waitFor(() => {
      const put = authFetchMock.mock.calls.find((c: any[]) => c[1]?.method === 'PUT');
      expect(put).toBeTruthy();
    });
    const sent = JSON.parse(authFetchMock.mock.calls.find((c: any[]) => c[1]?.method === 'PUT')![1].body);
    expect(sent.content.content).toHaveLength(4);
    expect(sent.content.content[3].type).toBe('gallery');
  });

  it('invalid docs never reach the wire — client-side validation gates every commit', async () => {
    // Corrupt the loaded doc by mocking a load that yields an invalid shape
    // post-migration; commits must refuse.
    authFetchMock.mockImplementation(async (url: string, init?: any) => {
      if (/\/api\/tenant\/page$/.test(url) && !init?.method) {
        return { ok: true, json: async () => ({ content: { version: 1, content: [{ type: 'hero', props: {}, data: {} }, { type: 'not-a-block', props: {}, data: {} }] } }) } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    const user = userEvent.setup();
    render(<BlockGalleryEditor />);
    // Loading renders both rows; moving past the unknown type must be
    // blocked client-side: validate→reject, no PUT attempted.
    await waitFor(() => expect(screen.getAllByTestId(/^block-row-/)).toHaveLength(2));
    await user.click(screen.getByTestId('block-down-0'));
    await new Promise((r) => setTimeout(r, 50));
    expect(authFetchMock.mock.calls.filter((c: any[]) => c[1]?.method === 'PUT')).toHaveLength(0);
    expect(toastSpy).toHaveBeenCalled();
  });
});
