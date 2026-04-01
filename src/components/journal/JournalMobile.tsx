/**
 * JournalMobile — Single-Column Mobile Layout
 *
 * Order: StreakBar → Header → Composer → AI Strip → Past Entries Timeline
 * Matches the mobile reference HTML mockup.
 */

import React, { useState, useMemo } from 'react';
import type { JournalEntry, MoodType, Tag } from '../../types';
import { StreakWidget, MoodPicker, WriteArea, getMoodEmoji, ACTIVITY_EMOJIS, ENERGY_OPTIONS } from './shared';
import type { StreakDotData } from './streakUtils';
import JournalReflectionCard from '../JournalReflectionCard';

interface JournalMobileProps {
  // Streak
  currentStreak: number;
  bestStreak: number;
  dots: StreakDotData[];

  // Date & entries
  selectedDate: string;
  dayEntries: JournalEntry[];
  allEntries: JournalEntry[];
  isToday: boolean;
  tags: Tag[];

  // Composer state
  content: string;
  mood?: MoodType;
  activities: string[];
  selectedTags: string[];
  isEditing: boolean;
  isNewEntry: boolean;
  editingEntry: JournalEntry | null;

  // Callbacks
  onContentChange: (text: string) => void;
  onMoodChange: (mood: MoodType) => void;
  onActivitiesChange: (acts: string[]) => void;
  onTagsChange: (tags: string[]) => void;
  onSave: () => void;
  onNewEntry: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onSelectDate: (date: string) => void;

  // AI
  aiNudge?: string | null;
  onDismissNudge?: () => void;

  // Reflection
  justSaved: boolean;
}

