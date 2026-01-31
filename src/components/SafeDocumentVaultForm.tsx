/**
 * Safe Document Vault Form
 * 
 * Beautiful form for adding/editing documents in the vault.
 * Styled to match Leo Planner's polished UI theme.
 */

import React, { useState, useEffect } from 'react';
import { DocumentVault, Tag, DocumentVaultEncryptedData, DocumentProvider, DocumentType } from '../types';
import { CryptoKey } from '../utils/encryption';
import { addDocumentVault, updateDocumentVault, decryptDocumentVault } from '../storage';
import Portal from './Portal';

interface SafeDocumentVaultFormProps {
  document?: DocumentVault;
  tags: Tag[];
  encryptionKey: CryptoKey;
  onSave: () => void;
  onCancel: () => void;
}

const documentTypes: { value: DocumentType; label: string; icon: string }[] = [
  { value: 'identity', label: 'Identity', icon: '🪪' },
  { value: 'insurance', label: 'Insurance', icon: '🛡️' },
  { value: 'medical', label: 'Medical', icon: '🏥' },
  { value: 'tax', label: 'Tax', icon: '📊' },
  { value: 'contract', label: 'Contract', icon: '📄' },
  { value: 'invoice', label: 'Invoice', icon: '🧾' },
  { value: 'warranty', label: 'Warranty', icon: '✅' },
  { value: 'license', label: 'License', icon: '📜' },
  { value: 'other', label: 'Other', icon: '📁' },
];

const providers: { value: DocumentProvider; label: string; icon: string; color: string; gradient: string }[] = [
  { value: 'google', label: 'Google Drive', icon: '🔵', color: '#4285f4', gradient: 'linear-gradient(135deg, #4285f4 0%, #34a0d8 100%)' },
  { value: 'onedrive', label: 'OneDrive', icon: '☁️', color: '#0078d4', gradient: 'linear-gradient(135deg, #0078d4 0%, #00a4ef 100%)' },
  { value: 'dropbox', label: 'Dropbox', icon: '📦', color: '#0061ff', gradient: 'linear-gradient(135deg, #0061ff 0%, #007ee5 100%)' },
];

