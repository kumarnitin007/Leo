import React, { useState } from 'react';
import { Task, Event } from './types';

interface TaskActionModalProps {
  task?: Task | null;
  event?: Event | null;
  itemType: 'task' | 'event';
  onComplete: (durationMinutes?: number) => void;
  onMoveToNextDay: () => void;
  onCancel: () => void;
  onStartTimer?: () => void;
}

const TaskActionModal: React.FC<TaskActionModalProps> = ({
  task,
  event,
  itemType,
  onComplete,
  onMoveToNextDay,
  onCancel,
  onStartTimer
}) => {
  const item = task || event;
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  
  if (!item) return null;
  
  const isEvent = itemType === 'event';

  const handleComplete = () => {
    if (!isEvent && showTimeInput) {
      const totalMinutes = (hours * 60) + minutes;
      onComplete(totalMinutes > 0 ? totalMinutes : undefined);
    } else {
      onComplete();
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item.name}</h3>
          {item.description && <p className="modal-description">{item.description}</p>}
        </div>
        
        <div className="modal-body">
          <p className="modal-question">What would you like to do?</p>
          
          {/* Timer Button - Only for tasks */}
          {!isEvent && onStartTimer && (
            <button 
              className="modal-btn modal-btn-timer"
              onClick={onStartTimer}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                marginBottom: '1rem'
              }}
            >
              <span className="btn-icon-large">⏱️</span>
              <span className="btn-text">
                <strong>Start Timer</strong>
                <small>Focus mode with countdown</small>
              </span>
            </button>
          )}

          {/* Time Tracking Toggle */}
          {!isEvent && (
            <div style={{
              marginBottom: '1rem',
              padding: '1rem',
              background: '#f3f4f6',
              borderRadius: '8px'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                marginBottom: showTimeInput ? '1rem' : 0
              }}>
                <input
                  type="checkbox"
                  checked={showTimeInput}
                  onChange={(e) => setShowTimeInput(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, color: '#374151' }}>
                  ⏰ Log time spent (optional)
                </span>
              </label>

              {showTimeInput && (
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'center',
                  marginTop: '1rem'
                }}>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginBottom: '0.25rem'
                    }}>
                      Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      value={hours}
                      onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginBottom: '0.25rem'
                    }}>
                      Minutes
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={minutes}
                      onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem', flexDirection: 'column', marginTop: '1.5rem' }}>
                    <button
                      onClick={() => setMinutes(15)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      15m
                    </button>
                    <button
                      onClick={() => setMinutes(30)}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      30m
                    </button>
                    <button
                      onClick={() => { setHours(1); setMinutes(0); }}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      1h
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="modal-actions">
            <button 
              className="modal-btn modal-btn-complete"
              onClick={handleComplete}
            >
              <span className="btn-icon-large">{isEvent ? '👁️' : '✓'}</span>
              <span className="btn-text">
                <strong>{isEvent ? 'Mark as Acknowledged' : 'Mark as Complete'}</strong>
                <small>{isEvent ? 'I have seen this reminder' : 'I finished this task today'}</small>
              </span>
            </button>
            
            {!isEvent && (
              <button 
                className="modal-btn modal-btn-move"
                onClick={onMoveToNextDay}
              >
                <span className="btn-icon-large">→</span>
                <span className="btn-text">
                  <strong>Move to Tomorrow</strong>
                  <small>I'll do this tomorrow</small>
                </span>
              </button>
            )}
            
            <button 
              className="modal-btn modal-btn-cancel"
              onClick={onCancel}
            >
              <span className="btn-icon-large">✕</span>
              <span className="btn-text">
                <strong>Cancel</strong>
                <small>Go back</small>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskActionModal;

