/**
 * Modal Component
 * 
 * A flexible modal dialog using React Portal.
 * Uses design tokens for consistent styling.
 * 
 * Usage:
 * ```tsx
 * <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Edit Item">
 *   <p>Modal content here</p>
 * </Modal>
 * 
 * <Modal isOpen={show} onClose={handleClose} size="lg" closable={false}>
 *   <Modal.Header>Custom Header</Modal.Header>
 *   <Modal.Body>Content</Modal.Body>
 *   <Modal.Footer>
 *     <Button onClick={handleClose}>Cancel</Button>
 *     <Button variant="primary">Save</Button>
 *   </Modal.Footer>
 * </Modal>
 * ```
 */

import React, { ReactNode, CSSProperties, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SHADOW, SPACING, Z_INDEX } from '../../constants/design-tokens';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: ModalSize;
  closable?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  style?: CSSProperties;
  className?: string;
}

const sizeMap: Record<ModalSize, string> = {
  sm: '400px',
  md: '500px',
  lg: '700px',
  xl: '900px',
  full: '95vw',
};

export const Modal: React.FC<ModalProps> & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
} = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'md',
  closable = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  style,
  className,
}) => {
  const { theme } = useTheme();

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && closable && closeOnEscape) {
      onClose();
    }
  }, [closable, closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const modalContent = (
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
        onClick={() => closable && closeOnOverlayClick && onClose()}
      />

      {/* Modal Container */}
      <div
        className={className}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: sizeMap[size],
          maxHeight: '90vh',
          background: theme.colors.cardBg,
          borderRadius: RADIUS.xl,
          boxShadow: SHADOW['2xl'],
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalFadeIn 0.2s ease-out',
          ...style,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Default header if title is provided */}
        {title && (
          <div
            style={{
              padding: `${SPACING[4]} ${SPACING[6]}`,
              borderBottom: `1px solid ${theme.colors.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: theme.colors.text }}>
              {title}
            </h2>
            {closable && showCloseButton && (
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: theme.colors.textLight,
                  padding: SPACING[1],
                  lineHeight: 1,
                  borderRadius: RADIUS.md,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
                aria-label="Close modal"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Close button when no title */}
        {!title && closable && showCloseButton && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: SPACING[3],
              right: SPACING[3],
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: theme.colors.textLight,
              padding: SPACING[1],
              lineHeight: 1,
              borderRadius: RADIUS.md,
              zIndex: 1,
            }}
            aria-label="Close modal"
          >
            ×
          </button>
        )}

        {/* Content */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>

      {/* Animation styles */}
      <style>
        {`
          @keyframes modalFadeIn {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }
        `}
      </style>
    </div>
  );

  return createPortal(modalContent, document.body);
};

// Modal.Header sub-component
interface ModalHeaderProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({ children, style, className }) => {
  const { theme } = useTheme();
  
  return (
    <div
      className={className}
      style={{
        padding: `${SPACING[4]} ${SPACING[6]}`,
        borderBottom: `1px solid ${theme.colors.cardBorder}`,
        fontWeight: 600,
        fontSize: '1.25rem',
        color: theme.colors.text,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Modal.Body sub-component
interface ModalBodyProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const ModalBody: React.FC<ModalBodyProps> = ({ children, style, className }) => {
  return (
    <div
      className={className}
      style={{
        padding: SPACING[6],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Modal.Footer sub-component
interface ModalFooterProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'space-between';
}

const ModalFooter: React.FC<ModalFooterProps> = ({ 
  children, 
  style, 
  className,
  align = 'right' 
}) => {
  const { theme } = useTheme();
  
  const alignMap: Record<string, string> = {
    left: 'flex-start',
    center: 'center',
    right: 'flex-end',
    'space-between': 'space-between',
  };
  
  return (
    <div
      className={className}
      style={{
        padding: `${SPACING[4]} ${SPACING[6]}`,
        borderTop: `1px solid ${theme.colors.cardBorder}`,
        display: 'flex',
        justifyContent: alignMap[align],
        alignItems: 'center',
        gap: SPACING[3],
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Attach sub-components
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
