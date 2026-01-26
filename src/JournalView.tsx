/**
 * Journal View Component
 * 
 * Free-form text journal for daily reflections
 * Features:
 * - Calendar view of entries
 * - Rich text editor
 * - Date-based entries (one per day)
 * - Search and filter
 * - Tag support
 */

import React, { useState, useEffect } from 'react';
import { JournalEntry, Tag } from './types';
import {
  getJournalEntries,
  getJournalEntryByDate,
  saveJournalEntry,
  deleteJournalEntry,
  getTagsForSection,
  importSampleJournals
} from './storage';
import { formatDate } from './utils';

const JournalView: React.FC = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<'great' | 'good' | 'okay' | 'bad' | 'terrible' | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  useEffect(() => {
    const loadTagsAndEntries = async () => {
      try {
        // Get tags available for journals section
        const journalTags = await getTagsForSection('journals');
        setAvailableTags(journalTags);
        await loadEntries();
      } catch (error) {
        console.error('Error loading tags and entries:', error);
      }
    };
    loadTagsAndEntries();
  }, []);

  useEffect(() => {
    loadEntryForDate(selectedDate);
  }, [selectedDate]);

  const loadEntries = async () => {
    try {
      const allEntries = await getJournalEntries();
      setEntries(allEntries);
    } catch (error) {
      console.error('Error loading journal entries:', error);
      setEntries([]);
    }
  };

  const loadEntryForDate = async (date: string) => {
    try {
      const entry = await getJournalEntryByDate(date);
      if (entry) {
        setCurrentEntry(entry);
        setContent(entry.content);
        setMood(entry.mood);
        setSelectedTags(entry.tags || []);
        setIsEditing(false);
      } else {
        setCurrentEntry(null);
        setContent('');
        setMood(undefined);
        setSelectedTags([]);
        setIsEditing(true); // Auto-enter edit mode for new entries
      }
    } catch (error) {
      console.error('Error loading journal entry:', error);
    }
  };

  const handleSave = async () => {
    try {
      const entry: JournalEntry = {
        id: currentEntry?.id || crypto.randomUUID(),
        date: selectedDate,
        content,
        mood,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        createdAt: currentEntry?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveJournalEntry(entry);
      await loadEntries();
      await loadEntryForDate(selectedDate);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving journal entry:', error);
      alert('Failed to save journal entry. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (currentEntry && confirm('Are you sure you want to delete this journal entry?')) {
      try {
        await deleteJournalEntry(currentEntry.id);
        await loadEntries();
        setCurrentEntry(null);
        setContent('');
        setMood(undefined);
        setSelectedTags([]);
        setIsEditing(true);
      } catch (error) {
        console.error('Error deleting journal entry:', error);
        alert('Failed to delete journal entry. Please try again.');
      }
    }
  };

  const getMoodEmoji = (moodValue?: string) => {
    const moods = {
      'great': '😄',
      'good': '🙂',
      'okay': '😐',
      'bad': '😞',
      'terrible': '😢'
    };
    return moodValue ? moods[moodValue as keyof typeof moods] : '📝';
  };

  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const goToPreviousDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    date.setDate(date.getDate() - 1);
    setSelectedDate(formatDate(date));
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate + 'T00:00:00');
    const today = new Date();
    if (date < today) {
      date.setDate(date.getDate() + 1);
      setSelectedDate(formatDate(date));
    }
  };

  const goToToday = () => {
    setSelectedDate(formatDate(new Date()));
  };

  const filteredEntries = entries.filter(entry => 
    searchTerm === '' || 
    entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.date.includes(searchTerm)
  );

  const isToday = selectedDate === formatDate(new Date());
  const canGoNext = !isToday;

  return (
    <div className="journal-view">
      <div className="journal-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h2>📔 Daily Journal</h2>
            <p>Reflect on your day, track your thoughts and feelings</p>
          </div>
          <div>
            <button
              onClick={async () => {
                const clearFirst = confirm('Load sample journal entries? Click OK to clear existing entries and load samples, or Cancel to add to existing entries.');
                if (clearFirst && !confirm('⚠️ This will delete ALL your existing journal entries. Are you sure?')) return;
                try {
                  const success = await importSampleJournals(clearFirst);
                  if (success) {
                    await loadEntries();
                    alert(`Sample journal entries ${clearFirst ? 'loaded' : 'added'} successfully!`);
                  } else {
                    alert('Error importing sample journal entries. Please try again.');
                  }
                } catch (err) {
                  console.error(err);
                  alert('Error importing sample journal entries.');
                }
              }}
              className="btn-secondary"
            >
              Load Demo Journals
            </button>
          </div>
        </div>
      </div>

      <div className="journal-container">
        {/* Sidebar with entry list */}
        <div className="journal-sidebar">
          <div className="journal-search">
            <input
              type="text"
              placeholder="🔍 Search entries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="journal-entries-list">
            <h3>Recent Entries</h3>
            {filteredEntries.length === 0 ? (
              <div className="no-entries">
                <p>No journal entries yet.</p>
                <p>Start writing to track your journey!</p>
              </div>
            ) : (
              <div className="entries-list">
                {filteredEntries.map(entry => (
                  <div
                    key={entry.id}
                    className={`entry-item ${entry.date === selectedDate ? 'active' : ''}`}
                    onClick={() => setSelectedDate(entry.date)}
                  >
                    <div className="entry-item-header">
                      <span className="entry-mood">{getMoodEmoji(entry.mood)}</span>
                      <span className="entry-date">
                        {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="entry-preview">
                      {entry.content.substring(0, 100)}
                      {entry.content.length > 100 && '...'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main editor area */}
        <div className="journal-editor">
          <div className="editor-header">
            <div className="date-navigation">
              <button onClick={goToPreviousDay} className="nav-btn">
                ← Previous
              </button>
              <h3>{formatDateLong(selectedDate)}</h3>
              <button 
                onClick={goToNextDay} 
                className="nav-btn" 
                disabled={!canGoNext}
                style={{ opacity: canGoNext ? 1 : 0.5 }}
              >
                Next →
              </button>
            </div>
            
            {!isToday && (
              <button onClick={goToToday} className="btn-secondary">
                📅 Go to Today
              </button>
            )}
          </div>

          <div className="editor-metadata">
            <div className="mood-selector">
              <label>How are you feeling?</label>
              <div className="mood-buttons">
                {['great', 'good', 'okay', 'bad', 'terrible'].map(m => (
                  <button
                    key={m}
                    className={`mood-btn ${mood === m ? 'active' : ''}`}
                    onClick={() => setMood(m as any)}
                    disabled={!isEditing}
                  >
                    {getMoodEmoji(m)}
                  </button>
                ))}
              </div>
            </div>

            {availableTags.length > 0 && (
              <div className="tag-selector">
                <label>Tags</label>
                <div className="tag-buttons">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      className={`tag-btn ${selectedTags.includes(tag.id) ? 'active' : ''}`}
                      style={{
                        borderColor: tag.color,
                        backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
                        color: selectedTags.includes(tag.id) ? 'white' : tag.color
                      }}
                      onClick={() => {
                        if (!isEditing) return;
                        setSelectedTags(prev =>
                          prev.includes(tag.id)
                            ? prev.filter(t => t !== tag.id)
                            : [...prev, tag.id]
                        );
                      }}
                      disabled={!isEditing}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="editor-content">
            {isEditing ? (
              <textarea
                className="journal-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your thoughts here... How was your day? What did you learn? What are you grateful for?"
                autoFocus
              />
            ) : (
              <div className="journal-display">
                {content || <em style={{ color: '#9ca3af' }}>No entry for this date.</em>}
              </div>
            )}
          </div>

          <div className="editor-actions">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={!content.trim()}
                >
                  💾 Save Entry
                </button>
                {currentEntry && (
                  <button
                    onClick={() => {
                      loadEntryForDate(selectedDate);
                      setIsEditing(false);
                    }}
                    className="btn-secondary"
                  >
                    ✕ Cancel
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setIsEditing(true)} className="btn-primary">
                  ✏️ Edit Entry
                </button>
                {currentEntry && (
                  <button onClick={handleDelete} className="btn-danger">
                    🗑️ Delete Entry
                  </button>
                )}
              </>
            )}
          </div>

          <div className="editor-stats">
            <span>{content.length} characters</span>
            <span>{content.split(/\s+/).filter(w => w.length > 0).length} words</span>
            {currentEntry && (
              <span>Last updated: {new Date(currentEntry.updatedAt).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalView;

