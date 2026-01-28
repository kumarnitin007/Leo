/**
 * Safe Document Vault Component
 * 
 * Manages documents stored in Google Drive, OneDrive, or Dropbox
 * Stores only metadata + encrypted file reference locally
 * Styled to match Safe section with grid/list view toggle
 */

import React, { useState, useMemo } from 'react';
import { DocumentVault, Tag, DocumentProvider, DocumentType } from '../types';
import { CryptoKey } from '../utils/encryption';
import { deleteDocumentVault, updateDocumentVault, decryptDocumentVault } from '../storage';
import { FileText, Trash2, Edit2, Heart, Download, Eye } from 'lucide-react';

interface SafeDocumentVaultProps {
  documents: DocumentVault[];
  tags: Tag[];
  encryptionKey: CryptoKey;
  onDocumentSaved: () => void;
  onAddDocument: () => void;
  onEditDocument: (doc: DocumentVault) => void;
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

const SafeDocumentVault: React.FC<SafeDocumentVaultProps> = ({
  documents,
  tags,
  encryptionKey,
  onDocumentSaved,
  onAddDocument,
  onEditDocument
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<DocumentProvider | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'expiry' | 'updated'>('updated');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>({});

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

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteDocumentVault(id);
      if (success) {
        setShowDeleteConfirm(null);
        onDocumentSaved();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const handleToggleFavorite = async (doc: DocumentVault) => {
    try {
      await updateDocumentVault(doc.id, { isFavorite: !doc.isFavorite });
      onDocumentSaved();
    } catch (error) {
      console.error('Error updating favorite:', error);
    }
  };

  const handleDecryptNotes = async (doc: DocumentVault) => {
    if (decryptedNotes[doc.id]) {
      setDecryptedNotes(prev => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
      return;
    }

    try {
      const encrypted = await decryptDocumentVault(doc, encryptionKey);
      setDecryptedNotes(prev => ({
        ...prev,
        [doc.id]: encrypted.notes || '(No notes)'
      }));
    } catch (error) {
      console.error('Error decrypting notes:', error);
      setDecryptedNotes(prev => ({
        ...prev,
        [doc.id]: '(Unable to decrypt)'
      }));
    }
  };

  const openFile = async (doc: DocumentVault) => {
    try {
      const encrypted = await decryptDocumentVault(doc, encryptionKey);
      const fileRef = encrypted.fileReference;
      
      if (fileRef.startsWith('http')) {
        window.open(fileRef, '_blank');
      } else {
        alert(`File reference: ${fileRef}\n\nPlease open this file in ${providerInfo[doc.provider].name}`);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Unable to open file. Please try again.');
    }
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

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search */}
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '200px',
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem'
          }}
        />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'title' | 'expiry' | 'updated')}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: 'white'
          }}
        >
          <option value="updated">Latest</option>
          <option value="title">Title A-Z</option>
          <option value="expiry">Expiry Date</option>
        </select>

        {/* Provider Filter */}
        <select
          value={selectedProvider || ''}
          onChange={(e) => setSelectedProvider((e.target.value as DocumentProvider) || null)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: 'white'
          }}
        >
          <option value="">All Providers</option>
          <option value="google">Google Drive</option>
          <option value="onedrive">OneDrive</option>
          <option value="dropbox">Dropbox</option>
        </select>

        {/* Type Filter */}
        <select
          value={selectedType || ''}
          onChange={(e) => setSelectedType((e.target.value as DocumentType) || null)}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: 'white'
          }}
        >
          <option value="">All Types</option>
          {Object.entries(documentTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Favorites */}
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: showFavoritesOnly ? '#fee2e2' : '#f3f4f6',
            color: showFavoritesOnly ? '#dc2626' : '#6b7280',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          ♥ Favorites
        </button>
      </div>

      {/* Grid */}
      {filteredDocuments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem 2rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>No documents found</p>
          <button
            onClick={onAddDocument}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500
            }}
          >
            + Add Your First Document
          </button>
        </div>
      ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '0.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  padding: '1rem',
                  borderLeft: `4px solid ${tags.find(t => t.id === doc.tags?.[0])?.color || '#ccc'}`,
                  transition: 'box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'}
                onClick={() => {
                  // Show details in a modal/popup
                  alert(`Document: ${doc.title}\n\nOpen in edit mode to view all details`);
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '2rem', flexShrink: 0 }}>{providerInfo[doc.provider].icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {doc.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                        {documentTypeLabels[doc.documentType]}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(doc)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.25rem',
                      color: doc.isFavorite ? '#ef4444' : '#d1d5db'
                    }}
                  >
                    ♥
                  </button>
                </div>

                {/* Dates */}
                {(doc.issueDate || doc.expiryDate) && (
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                    {doc.issueDate && <div>📅 Issued: {new Date(doc.issueDate).toLocaleDateString()}</div>}
                    {doc.expiryDate && (
                      <div style={{
                        color: isExpired(doc.expiryDate) ? '#dc2626' : isExpiringSoon(doc.expiryDate) ? '#ea580c' : '#6b7280',
                        fontWeight: isExpired(doc.expiryDate) || isExpiringSoon(doc.expiryDate) ? 600 : 400
                      }}>
                        ⏰ Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                        {isExpired(doc.expiryDate) && ' (EXPIRED)'}
                        {isExpiringSoon(doc.expiryDate) && !isExpired(doc.expiryDate) && ' (SOON)'}
                      </div>
                    )}
                  </div>
                )}

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
                    {doc.tags.slice(0, 2).map(tagId => {
                      const tag = tags.find(t => t.id === tagId);
                      return tag ? (
                        <span
                          key={tagId}
                          style={{
                            fontSize: '0.625rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            color: 'white',
                            backgroundColor: tag.color
                          }}
                        >
                          {tag.name}
                        </span>
                      ) : null;
                    })}
                    {doc.tags.length > 2 && (
                      <span style={{
                        fontSize: '0.625rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        backgroundColor: '#e5e7eb',
                        color: '#6b7280'
                      }}>
                        +{doc.tags.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDecryptNotes(doc);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#f3f4f6',
                      color: '#4b5563',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    👁 Notes
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openFile(doc);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    📥 Open
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditDocument(doc);
                    }}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: '#f3f4f6',
                      color: '#4b5563',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✎
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(doc.id);
                    }}
                    style={{
                      padding: '0.5rem',
                      backgroundColor: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer'
                    }}
                  >
                    🗑
                  </button>
                </div>

                {/* Notes Preview */}
                {decryptedNotes[doc.id] && (
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    color: '#4b5563',
                    wordBreak: 'break-word',
                    marginBottom: '0.75rem'
                  }}>
                    {decryptedNotes[doc.id]}
                  </div>
                )}

                {/* Delete Confirm */}
                {showDeleteConfirm === doc.id && (
                  <div style={{
                    padding: '0.5rem',
                    backgroundColor: '#fee2e2',
                    borderRadius: '0.375rem',
                    marginBottom: '0.75rem'
                  }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: '#991b1b' }}>Delete this document?</p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleDelete(doc.id)}
                        style={{
                          flex: 1,
                          padding: '0.375rem',
                          backgroundColor: '#dc2626',
                          color: 'white',
                          fontSize: '0.75rem',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        style={{
                          flex: 1,
                          padding: '0.375rem',
                          backgroundColor: '#d1d5db',
                          color: '#374151',
                          fontSize: '0.75rem',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
};

export default SafeDocumentVault;
