import React, { useState, useEffect } from 'react';
import { importEventsFromFile, getEventFileTagPreview, getTags } from '../storage';
import { Tag } from '../types';

interface EventImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
  onImportSuccess?: () => void;
}

export const EventImportModal: React.FC<EventImportModalProps> = ({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  onImportSuccess
}) => {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [fileTagNames, setFileTagNames] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Record<string, string>>({});
  const [newTagNames, setNewTagNames] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        // Load available tags and file tag preview
        const [tags, fileTags] = await Promise.all([
          getTags(),
          getEventFileTagPreview(fileUrl)
        ]);

        setAvailableTags(tags);
        setFileTagNames(fileTags);

        // Initialize selectedTags with existing tags where possible
        const initialSelection: Record<string, string> = {};
        const newTags = new Set<string>();

        for (const fileTag of fileTags) {
          const existingTag = tags.find(t => t.name.toLowerCase() === fileTag.toLowerCase());
          if (existingTag) {
            initialSelection[fileTag] = existingTag.id;
          } else {
            newTags.add(fileTag);
          }
        }

        setSelectedTags(initialSelection);
        setNewTagNames(newTags);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        console.error('Error loading import data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, fileUrl]);

  const handleTagSelection = (fileTag: string, tagId: string) => {
    setSelectedTags(prev => ({
      ...prev,
      [fileTag]: tagId
    }));
    setNewTagNames(prev => {
      const updated = new Set(prev);
      updated.delete(fileTag);
      return updated;
    });
  };

  const handleCreateNewTag = (fileTag: string) => {
    setSelectedTags(prev => {
      const updated = { ...prev };
      delete updated[fileTag];
      return updated;
    });
    setNewTagNames(prev => new Set(prev).add(fileTag));
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      setError(null);
      setSuccess(null);

      // Build final tag selection including 'CREATE_NEW' signals
      const finalSelection: Record<string, string> = { ...selectedTags };
      for (const newTag of newTagNames) {
        finalSelection[newTag] = 'CREATE_NEW';
      }

      const result = await importEventsFromFile(fileUrl, finalSelection, replaceExisting);

      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => {
          onImportSuccess?.();
          onClose();
        }, 1500);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      console.error('Import error:', err);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 border-b">
          <h2 className="text-2xl font-bold">{fileName}</h2>
          <p className="text-blue-100 mt-1">Configure tags for imported events</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin">⏳</div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">Loading data...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <p className="text-green-800 dark:text-green-300 text-sm">{success}</p>
                </div>
              )}

              {/* Replace Existing Option */}
              <label className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={e => setReplaceExisting(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Replace existing events</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">Delete all current events before importing</p>
                </div>
              </label>

              {/* Tags Configuration */}
              {fileTagNames.length > 0 ? (
                <div className="space-y-3">
                  <p className="font-semibold text-gray-900 dark:text-white">Tags to Import ({fileTagNames.length})</p>
                  {fileTagNames.map(fileTag => (
                    <div key={fileTag} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
                      <p className="font-medium text-gray-900 dark:text-white">{fileTag}</p>
                      <div className="flex flex-wrap gap-2">
                        {/* Existing tags */}
                        {availableTags
                          .filter(t => t.name !== fileTag)
                          .map(tag => (
                            <button
                              key={tag.id}
                              onClick={() => handleTagSelection(fileTag, tag.id)}
                              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                                selectedTags[fileTag] === tag.id
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                              }`}
                            >
                              {tag.name}
                            </button>
                          ))}

                        {/* Create new button */}
                        <button
                          onClick={() => handleCreateNewTag(fileTag)}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition flex items-center gap-1 ${
                            newTagNames.has(fileTag)
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                        >
                          <span>+</span> Create New
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-600 dark:text-gray-400 py-4">No tags in this file</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={importing}
            className="px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={loading || importing}
            className="px-6 py-2 rounded-lg font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {importing && <span className="animate-spin">⏳</span>}
            {importing ? 'Importing...' : 'Import Events'}
          </button>
        </div>
      </div>
    </div>
  );
};
