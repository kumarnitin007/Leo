/**
 * Composer — Center Panel
 *
 * The core journal entry editor used by both desktop and mobile layouts.
 * Handles mood, energy, writing, activities, tags, and save/cancel.
 * Autosaves drafts every 30 seconds.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { JournalEntry, MoodType, Tag } from '../../types';
import { MoodPicker, EnergyPicker, ActivityChips, WriteArea, TagPicker } from './shared';

interface ComposerProps {
  // Date navigation
  selectedDate: string;
  dayEntries: JournalEntry[];
  isToday: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;

  // Editor state (lifted to parent)
  content: string;
  mood?: MoodType;
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  activities: string[];
  selectedTags: string[];
  availableTags: Tag[];
  isEditing: boolean;
  isNewEntry: boolean;
  editingEntry: JournalEntry | null;
  weather: string;
  location: string;

  // State setters
  onContentChange: (text: string) => void;
  onMoodChange: (mood: MoodType) => void;
  onEnergyChange: (level: 1 | 2 | 3 | 4 | 5) => void;
  onActivitiesChange: (acts: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  onWeatherChange: (w: string) => void;
  onLocationChange: (l: string) => void;

  // Actions
  onSave: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
  onNewEntry: () => void;
  onSelectEntry: (entry: JournalEntry) => void;

  // Autosave
  autosaveStatus?: 'idle' | 'saving' | 'saved';

  // AI nudge (optional)
  aiNudge?: string | null;
  onDismissNudge?: () => void;
  onUseNudge?: () => void;
}

const Composer: React.FC<ComposerProps> = (props) => {
  const {
    selectedDate, dayEntries, isToday, onPrevDay, onNextDay,
    content, mood, energyLevel, activities, selectedTags, availableTags,
    isEditing, isNewEntry, editingEntry, weather, location,
    onContentChange, onMoodChange, onEnergyChange, onActivitiesChange,
    onTagsChange, onWeatherChange, onLocationChange,
    onSave, onEdit, onCancel, onDelete, onNewEntry, onSelectEntry,
    autosaveStatus, aiNudge, onDismissNudge, onUseNudge,
  } = props;

  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  // Keyboard shortcut: Cmd/Ctrl+S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isEditing && content.trim()) saveRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditing, content]);

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const canGoNext = !isToday;
  const entryIndex = editingEntry ? dayEntries.findIndex(e => e.id === editingEntry.id) + 1 : dayEntries.length + 1;

  return (
    <div className="j-center">
      {/* Header */}
      <div className="j-composer-header">
        <div className="j-date-nav">
          <button className="j-date-btn" onClick={onPrevDay} type="button">←</button>
          <div>
            <div className="j-date-label">{dateLabel}</div>
            <div className="j-date-sub">
              {isToday ? 'Today' : selectedDate} · {dayEntries.length} saved entr{dayEntries.length === 1 ? 'y' : 'ies'}
            </div>
          </div>
          <button className="j-date-btn" onClick={onNextDay} disabled={!canGoNext} type="button">→</button>
        </div>
        <div className="j-header-right">
          {dayEntries.length > 0 && (
            <span className="j-entry-counter">
              Entry {isNewEntry ? dayEntries.length + 1 : entryIndex} of today
            </span>
          )}
          {autosaveStatus === 'saving' && (
            <span className="j-autosave saving">Saving…</span>
          )}
          {autosaveStatus === 'saved' && (
            <span className="j-autosave saved">Saved ✓</span>
          )}
          {isEditing ? (
            <button
              className="j-save-btn"
              onClick={onSave}
              disabled={!content.trim()}
              type="button"
            >
              Save entry
            </button>
          ) : (
            <button className="j-save-btn" onClick={onEdit} type="button">
              Edit
            </button>
          )}
        </div>
      </div>

      {/* AI Nudge Banner */}
      {aiNudge && (
        <div className="j-ai-banner">
          <div className="j-ai-icon">✦</div>
          <div>
            <div className="j-ai-label">Leo AI · nudge</div>
            <div className="j-ai-message">"{aiNudge}"</div>
          </div>
          <div className="j-ai-actions">
            {onUseNudge && <span className="j-ai-chip" onClick={onUseNudge}>Use as prompt</span>}
            {onDismissNudge && <span className="j-ai-chip" onClick={onDismissNudge}>Dismiss</span>}
          </div>
        </div>
      )}

      {/* Day entry tabs (when multiple entries exist) */}
      {dayEntries.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '8px 20px',
          borderBottom: '0.5px solid var(--j-border)',
          background: 'var(--j-white)',
          flexWrap: 'wrap',
        }}>
          {dayEntries.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelectEntry(e)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                border: editingEntry?.id === e.id && !isNewEntry ? '1.5px solid var(--j-purple)' : '1px solid var(--j-border2)',
                background: editingEntry?.id === e.id && !isNewEntry ? 'var(--j-purple-light)' : 'var(--j-white)',
                color: editingEntry?.id === e.id && !isNewEntry ? 'var(--j-purple)' : 'var(--j-ink2)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'inherit',
              }}
            >
              {getMoodEmojiLocal(e.mood)} {e.entryTime || `Entry ${i + 1}`}
            </button>
          ))}
          <button
            type="button"
            onClick={onNewEntry}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              border: isNewEntry ? '1.5px solid var(--j-purple)' : '1.5px dashed var(--j-purple)',
              background: isNewEntry ? 'var(--j-purple-light)' : 'transparent',
              color: 'var(--j-purple)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + New
          </button>
        </div>
      )}

      {/* Composer Body */}
      <div className="j-composer-body">
        <MoodPicker value={mood} onChange={onMoodChange} disabled={!isEditing} />
        <WriteArea value={content} onChange={onContentChange} disabled={!isEditing} />
        <EnergyPicker value={energyLevel} onChange={onEnergyChange} disabled={!isEditing} />
        <ActivityChips selected={activities} onChange={onActivitiesChange} disabled={!isEditing} />
        <TagPicker availableTags={availableTags} selected={selectedTags} onChange={onTagsChange} disabled={!isEditing} />

        {/* Weather & Location (compact) */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            className="j-tag-input"
            placeholder="🌤️ Weather"
            value={weather}
            onChange={e => onWeatherChange(e.target.value)}
            disabled={!isEditing}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            className="j-tag-input"
            placeholder="📍 Location"
            value={location}
            onChange={e => onLocationChange(e.target.value)}
            disabled={!isEditing}
            style={{ flex: 1 }}
          />
        </div>

        {/* Action buttons when not editing (delete, new entry) */}
        {!isEditing && editingEntry && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={() => onDelete(editingEntry.id)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--j-red)', color: 'var(--j-red)',
                background: 'var(--j-red-light)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Delete entry
            </button>
            <button
              type="button"
              onClick={onNewEntry}
              className="j-btn-new"
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}
            >
              + New Entry
            </button>
          </div>
        )}

        {/* Cancel button when editing */}
        {isEditing && (editingEntry || isNewEntry) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 11,
                border: '1px solid var(--j-border2)', color: 'var(--j-ink2)',
                background: 'var(--j-white)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ✕ Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

function getMoodEmojiLocal(moodValue?: string): string {
  const moods: Record<string, string> = { great: '😄', good: '😊', okay: '😐', bad: '😔', terrible: '😟' };
  return moods[moodValue || ''] || '📝';
}

export default Composer;
