import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getTodayString } from '../utils';

interface QuickAddWidgetProps {
  onAddTask: (name: string, category?: string) => void;
  onAddEvent: (name: string, date: string, time?: string) => void;
}

type AddMode = null | 'task' | 'event';

const QuickAddWidget: React.FC<QuickAddWidgetProps> = ({ onAddTask, onAddEvent }) => {
  const [mode, setMode] = useState<AddMode>(null);
  const [inputValue, setInputValue] = useState('');
  const [eventDate, setEventDate] = useState(getTodayString());
  const [eventTime, setEventTime] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (mode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (mode === 'task') {
        await onAddTask(inputValue.trim());
      } else if (mode === 'event') {
        await onAddEvent(inputValue.trim(), eventDate, eventTime || undefined);
      }
      setInputValue('');
      setEventDate(getTodayString());
      setEventTime('');
      setMode(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setInputValue('');
    setEventDate(getTodayString());
    setEventTime('');
    setMode(null);
  };

  const isWP = theme.id === 'warm-paper';

  const containerStyle: React.CSSProperties = isWP ? {
    background: '#ffffff',
    borderRadius: 10,
    padding: mode ? '10px 16px 16px' : '10px 16px',
    marginBottom: '1rem',
    border: '1px solid #E5E3DC',
    transition: 'all 0.2s ease',
  } : {
    background: theme.colors.cardBg,
    borderRadius: 16,
    padding: mode ? '16px' : '12px 16px',
    marginBottom: '1.5rem',
    border: `1px solid ${theme.colors.cardBorder}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    transition: 'all 0.2s ease',
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    flexWrap: 'wrap',
  };

  const quickButtonStyle = (isActive: boolean, color: string): React.CSSProperties => isWP ? ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 26,
    padding: '0 10px',
    borderRadius: 6,
    border: isActive ? `1px solid #1a1a1a` : '1px solid #E5E3DC',
    background: isActive ? '#1a1a1a' : '#fff',
    color: isActive ? '#fff' : '#999',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }) : ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 24,
    border: isActive ? 'none' : `1px solid ${theme.colors.cardBorder}`,
    background: isActive ? color : 'transparent',
    color: isActive ? 'white' : theme.colors.text,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });

  const inputStyle: React.CSSProperties = isWP ? {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #E5E3DC',
    fontSize: 13,
    outline: 'none',
    background: '#fff',
    color: '#1a1a1a',
  } : {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 12,
    border: `1px solid ${theme.colors.cardBorder}`,
    fontSize: 15,
    outline: 'none',
    background: theme.colors.background,
    color: theme.colors.text,
  };

  const submitButtonStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: 12,
    border: 'none',
    background: mode === 'task' ? theme.colors.primary : '#3b82f6',
    color: 'white',
    fontSize: 14,
    fontWeight: 600,
    cursor: isSubmitting ? 'not-allowed' : 'pointer',
    opacity: isSubmitting ? 0.7 : 1,
  };

  if (mode === null) {
    if (isWP) {
      // Unified Quick Add bar for warm-paper
      return (
        <div className="quick-add-widget" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          border: '0.5px solid #E0DDD6', borderRadius: 8,
          padding: '7px 12px', background: '#fff', marginBottom: '1rem',
        }}>
          <span
            onClick={() => setMode('task')}
            style={{ flex: 1, fontSize: 13, color: '#bbb', cursor: 'text' }}
          >Add a task or event...</span>
          <button onClick={() => setMode('task')}
            style={{ fontSize: 11, border: '0.5px solid #1a1a1a', color: '#1a1a1a', borderRadius: 4, padding: '2px 8px', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>
            Task
          </button>
          <button onClick={() => setMode('event')}
            style={{ fontSize: 11, border: '0.5px solid #E0DDD6', color: '#888', borderRadius: 4, padding: '2px 8px', background: 'transparent', cursor: 'pointer', fontWeight: 500 }}>
            Event
          </button>
        </div>
      );
    }
    return (
      <div style={containerStyle} className="quick-add-widget">
        <div style={buttonGroupStyle}>
          <span style={{ fontSize: 13, color: theme.colors.textLight, fontWeight: 500, marginRight: 4 }}>Quick Add:</span>
          <button
            onClick={() => setMode('task')}
            style={quickButtonStyle(false, theme.colors.primary)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${theme.colors.primary}15`;
              e.currentTarget.style.borderColor = theme.colors.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.cardBorder;
            }}
          >
            <span>✓</span>
            <span>Task</span>
          </button>
          <button
            onClick={() => setMode('event')}
            style={quickButtonStyle(false, '#3b82f6')}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#3b82f615';
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = theme.colors.cardBorder;
            }}
          >
            <span>📅</span>
            <span>Event</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="quick-add-widget">
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ 
            fontSize: 20, 
            width: 36, 
            height: 36, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            borderRadius: '50%',
            background: mode === 'task' ? `${theme.colors.primary}20` : '#3b82f620',
          }}>
            {mode === 'task' ? '✓' : '📅'}
          </span>
          <span style={{ fontSize: 15, fontWeight: 600, color: theme.colors.text }}>
            {mode === 'task' ? 'Quick Add Task' : 'Quick Add Event'}
          </span>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              marginLeft: 'auto',
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              color: theme.colors.textLight,
              cursor: 'pointer',
              fontSize: 18,
            }}
            title="Cancel"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={mode === 'task' ? 'What do you need to do?' : 'Event name...'}
            style={inputStyle}
            autoComplete="off"
          />

          {mode === 'event' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                style={{ ...inputStyle, flex: '1 1 140px' }}
              />
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                placeholder="Time (optional)"
                style={{ ...inputStyle, flex: '1 1 120px' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={!inputValue.trim() || isSubmitting}
              style={submitButtonStyle}
            >
              {isSubmitting ? 'Adding...' : mode === 'task' ? 'Add Task' : 'Add Event'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default QuickAddWidget;
