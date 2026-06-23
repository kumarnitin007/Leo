/**
 * SafeDocumentRow - dense single-row presentation of a vault document for the
 * Documents "List" view (mirrors SafeEntryRow for passwords).
 *
 * File references are encrypted; "open" decrypts on demand via the parent.
 */

import React, { memo } from 'react';
import { DocumentVault, DocumentProvider, DocumentType } from '../../types';

// Shared column template so the header and every row stay aligned.
export const LIST_GRID_DOC = '2fr 1fr 1.2fr 1fr 110px 74px';

const providerInfo: Record<DocumentProvider, { icon: string; name: string }> = {
  google: { icon: '🔵', name: 'Google Drive' },
  onedrive: { icon: '☁️', name: 'OneDrive' },
  dropbox: { icon: '📦', name: 'Dropbox' },
};

const documentTypeLabels: Record<DocumentType, string> = {
  invoice: 'Invoice', contract: 'Contract', identity: 'Identity', insurance: 'Insurance',
  medical: 'Medical', tax: 'Tax', warranty: 'Warranty', license: 'License', other: 'Other',
};

function expiryState(expiryDate?: string): 'expired' | 'soon' | 'ok' | 'none' {
  if (!expiryDate) return 'none';
  const today = new Date();
  const expiry = new Date(expiryDate);
  if (expiry < today) return 'expired';
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  return days <= 30 ? 'soon' : 'ok';
}

interface SafeDocumentRowProps {
  doc: DocumentVault;
  commentCount: number;
  onEdit: (doc: DocumentVault) => void;
  onShare?: (doc: DocumentVault) => void;
  onToggleFavorite: (doc: DocumentVault) => void;
  onOpenFile: (doc: DocumentVault) => void;
  style?: React.CSSProperties;
}

const cellBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '0.15rem', fontSize: '0.85rem', lineHeight: 1, opacity: 0.6,
};

const SafeDocumentRow = memo(function SafeDocumentRow({
  doc,
  commentCount,
  onEdit,
  onShare,
  onToggleFavorite,
  onOpenFile,
}: SafeDocumentRowProps) {
  const isShared = (doc as any).isShared;
  const sharedBy = (doc as any).sharedBy;
  const exp = expiryState(doc.expiryDate);
  const expColor = exp === 'expired' ? 'var(--ck-red, #c94a2e)' : exp === 'soon' ? '#b8860b' : 'var(--ck-ink3)';

  return (
    <div
      onClick={() => onEdit(doc)}
      style={{
        display: 'grid',
        gridTemplateColumns: LIST_GRID_DOC,
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0 0.75rem',
        height: '100%',
        cursor: 'pointer',
        borderBottom: '0.5px solid var(--ck-border2)',
        background: 'transparent',
        fontSize: '0.85rem',
        color: 'var(--ck-ink)',
        boxSizing: 'border-box',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--ck-cream)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Title + favorite + icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        {isShared ? (
          doc.isFavorite ? <span title="Favorite" style={{ fontSize: '0.85rem' }}>⭐</span> : <span style={{ width: '1rem' }} />
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onToggleFavorite(doc); }}
            title={doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={!!doc.isFavorite}
            style={{ ...cellBtn, fontSize: '0.95rem', opacity: doc.isFavorite ? 1 : 0.5 }}
          >
            {doc.isFavorite ? '⭐' : '☆'}
          </button>
        )}
        <span style={{ fontSize: '0.95rem', flexShrink: 0 }} title={isShared ? (sharedBy ? `Shared by ${sharedBy}` : 'Shared with others') : undefined}>
          {isShared ? '🔗' : '📄'}
        </span>
        <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {doc.title}
        </span>
        {commentCount > 0 && (
          <span style={{ fontSize: '0.65rem', color: 'var(--ck-purple)' }}>💬{commentCount}</span>
        )}
      </div>

      {/* Type chip */}
      <div style={{ minWidth: 0 }}>
        <span style={{
          display: 'inline-block', maxWidth: '100%',
          padding: '0.15rem 0.55rem', border: '0.5px solid var(--ck-border2)',
          color: 'var(--ck-ink2)', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box',
        }}>
          {documentTypeLabels[doc.documentType]}
        </span>
      </div>

      {/* Provider */}
      <div style={{ minWidth: 0, color: 'var(--ck-ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {providerInfo[doc.provider].icon} {providerInfo[doc.provider].name}
      </div>

      {/* Expiry */}
      <div style={{ minWidth: 0, color: expColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: exp === 'expired' || exp === 'soon' ? 600 : 400 }}>
        {doc.expiryDate ? (exp === 'expired' ? `⏰ ${doc.expiryDate}` : doc.expiryDate) : <span style={{ color: 'var(--ck-ink3)' }}>—</span>}
      </div>

      {/* Updated */}
      <div style={{ color: 'var(--ck-ink3)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
        {new Date(doc.updatedAt).toLocaleDateString()}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.1rem' }}>
        <button onClick={e => { e.stopPropagation(); onOpenFile(doc); }} title="Open file" style={cellBtn}>📂</button>
        {onShare && !isShared && (
          <button onClick={e => { e.stopPropagation(); onShare(doc); }} title="Share" style={cellBtn}>🔗</button>
        )}
      </div>
    </div>
  );
});

export default SafeDocumentRow;
