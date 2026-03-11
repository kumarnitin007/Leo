/**
 * ContextMenu Component
 * 
 * A context menu that appears on right-click (desktop) or long-press (mobile).
 * Provides quick actions without navigating away.
 * 
 * Usage:
 * ```tsx
 * // Wrap any element to add context menu
 * <ContextMenu
 *   items={[
 *     { icon: '✏️', label: 'Edit', onClick: handleEdit },
 *     { icon: '📋', label: 'Duplicate', onClick: handleDuplicate },
 *     { divider: true },
 *     { icon: '🗑️', label: 'Delete', onClick: handleDelete, danger: true },
 *   ]}
 * >
 *   <TaskCard task={task} />
 * </ContextMenu>
 * 
 * // Or use the hook for more control
 * const { triggerProps, menuProps, isOpen } = useContextMenu(items);
 * ```
 */

import React, { ReactNode, CSSProperties, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, SHADOW, Z_INDEX } from '../../constants/design-tokens';
import { haptic } from '../../utils/haptic';

export interface ContextMenuItem {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: never;
}

export interface ContextMenuDivider {
  divider: true;
  icon?: never;
  label?: never;
  onClick?: never;
  danger?: never;
  disabled?: never;
}

export type ContextMenuItemOrDivider = ContextMenuItem | ContextMenuDivider;

export interface ContextMenuProps {
  children: ReactNode;
  items: ContextMenuItemOrDivider[];
  disabled?: boolean;
  longPressDuration?: number;
}

interface Position {
  x: number;
  y: number;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  items,
  disabled = false,
  longPressDuration = 500,
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback((x: number, y: number) => {
    if (disabled) return;
    
    // Adjust position to keep menu in viewport
    const menuWidth = 200;
    const menuHeight = items.length * 44;
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 16);
    const adjustedY = Math.min(y, window.innerHeight - menuHeight - 16);
    
    setPosition({ x: Math.max(16, adjustedX), y: Math.max(16, adjustedY) });
    setIsOpen(true);
    haptic.medium();
  }, [disabled, items.length]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Right-click handler (desktop)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openMenu(e.clientX, e.clientY);
  }, [openMenu]);

  // Long-press handlers (mobile)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      openMenu(touch.clientX, touch.clientY);
    }, longPressDuration);
  }, [longPressDuration, openMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMenu]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.disabled) return;
    haptic.light();
    closeMenu();
    item.onClick();
  };

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        style={{ 
          touchAction: 'auto',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {children}
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: Z_INDEX.popover,
            minWidth: '180px',
            background: theme.colors.cardBg,
            borderRadius: RADIUS.lg,
            boxShadow: SHADOW.xl,
            border: `1px solid ${theme.colors.cardBorder}`,
            padding: SPACING[1],
            animation: 'contextMenuFadeIn 0.15s ease-out',
          }}
        >
          {items.map((item, index) => {
            if ('divider' in item && item.divider) {
              return (
                <div
                  key={index}
                  style={{
                    height: '1px',
                    background: theme.colors.cardBorder,
                    margin: `${SPACING[1]} 0`,
                  }}
                />
              );
            }

            const menuItem = item as ContextMenuItem;
            return (
              <button
                key={index}
                onClick={() => handleItemClick(menuItem)}
                disabled={menuItem.disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING[3],
                  width: '100%',
                  padding: `${SPACING[2]} ${SPACING[3]}`,
                  background: 'none',
                  border: 'none',
                  borderRadius: RADIUS.md,
                  cursor: menuItem.disabled ? 'not-allowed' : 'pointer',
                  opacity: menuItem.disabled ? 0.5 : 1,
                  color: menuItem.danger ? theme.colors.danger : theme.colors.text,
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  textAlign: 'left',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => {
                  if (!menuItem.disabled) {
                    e.currentTarget.style.background = theme.colors.background;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                {menuItem.icon && (
                  <span style={{ fontSize: '1.125rem', width: '24px', textAlign: 'center' }}>
                    {menuItem.icon}
                  </span>
                )}
                <span>{menuItem.label}</span>
              </button>
            );
          })}

          <style>
            {`
              @keyframes contextMenuFadeIn {
                from { opacity: 0; transform: scale(0.95); }
                to { opacity: 1; transform: scale(1); }
              }
            `}
          </style>
        </div>,
        document.body
      )}
    </>
  );
};

/**
 * Hook for more control over context menu behavior
 */
export const useContextMenu = (items: ContextMenuItemOrDivider[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });

  const open = useCallback((x: number, y: number) => {
    setPosition({ x, y });
    setIsOpen(true);
    haptic.medium();
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const triggerProps = {
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      open(e.clientX, e.clientY);
    },
  };

  return { isOpen, position, open, close, triggerProps, items };
};

export default ContextMenu;
