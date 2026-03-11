import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface SpeedDialAction {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
}

interface SpeedDialFABProps {
  actions: SpeedDialAction[];
}

const SpeedDialFAB: React.FC<SpeedDialFABProps> = ({ actions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleActionClick = (action: SpeedDialAction) => {
    action.onClick();
    setIsOpen(false);
  };

  const fabStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '1.5rem',
    right: '1.5rem',
    zIndex: 1000,
  };

  const mainButtonStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${theme.gradient.from} 0%, ${theme.gradient.to} 100%)`,
    border: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    color: 'white',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
  };

  const actionsContainerStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 70,
    right: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    opacity: isOpen ? 1 : 0,
    visibility: isOpen ? 'visible' : 'hidden',
    transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
    transition: 'opacity 0.25s ease, transform 0.25s ease, visibility 0.25s',
  };

  const actionButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'white',
    border: `1px solid ${theme.colors.cardBorder}`,
    borderRadius: 28,
    padding: '10px 16px 10px 12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontSize: 13,
    fontWeight: 500,
    color: theme.colors.text,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  };

  const actionIconStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: theme.colors.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  };

  return (
    <div ref={containerRef} style={fabStyle} className="speed-dial-fab">
      {/* Action buttons */}
      <div style={actionsContainerStyle}>
        {actions.map((action, index) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            style={{
              ...actionButtonStyle,
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
              transform: isOpen ? 'translateX(0)' : 'translateX(20px)',
              opacity: isOpen ? 1 : 0,
            }}
            title={action.label}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(0) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
            }}
          >
            <span style={actionIconStyle}>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={mainButtonStyle}
        title={isOpen ? 'Close menu' : 'Quick actions'}
        aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
        aria-expanded={isOpen}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        }}
      >
        {isOpen ? '✕' : '⚡'}
      </button>

      <style>{`
        .speed-dial-fab {
          display: block;
        }
        
        @media (max-width: 768px) {
          .speed-dial-fab {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SpeedDialFAB;
