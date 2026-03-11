/**
 * Keyboard Shortcuts Help Overlay
 * 
 * Shows available keyboard shortcuts when user presses "?".
 * Can also be triggered programmatically.
 * 
 * Usage:
 * ```tsx
 * // Add to App.tsx - it handles "?" key automatically
 * <KeyboardShortcutsOverlay />
 * 
 * // Or control manually
 * const [show, setShow] = useState(false);
 * <KeyboardShortcutsOverlay isOpen={show} onClose={() => setShow(false)} />
 * ```
 */

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, SHADOW, Z_INDEX } from '../../constants/design-tokens';

export interface ShortcutItem {
  keys: string[];
  description: string;
  category?: string;
}

export interface KeyboardShortcutsOverlayProps {
  isOpen?: boolean;
  onClose?: () => void;
  shortcuts?: ShortcutItem[];
  autoListen?: boolean;
}

const defaultShortcuts: ShortcutItem[] = [
  // Navigation
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'General' },
  { keys: ['Esc'], description: 'Close modal / Cancel', category: 'General' },
  
  // Voice Commands
  { keys: ['Ctrl', 'Shift', 'V'], description: 'Start voice command', category: 'Voice' },
  { keys: ['Ctrl', 'Shift', 'M'], description: 'Toggle microphone', category: 'Voice' },
  
  // Quick Actions
  { keys: ['Ctrl', 'N'], description: 'New task', category: 'Actions' },
  { keys: ['Ctrl', 'E'], description: 'New event', category: 'Actions' },
  { keys: ['Ctrl', 'S'], description: 'Save', category: 'Actions' },
  
  // Navigation
  { keys: ['Ctrl', '1'], description: 'Go to Today', category: 'Navigation' },
  { keys: ['Ctrl', '2'], description: 'Go to Tasks & Events', category: 'Navigation' },
  { keys: ['Ctrl', '3'], description: 'Go to Smart', category: 'Navigation' },
  { keys: ['Ctrl', '4'], description: 'Go to Safe', category: 'Navigation' },
  { keys: ['Ctrl', ','], description: 'Open Settings', category: 'Navigation' },
];

export const KeyboardShortcutsOverlay: React.FC<KeyboardShortcutsOverlayProps> = ({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  shortcuts = defaultShortcuts,
  autoListen = true,
}) => {
  const { theme } = useTheme();
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const handleClose = controlledOnClose || (() => setInternalIsOpen(false));

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (autoListen && e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (!isInput) {
        e.preventDefault();
        setInternalIsOpen(prev => !prev);
      }
    }
    
    if (isOpen && e.key === 'Escape') {
      handleClose();
    }
  }, [autoListen, isOpen, handleClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING[4],
      }}
    >
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '80vh',
          background: theme.colors.cardBg,
          borderRadius: RADIUS.xl,
          boxShadow: SHADOW['2xl'],
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: `${SPACING[4]} ${SPACING[6]}`,
            borderBottom: `1px solid ${theme.colors.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACING[2] }}>
            <span style={{ fontSize: '1.5rem' }}>⌨️</span>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: theme.colors.text }}>
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: theme.colors.textLight,
              padding: SPACING[1],
              lineHeight: 1,
              borderRadius: RADIUS.md,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: SPACING[6], overflow: 'auto', maxHeight: 'calc(80vh - 80px)' }}>
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} style={{ marginBottom: SPACING[6] }}>
              <h3
                style={{
                  margin: 0,
                  marginBottom: SPACING[3],
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: theme.colors.primary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {category}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING[2] }}>
                {items.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: `${SPACING[2]} ${SPACING[3]}`,
                      background: theme.colors.background,
                      borderRadius: RADIUS.md,
                    }}
                  >
                    <span style={{ color: theme.colors.text }}>
                      {item.description}
                    </span>
                    <div style={{ display: 'flex', gap: SPACING[1] }}>
                      {item.keys.map((key, i) => (
                        <React.Fragment key={i}>
                          <kbd
                            style={{
                              padding: `${SPACING[0.5]} ${SPACING[2]}`,
                              background: theme.colors.cardBg,
                              border: `1px solid ${theme.colors.cardBorder}`,
                              borderRadius: RADIUS.sm,
                              fontSize: '0.875rem',
                              fontFamily: 'monospace',
                              fontWeight: 500,
                              color: theme.colors.text,
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            }}
                          >
                            {key}
                          </kbd>
                          {i < item.keys.length - 1 && (
                            <span style={{ color: theme.colors.textLight }}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: `${SPACING[3]} ${SPACING[6]}`,
            borderTop: `1px solid ${theme.colors.cardBorder}`,
            background: theme.colors.background,
            textAlign: 'center',
            color: theme.colors.textLight,
            fontSize: '0.875rem',
          }}
        >
          Press <kbd style={{
            padding: `${SPACING[0.5]} ${SPACING[1]}`,
            background: theme.colors.cardBg,
            border: `1px solid ${theme.colors.cardBorder}`,
            borderRadius: RADIUS.xs,
            fontFamily: 'monospace',
          }}>?</kbd> anytime to toggle this overlay
        </div>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}
      </style>
    </div>
  );

  return createPortal(content, document.body);
};

export default KeyboardShortcutsOverlay;
