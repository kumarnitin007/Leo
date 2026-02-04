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

interface JournalViewProps {
  prefillContent?: string;
  prefillMood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  onPrefillUsed?: () => void; // Callback to clear prefill after use
}

const JournalView: React.FC<JournalViewProps> = ({ 
  prefillContent, 
  prefillMood,
  onPrefillUsed 
}) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<'great' | 'good' | 'okay' | 'bad' | 'terrible' | undefined>();
  const [prefillApplied, setPrefillApplied] = useState(false);

  // Apply prefill data from voice command
  // This should run after loadEntryForDate to ensure prefill content is not overwritten
  useEffect(() => {
    if (!prefillApplied && (prefillContent || prefillMood)) {
      // Use setTimeout to ensure this runs after loadEntryForDate completes
      const timer = setTimeout(() => {
        if (prefillContent) {
          // If there's existing content, append; otherwise use prefill
          setContent(prev => {
            if (prev && prev.trim() && !prev.includes(prefillContent || '')) {
              return `${prev}\n\n${prefillContent}`;
            }
            return prefillContent;
          });
          setIsEditing(true);
        }
        if (prefillMood) {
          setMood(prefillMood);
        }
        setPrefillApplied(true);
        onPrefillUsed?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [prefillContent, prefillMood, prefillApplied, onPrefillUsed]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showRecentEntries, setShowRecentEntries] = useState(false);

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
        // Only set content if we don't have prefill content waiting to be applied
        // This prevents overwriting prefill content when editing a voice memo
        if (!prefillContent || prefillApplied) {
          setContent(entry.content);
        }
        // Only set mood if we don't have prefill mood waiting to be applied
        if (!prefillMood || prefillApplied) {
          setMood(entry.mood);
        }
        setSelectedTags(entry.tags || []);
        setIsEditing(false);
      } else {
        setCurrentEntry(null);
        // Only clear content if we don't have prefill content waiting
        if (!prefillContent || prefillApplied) {
          setContent('');
        }
        // Only clear mood if we don't have prefill mood waiting
        if (!prefillMood || prefillApplied) {
          setMood(undefined);
        }
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

  const calculateStreaks = () => {
    if (entries.length === 0) return { current: 0, best: 0 };
    
    const sortedDates = entries.map(e => e.date).sort().reverse();
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    
    const today = formatDate(new Date());
    let checkDate = today;
    
    // Calculate current streak
    for (let i = 0; i < sortedDates.length; i++) {
      if (sortedDates[i] === checkDate) {
        currentStreak++;
        const prevDate = new Date(checkDate + 'T00:00:00');
        prevDate.setDate(prevDate.getDate() - 1);
        checkDate = formatDate(prevDate);
      } else {
        break;
      }
    }
    
    // Calculate best streak
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0 || sortedDates[i] === formatDate(new Date(new Date(sortedDates[i - 1] + 'T00:00:00').getTime() - 86400000))) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }
    
    return { current: currentStreak, best: Math.max(bestStreak, currentStreak) };
  };

  const { current: currentStreak, best: bestStreak } = calculateStreaks();

  const filteredEntries = entries.filter(entry => 
    searchTerm === '' || 
    entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.date.includes(searchTerm)
  );

  const isToday = selectedDate === formatDate(new Date());
  const canGoNext = !isToday;

  return (
    <div className="journal-view">
      {/* Mobile Header - Streak Counter Only */}
      <div className="journal-header mobile-journal-header">
        {/* Streak Counter */}
        <div className="journal-streak-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 2px 8px rgba(255, 155, 80, 0.4))' }}>🔥</span>
            <div>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, lineHeight: 1 }}>{currentStreak} Days</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 500, marginTop: '0.125rem' }}>Current streak</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700 }}>{bestStreak} Days</div>
            <div style={{ fontSize: '0.6875rem', opacity: 0.75, fontWeight: 500 }}>Best streak</div>
          </div>
        </div>
      </div>



      {/* Desktop Header */}
      <div className="journal-header desktop-journal-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <h2>📔 Daily Journal</h2>
            <p>Reflect on your day, track your thoughts and feelings</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'white', opacity: 0.9 }}>
              🔥 {currentStreak} day streak (best: {bestStreak})
            </div>
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
        {/* Main editor area */}
        <div className="journal-editor">
          {/* Combined Journal Card - Mobile-optimized single card */}
          <div className="journal-combined-card">
            {/* Date Navigator Row */}
            <div className="journal-date-row">
              <button onClick={goToPreviousDay} className="nav-btn journal-arrow-btn">
                ←
              </button>
              <div className="current-date-display">
                <div className="date-day-name">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="date-full-display">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <button 
                onClick={goToNextDay} 
                className="nav-btn journal-arrow-btn" 
                disabled={!canGoNext}
                style={{ opacity: canGoNext ? 1 : 0.5 }}
              >
                →
              </button>
            </div>

            {/* Mood Selector Row - Inline compact design */}
            <div className="mood-selector-row">
              <span className="mood-label">Feeling:</span>
              <div className="mood-buttons-inline">
                {[
                  { key: 'great', emoji: '😄' },
                  { key: 'good', emoji: '🙂' },
                  { key: 'okay', emoji: '😐' },
                  { key: 'bad', emoji: '😔' },
                  { key: 'terrible', emoji: '😟' }
                ].map(m => (
                  <button
                    key={m.key}
                    className={`mood-btn-inline ${mood === m.key ? 'active' : ''}`}
                    onClick={() => setMood(m.key as any)}
                    disabled={!isEditing}
                    title={m.key}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Journal Content */}
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
                  {content || <em style={{ color: '#9ca3af' }}>No entry for this date. Tap Edit to write.</em>}
                </div>
              )}
            </div>

            {/* Tags Section - Compact inline */}
            {availableTags.length > 0 && (
              <div className="tag-selector-inline">
                <div className="tag-buttons-inline">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      className={`tag-btn-small ${selectedTags.includes(tag.id) ? 'active' : ''}`}
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

            {/* Action Buttons Row */}
            <div className="journal-actions-row">
              <button
                onClick={isEditing ? handleSave : () => setIsEditing(true)}
                className="btn-primary journal-save-btn"
                disabled={isEditing && !content.trim()}
              >
                <span>{isEditing ? '💾' : '✏️'}</span>
                <span>{isEditing ? 'Save' : 'Edit'}</span>
              </button>

              {!isEditing && currentEntry && (
                <button onClick={handleDelete} className="btn-danger-small">
                  🗑️
                </button>
              )}

              {isEditing && currentEntry && (
                <button
                  onClick={() => {
                    loadEntryForDate(selectedDate);
                    setIsEditing(false);
                  }}
                  className="btn-secondary-small"
                >
                  ✕ Cancel
                </button>
              )}
            </div>
          </div>

          {/* Legacy Desktop Cards - Hidden on mobile via CSS */}
          <div className="journal-date-card desktop-only">
            <div className="date-navigation">
              <button onClick={goToPreviousDay} className="nav-btn journal-arrow-btn">
                ←
              </button>
              <div className="current-date-display">
                <div className="date-day-name">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="date-full-display">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <button 
                onClick={goToNextDay} 
                className="nav-btn journal-arrow-btn" 
                disabled={!canGoNext}
                style={{ opacity: canGoNext ? 1 : 0.5 }}
              >
                →
              </button>
            </div>

            {/* Mood Selector */}
            <div className="mood-selector">
              <label>How are you feeling?</label>
              <div className="mood-buttons">
                {[
                  { key: 'great', emoji: '😄' },
                  { key: 'good', emoji: '🙂' },
                  { key: 'okay', emoji: '😐' },
                  { key: 'bad', emoji: '😔' },
                  { key: 'terrible', emoji: '😟' }
                ].map(m => (
                  <button
                    key={m.key}
                    className={`mood-btn ${mood === m.key ? 'active' : ''}`}
                    onClick={() => setMood(m.key as any)}
                    disabled={!isEditing}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Entry Editor Card - Desktop */}
          <div className="journal-entry-card desktop-only">
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

            {/* Tags Section */}
            {availableTags.length > 0 && (
              <div className="tag-selector journal-tags-section">
                <label>Tags</label>
                <div className="tag-buttons journal-tag-grid">
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

            {/* Save Button */}
            <button
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
              className="btn-primary journal-save-btn"
              disabled={isEditing && !content.trim()}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
                marginTop: '1.25rem'
              }}
            >
              <span>{isEditing ? '💾' : '✏️'}</span>
              <span>{isEditing ? 'Save Entry' : 'Edit Entry'}</span>
            </button>

            {!isEditing && currentEntry && (
              <button
                onClick={handleDelete}
                className="btn-danger"
                style={{
                  width: '100%',
                  marginTop: '0.5rem'
                }}
              >
                🗑️ Delete Entry
              </button>
            )}

            {isEditing && currentEntry && (
              <button
                onClick={() => {
                  loadEntryForDate(selectedDate);
                  setIsEditing(false);
                }}
                className="btn-secondary"
                style={{
                  width: '100%',
                  marginTop: '0.5rem'
                }}
              >
                ✕ Cancel
              </button>
            )}
          </div>

          {/* Recent Entries - Mobile (Collapsible) */}
          <div className="journal-recent-entries mobile-journal-recent">
            <div 
              className="entries-header" 
              onClick={() => setShowRecentEntries(!showRecentEntries)}
              style={{ 
                cursor: 'pointer', 
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: showRecentEntries ? '1rem' : 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📖</span>
                <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>Recent Entries</span>
              </div>
              <span 
                style={{ 
                  fontSize: '1.25rem', 
                  transition: 'transform 0.3s ease',
                  transform: showRecentEntries ? 'rotate(180deg)' : 'rotate(0deg)'
                }}
              >
                ▼
              </span>
            </div>
            
            {showRecentEntries && (
              <>
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: '#6B7C8E' }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search past entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px 12px 44px',
                      border: '2px solid rgba(0, 180, 150, 0.15)',
                      borderRadius: '12px',
                      fontSize: '14px',
                      background: 'rgba(248, 252, 251, 1)',
                      transition: 'all 0.3s ease',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div className="entries-list">
                {filteredEntries.length === 0 ? (
                  <div className="no-entries">
                    <p>No journal entries yet.</p>
                    <p>Start writing to track your journey!</p>
                  </div>
                ) : (
                  filteredEntries.slice(0, 10).map(entry => (
                    <div
                      key={entry.id}
                      className={`entry-item mobile-entry-item ${entry.date === selectedDate ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedDate(entry.date);
                        setShowRecentEntries(false);
                      }}
                      style={{
                        padding: '0.875rem',
                        border: '2px solid rgba(0, 180, 150, 0.15)',
                        borderRadius: '0.875rem',
                        marginBottom: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <div className="entry-item-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                        <span className="entry-mood">{getMoodEmoji(entry.mood)}</span>
                        <span className="entry-date" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#5B8FF9', flex: 1 }}>
                          {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <span 
                          onClick={async (e) => {
                            e.stopPropagation();
                            const updatedEntry = { ...entry, isFavorite: !entry.isFavorite };
                            await saveJournalEntry(updatedEntry);
                            await loadEntries();
                          }}
                          style={{ 
                            fontSize: '16px', 
                            opacity: entry.isFavorite ? 1 : 0.3,
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                        >
                          ⭐
                        </span>
                      </div>
                      <div className="entry-preview" style={{ fontSize: '0.875rem', color: '#6B7C8E', lineHeight: 1.4, marginBottom: entry.tags && entry.tags.length > 0 ? '0.5rem' : 0 }}>
                        {entry.content.substring(0, 100)}
                        {entry.content.length > 100 && '...'}
                      </div>
                      {entry.tags && entry.tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                          {entry.tags.slice(0, 3).map(tagId => {
                            const tag = availableTags.find(t => t.id === tagId);
                            return tag ? (
                              <span
                                key={tagId}
                                style={{
                                  padding: '0.25rem 0.625rem',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.6875rem',
                                  fontWeight: 600,
                                  backgroundColor: `${tag.color}20`,
                                  color: tag.color
                                }}
                              >
                                {tag.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar with entry list - Desktop Only */}
        <div className="journal-sidebar desktop-journal-sidebar">
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
      </div>
    </div>
  );
};

export default JournalView;

