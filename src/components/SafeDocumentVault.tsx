/**
 * Safe Document Vault Component
 *
 * Manages documents stored in Google Drive, OneDrive, or Dropbox.
 * Stores only metadata + encrypted file reference locally.
 * Mirrors the Passwords section: List/Card toggle, client-side pagination with a
 * page-size dropdown, compact mobile cards, and batched comment-count badges.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { DocumentVault, Tag, DocumentProvider, DocumentType } from '../types';
import { CryptoKey } from '../utils/encryption';
import { updateDocumentVault, decryptDocumentVault } from '../storage';
import { getUnresolvedCommentCountsForEntries } from '../services/commentService';
import { useVirtualList } from '../hooks/useVirtualList';
import ViewToggle, { VaultView } from './vault/ViewToggle';
import SafeDocumentRow, { LIST_GRID_DOC } from './vault/SafeDocumentRow';
import {
  PageSizeSelect, PaginationNav, getStoredPageSize, storePageSize, PAGE_SIZE_KEY_DOCS,
} from './vault/VaultPagination';

const VAULT_DOC_VIEW_KEY = 'myday_safe_documents_view';
const LIST_ROW_HEIGHT = 48;
const HEADER_LABELS_DOC = ['TITLE', 'TYPE', 'PROVIDER', 'EXPIRY', 'UPDATED', ''];

interface SafeDocumentVaultProps {
  documents: DocumentVault[];
  tags: Tag[];
  encryptionKey: CryptoKey;
  onDocumentSaved: () => void;
  onAddDocument: () => void;
  onEditDocument: (doc: DocumentVault) => void;
  onShare?: (doc: DocumentVault) => void;
  isMobile?: boolean;
}

const providerInfo: Record<DocumentProvider, { icon: string; name: string }> = {
  google: { icon: '🔵', name: 'Google Drive' },
  onedrive: { icon: '☁️', name: 'OneDrive' },
  dropbox: { icon: '📦', name: 'Dropbox' }
};

const documentTypeLabels: Record<DocumentType, string> = {
  invoice: 'Invoice',
  contract: 'Contract',
  identity: 'Identity',
  insurance: 'Insurance',
  medical: 'Medical',
  tax: 'Tax',
  warranty: 'Warranty',
  license: 'License',
  other: 'Other'
};

const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
};

const isExpiringSoon = (expiryDate?: string): boolean => {
  if (!expiryDate) return false;
  const today = new Date();
  const expiry = new Date(expiryDate);
  const daysUntil = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return daysUntil <= 30 && daysUntil > 0;
};

const isExpired = (expiryDate?: string): boolean => {
  if (!expiryDate) return false;
  return new Date(expiryDate) < new Date();
};

// ── List view (virtualized rows) ───────────────────────────────────────

interface DocumentsListViewProps {
  documents: DocumentVault[];
  commentCounts: Record<string, number>;
  onEditDocument: (doc: DocumentVault) => void;
  onShare?: (doc: DocumentVault) => void;
  onToggleFavorite: (doc: DocumentVault) => void;
  onOpenFile: (doc: DocumentVault) => void;
}

const DocumentsListView: React.FC<DocumentsListViewProps> = ({
  documents, commentCounts, onEditDocument, onShare, onToggleFavorite, onOpenFile,
}) => {
  const { virtualItems, totalHeight, containerRef } = useVirtualList<DocumentVault>({
    items: documents,
    itemHeight: LIST_ROW_HEIGHT,
    overscan: 6,
  });

  return (
    <div style={{ border: '0.5px solid var(--ck-border2)', borderRadius: '10px', overflow: 'hidden', background: 'var(--ck-white)' }}>
      <div
        style={{
          display: 'grid', gridTemplateColumns: LIST_GRID_DOC, gap: '0.75rem',
          padding: '0.6rem 0.75rem', background: 'var(--ck-purple-light)',
          borderBottom: '0.5px solid var(--ck-border2)', fontSize: '0.68rem',
          fontWeight: 700, letterSpacing: '0.5px', color: 'var(--ck-ink3)',
        }}
      >
        {HEADER_LABELS_DOC.map((l, i) => <span key={l || `h${i}`}>{l}</span>)}
      </div>

      <div ref={containerRef} style={{ maxHeight: 'calc(100vh - 300px)', minHeight: '420px', overflowY: 'auto' }}>
        <div style={{ height: totalHeight, position: 'relative' }}>
          {virtualItems.map(({ item, style }) => (
            <div key={item.id} style={style.position ? style : { height: LIST_ROW_HEIGHT }}>
              <SafeDocumentRow
                doc={item}
                commentCount={commentCounts[item.id] || 0}
                onEdit={onEditDocument}
                onShare={onShare}
                onToggleFavorite={onToggleFavorite}
                onOpenFile={onOpenFile}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Card view ──────────────────────────────────────────────────────────

interface DocumentCardProps {
  doc: DocumentVault;
  tags: Tag[];
  commentCount: number;
  compact: boolean;
  onEditDocument: (doc: DocumentVault) => void;
  onShare?: (doc: DocumentVault) => void;
  onToggleFavorite: (doc: DocumentVault) => void;
  onOpenFile: (doc: DocumentVault) => void;
}

const DocumentCard: React.FC<DocumentCardProps> = ({
  doc, tags, commentCount, compact, onEditDocument, onShare, onToggleFavorite, onOpenFile,
}) => {
  const shared = (doc as any).isShared;
  const sharedBy = (doc as any).sharedBy;
  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: shared && sharedBy ? 'rgba(236, 253, 245, 0.95)' : shared ? 'rgba(238, 242, 255, 0.95)' : 'rgba(255,255,255,0.95)',
        borderRadius: '8px',
        padding: compact ? '0.7rem 0.8rem' : '1.25rem',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        border: shared && sharedBy ? '2px solid #10b981' : shared ? '2px solid #6366f1' : 'none',
      }}
      onClick={() => onEditDocument(doc)}
    >
      {/* Header: title + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: compact ? '0.4rem' : '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: compact ? '0.95rem' : '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.title}</h3>
          {commentCount > 0 && (
            <span style={{ background: '#3b82f6', color: 'white', fontSize: '0.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: '10px', flexShrink: 0 }}>💬 {commentCount}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenFile(doc); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', fontSize: '1rem', opacity: 0.7 }}
            title="Open file"
          >📂</button>
          {onShare && !shared && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(doc); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', fontSize: '1rem', opacity: 0.7 }}
              title="Share"
            >🔗</button>
          )}
          {shared ? (
            doc.isFavorite && <span title="Favorite">⭐</span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc); }}
              title={doc.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={!!doc.isFavorite}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', fontSize: '1rem', lineHeight: 1, opacity: doc.isFavorite ? 1 : 0.55 }}
            >
              {doc.isFavorite ? '⭐' : '☆'}
            </button>
          )}
        </div>
      </div>

      {/* Shared/Updated badges */}
      {shared && !compact && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
          <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', backgroundColor: sharedBy ? '#10b981' : '#6366f1', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, alignSelf: 'flex-start' }}>
            {sharedBy ? `🔗 Shared by ${sharedBy}` : '📤 Shared with others'}
          </span>
          {(doc as any).lastUpdatedByName && (doc as any).lastUpdatedAt && (
            <span style={{ display: 'inline-block', padding: '0.25rem 0.5rem', backgroundColor: '#3b82f6', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, alignSelf: 'flex-start' }}>
              ✏️ Updated {formatTimeAgo((doc as any).lastUpdatedAt)} by {(doc as any).lastUpdatedByName}
            </span>
          )}
        </div>
      )}

      {/* Provider and Type */}
      <p style={{ margin: compact ? '0 0 0.3rem 0' : '0 0 0.5rem 0', color: '#3b82f6', fontSize: compact ? '0.8rem' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {providerInfo[doc.provider].icon} {compact ? documentTypeLabels[doc.documentType] : `${providerInfo[doc.provider].name} • ${documentTypeLabels[doc.documentType]}`}
      </p>

      {/* Tags */}
      {doc.tags && doc.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: compact ? '0' : '0.5rem' }}>
          {doc.tags.map(tagId => {
            const tag = tags.find(t => t.id === tagId);
            if (!tag) return null;
            return (
              <div key={tagId} style={{ padding: '0.2rem 0.6rem', backgroundColor: tag.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.7rem' }}>{tag.name}</div>
            );
          })}
        </div>
      )}

      {/* Expiry warning */}
      {doc.expiryDate && (isExpired(doc.expiryDate) || isExpiringSoon(doc.expiryDate)) && (
        <div style={{ display: 'inline-block', padding: '0.2rem 0.6rem', backgroundColor: isExpired(doc.expiryDate) ? '#ef4444' : '#f59e0b', color: 'white', borderRadius: '6px', fontSize: '0.7rem', marginTop: compact ? '0.3rem' : 0, marginBottom: compact ? 0 : '0.5rem' }}>
          ⏰ {isExpired(doc.expiryDate) ? 'Expired' : 'Expires soon'}
        </div>
      )}

      {!compact && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
          Updated {new Date(doc.updatedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────

const SafeDocumentVault: React.FC<SafeDocumentVaultProps> = ({
  documents,
  tags,
  encryptionKey,
  onDocumentSaved,
  onAddDocument,
  onEditDocument,
  onShare,
  isMobile = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<DocumentProvider | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'expiry' | 'updated'>('updated');

  // List/Card view (desktop only) — persisted per-device, separate from passwords.
  const [view, setViewState] = useState<VaultView>(
    () => (localStorage.getItem(VAULT_DOC_VIEW_KEY) === 'list' ? 'list' : 'card')
  );
  const setView = (v: VaultView) => { setViewState(v); localStorage.setItem(VAULT_DOC_VIEW_KEY, v); };
  const effectiveView: VaultView = isMobile ? 'card' : view;

  // Client-side pagination (display window only).
  const [pageSize, setPageSizeState] = useState<number>(() => getStoredPageSize(isMobile, PAGE_SIZE_KEY_DOCS));
  const setPageSize = (n: number) => { setPageSizeState(n); storePageSize(n, PAGE_SIZE_KEY_DOCS); };
  const [page, setPage] = useState(1);

  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => d.title.toLowerCase().includes(q));
    }
    if (selectedType) {
      filtered = filtered.filter(d => d.documentType === selectedType);
    }
    if (selectedProvider) {
      filtered = filtered.filter(d => d.provider === selectedProvider);
    }
    if (showFavoritesOnly) {
      filtered = filtered.filter(d => d.isFavorite);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'expiry':
          if (!a.expiryDate && !b.expiryDate) return 0;
          if (!a.expiryDate) return 1;
          if (!b.expiryDate) return -1;
          return a.expiryDate.localeCompare(b.expiryDate);
        case 'updated':
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });

    return filtered;
  }, [documents, searchQuery, selectedType, selectedProvider, showFavoritesOnly, sortBy]);

  // Reset to page 1 when filters/sort/page-size change.
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedType, selectedProvider, showFavoritesOnly, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedDocuments = useMemo(
    () => filteredDocuments.slice((page - 1) * pageSize, page * pageSize),
    [filteredDocuments, page, pageSize],
  );

  // Batched unresolved comment counts for the visible page only.
  const pagedIdsKey = pagedDocuments.map(d => d.id).join(',');
  useEffect(() => {
    if (pagedDocuments.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const counts = await getUnresolvedCommentCountsForEntries(
          pagedDocuments.map(d => d.id),
          'document',
        );
        if (!cancelled) setCommentCounts(prev => ({ ...prev, ...counts }));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagedIdsKey]);

  const handleToggleFavorite = async (doc: DocumentVault) => {
    try {
      await updateDocumentVault(doc.id, { isFavorite: !doc.isFavorite });
      onDocumentSaved();
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const openFile = async (doc: DocumentVault) => {
    try {
      const encrypted = await decryptDocumentVault(doc, encryptionKey);
      const fileRef = encrypted.fileReference;
      if (fileRef && fileRef.startsWith('http')) {
        window.open(fileRef, '_blank');
      } else {
        alert(`File reference: ${fileRef || '(none)'}\n\nPlease open this file in ${providerInfo[doc.provider].name}`);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Unable to open file. Please try again.');
    }
  };

  return (
    <div>
      {/* Toolbar - compact, no background box */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '150px', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }}
        />

        <select
          value={selectedProvider || ''}
          onChange={(e) => setSelectedProvider((e.target.value as DocumentProvider) || null)}
          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white' }}
        >
          <option value="">Provider</option>
          <option value="google">Google</option>
          <option value="onedrive">OneDrive</option>
          <option value="dropbox">Dropbox</option>
        </select>

        <select
          value={selectedType || ''}
          onChange={(e) => setSelectedType((e.target.value as DocumentType) || null)}
          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white' }}
        >
          <option value="">Type</option>
          {Object.entries(documentTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'title' | 'expiry' | 'updated')}
          style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem', backgroundColor: 'white' }}
        >
          <option value="updated">Latest</option>
          <option value="title">A-Z</option>
          <option value="expiry">Expiry</option>
        </select>

        <PageSizeSelect value={pageSize} onChange={setPageSize} />

        {!isMobile && <ViewToggle value={view} onChange={setView} />}

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          style={{ padding: '0.5rem 0.75rem', backgroundColor: showFavoritesOnly ? '#fee2e2' : '#f3f4f6', color: showFavoritesOnly ? '#dc2626' : '#6b7280', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
        >
          ♥ Favorite
        </button>
      </div>

      {filteredDocuments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 2rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No documents found</p>
          <button
            onClick={onAddDocument}
            style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '1rem', fontWeight: 500 }}
          >
            + Add Document
          </button>
        </div>
      ) : effectiveView === 'list' ? (
        <>
          <DocumentsListView
            documents={pagedDocuments}
            commentCounts={commentCounts}
            onEditDocument={onEditDocument}
            onShare={onShare}
            onToggleFavorite={handleToggleFavorite}
            onOpenFile={openFile}
          />
          <PaginationNav page={page} pageSize={pageSize} totalItems={filteredDocuments.length} onPageChange={setPage} />
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(160px, 1fr))' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: isMobile ? '0.6rem' : '1rem' }}>
            {pagedDocuments.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                tags={tags}
                commentCount={commentCounts[doc.id] || 0}
                compact={isMobile}
                onEditDocument={onEditDocument}
                onShare={onShare}
                onToggleFavorite={handleToggleFavorite}
                onOpenFile={openFile}
              />
            ))}
          </div>
          <PaginationNav page={page} pageSize={pageSize} totalItems={filteredDocuments.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default SafeDocumentVault;
