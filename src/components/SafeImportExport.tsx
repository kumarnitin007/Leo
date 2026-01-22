/**
 * Safe Import/Export Component
 * 
 * Handles importing and exporting safe entries
 */

import React, { useState } from 'react';
import { SafeEntry, Tag } from '../types';
import { CryptoKey } from '../utils/encryption';
import { 
  exportEncrypted, 
  exportUnencrypted, 
  exportCSV, 
  importEncrypted,
  downloadFile,
  readFile,
  EncryptedExport
} from '../utils/safeImportExport';
import { getEncryptionKey, importSafeEntries, getSafeEntries, createSafeTag, importSampleSafe, initializeSafeCategories, getSafeTags } from '../storage';
import { 
  parseKeePassCSV, 
  generatePreview, 
  getCategoryMapping, 
  convertCSVRowsToEntries,
  PreviewEntry,
  ImportSummary
} from '../utils/csvImport';

interface SafeImportExportProps {
  entries: SafeEntry[];
  encryptionKey: CryptoKey;
  tags: Tag[];
  onImportComplete: () => void;
  onClose: () => void;
  onTagsRefresh?: () => void;
}

const SafeImportExport: React.FC<SafeImportExportProps> = ({
  entries,
  encryptionKey,
  tags,
  onImportComplete,
  onClose,
  onTagsRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<'encrypted' | 'unencrypted' | 'csv'>('encrypted');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [importError, setImportError] = useState('');
  
  // CSV Import states
  const [importFormat, setImportFormat] = useState<'encrypted' | 'csv'>('encrypted');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<PreviewEntry[]>([]);
  const [categoryMapping, setCategoryMapping] = useState<Record<string, number>>({});
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [newTagName, setNewTagName] = useState('');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [csvTotalRows, setCsvTotalRows] = useState(0);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [isProcessingCSV, setIsProcessingCSV] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      switch (exportFormat) {
        case 'encrypted':
          const encryptedExport = await exportEncrypted(entries, encryptionKey);
          content = JSON.stringify(encryptedExport, null, 2);
          filename = `leo-safe-backup-encrypted-${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;
        
        case 'unencrypted':
          const unencryptedExport = await exportUnencrypted(entries, encryptionKey, tags);
          content = JSON.stringify(unencryptedExport, null, 2);
          filename = `leo-safe-export-${new Date().toISOString().split('T')[0]}.json`;
          mimeType = 'application/json';
          break;
        
        case 'csv':
          content = await exportCSV(entries, encryptionKey, tags);
          filename = `leo-safe-export-${new Date().toISOString().split('T')[0]}.csv`;
          mimeType = 'text/csv';
          break;
      }

      downloadFile(content, filename, mimeType);
      alert(`Export completed! File saved as ${filename}`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportError('');

    try {
      const fileContent = await readFile(file);
      const importData: EncryptedExport = JSON.parse(fileContent);

      // Validate format
      if (!importData.version || !importData.encryptedData || !importData.encryptedDataIv) {
        throw new Error('Invalid export file format');
      }

      // Verify password by deriving key
      if (!importPassword) {
        setImportError('Please enter your master password to decrypt the backup');
        setIsImporting(false);
        return;
      }

      // Derive encryption key from password
      const importKey = await getEncryptionKey(importPassword);

      // Import entries
      const importedEntries = await importEncrypted(importData, importKey);

      // Save to database
      const result = await importSafeEntries(importedEntries, importKey);
      
      if (result.failed > 0) {
        alert(`Imported ${result.success} entries. ${result.failed} entries failed to import.`);
      } else {
        alert(`Successfully imported ${result.success} entries!`);
      }
      
      onImportComplete();
      onClose();
    } catch (error: any) {
      console.error('Import error:', error);
      setImportError(error.message || 'Failed to import. Please check your password and file format.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (importFormat === 'csv') {
      setCsvFile(file);
      setIsProcessingCSV(true);
      try {
        const content = await readFile(file);
        const rows = parseKeePassCSV(content);
        setCsvTotalRows(rows.length);
        
        // Generate preview
        const preview = generatePreview(rows, tags, 10);
        setCsvPreview(preview);
        
        // Get category mapping
        const mapping = getCategoryMapping(rows, tags);
        setCategoryMapping(mapping);
      } catch (error: any) {
        setImportError(error.message || 'Failed to parse CSV file');
        setCsvFile(null);
      } finally {
        setIsProcessingCSV(false);
      }
    } else {
      handleImport(file);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    
    try {
      const newTag = await createSafeTag(newTagName.trim(), '#667eea');
      if (newTag) {
        setSelectedTagId(newTag.id);
        setShowCreateTag(false);
        setNewTagName('');
        // Refresh tags list in parent component
        if (onTagsRefresh) {
          onTagsRefresh();
        }
      }
    } catch (error: any) {
      setImportError(error.message || 'Failed to create tag');
    }
  };

  const handleDownloadSampleCSV = () => {
    // Simple KeePass-style sample matching the expected structure
    const headers = ['Title','Username','Password','URL','Notes','Category'];
    const sampleRow = [
      'Acme Email',
      'user@acme.com',
      'hunter2',
      'https://mail.acme.com',
      'Work account',
      'Email'
    ];

    const csvContent = [
      headers.join(','),
      sampleRow.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ].join('\n');

    downloadFile(csvContent, 'leo-safe-sample.csv', 'text/csv');
  };

  const handleCSVImport = async () => {
    if (!csvFile) {
      setImportError('Please select a CSV file');
      return;
    }
    
    // Check if we need to create a new tag first
    let finalTagId = selectedTagId;
    if (showCreateTag && newTagName.trim()) {
      try {
        const newTag = await createSafeTag(newTagName.trim(), '#667eea');
        if (newTag) {
          finalTagId = newTag.id;
          setSelectedTagId(newTag.id);
          setShowCreateTag(false);
          setNewTagName('');
          // Refresh tags list in parent component
          if (onTagsRefresh) {
            await onTagsRefresh();
          }
        } else {
          setImportError('Failed to create new tag');
          return;
        }
      } catch (error: any) {
        setImportError(error.message || 'Failed to create tag');
        return;
      }
    }
    
    if (!finalTagId) {
      setImportError('Please select or create a tag for imported entries');
      return;
    }
    
    setIsImporting(true);
    setImportError('');
    
    try {
      const content = await readFile(csvFile);
      const rows = parseKeePassCSV(content);
      
      // Get existing entries to check for duplicates
      const existingEntries = await getSafeEntries();
      
      // Ensure all system categories are initialized (in case new categories were added)
      await initializeSafeCategories();
      
      // Get fresh list of all categories including any new ones
      const allTags = await getSafeTags();
      
      // Convert CSV rows to SafeEntry format
      const entriesToImport = await convertCSVRowsToEntries(
        rows,
        encryptionKey,
        allTags,
        finalTagId,
        existingEntries
      );
      
      // Import entries
      const result = await importSafeEntries(entriesToImport, encryptionKey);
      
      // Generate summary
      const summary: ImportSummary = {
        total: rows.length,
        imported: result.success,
        skipped: rows.length - entriesToImport.length,
        categoryMapping: getCategoryMapping(rows, allTags),
        errors: []
      };
      
      setImportSummary(summary);
      // onImportComplete will refresh entries and tags
      onImportComplete();
    } catch (error: any) {
      console.error('CSV import error:', error);
      setImportError(error.message || 'Failed to import CSV file');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>🦁 Import/Export Safe Data</h2>
            <button
              onClick={async () => {
                const clearFirst = confirm('Load demo safe entries? Click OK to clear existing safe entries and load samples, or Cancel to add to existing entries.');
                if (clearFirst && !confirm('⚠️ This will delete ALL your existing safe entries. Are you sure?')) return;
                try {
                  const success = await importSampleSafe(clearFirst);
                  if (success) {
                    alert(`Sample safe entries ${clearFirst ? 'loaded' : 'added'} successfully!`);
                    onImportComplete();
                    onClose();
                  } else {
                    alert('Error importing sample safe entries. Please try again.');
                  }
                } catch (err) {
                  console.error(err);
                  alert('Error importing sample safe entries.');
                }
              }}
              className="btn-secondary"
              style={{ fontSize: '0.9rem' }}
            >
              Load Demo Safe
            </button>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('export')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'export' ? '#3b82f6' : 'transparent',
              color: activeTab === 'export' ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'export' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
              marginBottom: '-2px'
            }}
          >
            Export
          </button>
          <button
            onClick={() => setActiveTab('import')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: activeTab === 'import' ? '#3b82f6' : 'transparent',
              color: activeTab === 'import' ? 'white' : '#6b7280',
              border: 'none',
              borderBottom: activeTab === 'import' ? '2px solid #3b82f6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 500,
              marginBottom: '-2px'
            }}
          >
            Import
          </button>
        </div>

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div>
            <p style={{ marginBottom: '1.5rem', opacity: 0.7 }}>
              Export your safe entries for backup or migration. Choose the format that best suits your needs.
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Export Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="encrypted">🔒 Encrypted Backup (Recommended)</option>
                <option value="unencrypted">📄 Unencrypted JSON (Structure only)</option>
                <option value="csv">📊 CSV (Plaintext fields only)</option>
              </select>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem',
              fontSize: '0.875rem'
            }}>
              <strong>Format Details:</strong>
              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem' }}>
                {exportFormat === 'encrypted' && (
                  <li>Fully encrypted backup. Requires master password to restore.</li>
                )}
                {exportFormat === 'unencrypted' && (
                  <li>JSON format with all decrypted data. Use for migration to other tools.</li>
                )}
                {exportFormat === 'csv' && (
                  <li>CSV format with all decrypted fields. Includes usernames, passwords, and all category-specific data.</li>
                )}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={handleExport}
                disabled={isExporting || entries.length === 0}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  backgroundColor: isExporting || entries.length === 0 ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: isExporting || entries.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: 500
                }}
              >
                {isExporting ? 'Exporting...' : `Export ${entries.length} Entries`}
              </button>
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div>
            <p style={{ marginBottom: '1.5rem', opacity: 0.7 }}>
              Import entries from an encrypted backup file or KeePass CSV format.
            </p>

            {/* Import Format Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Import Format
              </label>
              <select
                value={importFormat}
                onChange={(e) => {
                  setImportFormat(e.target.value as 'encrypted' | 'csv');
                  setCsvFile(null);
                  setCsvPreview([]);
                  setCategoryMapping({});
                  setImportSummary(null);
                  setImportError('');
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  backgroundColor: 'white'
                }}
              >
                <option value="encrypted">🔒 Encrypted Backup</option>
                <option value="csv">📄 KeePass CSV</option>
              </select>
            </div>

            {/* Encrypted Import */}
            {importFormat === 'encrypted' && (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Master Password
                  </label>
                  <input
                    type="password"
                    value={importPassword}
                    onChange={(e) => {
                      setImportPassword(e.target.value);
                      setImportError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: importError ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                    placeholder="Enter master password"
                  />
                  {importError && (
                    <p style={{ margin: '0.5rem 0 0 0', color: '#ef4444', fontSize: '0.875rem' }}>
                      {importError}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Backup File
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    disabled={isImporting}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </>
            )}

            {/* CSV Import */}
            {importFormat === 'csv' && (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    CSV File (KeePass Format)
                  </label>

                  {/* Expected CSV Structure - show columns and a sample row to the user */}
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    marginBottom: '0.75rem',
                    fontSize: '0.9rem'
                  }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Expected CSV structure</strong>
                    <div style={{ marginBottom: '0.5rem' }}>
                      Columns (first row / header): <em>Title, Username, Password, URL, Notes, Category</em>
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#374151' }}>
                      Example header: Title,Username,Password,URL,Notes,Category
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <div style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', color: '#6b7280' }}>
                        Example row: "Acme Email","user@acme.com","hunter2","https://mail.acme.com","Work account","Email"
                      </div>
                      <button
                        onClick={handleDownloadSampleCSV}
                        style={{
                          padding: '0.5rem 0.75rem',
                          backgroundColor: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        Download sample CSV
                      </button>
                    </div>
                  </div>

                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    disabled={isProcessingCSV || isImporting}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  {importError && (
                    <p style={{ margin: '0.5rem 0 0 0', color: '#ef4444', fontSize: '0.875rem' }}>
                      {importError}
                    </p>
                  )}
                </div>

                {isProcessingCSV && (
                  <div style={{
                    padding: '1rem',
                    backgroundColor: '#dbeafe',
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                    marginBottom: '1.5rem'
                  }}>
                    <p style={{ margin: 0 }}>Processing CSV file...</p>
                  </div>
                )}

                {/* CSV Preview */}
                {csvPreview.length > 0 && !importSummary && (
                  <>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                        Found {csvTotalRows} entries
                      </p>
                      
                      {/* Category Mapping Summary */}
                      <div style={{
                        padding: '1rem',
                        backgroundColor: '#f9fafb',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem'
                      }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                          Category Detection:
                        </strong>
                        {Object.entries(categoryMapping).map(([category, count]) => (
                          <div key={category} style={{ marginBottom: '0.25rem' }}>
                            {category}: {count} entries
                          </div>
                        ))}
                      </div>

                      {/* Preview Table */}
                      <div style={{
                        maxHeight: '300px',
                        overflow: 'auto',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.5rem',
                        marginBottom: '1rem'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                            <tr>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Title</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>Category</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>URL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((entry, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>{entry.title}</td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>
                                  {entry.detectedCategory}
                                  {entry.confidence === 'high' && ' ✓'}
                                </td>
                                <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#6b7280' }}>
                                  {entry.url || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Tag Selection */}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                          Tag for all imported entries
                        </label>
                        {!showCreateTag ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select
                              value={selectedTagId}
                              onChange={(e) => setSelectedTagId(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                backgroundColor: 'white'
                              }}
                            >
                              <option value="">Select a tag...</option>
                              {tags.filter(t => !t.isSystemCategory).map(tag => (
                                <option key={tag.id} value={tag.id}>{tag.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => setShowCreateTag(true)}
                              style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              + New Tag
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="text"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              placeholder="Enter tag name"
                              style={{
                                flex: 1,
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                boxSizing: 'border-box'
                              }}
                            />
                            <button
                              onClick={handleCreateTag}
                              disabled={!newTagName.trim()}
                              style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: newTagName.trim() ? '#10b981' : '#9ca3af',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: newTagName.trim() ? 'pointer' : 'not-allowed',
                                fontSize: '0.875rem',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Create
                            </button>
                            <button
                              onClick={() => {
                                setShowCreateTag(false);
                                setNewTagName('');
                              }}
                              style={{
                                padding: '0.75rem 1rem',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Import Button */}
                      <button
                        onClick={handleCSVImport}
                        disabled={!selectedTagId || isImporting}
                        style={{
                          width: '100%',
                          padding: '0.875rem',
                          backgroundColor: (!selectedTagId || isImporting) ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: (!selectedTagId || isImporting) ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          fontWeight: 500
                        }}
                      >
                        {isImporting ? 'Importing...' : `Import ${csvTotalRows} Entries`}
                      </button>
                    </div>
                  </>
                )}

                {/* Import Summary */}
                {importSummary && (
                  <div style={{
                    padding: '1.5rem',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '0.5rem',
                    border: '2px solid #10b981'
                  }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#10b981' }}>
                      ✓ Import Complete!
                    </h3>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Total entries:</strong> {importSummary.total}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Imported:</strong> {importSummary.imported}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Skipped (duplicates):</strong> {importSummary.skipped}
                    </div>
                    <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                      <strong>Category Mapping:</strong>
                    </div>
                    <div style={{ paddingLeft: '1rem' }}>
                      {Object.entries(importSummary.categoryMapping).map(([category, count]) => (
                        <div key={category} style={{ marginBottom: '0.25rem' }}>
                          {category}: {count} entries
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={onClose}
                      style={{
                        marginTop: '1rem',
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 500
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </>
            )}

            {isImporting && importFormat === 'encrypted' && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#dbeafe',
                borderRadius: '0.5rem',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0 }}>Importing entries...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SafeImportExport;

