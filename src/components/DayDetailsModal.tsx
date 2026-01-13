/**
 * Day Details Modal Component
 * 
 * Shows detailed view of tasks and events for a selected day from monthly view
 * Includes advance reminders for upcoming events
 */

import React, { useState } from 'react';
import { Task, Event } from '../types';
import { getTodayString } from '../utils';

interface DayDetailsModalProps {
  date: string; // YYYY-MM-DD format
  tasks: Task[];
  events: Event[];
  completedTaskIds: Set<string>;
  onClose: () => void;
  onCompleteTask: (taskId: string) => void;
}

const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  date,
  tasks,
  events,
  completedTaskIds,
  onClose,
  onCompleteTask
}) => {
  const [editMode, setEditMode] = useState(false); // Reset each time modal opens
  const dateObj = new Date(date + 'T00:00:00');
  const today = getTodayString();
  const isPastDate = date < today;
  const canEdit = editMode && isPastDate;
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Calculate days until each event and filter to show advance reminders
  const getEventWithDaysUntil = (event: Event) => {
    const selectedDateObj = new Date(date + 'T00:00:00');
    const selectedYear = selectedDateObj.getFullYear();
    const selectedMonth = selectedDateObj.getMonth() + 1;
    const selectedDay = selectedDateObj.getDate();
    
    let eventDate: Date;
    
    if (event.frequency === 'yearly') {
      // For yearly events, date is in MM-DD format
      const [month, day] = event.date.split('-').map(Number);
      eventDate = new Date(selectedYear, month - 1, day);
      
      // If event already passed this year, consider next year
      if (eventDate < selectedDateObj) {
        eventDate = new Date(selectedYear + 1, month - 1, day);
      }
    } else {
      // For one-time events, date is in YYYY-MM-DD format
      eventDate = new Date(event.date + 'T00:00:00');
    }
    
    const diffTime = eventDate.getTime() - selectedDateObj.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      event,
      daysUntil: diffDays,
      showAsReminder: diffDays > 0 && diffDays <= (event.notifyDaysBefore || 0)
    };
  };

  const eventsWithReminders = events.map(getEventWithDaysUntil);
  const todayEvents = eventsWithReminders.filter(e => e.daysUntil === 0);
  const upcomingReminders = eventsWithReminders.filter(e => e.showAsReminder);

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Birthday': '🎂',
      'Anniversary': '💝',
      'Wedding': '💍',
      'Graduation': '🎓',
      'Holiday': '🎊',
      'Festival': '🎊',
      'Special Event': '⭐',
      'Death Anniversary': '🕯️',
      'Memorial': '🌹',
      'Remembrance': '🙏'
    };
    return icons[category] || '📅';
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Birthday': '#f59e0b',
      'Anniversary': '#ec4899',
      'Wedding': '#a855f7',
      'Graduation': '#3b82f6',
      'Holiday': '#10b981',
      'Festival': '#10b981',
      'Special Event': '#8b5cf6',
      'Death Anniversary': '#6b7280',
      'Memorial': '#78716c',
      'Remembrance': '#78716c'
    };
    return colors[category] || '#667eea';
  };

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '85vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="modal-header" style={{ 
          background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', 
          color: 'white' 
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem' }}>📅 {formattedDate}</h2>
            <p style={{ margin: '0.5rem 0 0 0', opacity: 0.9, fontSize: '0.9rem' }}>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} • {todayEvents.length} event{todayEvents.length !== 1 ? 's' : ''}
              {upcomingReminders.length > 0 && ` • ${upcomingReminders.length} reminder${upcomingReminders.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button className="modal-close" onClick={onClose} style={{ color: 'white' }}>×</button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* History Edit Mode Toggle - Show for all dates (but only works for past dates) */}
          <div style={{ 
            marginBottom: '1.5rem', 
            padding: '1rem', 
            background: isPastDate ? '#fef3c7' : '#f3f4f6', 
            borderRadius: '8px',
            border: `1px solid ${isPastDate ? '#fbbf24' : '#d1d5db'}`
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              cursor: isPastDate ? 'pointer' : 'not-allowed',
              fontSize: '0.95rem',
              fontWeight: 500,
              opacity: isPastDate ? 1 : 0.6
            }}>
              <input
                type="checkbox"
                checked={editMode}
                onChange={() => isPastDate && setEditMode(!editMode)}
                disabled={!isPastDate}
                style={{ width: '18px', height: '18px', cursor: isPastDate ? 'pointer' : 'not-allowed' }}
              />
              <span>Enable History Edit Mode {!isPastDate && '(Only available for past dates)'}</span>
            </label>
            {editMode && isPastDate && (
              <p style={{ 
                margin: '0.5rem 0 0 2rem', 
                fontSize: '0.85rem', 
                color: '#92400e',
                fontStyle: 'italic'
              }}>
                ✓ You can now edit task completion status for this past date.
              </p>
            )}
          </div>

          {/* Upcoming Reminders Section */}
          {upcomingReminders.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: '#1f2937',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🔔 Upcoming Reminders
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {upcomingReminders.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                      border: '2px solid #fb923c',
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem'
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>
                      {getCategoryIcon(item.event.category || '')}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: 600, 
                        color: '#1f2937',
                        marginBottom: '0.25rem'
                      }}>
                        {item.event.name}
                      </div>
                      {item.event.description && (
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: '#6b7280',
                          marginBottom: '0.25rem'
                        }}>
                          {item.event.description}
                        </div>
                      )}
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#ea580c',
                        fontWeight: 600
                      }}>
                        📅 In {item.daysUntil} day{item.daysUntil !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Events Section */}
          {todayEvents.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ 
                fontSize: '1.1rem', 
                fontWeight: 600, 
                color: '#1f2937',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🎉 Events Today
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {todayEvents.map((item, idx) => {
                  const isSomber = ['Death Anniversary', 'Memorial', 'Remembrance'].includes(item.event.category || '');
                  return (
                    <div
                      key={idx}
                      style={{
                        background: isSomber 
                          ? 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
                          : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        border: `2px solid ${getCategoryColor(item.event.category || '')}`,
                        borderRadius: '12px',
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      <span style={{ fontSize: '2rem' }}>
                        {getCategoryIcon(item.event.category || '')}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          fontWeight: 600, 
                          color: '#1f2937',
                          marginBottom: '0.25rem'
                        }}>
                          {item.event.name}
                        </div>
                        {item.event.description && (
                          <div style={{ 
                            fontSize: '0.875rem', 
                            color: '#6b7280'
                          }}>
                            {item.event.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          {tasks.length > 0 ? (() => {
            const completedTasks = tasks.filter(task => completedTaskIds.has(task.id));
            const incompleteTasks = tasks.filter(task => !completedTaskIds.has(task.id));
            
            return (
              <div>
                <h3 style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 600, 
                  color: '#1f2937',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  ✅ Tasks ({completedTasks.length}/{tasks.length} completed)
                </h3>
                
                {/* Incomplete Tasks Section */}
                {incompleteTasks.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: 600, 
                      color: '#6b7280',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      📋 Pending ({incompleteTasks.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {incompleteTasks.map((task) => (
                        <div
                          key={task.id}
                          style={{
                            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                            border: `2px solid ${task.color || '#667eea'}`,
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem'
                          }}
                        >
                          {canEdit ? (
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => onCompleteTask(task.id)}
                              style={{
                                width: '20px',
                                height: '20px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '2rem', flexShrink: 0 }}>📋</span>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontWeight: 600, 
                              color: '#1f2937',
                              marginBottom: '0.25rem'
                            }}>
                              {task.name}
                            </div>
                            {task.description && (
                              <div style={{ 
                                fontSize: '0.875rem', 
                                color: '#6b7280'
                              }}>
                                {task.description}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Completed Tasks Section */}
                {completedTasks.length > 0 && (
                  <div>
                    <h4 style={{ 
                      fontSize: '0.95rem', 
                      fontWeight: 600, 
                      color: '#6b7280',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      ✅ Completed ({completedTasks.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {completedTasks.map((task) => (
                        <div
                          key={task.id}
                          style={{
                            background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                            border: '2px solid #10b981',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            opacity: 0.85
                          }}
                        >
                          {canEdit ? (
                            <input
                              type="checkbox"
                              checked={true}
                              onChange={() => onCompleteTask(task.id)}
                              style={{
                                width: '20px',
                                height: '20px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '2rem', flexShrink: 0 }}>✅</span>
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontWeight: 600, 
                              color: '#6b7280',
                              marginBottom: '0.25rem',
                              textDecoration: 'line-through'
                            }}>
                              {task.name}
                            </div>
                            {task.description && (
                              <div style={{ 
                                fontSize: '0.875rem', 
                                color: '#6b7280'
                              }}>
                                {task.description}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : !todayEvents.length && !upcomingReminders.length ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No tasks or events</div>
              <div style={{ fontSize: '0.9rem' }}>This day is free!</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default DayDetailsModal;

