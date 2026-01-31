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
  onShare?: (doc: DocumentVault) => void;
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
  onEditDocument,
  onShare
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
      {/* Toolbar - compact, no background box */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="🔍 Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem'
          }}
        />

        <select
          value={selectedProvider || ''}
          onChange={(e) => setSelectedProvider((e.target.value as DocumentProvider) || null)}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: 'white'
          }}
        >
          <option value="">Provider</option>
          <option value="google">Google</option>
          <option value="onedrive">OneDrive</option>
          <option value="dropbox">Dropbox</option>
        </select>

        <select
          value={selectedType || ''}
          onChange={(e) => setSelectedType((e.target.value as DocumentType) || null)}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: 'white'
          }}
        >
          <option value="">Type</option>
          {Object.entries(documentTypeLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'title' | 'expiry' | 'updated')}
          style={{
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: 'white'
          }}
        >
          <option value="updated">Latest</option>
          <option value="title">A-Z</option>
          <option value="expiry">Expiry</option>
        </select>

        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: showFavoritesOnly ? '#fee2e2' : '#f3f4f6',
            color: showFavoritesOnly ? '#dc2626' : '#6b7280',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          ♥ Favorite
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
            + Add Document
          </button>
        </div>
      ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem'
          }}>
            {filteredDocuments.map(doc => (
              <div
                key={doc.id}
                style={{
                  position: 'relative',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                }}
                onClick={() => onEditDocument(doc)}
              >
                {/* Header with title and favorite */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>{doc.title}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {onShare && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShare(doc);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          fontSize: '1rem',
                          opacity: 0.7
                        }}
                        title="Share"
                      >
                        🔗
                      </button>
                    )}
                    {doc.isFavorite && <span>⭐</span>}
                  </div>
                </div>

                {/* Provider and Type */}
                <p style={{ margin: '0 0 0.5rem 0', color: '#3b82f6' }}>
                  {providerInfo[doc.provider].icon} {providerInfo[doc.provider].name} • {documentTypeLabels[doc.documentType]}
                </p>

                {/* Tags */}
                {doc.tags && doc.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {doc.tags.map(tagId => {
                      const tag = tags.find(t => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <div key={tagId} style={{ padding: '0.25rem 0.75rem', backgroundColor: tag.color || '#667eea', color: 'white', borderRadius: '6px', fontSize: '0.75rem' }}>{tag.name}</div>
                      );
                    })}
                  </div>
                )}

                {/* Expiry warning */}
                {doc.expiryDate && (isExpired(doc.expiryDate) || isExpiringSoon(doc.expiryDate)) && (
                  <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    backgroundColor: isExpired(doc.expiryDate) ? '#ef4444' : '#f59e0b',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    marginBottom: '0.5rem'
                  }}>
                    ⏰ {isExpired(doc.expiryDate) ? 'Expired' : 'Expires soon'}
                  </div>
                )}

                <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
};

export default SafeDocumentVault;
