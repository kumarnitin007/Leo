/**
 * EntryList — Desktop Left Panel
 *
 * Searchable list of journal entries grouped by date.
 * Shows mood emoji, preview, tags, and multi-entry badge.
 */

import React, { useMemo } from 'react';
import type { JournalEntry, Tag } from '../../types';
import { getMoodEmoji } from './shared';

interface EntryListProps {
  entries: JournalEntry[];
  selectedDate: string;
  editingEntryId?: string;
  tags: Tag[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectDate: (date: string) => void;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

const EntryList: React.FC<EntryListProps> = ({
  entries, selectedDate, editingEntryId, tags, searchTerm,
  onSearchChange, onSelectDate, onSelectEntry, onNewEntry,
}) => {
  const filtered = useMemo(() => {
    if (!searchTerm) return entries;
    const q = searchTerm.toLowerCase();
    return entries.filter(e =>
      e.content.toLowerCase().includes(q) ||
      e.date.includes(q) ||
      e.tags?.some(t => {
        const tag = tags.find(tg => tg.id === t);
        return tag?.name.toLowerCase().includes(q);
      })
    );
  }, [entries, searchTerm, tags]);

  const byDate = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    filtered.forEach(e => {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    });
    return map;
  }, [filtered]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className="j-left">
      <div className="j-left-head">
        <div className="j-left-head-row">
          <span className="j-section-label">Entries</span>
          <button className="j-btn-new" onClick={onNewEntry} type="button">+ New</button>
        </div>
        <div className="j-search-box">
          <span style={{ color: 'var(--j-ink3)', fontSize: 13 }}>⌕</span>
          <input
            type="text"
            placeholder="Search entries…"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="j-entries-list">
        {[...byDate.entries()].map(([date, dateEntries]) => {
          const first = dateEntries[0];
          const isActive = date === selectedDate;
          const isSelected = editingEntryId ? dateEntries.some(e => e.id === editingEntryId) : isActive;

          return (
            <div
              key={date}
              className={`j-entry-item ${isSelected ? 'active' : ''}`}
              onClick={() => {
                onSelectDate(date);
                onSelectEntry(first);
              }}
            >
              <div className="j-entry-date">
                {formatDateLabel(date)}
                {date !== 'Today' && <span style={{ marginLeft: 2 }}>· {date}</span>}
                {dateEntries.length > 1 && (
                  <span className="j-multi-badge">{dateEntries.length} entries</span>
                )}
              </div>
              <div className="j-entry-mood-row">
                <span style={{ fontSize: 14 }}>{getMoodEmoji(first.mood)}</span>
                {first.content.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--j-ink3)' }}>Draft</span>
                )}
              </div>
              <div className="j-entry-preview">
                {first.content.substring(0, 120) || 'Writing now…'}
              </div>
              {first.tags && first.tags.length > 0 && (
                <div className="j-entry-tags">
                  {first.tags.slice(0, 3).map(tagId => {
                    const tag = tags.find(t => t.id === tagId);
                    return tag ? (
                      <span key={tagId} className="j-entry-tag">{tag.name}</span>
                    ) : null;
                  })}
                  {first.tags.length > 3 && (
                    <span className="j-entry-tag">+{first.tags.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {byDate.size === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--j-ink3)', fontSize: 12 }}>
            {searchTerm ? 'No entries match your search.' : 'No journal entries yet.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default EntryList;