const JournalMobile: React.FC<JournalMobileProps> = (props) => {
  const {
    currentStreak, bestStreak, dots, selectedDate, dayEntries, allEntries,
    isToday, tags, content, mood, activities, selectedTags,
    isEditing, isNewEntry, editingEntry,
    onContentChange, onMoodChange, onActivitiesChange, onTagsChange,
    onSave, onNewEntry, onSelectEntry, onSelectDate,
    aiNudge, onDismissNudge, justSaved,
  } = props;

  const [showActivities, setShowActivities] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);

  const dateObj = new Date(selectedDate + 'T00:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // Past entries (recent, not today's draft)
  const pastEntries = useMemo(() => {
    const entries = showAllEntries ? allEntries.slice(0, 30) : allEntries.slice(0, 5);
    return entries;
  }, [allEntries, showAllEntries]);

  const toggleActivity = (act: string) => {
    onActivitiesChange(
      activities.includes(act) ? activities.filter(a => a !== act) : [...activities, act]
    );
  };

  const toggleTag = (tagId: string) => {
    onTagsChange(
      selectedTags.includes(tagId) ? selectedTags.filter(t => t !== tagId) : [...selectedTags, tagId]
    );
  };

  return (
    <div className="j-shell">
      {/* Streak Bar */}
      <StreakWidget currentStreak={currentStreak} bestStreak={bestStreak} dots={dots} compact />

      {/* Header */}
      <div className="j-mobile-header">
        <div>
          <div className="j-mobile-date">{dateLabel}</div>
          <div className="j-mobile-sub">
            {dayEntries.length} entr{dayEntries.length === 1 ? 'y' : 'ies'} today · tap + to add more
          </div>
        </div>
        <div>
          <button className="j-btn-new" onClick={onNewEntry} type="button"
            style={{ padding: '7px 16px', borderRadius: 9, fontSize: 13 }}>
            + New
          </button>
        </div>
      </div>

      {/* Composer — hero, above the fold */}
      <div className="j-mobile-composer">
        <div className="j-mobile-composer-top">
          <span style={{ fontSize: 11, color: 'var(--j-ink3)' }}>How are you feeling?</span>
          <MoodPicker value={mood} onChange={onMoodChange} compact />
        </div>

        <WriteArea value={content} onChange={onContentChange} compact />

        {/* Footer with activity/tag pills + save */}
        <div className="j-write-footer">
          {activities.length > 0 ? (
            activities.slice(0, 2).map(act => (
              <span key={act} className="j-wf-pill active" onClick={() => toggleActivity(act)}>
                {ACTIVITY_EMOJIS[act] || '•'} {act}
              </span>
            ))
          ) : (
            <span className="j-wf-pill" onClick={() => setShowActivities(true)}>+ Activity</span>
          )}

          {selectedTags.length > 0 ? (
            <span className="j-wf-pill" onClick={() => setShowTags(true)}>
              {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="j-wf-pill" onClick={() => setShowTags(true)}>+ Tag</span>
          )}

          <button
            className="j-save-btn"
            onClick={onSave}
            disabled={!content.trim()}
            type="button"
            style={{ marginLeft: 'auto', padding: '7px 20px', borderRadius: 9 }}
          >
            Save
          </button>
        </div>

        {/* Expanded activity picker */}
        {showActivities && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--j-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="j-section-label">Activities</span>
              <button type="button" onClick={() => setShowActivities(false)}
                style={{ background: 'none', border: 'none', color: 'var(--j-ink3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div className="j-chips-wrap">
              {(['exercise', 'work', 'reading', 'social', 'family', 'cooking', 'travel', 'meditation', 'music', 'creative', 'shopping', 'learning'] as const).map(act => (
                <button
                  key={act}
                  className={`j-chip ${activities.includes(act) ? 'selected' : ''}`}
                  onClick={() => toggleActivity(act)}
                  type="button"
                >
                  {ACTIVITY_EMOJIS[act]} <span style={{ textTransform: 'capitalize' }}>{act}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Expanded tag picker */}
        {showTags && tags.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--j-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="j-section-label">Tags</span>
              <button type="button" onClick={() => setShowTags(false)}
                style={{ background: 'none', border: 'none', color: 'var(--j-ink3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div className="j-tags-row">
              {tags.map(tag => (
                <span
                  key={tag.id}
                  className="j-existing-tag"
                  style={{
                    background: selectedTags.includes(tag.id) ? tag.color : undefined,
                    color: selectedTags.includes(tag.id) ? '#fff' : undefined,
                    borderColor: selectedTags.includes(tag.id) ? tag.color : undefined,
                  }}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Nudge Strip */}
      {aiNudge && (
        <div className="j-ai-strip">
          <div className="j-ai-icon" style={{ width: 20, height: 20, borderRadius: 6, fontSize: 12 }}>✦</div>
          <div className="j-ai-strip-text">"{aiNudge}"</div>
          {onDismissNudge && <span className="j-ai-dismiss" onClick={onDismissNudge}>✕</span>}
        </div>
      )}

      {/* Past Entries */}
      <div className="j-past-header">
        <span className="j-past-label">Earlier today & recent</span>
        <button className="j-past-link" onClick={() => setShowAllEntries(v => !v)} type="button">
          {showAllEntries ? 'Show less' : 'See all →'}
        </button>
      </div>

      <div className="j-timeline">
        {pastEntries.map((entry, idx) => {
          const entryDate = new Date(entry.date + 'T00:00:00');
          const isEntryToday = entry.date === selectedDate;
          const dayLabel = isEntryToday
            ? 'Today'
            : entryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const timeLabel = entry.entryTime || entryDate.toLocaleDateString('en-US', { weekday: 'short' });
          const sameDate = allEntries.filter(e => e.date === entry.date);
          const multiCount = sameDate.length;

          return (
            <div key={entry.id} className="j-t-row">
              <div className="j-t-left">
                <span className="j-t-time">{dayLabel}<br />{timeLabel}</span>
                <div className={`j-t-dot ${isEntryToday ? 'today' : 'saved'}`} />
                {idx < pastEntries.length - 1 && <div className="j-t-line" />}
              </div>
              <div className="j-t-card" onClick={() => {
                onSelectDate(entry.date);
                onSelectEntry(entry);
              }}>
                <div className="j-t-card-head">
                  <span style={{ fontSize: 16 }}>{getMoodEmoji(entry.mood)}</span>
                  {multiCount > 1 && (
                    <span className="j-multi-indicator">{multiCount} entries</span>
                  )}
                  <span className="j-t-status saved">Saved</span>
                </div>
                <div className="j-t-body">
                  {entry.content.substring(0, 120)}{entry.content.length > 120 ? '…' : ''}
                </div>
                <div className="j-t-meta">
                  {entry.tags?.slice(0, 3).map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag ? <span key={tagId} className="j-t-tag">{tag.name}</span> : null;
                  })}
                  {entry.activity?.slice(0, 1).map(act => (
                    <span key={act} className="j-t-tag activity">
                      {ACTIVITY_EMOJIS[act] || '•'} {act}
                    </span>
                  ))}
                  {entry.energyLevel && (
                    <span className="j-t-energy">
                      {ENERGY_OPTIONS.find(e => e.value === entry.energyLevel)?.emoji} {ENERGY_OPTIONS.find(e => e.value === entry.energyLevel)?.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add more entry card */}
      <div className="j-add-more" onClick={onNewEntry}>
        <div className="j-add-icon">+</div>
        <div>
          <div className="j-add-text">Add another entry</div>
          <div className="j-add-sub">Night reflection, voice note…</div>
        </div>
      </div>

      {/* AI Reflection (below timeline on mobile) */}
      <div style={{ padding: '0 14px 20px' }}>
        <JournalReflectionCard entry={editingEntry} justSaved={justSaved} />
      </div>
    </div>
  );
};

export default JournalMobile;
