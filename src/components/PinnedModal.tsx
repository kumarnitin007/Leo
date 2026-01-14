import React, { useEffect, useState } from 'react';
import { loadData } from '../storage';
import { Task, Event } from '../types';

// Reuse gift cards modal styles for consistent look & feel

interface PinnedModalProps {
  onClose: () => void;
}

const PinnedModal: React.FC<PinnedModalProps> = ({ onClose }) => {
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
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>No pinned items yet. Tag tasks or events with "Pinned" to see them here.</p>
        </div>
      ) : (
        <div className="giftcards-grid">
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
