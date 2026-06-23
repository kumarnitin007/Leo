/**
 * Vault pagination primitives (client-side only).
 *
 * The vault keeps ALL entry metadata in memory (title/url/tags/category are
 * plaintext), so search, filters and counts stay global. Pagination here is
 * purely a display window — it bounds how many rows/cards hit the DOM at once.
 * Page size is remembered per-device in localStorage.
 */

import React from 'react';

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const PAGE_SIZE_KEY = 'myday_safe_page_size';

/** Default page size: denser on mobile to reduce scrolling, lighter on desktop. */
export function getStoredPageSize(isMobile: boolean): number {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (PAGE_SIZE_OPTIONS.includes(n)) return n;
  } catch { /* ignore */ }
  return isMobile ? 50 : 20;
}

export function storePageSize(size: number): void {
  try { localStorage.setItem(PAGE_SIZE_KEY, String(size)); } catch { /* ignore */ }
}

export const PageSizeSelect: React.FC<{
  value: number;
  onChange: (size: number) => void;
}> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={e => onChange(parseInt(e.target.value, 10))}
    title="Entries per page"
    style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white' }}
  >
    {PAGE_SIZE_OPTIONS.map(n => (
      <option key={n} value={n}>{n} / page</option>
    ))}
  </select>
);

/** Compact windowed page list: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('gap');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push('gap');
  pages.push(total);
  return pages;
}

const btnBase: React.CSSProperties = {
  minWidth: 34, height: 34, padding: '0 0.5rem',
  border: '1px solid var(--ck-border2, #d1d5db)', borderRadius: '0.5rem',
  background: 'white', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--ck-ink, #374151)',
};

export const PaginationNav: React.FC<{
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (p: number) => void;
}> = ({ page, pageSize, totalItems, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
      gap: '0.5rem', marginTop: '1rem',
    }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--ck-ink2, #6b7280)' }}>
        Showing {from}–{to} of {totalItems}
      </span>

      {totalPages > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
          <button
            style={{ ...btnBase, opacity: page === 1 ? 0.45 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >‹</button>

          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap'
              ? <span key={`gap-${i}`} style={{ padding: '0 0.25rem', color: 'var(--ck-ink3, #9ca3af)' }}>…</span>
              : (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  style={{
                    ...btnBase,
                    background: p === page ? 'var(--ck-purple, #6b5de8)' : 'white',
                    color: p === page ? 'white' : 'var(--ck-ink, #374151)',
                    borderColor: p === page ? 'var(--ck-purple, #6b5de8)' : 'var(--ck-border2, #d1d5db)',
                    fontWeight: p === page ? 700 : 400,
                  }}
                >{p}</button>
              ),
          )}

          <button
            style={{ ...btnBase, opacity: page === totalPages ? 0.45 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >›</button>
        </div>
      )}
    </div>
  );
};
