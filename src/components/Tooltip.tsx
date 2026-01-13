/**
 * Tooltip Component
 * 
 * Contextual help tooltips for guiding users through features
 */

import React, { useState, useEffect } from 'react';

interface TooltipProps {
  id: string;
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showOnFirstVisit?: boolean;
}

const TOOLTIP_STORAGE_KEY = 'myday-tooltips-seen';

const getSeenTooltips = (): string[] => {
  try {
    const stored = localStorage.getItem(TOOLTIP_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

const markTooltipSeen = (id: string): void => {
  try {
    const seen = getSeenTooltips();
    if (!seen.includes(id)) {
      seen.push(id);
      localStorage.setItem(TOOLTIP_STORAGE_KEY, JSON.stringify(seen));
    }
  } catch (e) {
    console.error('Error marking tooltip seen:', e);
  }
};

const Tooltip: React.FC<TooltipProps> = ({
  id,
  children,
  content,
  position = 'top',
  showOnFirstVisit = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showFirstTime, setShowFirstTime] = useState(false);

  useEffect(() => {
    if (showOnFirstVisit) {
      const seen = getSeenTooltips();
      if (!seen.includes(id)) {
        // Show tooltip after a short delay
        const timer = setTimeout(() => {
          setShowFirstTime(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [id, showOnFirstVisit]);

  const handleClose = () => {
    setShowFirstTime(false);
    markTooltipSeen(id);
  };

  const show = isVisible || showFirstTime;

  if (!show) {
    return (
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        style={{ display: 'inline-block', position: 'relative' }}
      >
        {children}
      </div>
    );
  }

  const getPositionStyles = (): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      zIndex: 10001,
      background: '#1f2937',
      color: 'white',
      padding: '0.75rem 1rem',
      borderRadius: '8px',
      fontSize: '0.875rem',
      lineHeight: 1.5,
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      maxWidth: '250px',
      whiteSpace: 'normal'
    };

    switch (position) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '8px'
        };
      case 'bottom':
        return {
          ...baseStyles,
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '8px'
        };
      case 'left':
        return {
          ...baseStyles,
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginRight: '8px'
        };
      case 'right':
        return {
          ...baseStyles,
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '8px'
        };
      default:
        return baseStyles;
    }
  };

  return (
    <div
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => {
        setIsVisible(false);
        if (showFirstTime) {
          handleClose();
        }
      }}
      style={{ display: 'inline-block', position: 'relative' }}
    >
      {children}
      <div style={getPositionStyles()}>
        {content}
        {showFirstTime && (
          <button
            onClick={handleClose}
            style={{
              position: 'absolute',
              top: '0.25rem',
              right: '0.25rem',
              background: 'transparent',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '0.25rem',
              fontSize: '1rem',
              lineHeight: 1,
              opacity: 0.7
            }}
          >
            ✕
          </button>
        )}
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            border: '6px solid transparent',
            ...(position === 'top' && {
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderTopColor: '#1f2937'
            }),
            ...(position === 'bottom' && {
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderBottomColor: '#1f2937'
            }),
            ...(position === 'left' && {
              left: '100%',
              top: '50%',
              transform: 'translateY(-50%)',
              borderLeftColor: '#1f2937'
            }),
            ...(position === 'right' && {
              right: '100%',
              top: '50%',
              transform: 'translateY(-50%)',
              borderRightColor: '#1f2937'
            })
          }}
        />
      </div>
    </div>
  );
};

export default Tooltip;

