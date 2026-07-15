/**
 * Milestones Modal Component
 * 
 * Displays all tasks and events tagged with "milestone"
 */

import React, { useState, useEffect } from 'react';
import { Task, Event, Tag } from '../types';
import { getTasks, getEvents, getTags } from '../storage';

interface MilestonesModalProps {
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

type MilestoneItem = {
  id: string;
  name: string;
  date: string;
  category?: string;
  type: 'task' | 'event';
  daysRemaining: number;
};

type ViewMode = 'cards' | 'list' | 'counter';

const MilestonesModal: React.FC<MilestonesModalProps> = ({ onClose, onNavigate }) => {
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    loadMilestones();
  }, []);

  const loadMilestones = async () => {
    try {
      const [tasks, events, tags] = await Promise.all([
        getTasks(),
        getEvents(),
        getTags()
      ]);

      // Find the milestone tag
      const milestoneTag = tags.find(tag => 
        tag.name.toLowerCase() === 'milestone'
      );

      if (!milestoneTag) {
        setMilestones([]);
        setLoading(false);
        return;
      }

      const milestoneItems: MilestoneItem[] = [];

      // Process tasks with milestone tag
      tasks.forEach(task => {
        if (task.tags && task.tags.includes(milestoneTag.id)) {
          let dateStr = '';
          let daysRemaining = 0;

          // Determine date based on task type
          if (task.specificDate) {
            dateStr = task.specificDate;
            const date = new Date(task.specificDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          } else if (task.endDate) {
            dateStr = task.endDate;
            const date = new Date(task.endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          } else if (task.startDate) {
            dateStr = task.startDate;
            const date = new Date(task.startDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            // For recurring tasks without specific date, skip or use today
            return;
          }

          milestoneItems.push({
            id: task.id,
            name: task.name,
            date: dateStr,
            category: task.category,
            type: 'task',
            daysRemaining
          });
        }
      });

      // Process events with milestone tag
      events.forEach(event => {
        if (event.tags && event.tags.includes(milestoneTag.id)) {
          let dateStr = '';
          let daysRemaining = 0;

          // Parse event date (MM-DD for yearly, YYYY-MM-DD for one-time)
          if (event.frequency === 'yearly') {
            // For yearly events, use this year's date
            const dateParts = event.date.split('-');
            let month: string, day: string;
            
            if (dateParts.length === 2) {
              // MM-DD format
              [month, day] = dateParts;
            } else if (dateParts.length === 3) {
              // YYYY-MM-DD format, extract MM-DD
              [, month, day] = dateParts;
            } else {
              return; // Invalid date format
            }
            
            const today = new Date();
            const currentYear = today.getFullYear();
            const eventDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
            
            // If date has passed this year, use next year
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const eventDateStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            
            if (eventDateStart < todayStart) {
              eventDate.setFullYear(currentYear + 1);
            }
            
            dateStr = `${eventDate.getFullYear()}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            eventDate.setHours(0, 0, 0, 0);
            todayStart.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((eventDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            // One-time event
            dateStr = event.date;
            const date = new Date(event.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }

          milestoneItems.push({
            id: event.id,
            name: event.name,
            date: dateStr,
            category: event.category,
            type: 'event',
            daysRemaining
          });
        }
      });

      // Sort by days remaining (ascending - closest first)
      milestoneItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

      setMilestones(milestoneItems);
    } catch (error) {
      console.error('Error loading milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    // Parse date string manually to avoid timezone issues
    // dateStr is in YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDaysRemaining = (days: number): string => {
    if (days < 0) {
      return `${Math.abs(days)} days ago`;
    }
    if (days === 0) {
      return 'Today';
    }
    if (days === 1) {
      return '1 day to go';
    }
    return `${days} days to go`;
  };

  const badgeClass = (days: number): string =>
    days < 0 ? 'past' : days === 0 ? 'today' : 'upcoming';

  const categories = Array.from(
    new Set(milestones.map(m => m.category).filter((c): c is string => !!c))
  ).sort();

  const visibleMilestones = categoryFilter === 'all'
    ? milestones
    : milestones.filter(m => (m.category || 'Uncategorized') === categoryFilter);

  const renderFooterNote = () => (
    <div className="milestones-footer-note">
      <span>
        <strong>Add a milestone:</strong> tag any task or event with <strong>"milestone"</strong> — it lands here automatically with a live countdown.
      </span>
      {onNavigate && (
        <button
          className="milestones-footer-add"
          onClick={() => { onClose(); onNavigate('tasks-events'); }}
        >
          + New milestone
        </button>
      )}
    </div>
  );

  return (
    <div className="milestones-modal-content">
      <div className="milestones-modal-header">
        <h2>🎯 Milestones</h2>
        <button 
          className="modal-close-button" 
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading milestones...</p>
        </div>
      ) : milestones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
          <p style={{ color: '#6b7280', fontSize: '1rem', lineHeight: 1.6, marginBottom: 16 }}>
            No milestones yet. To create one, go to <strong>Tasks &amp; Events</strong> and add (or edit) a task or event — then assign the tag <strong>"milestone"</strong>.
          </p>
          {onNavigate && (
            <button
              onClick={() => { onClose(); onNavigate('tasks-events'); }}
              style={{
                background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Create in Tasks &amp; Events
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="milestones-toolbar">
            <div className="milestones-view-toggle" role="tablist" aria-label="View mode">
              {([
                { id: 'cards', label: 'Cards' },
                { id: 'list', label: 'List' },
                { id: 'counter', label: 'Counter' },
              ] as { id: ViewMode; label: string }[]).map(v => (
                <button
                  key={v.id}
                  className={`milestones-view-btn ${viewMode === v.id ? 'active' : ''}`}
                  onClick={() => setViewMode(v.id)}
                  role="tab"
                  aria-selected={viewMode === v.id}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {categories.length > 0 && (
              <div className="milestones-category-chips">
                <button
                  className={`milestones-chip ${categoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`milestones-chip ${categoryFilter === cat ? 'active' : ''}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {viewMode === 'cards' && (
            <div className="milestones-grid">
              {visibleMilestones.map((milestone) => (
                <div
                  key={`${milestone.type}-${milestone.id}`}
                  className="milestone-item"
                >
                  <div className="milestone-days-remaining">
                    <div className={`days-badge ${badgeClass(milestone.daysRemaining)}`}>
                      <span className="days-number">{Math.abs(milestone.daysRemaining)}</span>
                      <span className="days-label">
                        {milestone.daysRemaining < 0 ? 'DAYS AGO' : milestone.daysRemaining === 0 ? 'TODAY' : 'DAYS TO GO'}
                      </span>
                      <div className="milestone-name-in-badge">
                        <h3>{milestone.name}</h3>
                      </div>
                    </div>
                  </div>

                  <div className="milestone-content">
                    <div className="milestone-date-row">
                      <div className="milestone-date-box">
                        <div className="date-content">
                          <span className="date-icon">📅</span>
                          <span className="date-text">{formatDate(milestone.date)}</span>
                        </div>
                      </div>
                      {milestone.category && (
                        <div className="milestone-category-box">
                          <span className="category-text">{milestone.category}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'list' && (
            <div className="milestones-list">
              {visibleMilestones.map((milestone) => (
                <div key={`${milestone.type}-${milestone.id}`} className="milestone-list-row">
                  <div className={`milestone-list-count ${badgeClass(milestone.daysRemaining)}`}>
                    <span className="milestone-list-number">{Math.abs(milestone.daysRemaining)}</span>
                    <span className="milestone-list-unit">
                      {milestone.daysRemaining === 0 ? 'today' : milestone.daysRemaining < 0 ? 'days ago' : 'days'}
                    </span>
                  </div>
                  <div className="milestone-list-main">
                    <span className="milestone-list-name">{milestone.name}</span>
                    <span className="milestone-list-meta">
                      {formatDate(milestone.date)}{milestone.category ? ` · ${milestone.category}` : ''}
                    </span>
                  </div>
                  <span className="milestone-list-status">{formatDaysRemaining(milestone.daysRemaining)}</span>
                </div>
              ))}
            </div>
          )}

          {viewMode === 'counter' && (
            <div className="milestones-counter-grid">
              {visibleMilestones.map((milestone) => (
                <div key={`${milestone.type}-${milestone.id}`} className={`milestone-counter ${badgeClass(milestone.daysRemaining)}`}>
                  <span className="milestone-counter-number">{Math.abs(milestone.daysRemaining)}</span>
                  <span className="milestone-counter-label">
                    {milestone.daysRemaining < 0 ? 'DAYS AGO' : milestone.daysRemaining === 0 ? 'TODAY' : 'DAYS TO GO'}
                  </span>
                  <span className="milestone-counter-name">{milestone.name}</span>
                </div>
              ))}
            </div>
          )}

          {renderFooterNote()}
        </>
      )}
    </div>
  );
};

export default MilestonesModal;

