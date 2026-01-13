/**
 * Important Dates Section Component
 * 
 * Displays upcoming events (birthdays, anniversaries, etc.) in a collapsible section
 * Similar to MotivationalSection, but for events
 */

import React, { useState } from 'react';
import { Event } from '../types';

interface DashboardItem {
  type: 'task' | 'event';
  task?: any;
  event?: Event;
  id: string;
  name: string;
  description?: string;
  category?: string;
  isCompleted: boolean;
  weightage: number;
  color?: string;
  daysUntil?: number;
}

interface ImportantDatesSectionProps {
  events: DashboardItem[];
  onEventClick: (event: DashboardItem) => void;
  collapsed?: boolean;
}

const ImportantDatesSection: React.FC<ImportantDatesSectionProps> = ({ 
  events, 
  onEventClick, 
  collapsed = false 
}) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Birthday': '🎂',
      'Anniversary': '💝',
      'Wedding': '💒',
      'Graduation': '🎓',
      'Holiday': '🎊',
      'Special Event': '⭐',
      'Death Anniversary': '🕯️',
      'Memorial': '🌹',
      'Remembrance': '🙏',
      'New Year': '🎆',
      'Christmas': '🎄',
      'Easter': '🐰',
      'Diwali': '🪔',
      'Hanukkah': '🕎',
      'Eid': '🌙',
      'Thanksgiving': '🦃',
      'Chinese New Year': '🧧',
      'Festival': '🎪',
      'Mother\'s Day': '🌸',
      'Father\'s Day': '👔',
      'Valentine\'s Day': '💕',
      'Independence Day': '🎆',
      'Cultural Event': '🎭'
    };
    return icons[category] || '📅';
  };

  const getDaysUntilText = (daysUntil: number | undefined) => {
    if (daysUntil === undefined) return '';
    if (daysUntil === 0) return 'Today!';
    if (daysUntil === 1) return 'Tomorrow';
    return `In ${daysUntil} days`;
  };

  if (events.length === 0) {
    return null; // Don't show section if no events
  }

  return (
    <div className="important-dates-section" style={{ marginBottom: '2rem' }}>
      <div 
        className="section-header"
        onClick={toggleCollapse}
        style={{
          cursor: 'pointer',
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s ease'
        }}
      >
        <span style={{ 
          fontSize: '1.2rem', 
          fontWeight: 'bold',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          📅 Events ({events.length})
        </span>
        <span style={{ 
          fontSize: '1.5rem',
          color: 'white',
          transition: 'transform 0.3s ease',
          transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
        }}>
          ▼
        </span>
      </div>

      {!isCollapsed && (
        <div 
          className="events-container"
          style={{
            marginTop: '1rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '1rem'
          }}
        >
          {events.map((event) => {
            const isSomber = ['Death Anniversary', 'Memorial', 'Remembrance'].includes(event.category || '');
            
            return (
              <div
                key={event.id}
                onClick={() => !event.isCompleted && onEventClick(event)}
                className={`event-card ${event.isCompleted ? 'completed' : ''} ${isSomber ? 'somber' : ''}`}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  background: event.isCompleted 
                    ? '#f3f4f6' 
                    : isSomber 
                      ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                      : `linear-gradient(135deg, ${event.color || '#667eea'} 0%, ${event.color || '#764ba2'} 100%)`,
                  color: event.isCompleted ? '#6b7280' : 'white',
                  cursor: event.isCompleted ? 'default' : 'pointer',
                  opacity: event.isCompleted ? 0.6 : 1,
                  boxShadow: event.isCompleted ? 'none' : '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  marginBottom: '0.5rem'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>
                    {getCategoryIcon(event.category || '')}
                  </span>
                  <h3 style={{ 
                    margin: 0, 
                    fontSize: '1.1rem',
                    flex: 1
                  }}>
                    {event.name}
                  </h3>
                  {event.isCompleted && (
                    <span style={{ fontSize: '1.2rem' }}>✓</span>
                  )}
                </div>

                {event.category && (
                  <div style={{ 
                    fontSize: '0.85rem',
                    marginBottom: '0.5rem',
                    opacity: 0.9
                  }}>
                    {event.category}
                  </div>
                )}

                {event.daysUntil !== undefined && (
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    marginTop: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    display: 'inline-block'
                  }}>
                    {getDaysUntilText(event.daysUntil)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ImportantDatesSection;