const SafeDocumentVaultForm: React.FC<SafeDocumentVaultFormProps> = ({
  document,
  tags,
  encryptionKey,
  onSave,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [provider, setProvider] = useState<DocumentProvider>('google');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);

  // Encrypted fields
  const [fileReference, setFileReference] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState(5);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (document) {
      loadDocumentData();
    }
  }, [document]);

  const loadDocumentData = async () => {
    if (!document) return;

    setIsLoading(true);
    try {
      const decrypted = await decryptDocumentVault(document, encryptionKey);
      
      setTitle(document.title);
      setProvider(document.provider);
      setDocumentType(document.documentType);
      setIssueDate(document.issueDate || '');
      setExpiryDate(document.expiryDate || '');
      setSelectedTagIds(document.tags || []);
      setIsFavorite(document.isFavorite);
      
      setFileReference(decrypted.fileReference);
      setNotes(decrypted.notes || '');
      setPriority(decrypted.priority || 5);
    } catch (error) {
      console.error('Error loading document:', error);
      alert('Failed to load document data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !fileReference.trim()) {
      alert('Title and file reference are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const encryptedData: DocumentVaultEncryptedData = {
        fileReference,
        notes: notes.trim() || undefined,
        priority: priority || undefined,
        expiryDate: expiryDate || undefined
      };

      if (document) {
        // Update existing
        const success = await updateDocumentVault(
          document.id,
          {
            title,
            provider,
            documentType,
            issueDate: issueDate || undefined,
            expiryDate: expiryDate || undefined,
            tags: selectedTagIds,
            isFavorite,
            encryptedData: JSON.stringify(encryptedData)
          },
          encryptionKey
        );
        if (!success) throw new Error('Failed to update document');
      } else {
        // Add new
        const result = await addDocumentVault(
          {
            title,
            provider,
            documentType,
            issueDate: issueDate || undefined,
            expiryDate: expiryDate || undefined,
            tags: selectedTagIds,
            isFavorite,
            encryptedData: JSON.stringify(encryptedData)
          },
          encryptionKey
        );
        if (!result) throw new Error('Failed to add document');
      }

      onSave();
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getPriorityLabel = () => {
    if (priority <= 3) return { label: 'Low', color: '#22c55e', bg: '#dcfce7' };
    if (priority <= 6) return { label: 'Medium', color: '#f59e0b', bg: '#fef3c7' };
    return { label: 'High', color: '#ef4444', bg: '#fee2e2' };
  };

  if (isLoading) {
    return (
      <Portal>
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1.5rem',
            padding: '3rem',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
          }}>
            <div style={{ 
              fontSize: '3rem', 
              marginBottom: '1rem',
              animation: 'spin 1s linear infinite'
            }}>⏳</div>
            <p style={{ color: '#6b7280', fontSize: '1rem', margin: 0 }}>Loading document...</p>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        overflowY: 'auto',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'slideUp 0.3s ease-out'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 50%, #2dd4bf 100%)',
            padding: '1.5rem',
            borderRadius: '1.5rem 1.5rem 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '1rem',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem'
              }}>
                📄
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white', margin: 0 }}>
                  {document ? 'Edit Document' : 'Add Document'}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', margin: 0 }}>
                  Secure vault storage • Encrypted
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '1.25rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            >
              ✕
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
            {/* Document Title */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Document Title <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Passport, Health Insurance Policy"
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  fontSize: '1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  background: '#f9fafb',
                  color: '#1f2937',
                  transition: 'all 0.2s',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#14b8a6';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(20, 184, 166, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            {/* Storage Provider */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Storage Provider <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {providers.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProvider(p.value)}
                    style={{
                      padding: '1rem 0.5rem',
                      borderRadius: '1rem',
                      border: provider === p.value ? 'none' : '2px solid #e5e7eb',
                      background: provider === p.value ? p.gradient : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: provider === p.value ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                      transform: provider === p.value ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <span style={{ fontSize: '1.75rem' }}>{p.icon}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: provider === p.value ? 'white' : '#6b7280'
                    }}>
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* File Reference */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                File Reference <span style={{ color: '#ef4444' }}>*</span>
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.25rem 0.5rem',
                  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                  color: '#166534',
                  borderRadius: '1rem',
                  fontWeight: 600
                }}>
                  🔒 Encrypted
                </span>
              </label>
              <textarea
                value={fileReference}
                onChange={(e) => setFileReference(e.target.value)}
                placeholder="File URL or ID (e.g., https://drive.google.com/file/d/ABC123)"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  background: '#f9fafb',
                  color: '#1f2937',
                  transition: 'all 0.2s',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '4rem',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#14b8a6';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(20, 184, 166, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
              <p style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.375rem' }}>
                This reference will be encrypted and stored securely
              </p>
            </div>

            {/* Document Type */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Document Type
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem'
              }}>
                {documentTypes.map(dt => (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setDocumentType(dt.value)}
                    style={{
                      padding: '0.75rem 0.5rem',
                      borderRadius: '0.75rem',
                      border: documentType === dt.value ? '2px solid #14b8a6' : '2px solid #e5e7eb',
                      background: documentType === dt.value ? 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.375rem'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{dt.icon}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: documentType === dt.value ? 600 : 500,
                      color: documentType === dt.value ? '#0f766e' : '#6b7280'
                    }}>
                      {dt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  📅 Issue Date
                </label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    background: '#f9fafb',
                    color: '#1f2937',
                    transition: 'all 0.2s',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#14b8a6';
                    e.currentTarget.style.background = 'white';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.background = '#f9fafb';
                  }}
                />
              </div>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  ⏰ Expiry Date
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    fontSize: '0.9rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.75rem',
                    background: '#f9fafb',
                    color: '#1f2937',
                    transition: 'all 0.2s',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#14b8a6';
                    e.currentTarget.style.background = 'white';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.background = '#f9fafb';
                  }}
                />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Notes
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.25rem 0.5rem',
                  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                  color: '#166534',
                  borderRadius: '1rem',
                  fontWeight: 600
                }}>
                  🔒 Encrypted
                </span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.substring(0, 500))}
                placeholder="Add private notes about this document"
                rows={3}
                maxLength={500}
                style={{
                  width: '100%',
                  padding: '0.875rem 1rem',
                  fontSize: '0.9rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  background: '#f9fafb',
                  color: '#1f2937',
                  transition: 'all 0.2s',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '5rem',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#14b8a6';
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(20, 184, 166, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.background = '#f9fafb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <p style={{
                fontSize: '0.7rem',
                color: notes.length >= 450 ? '#ef4444' : '#6b7280',
                marginTop: '0.375rem',
                textAlign: 'right'
              }}>
                {notes.length}/500 characters
              </p>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '0.75rem'
              }}>
                <span>Priority Level</span>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '1rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  background: getPriorityLabel().bg,
                  color: getPriorityLabel().color
                }}>
                  {getPriorityLabel().label} ({priority})
                </span>
              </label>
              <div style={{
                position: 'relative',
                height: 8,
                background: 'linear-gradient(to right, #22c55e 0%, #f59e0b 50%, #ef4444 100%)',
                borderRadius: 4
              }}>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value))}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: `${((priority - 1) / 9) * 100}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: 'white',
                    border: `3px solid ${getPriorityLabel().color}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'left 0.1s'
                  }}
                />
              </div>
            </div>

            {/* Tags */}
            {tags.filter(t => t.isSafeOnly || t.allowedSections?.includes('safe')).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.5rem'
                }}>
                  🏷️ Tags
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {tags
                    .filter(t => t.isSafeOnly || t.allowedSections?.includes('safe'))
                    .map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '2rem',
                          border: selectedTagIds.includes(tag.id) ? 'none' : '2px solid #e5e7eb',
                          background: selectedTagIds.includes(tag.id) ? tag.color : 'white',
                          color: selectedTagIds.includes(tag.id) ? 'white' : '#6b7280',
                          fontSize: '0.8rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: selectedTagIds.includes(tag.id) ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Favorite Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: isFavorite 
                  ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)' 
                  : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                borderRadius: '1rem',
                border: isFavorite ? '2px solid #fecaca' : '2px solid #e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '1.5rem'
              }}
              onClick={() => setIsFavorite(!isFavorite)}
            >
              <span style={{
                fontSize: '2rem',
                transition: 'transform 0.2s',
                transform: isFavorite ? 'scale(1.1)' : 'scale(1)'
              }}>
                {isFavorite ? '❤️' : '🤍'}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#374151' }}>
                  Mark as Favorite
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                  Quick access in favorites filter
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              paddingTop: '1rem',
              borderTop: '2px solid #f3f4f6'
            }}>
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1,
                  padding: '1rem 1.5rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '1rem 1.5rem',
                  background: isSubmitting
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: isSubmitting ? 'none' : '0 4px 14px rgba(20, 184, 166, 0.4)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {isSubmitting ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                    Saving...
                  </>
                ) : (
                  <>
                    {document ? '✓ Update' : '+ Add'} Document
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Portal>
  );
};

export default SafeDocumentVaultForm;
