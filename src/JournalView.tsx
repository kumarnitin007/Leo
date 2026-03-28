/**
 * Journal View Component
 * 
 * Free-form text journal for daily reflections.
 * Supports multiple entries per day, mood, energy level,
 * activities, weather, location, and tags.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { JournalEntry, Tag, JOURNAL_ACTIVITIES } from './types';
import {
  getJournalEntries,
  getJournalEntriesForDate,
  saveJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
  getTagsForSection,
  importSampleJournals
} from './storage';
import { formatDate } from './utils';
import JournalReflectionCard from './components/JournalReflectionCard';

interface JournalViewProps {
  prefillContent?: string;
  prefillMood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  onPrefillUsed?: () => void;
}

const MOOD_OPTIONS = [
  { key: 'great', emoji: '😄', label: 'Great' },
  { key: 'good', emoji: '🙂', label: 'Good' },
  { key: 'okay', emoji: '😐', label: 'Okay' },
  { key: 'bad', emoji: '😔', label: 'Bad' },
  { key: 'terrible', emoji: '😟', label: 'Terrible' },
] as const;

const ENERGY_OPTIONS = [
  { value: 1, emoji: '🪫', label: 'Very Low' },
  { value: 2, emoji: '😴', label: 'Low' },
  { value: 3, emoji: '⚡', label: 'Medium' },
  { value: 4, emoji: '🔥', label: 'High' },
  { value: 5, emoji: '🚀', label: 'Very High' },
] as const;

const ACTIVITY_EMOJIS: Record<string, string> = {
  exercise: '🏃', work: '💼', reading: '📖', social: '👥', family: '👨‍👩‍👧', cooking: '🍳',
  travel: '✈️', meditation: '🧘', music: '🎵', creative: '🎨', shopping: '🛍️', learning: '📚',
  gaming: '🎮', nature: '🌳', cleaning: '🧹', 'self-care': '💆',
};

const JournalView: React.FC<JournalViewProps> = ({ 
  prefillContent, prefillMood, onPrefillUsed 
}) => {
  const [allEntries, setAllEntries] = useState<JournalEntry[]>([]);
  const [dayEntries, setDayEntries] = useState<JournalEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(formatDate(new Date()));
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  // Editor state
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<'great' | 'good' | 'okay' | 'bad' | 'terrible' | undefined>();
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5 | undefined>();
  const [activities, setActivities] = useState<string[]>([]);
  const [weather, setWeather] = useState('');
  const [location, setLocation] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(false);

  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showRecentEntries, setShowRecentEntries] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);

  // Apply prefill from voice command
  useEffect(() => {
    if (!prefillApplied && (prefillContent || prefillMood)) {
      const timer = setTimeout(() => {
        if (prefillContent) {
          setContent(prev => {
            if (prev && prev.trim() && !prev.includes(prefillContent || '')) {
              return `${prev}\n\n${prefillContent}`;
            }
            return prefillContent;
          });
          setIsEditing(true);
          setIsNewEntry(true);
        }
        if (prefillMood) setMood(prefillMood);
        setPrefillApplied(true);
        onPrefillUsed?.();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [prefillContent, prefillMood, prefillApplied, onPrefillUsed]);

  useEffect(() => {
    const loadTagsAndEntries = async () => {
      try {
        const journalTags = await getTagsForSection('journals');
        setAvailableTags(journalTags);
        await loadAllEntries();
      } catch (error) {
        console.error('Error loading tags and entries:', error);
      }
    };
    loadTagsAndEntries();
  }, []);

  useEffect(() => {
    loadDayEntries(selectedDate);
    setJustSaved(false);
  }, [selectedDate]);

  const loadAllEntries = async () => {
    try {
      const entries = await getJournalEntries();
      setAllEntries(entries);
    } catch (error) {
      console.error('Error loading journal entries:', error);
      setAllEntries([]);
    }
  };

  const loadDayEntries = async (date: string) => {
    try {
      const entries = await getJournalEntriesForDate(date);
      setDayEntries(entries);
      if (entries.length > 0 && !isEditing) {
        selectEntry(entries[0]);
      } else if (entries.length === 0) {
        resetEditor();
        setIsEditing(true);
        setIsNewEntry(true);
      }
    } catch (error) {
      console.error('Error loading day entries:', error);
    }
  };

  const selectEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setContent(entry.content);
    setMood(entry.mood);
    setEnergyLevel(entry.energyLevel);
    setActivities(entry.activity || []);
    setWeather(entry.weather || '');
    setLocation(entry.location || '');
    setSelectedTags(entry.tags || []);
    setIsEditing(false);
    setIsNewEntry(false);
  };

  const resetEditor = () => {
    setEditingEntry(null);
    setContent('');
    setMood(undefined);
    setEnergyLevel(undefined);
    setActivities([]);
    setWeather('');
    setLocation('');
    setSelectedTags([]);
    setShowTags(false);
    setShowActivities(false);
    setShowMetadata(false);
  };

  const startNewEntry = () => {
    resetEditor();
    setIsEditing(true);
    setIsNewEntry(true);
  };

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    try {
      if (isNewEntry || !editingEntry) {
        const entry: JournalEntry = {
          id: crypto.randomUUID(),
          date: selectedDate,
          content,
          mood,
          energyLevel,
          activity: activities.length > 0 ? activities : undefined,
          weather: weather.trim() || undefined,
          location: location.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveJournalEntry(entry);
      } else {
        await updateJournalEntry(editingEntry.id, {
          content,
          mood,
          energyLevel,
          activity: activities.length > 0 ? activities : undefined,
          weather: weather.trim() || undefined,
          location: location.trim() || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
        });
      }
      await loadAllEntries();
      await loadDayEntries(selectedDate);
      setIsEditing(false);
      setIsNewEntry(false);
      setJustSaved(true);
    } catch (error) {
      console.error('Error saving journal entry:', error);
      alert('Failed to save journal entry. Please try again.');
    }
  }, [content, mood, energyLevel, activities, weather, location, selectedTags, selectedDate, isNewEntry, editingEntry]);

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await deleteJournalEntry(entryId);
      await loadAllEntries();
      await loadDayEntries(selectedDate);
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      alert('Failed to delete journal entry.');
    }
  };

  const getMoodEmoji = (moodValue?: string) => {
    const m = MOOD_OPTIONS.find(o => o.key === moodValue);
    return m ? m.emoji : '📝';
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

  const goToToday = () => setSelectedDate(formatDate(new Date()));

  const calculateStreaks = () => {
    if (allEntries.length === 0) return { current: 0, best: 0 };
    const uniqueDates = [...new Set(allEntries.map(e => e.date))].sort().reverse();
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    const today = formatDate(new Date());
    let checkDate = today;

    for (let i = 0; i < uniqueDates.length; i++) {
      if (uniqueDates[i] === checkDate) {
        currentStreak++;
        const prevDate = new Date(checkDate + 'T00:00:00');
        prevDate.setDate(prevDate.getDate() - 1);
        checkDate = formatDate(prevDate);
      } else break;
    }
    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0 || uniqueDates[i] === formatDate(new Date(new Date(uniqueDates[i - 1] + 'T00:00:00').getTime() - 86400000))) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 1;
      }
    }
    return { current: currentStreak, best: Math.max(bestStreak, currentStreak) };
  };

  const { current: currentStreak, best: bestStreak } = calculateStreaks();
  const filteredEntries = allEntries.filter(entry =>
    searchTerm === '' ||
    entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.date.includes(searchTerm)
  );
  const isToday = selectedDate === formatDate(new Date());
  const canGoNext = !isToday;

  // Group entries by date for the sidebar
  const entriesByDate = new Map<string, JournalEntry[]>();
  filteredEntries.forEach(e => {
    const list = entriesByDate.get(e.date) || [];
    list.push(e);
    entriesByDate.set(e.date, list);
  });

  const toggleActivity = (act: string) => {
    if (!isEditing) return;
    setActivities(prev => prev.includes(act) ? prev.filter(a => a !== act) : [...prev, act]);
  };

  // ── Render helpers ───────────────────────────────────────────────────

  const renderMoodSelector = () => (
    <div className="mood-selector-row">
      <span className="mood-label">Feeling:</span>
      <div className="mood-buttons-inline">
        {MOOD_OPTIONS.map(m => (
          <button
            key={m.key}
            className={`mood-btn-inline ${mood === m.key ? 'active' : ''}`}
            onClick={() => setMood(m.key as any)}
            disabled={!isEditing}
            title={m.label}
          >
            {m.emoji}
          </button>
        ))}
      </div>
    </div>
  );

  const renderEnergySelector = () => (
    <div className="mood-selector-row" style={{ marginTop: 4 }}>
      <span className="mood-label">Energy:</span>
      <div className="mood-buttons-inline">
        {ENERGY_OPTIONS.map(e => (
          <button
            key={e.value}
            className={`mood-btn-inline ${energyLevel === e.value ? 'active' : ''}`}
            onClick={() => setEnergyLevel(e.value as any)}
            disabled={!isEditing}
            title={e.label}
            style={{ fontSize: '1rem' }}
          >
            {e.emoji}
          </button>
        ))}
      </div>
    </div>
  );

  const renderActivities = () => (
    <div style={{ padding: '0 0.5rem' }}>
      <button
        onClick={() => setShowActivities(prev => !prev)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '0.8125rem', fontWeight: 600, color: '#6B7280',
          padding: '6px 0', width: '100%',
        }}
      >
        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showActivities ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        Activities {activities.length > 0 && <span style={{ color: '#10B981', fontSize: 11 }}>({activities.length})</span>}
      </button>
      {showActivities && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0 8px' }}>
          {JOURNAL_ACTIVITIES.map(act => (
            <button
              key={act}
              onClick={() => toggleActivity(act)}
              disabled={!isEditing}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: '1.5px solid',
                borderColor: activities.includes(act) ? '#10B981' : '#E5E7EB',
                background: activities.includes(act) ? '#10B98118' : 'transparent',
                color: activities.includes(act) ? '#059669' : '#6B7280',
                cursor: isEditing ? 'pointer' : 'default', transition: 'all 0.15s',
                opacity: isEditing ? 1 : 0.7,
              }}
            >
              <span>{ACTIVITY_EMOJIS[act] || '•'}</span>
              <span style={{ textTransform: 'capitalize' }}>{act}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderMetadata = () => (
    <div style={{ padding: '0 0.5rem' }}>
      <button
        onClick={() => setShowMetadata(prev => !prev)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: '0.8125rem', fontWeight: 600, color: '#6B7280',
          padding: '6px 0', width: '100%',
        }}
      >
        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showMetadata ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
        Weather & Location {(weather || location) && <span style={{ color: '#3B82F6', fontSize: 11 }}>✓</span>}
      </button>
      {showMetadata && (
        <div style={{ display: 'flex', gap: 8, padding: '4px 0 8px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 120px' }}>
            <input
              type="text"
              placeholder="🌤️ Weather"
              value={weather}
              onChange={e => setWeather(e.target.value)}
              disabled={!isEditing}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 10,
                border: '1.5px solid #E5E7EB', fontSize: 13, background: '#FAFAFA',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <input
              type="text"
              placeholder="📍 Location"
              value={location}
              onChange={e => setLocation(e.target.value)}
              disabled={!isEditing}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 10,
                border: '1.5px solid #E5E7EB', fontSize: 13, background: '#FAFAFA',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderTagsCollapsible = () => {
    if (availableTags.length === 0) return null;
    return (
      <div style={{ padding: '0 0.5rem' }}>
        <button
          onClick={() => setShowTags(prev => !prev)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: '0.8125rem', fontWeight: 600, color: '#6B7280',
            padding: '6px 0', width: '100%',
          }}
        >
          <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showTags ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
          Tags {selectedTags.length > 0 && <span style={{ color: '#8B5CF6', fontSize: 11 }}>({selectedTags.length})</span>}
        </button>
        {showTags && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '4px 0 8px' }}>
            {availableTags.map(tag => (
              <button
                key={tag.id}
                className={`tag-btn-small ${selectedTags.includes(tag.id) ? 'active' : ''}`}
                style={{
                  borderColor: tag.color,
                  backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
                  color: selectedTags.includes(tag.id) ? 'white' : tag.color,
                }}
                onClick={() => {
                  if (!isEditing) return;
                  setSelectedTags(prev =>
                    prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id]
                  );
                }}
                disabled={!isEditing}
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDayEntriesList = () => {
    if (dayEntries.length <= 1 && isEditing) return null;
    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        padding: '8px 12px', borderBottom: '1px solid rgba(0,180,150,0.1)',
      }}>
        {dayEntries.map((e, i) => (
          <button
            key={e.id}
            onClick={() => { selectEntry(e); setIsEditing(false); }}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: '1.5px solid',
              borderColor: editingEntry?.id === e.id && !isNewEntry ? '#10B981' : '#E5E7EB',
              background: editingEntry?.id === e.id && !isNewEntry ? '#10B98118' : 'transparent',
              color: editingEntry?.id === e.id && !isNewEntry ? '#059669' : '#6B7280',
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {getMoodEmoji(e.mood)}
            <span>{e.entryTime || `Entry ${i + 1}`}</span>
          </button>
        ))}
        <button
          onClick={startNewEntry}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1.5px dashed #10B981', background: isNewEntry ? '#10B98118' : 'transparent',
            color: '#10B981', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          + New
        </button>
      </div>
    );
  };

  const renderEntryCard = (entry: JournalEntry, compact = false) => {
    const entryActivities = entry.activity || [];
    return (
      <div style={{ fontSize: compact ? 12 : 13, lineHeight: 1.5, color: '#374151' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {entry.mood && <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{getMoodEmoji(entry.mood)} {entry.mood}</span>}
          {entry.energyLevel && <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>{ENERGY_OPTIONS[entry.energyLevel - 1]?.emoji} Energy {entry.energyLevel}/5</span>}
          {entry.weather && <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>🌤️ {entry.weather}</span>}
          {entry.location && <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>📍 {entry.location}</span>}
          {entryActivities.length > 0 && entryActivities.slice(0, 3).map(a =>
            <span key={a} style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
              {ACTIVITY_EMOJIS[a] || '•'} {a}
            </span>
          )}
        </div>
        <div style={{ whiteSpace: 'pre-line' }}>
          {compact ? (entry.content.substring(0, 120) + (entry.content.length > 120 ? '...' : '')) : entry.content}
        </div>
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────────

  return (
    <div className="journal-view">
      {/* Mobile Header - Streak Counter Only */}
      <div className="journal-header mobile-journal-header">
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
                    await loadAllEntries();
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
              <button onClick={goToPreviousDay} className="nav-btn journal-arrow-btn">←</button>
              <div className="current-date-display">
                <div className="date-day-name">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="date-full-display">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {dayEntries.length > 1 && (
                    <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginLeft: 8 }}>
                      {dayEntries.length} entries
                    </span>
                  )}
                </div>
              </div>
              <button onClick={goToNextDay} className="nav-btn journal-arrow-btn" disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.5 }}>→</button>
            </div>

            {/* Day entries tab bar (multiple entries per day) */}
            {renderDayEntriesList()}

            {/* Mood & Energy Selectors */}
            {renderMoodSelector()}
            {renderEnergySelector()}

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
                  {content ? renderEntryCard({ ...editingEntry!, content, mood, energyLevel, activity: activities, weather, location } as JournalEntry) : <em style={{ color: '#9ca3af' }}>No entry for this date. Tap Edit to write.</em>}
                </div>
              )}
            </div>

            {/* Collapsible sections: Activities, Metadata, Tags */}
            {renderActivities()}
            {renderMetadata()}
            {renderTagsCollapsible()}

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

              {!isEditing && editingEntry && (
                <button onClick={() => handleDelete(editingEntry.id)} className="btn-danger-small">🗑️</button>
              )}

              {isEditing && (editingEntry || isNewEntry) && (
                <button
                  onClick={() => {
                    if (editingEntry && !isNewEntry) {
                      selectEntry(editingEntry);
                    } else if (dayEntries.length > 0) {
                      selectEntry(dayEntries[0]);
                    }
                    setIsEditing(false);
                    setIsNewEntry(false);
                  }}
                  className="btn-secondary-small"
                >
                  ✕ Cancel
                </button>
              )}

              {!isEditing && dayEntries.length > 0 && (
                <button onClick={startNewEntry} className="btn-secondary-small" style={{ marginLeft: 'auto' }}>
                  + New Entry
                </button>
              )}
            </div>

            {/* AI Reflection — mobile */}
            <JournalReflectionCard entry={editingEntry} justSaved={justSaved} />
          </div>

          {/* Legacy Desktop Cards - Hidden on mobile via CSS */}
          <div className="journal-date-card desktop-only">
            <div className="date-navigation">
              <button onClick={goToPreviousDay} className="nav-btn journal-arrow-btn">←</button>
              <div className="current-date-display">
                <div className="date-day-name">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <div className="date-full-display">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {dayEntries.length > 1 && (
                    <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600, marginLeft: 8 }}>
                      {dayEntries.length} entries
                    </span>
                  )}
                </div>
              </div>
              <button onClick={goToNextDay} className="nav-btn journal-arrow-btn" disabled={!canGoNext} style={{ opacity: canGoNext ? 1 : 0.5 }}>→</button>
            </div>

            {/* Day entries tab bar (desktop) */}
            {renderDayEntriesList()}

            {/* Mood & Energy Selector */}
            <div className="mood-selector">
              <label>How are you feeling?</label>
              <div className="mood-buttons">
                {MOOD_OPTIONS.map(m => (
                  <button key={m.key} className={`mood-btn ${mood === m.key ? 'active' : ''}`}
                    onClick={() => setMood(m.key as any)} disabled={!isEditing}>
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="mood-selector" style={{ marginTop: 4 }}>
              <label>Energy level</label>
              <div className="mood-buttons">
                {ENERGY_OPTIONS.map(e => (
                  <button key={e.value} className={`mood-btn ${energyLevel === e.value ? 'active' : ''}`}
                    onClick={() => setEnergyLevel(e.value as any)} disabled={!isEditing}
                    title={e.label}>
                    {e.emoji}
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
                  {content ? renderEntryCard({ ...editingEntry!, content, mood, energyLevel, activity: activities, weather, location } as JournalEntry) : <em style={{ color: '#9ca3af' }}>No entry for this date.</em>}
                </div>
              )}
            </div>

            {/* Collapsible: Activities, Metadata, Tags (desktop) */}
            {renderActivities()}
            {renderMetadata()}
            {renderTagsCollapsible()}

            {/* Save Button */}
            <button
              onClick={isEditing ? handleSave : () => setIsEditing(true)}
              className="btn-primary journal-save-btn"
              disabled={isEditing && !content.trim()}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '0.625rem', marginTop: '1.25rem',
              }}
            >
              <span>{isEditing ? '💾' : '✏️'}</span>
              <span>{isEditing ? 'Save Entry' : 'Edit Entry'}</span>
            </button>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {!isEditing && editingEntry && (
                <button onClick={() => handleDelete(editingEntry.id)} className="btn-danger" style={{ flex: 1 }}>
                  🗑️ Delete Entry
                </button>
              )}
              {isEditing && (editingEntry || isNewEntry) && (
                <button
                  onClick={() => {
                    if (editingEntry && !isNewEntry) selectEntry(editingEntry);
                    else if (dayEntries.length > 0) selectEntry(dayEntries[0]);
                    setIsEditing(false); setIsNewEntry(false);
                  }}
                  className="btn-secondary" style={{ flex: 1 }}
                >
                  ✕ Cancel
                </button>
              )}
              {!isEditing && dayEntries.length > 0 && (
                <button onClick={startNewEntry} className="btn-secondary" style={{ flex: 1 }}>
                  + New Entry
                </button>
              )}
            </div>
          </div>

          {/* AI Reflection — desktop */}
          <div className="desktop-only">
            <JournalReflectionCard entry={editingEntry} justSaved={justSaved} />
          </div>

          {/* Recent Entries - Mobile (Collapsible) */}
          <div className="journal-recent-entries mobile-journal-recent">
            <div 
              className="entries-header" 
              onClick={() => setShowRecentEntries(!showRecentEntries)}
              style={{ 
                cursor: 'pointer', userSelect: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: showRecentEntries ? '1rem' : 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📖</span>
                <span style={{ fontSize: '1.125rem', fontWeight: 700 }}>Recent Entries</span>
              </div>
              <span style={{ fontSize: '1.25rem', transition: 'transform 0.3s ease', transform: showRecentEntries ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
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
                      width: '100%', padding: '12px 14px 12px 44px',
                      border: '2px solid rgba(0, 180, 150, 0.15)', borderRadius: '12px',
                      fontSize: '14px', background: 'rgba(248, 252, 251, 1)',
                      transition: 'all 0.3s ease', boxSizing: 'border-box',
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
                    [...entriesByDate.entries()].slice(0, 10).map(([date, dateEntries]) => (
                      <div
                        key={date}
                        className={`entry-item mobile-entry-item ${date === selectedDate ? 'active' : ''}`}
                        onClick={() => { setSelectedDate(date); setShowRecentEntries(false); }}
                        style={{
                          padding: '0.875rem', border: '2px solid rgba(0, 180, 150, 0.15)',
                          borderRadius: '0.875rem', marginBottom: '0.75rem',
                          cursor: 'pointer', transition: 'all 0.3s ease',
                        }}
                      >
                        <div className="entry-item-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                          <span className="entry-mood">{getMoodEmoji(dateEntries[0].mood)}</span>
                          <span className="entry-date" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#5B8FF9', flex: 1 }}>
                            {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {dateEntries.length > 1 && (
                            <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>{dateEntries.length} entries</span>
                          )}
                          <span
                            onClick={async (e) => {
                              e.stopPropagation();
                              const updatedEntry = { ...dateEntries[0], isFavorite: !dateEntries[0].isFavorite };
                              await saveJournalEntry(updatedEntry);
                              await loadAllEntries();
                            }}
                            style={{ fontSize: '16px', opacity: dateEntries[0].isFavorite ? 1 : 0.3, cursor: 'pointer', transition: 'all 0.3s ease' }}
                          >⭐</span>
                        </div>
                        <div className="entry-preview" style={{ fontSize: '0.875rem', color: '#6B7C8E', lineHeight: 1.4, marginBottom: dateEntries[0].tags && dateEntries[0].tags.length > 0 ? '0.5rem' : 0 }}>
                          {dateEntries[0].content.substring(0, 100)}
                          {dateEntries[0].content.length > 100 && '...'}
                        </div>
                        {dateEntries[0].tags && dateEntries[0].tags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            {dateEntries[0].tags.slice(0, 3).map(tagId => {
                              const tag = availableTags.find(t => t.id === tagId);
                              return tag ? (
                                <span key={tagId} style={{ padding: '0.25rem 0.625rem', borderRadius: '0.375rem', fontSize: '0.6875rem', fontWeight: 600, backgroundColor: `${tag.color}20`, color: tag.color }}>{tag.name}</span>
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
                {[...entriesByDate.entries()].map(([date, dateEntries]) => (
                  <div
                    key={date}
                    className={`entry-item ${date === selectedDate ? 'active' : ''}`}
                    onClick={() => setSelectedDate(date)}
                  >
                    <div className="entry-item-header">
                      <span className="entry-mood">{getMoodEmoji(dateEntries[0].mood)}</span>
                      <span className="entry-date">
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {dateEntries.length > 1 && (
                        <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600, marginLeft: 4 }}>{dateEntries.length}</span>
                      )}
                    </div>
                    <div className="entry-preview">
                      {dateEntries[0].content.substring(0, 100)}
                      {dateEntries[0].content.length > 100 && '...'}
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
