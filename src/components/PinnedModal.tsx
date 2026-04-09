import React, { useEffect, useState } from 'react';
import { loadData } from '../storage';
import { Task, Event } from '../types';

// Reuse gift cards modal styles for consistent look & feel

interface PinnedModalProps {
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

const PinnedModal: React.FC<PinnedModalProps> = ({ onClose, onNavigate }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await loadData();
        const pinnedTag = data.tags.find(t => t.name.toLowerCase() === 'pinned');
        if (!pinnedTag) {
          setTasks([]);
          setEvents([]);
        } else {
          const pid = pinnedTag.id;
          const pinnedTasks = data.tasks.filter(t => t.tags && t.tags.includes(pid));
          const pinnedEvents = data.events.filter(e => e.tags && e.tags.includes(pid));
          // Build tag map for display
          const tagMap: Record<string,string> = (data.tags || []).reduce((acc: any, tg: any) => { acc[tg.id] = tg.name; return acc; }, {});

          // Attach tag names for display
          const tasksWithTags = pinnedTasks.map(t => ({ ...t, tagNames: (t.tags || []).map(id => tagMap[id] || id) } as any));
          const eventsWithTags = pinnedEvents.map(e => ({ ...e, tagNames: (e.tags || []).map(id => tagMap[id] || id) } as any));
          setTasks(tasksWithTags as any);
          setEvents(eventsWithTags as any);
        }
      } catch (err) {
        console.error('Error loading pinned items', err);
        setTasks([]);
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="giftcards-modal-content">
      <div className="giftcards-modal-header">
        <h2>📌 Pinned Items</h2>
        <button className="modal-close-button" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading pinned items...</p>
        </div>
      ) : tasks.length === 0 && events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📌</div>
          <p style={{ color: '#6b7280', fontSize: '1rem', lineHeight: 1.6, marginBottom: 16 }}>
            No pinned items yet. To pin something, go to <strong>Tasks &amp; Events</strong> and add (or edit) a task or event — then assign the tag <strong>"pinned"</strong>. Pinned items stay visible on your dashboard until completed.
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
        <div className="giftcards-grid">
          <div style={{ padding: '8px 12px', marginBottom: 8, background: '#f9f9f6', borderRadius: 8, border: '1px dashed #d5d3cc', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>Tag any task or event with <strong>"pinned"</strong> to track it here.</span>
            {onNavigate && (
              <button onClick={() => { onClose(); onNavigate('tasks-events'); }} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: '#555' }}>+ Add</button>
            )}
          </div>
          {tasks.map((t: any) => (
            <div key={t.id} className="giftcard-item" style={{ borderLeft: `6px solid ${t.color || '#667eea'}` }}>
              <div className="giftcard-header">
                <div className="giftcard-icon">📋</div>
                <div className="giftcard-info">
                  <h3>{t.name}</h3>
                  <p className="giftcard-merchant">{t.category || 'No category'}</p>
                </div>
              </div>

              <div className="giftcard-details">
                <div className="giftcard-detail-item">
                  <span className="detail-label">Frequency:</span>
                  <span className="detail-value">{t.frequency}{t.frequencyCount ? ` (${t.frequencyCount} per ${t.frequencyPeriod || 'period'})` : ''}</span>
                </div>
                <div className="giftcard-detail-item">
                  <span className="detail-label">Tags:</span>
                  <span className="detail-value">{(t.tagNames || []).join(', ') || 'None'}</span>
                </div>
                <div className="giftcard-detail-item">
                  <span className="detail-label">Created:</span>
                  <span className="detail-value">{t.createdAt || 'N/A'}</span>
                </div>
              </div>

            </div>
          ))}

          {events.map((e: any) => (
            <div key={e.id} className="giftcard-item" style={{ borderLeft: `6px solid ${e.color || '#f97316'}` }}>
              <div className="giftcard-header">
                <div className="giftcard-icon">📅</div>
                <div className="giftcard-info">
                  <h3>{e.name}</h3>
                  <p className="giftcard-merchant">{e.category || 'No category'}</p>
                </div>
              </div>

              <div className="giftcard-details">
                <div className="giftcard-detail-item">
                  <span className="detail-label">Date:</span>
                  <span className="detail-value">{e.date} ({e.frequency})</span>
                </div>
                <div className="giftcard-detail-item">
                  <span className="detail-label">Tags:</span>
                  <span className="detail-value">{(e.tagNames || []).join(', ') || 'None'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PinnedModal;
