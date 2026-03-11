/**
 * BottomSheet Component
 * 
 * A mobile-friendly slide-up panel that replaces modals on small screens.
 * Supports drag-to-dismiss and snap points.
 * 
 * Usage:
 * ```tsx
 * <BottomSheet isOpen={show} onClose={() => setShow(false)} title="Options">
 *   <BottomSheet.Item icon="✏️" label="Edit" onClick={handleEdit} />
 *   <BottomSheet.Item icon="🗑️" label="Delete" onClick={handleDelete} danger />
 * </BottomSheet>
 * 
 * <BottomSheet isOpen={show} onClose={close} height="auto">
 *   <form>...</form>
 * </BottomSheet>
 * ```
 */

import React, { ReactNode, CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, SHADOW, Z_INDEX } from '../../constants/design-tokens';
import { haptic } from '../../utils/haptic';

export type BottomSheetHeight = 'auto' | 'half' | 'full' | number;

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  height?: BottomSheetHeight;
  showHandle?: boolean;
  closeOnOverlayClick?: boolean;
  style?: CSSProperties;
  className?: string;
}

const getHeightValue = (height: BottomSheetHeight): string => {
  if (typeof height === 'number') return `${height}px`;
  switch (height) {
    case 'half': return '50vh';
    case 'full': return '90vh';
    case 'auto':
    default: return 'auto';
  }
};

export const BottomSheet: React.FC<BottomSheetProps> & {
  Item: typeof BottomSheetItem;
  Divider: typeof BottomSheetDivider;
} = ({
  isOpen,
  onClose,
  children,
  title,
  height = 'auto',
  showHandle = true,
  closeOnOverlayClick = true,
  style,
  className,
}) => {
  const { theme } = useTheme();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      haptic.light();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!showHandle) return;
    startY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      setDragOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragOffset > 100) {
      haptic.light();
      onClose();
    }
    setDragOffset(0);
  };

  if (!isOpen) return null;

  const content = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.modal,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          opacity: isDragging ? 1 - dragOffset / 300 : 1,
          transition: isDragging ? 'none' : 'opacity 0.2s ease',
        }}
        onClick={() => closeOnOverlayClick && onClose()}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={className}
        style={{
          position: 'relative',
          background: theme.colors.cardBg,
          borderRadius: `${RADIUS.xl} ${RADIUS.xl} 0 0`,
          boxShadow: SHADOW['2xl'],
          maxHeight: getHeightValue(height),
          overflow: 'hidden',
          transform: `translateY(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          animation: isDragging ? 'none' : 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          ...style,
        }}
      >
        {/* Handle */}
        {showHandle && (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              padding: `${SPACING[3]} 0`,
              cursor: 'grab',
              touchAction: 'none',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '4px',
                background: theme.colors.cardBorder,
                borderRadius: RADIUS.full,
                margin: '0 auto',
              }}
            />
          </div>
        )}

        {/* Title */}
        {title && (
          <div
            style={{
              padding: `${SPACING[2]} ${SPACING[4]} ${SPACING[4]}`,
              borderBottom: `1px solid ${theme.colors.cardBorder}`,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1.125rem',
                fontWeight: 600,
                color: theme.colors.text,
                textAlign: 'center',
              }}
            >
              {title}
            </h3>
          </div>
        )}

        {/* Content */}
        <div
          style={{
            padding: title ? SPACING[2] : SPACING[4],
            paddingBottom: SPACING[6],
            overflow: 'auto',
            maxHeight: height === 'auto' ? '60vh' : undefined,
          }}
        >
          {children}
        </div>
      </div>

      <style>
        {`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );

  return createPortal(content, document.body);
};

// ============ BottomSheet.Item ============
interface BottomSheetItemProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}

const BottomSheetItem: React.FC<BottomSheetItemProps> = ({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();

  const handleClick = () => {
    if (!disabled) {
      haptic.light();
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING[3],
        width: '100%',
        padding: `${SPACING[4]} ${SPACING[4]}`,
        background: 'none',
        border: 'none',
        borderRadius: RADIUS.lg,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        color: danger ? theme.colors.danger : theme.colors.text,
        fontSize: '1rem',
        fontWeight: 500,
        textAlign: 'left',
        transition: 'background 0.15s ease',
        ...style,
      }}
      onTouchStart={(e) => {
        if (!disabled) e.currentTarget.style.background = theme.colors.background;
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.background = 'none';
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = theme.colors.background;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'none';
      }}
    >
      {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

// ============ BottomSheet.Divider ============
const BottomSheetDivider: React.FC = () => {
  const { theme } = useTheme();
  return (
    <div
      style={{
        height: '1px',
        background: theme.colors.cardBorder,
        margin: `${SPACING[2]} 0`,
      }}
    />
  );
};

// Attach sub-components
BottomSheet.Item = BottomSheetItem;
BottomSheet.Divider = BottomSheetDivider;

export default BottomSheet;
