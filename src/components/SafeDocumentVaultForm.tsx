/**
 * Safe Document Vault Form
 * 
 * Form for adding/editing documents
 */

import React, { useState, useEffect } from 'react';
import { DocumentVault, Tag, DocumentVaultEncryptedData, DocumentProvider, DocumentType } from '../types';
import { CryptoKey } from '../utils/encryption';
import { addDocumentVault, updateDocumentVault, decryptDocumentVault } from '../storage';
import { X } from 'lucide-react';

interface SafeDocumentVaultFormProps {
  document?: DocumentVault;
  tags: Tag[];
  encryptionKey: CryptoKey;
  onSave: () => void;
  onCancel: () => void;
}

const documentTypes: DocumentType[] = ['invoice', 'contract', 'identity', 'insurance', 'medical', 'tax', 'warranty', 'license', 'other'];
const providers: DocumentProvider[] = ['google', 'onedrive', 'dropbox'];

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

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full">
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full my-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {document ? 'Edit Document' : 'Add Document to Vault'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Document Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Passport, Health Insurance Policy"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Storage Provider *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {providers.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`p-3 rounded-lg border-2 transition ${
                    provider === p
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                >
                  <div className={`text-center font-medium ${
                    provider === p
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {p === 'google' && '🔵 Google'}
                    {p === 'onedrive' && '☁️ OneDrive'}
                    {p === 'dropbox' && '📦 Dropbox'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* File Reference */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              File Reference (Encrypted) *
            </label>
            <textarea
              value={fileReference}
              onChange={(e) => setFileReference(e.target.value)}
              placeholder="File URL or ID from provider (e.g., https://drive.google.com/file/d/ABC123)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs"
              rows={2}
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This will be encrypted and stored securely
            </p>
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {documentTypes.map(type => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Notes (Encrypted, 4-5 lines max)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.substring(0, 500))}
              placeholder="Add private notes about this document (encrypted)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notes.length}/500 characters (encrypted)
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
              Priority (Encrypted): {priority}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {tags
                .filter(t => t.isSafeOnly || t.allowedSections?.includes('safe'))
                .map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                      selectedTagIds.includes(tag.id)
                        ? 'text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                    style={
                      selectedTagIds.includes(tag.id)
                        ? { backgroundColor: tag.color }
                        : {}
                    }
                  >
                    {tag.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Favorite */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Mark as favorite</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Saving...' : document ? 'Update' : 'Add'} Document
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SafeDocumentVaultForm;
