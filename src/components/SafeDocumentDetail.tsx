/**
 * Safe Document Detail Component
 * 
 * Displays document details with comments integration
 */

import React, { useState, useEffect } from 'react';
import type { DocumentVault } from '../types';
import type { SharedDocument } from '../services/documentSharingService';
import { useAuth } from '../contexts/AuthContext';
import EntryComments from './EntryComments';
import { FileText, ExternalLink, Calendar, Tag as TagIcon, Download } from 'lucide-react';

interface SafeDocumentDetailProps {
  document: DocumentVault | null;
  sharedDocument?: SharedDocument | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const providerInfo: Record<string, { icon: string; name: string }> = {
  google: { icon: '🔵', name: 'Google Drive' },
  onedrive: { icon: '☁️', name: 'OneDrive' },
  dropbox: { icon: '📦', name: 'Dropbox' },
};

const SafeDocumentDetail: React.FC<SafeDocumentDetailProps> = ({
  document,
  sharedDocument,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { user } = useAuth();
  const [showNotes, setShowNotes] = useState(false);

  if (!document && !sharedDocument) {
    return null;
  }

  const isShared = !!sharedDocument;
  const isReadOnly = isShared && sharedDocument?.shareMode === 'readonly';
  
  // Use shared document data if available, otherwise use regular document
  const displayDoc = sharedDocument?.decryptedData || document;
  const title = sharedDocument?.documentTitle || document?.title || 'Untitled';
  const provider = sharedDocument?.provider || document?.provider || 'google';
  const documentType = sharedDocument?.documentType || document?.documentType || 'other';

  const providerData = providerInfo[provider] || { icon: '📄', name: 'Unknown' };

  const handleOpenFile = () => {
    if (displayDoc?.fileUrl) {
      window.open(displayDoc.fileUrl, '_blank');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <FileText size={24} color="#3b82f6" />
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h2>
            </div>
            
            {isShared && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#10b981',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginTop: '0.5rem',
                }}
              >
                Shared by {sharedDocument?.sharedByName}
              </div>
            )}
            
            {isReadOnly && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#f59e0b',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  marginLeft: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                🔒 Read-only
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0.25rem',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          {/* Metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                Provider
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{providerData.icon}</span>
                <span style={{ fontWeight: 500 }}>{providerData.name}</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                Type
              </div>
              <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                {documentType}
              </div>
            </div>

            {displayDoc?.fileSize && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Size
                </div>
                <div style={{ fontWeight: 500 }}>
                  {(displayDoc.fileSize / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            )}

            {displayDoc?.expiryDate && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                  Expires
                </div>
                <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={14} />
                  {new Date(displayDoc.expiryDate).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {displayDoc?.tags && displayDoc.tags.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                Tags
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {displayDoc.tags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    style={{
                      background: '#e0e7ff',
                      color: '#3730a3',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <TagIcon size={12} />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {displayDoc?.notes && (
            <div style={{ marginBottom: '1.5rem' }}>
              <button
                onClick={() => setShowNotes(!showNotes)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#3b82f6',
                  cursor: 'pointer',
                  marginBottom: '0.5rem',
                }}
              >
                {showNotes ? '▼' : '▶'} Notes
              </button>
              {showNotes && (
                <div
                  style={{
                    background: '#f9fafb',
                    padding: '1rem',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {displayDoc.notes}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {displayDoc?.fileUrl && (
              <button
                onClick={handleOpenFile}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <ExternalLink size={16} />
                Open File
              </button>
            )}

            {!isReadOnly && onEdit && (
              <button
                onClick={onEdit}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  color: '#3b82f6',
                  border: '1px solid #3b82f6',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                ✎ Edit
              </button>
            )}

            {!isShared && onDelete && (
              <button
                onClick={onDelete}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                🗑 Delete
              </button>
            )}
          </div>

          {/* Comments Section */}
          {user && (document || sharedDocument) && (
            <EntryComments
              entryId={document?.id || sharedDocument?.documentId || ''}
              entryType="document"
              currentUserId={user.id}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SafeDocumentDetail;
