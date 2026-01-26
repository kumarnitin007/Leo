/**
 * Mobile Bottom Sheet Component
 * 
 * Sliding bottom sheet for mobile actions and menus
 * Used for Add menu and More menu
 */

import React, { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface BottomSheetOption {
  icon: string;
  label: string;
  description?: string;
  onClick: () => void;
  primary?: boolean;
}

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: BottomSheetOption[];
}

const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  options,
}) => {
  const { theme } = useTheme();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="bottom-sheet-backdrop" onClick={onClose} />
      <div className="bottom-sheet">
        <div className="bottom-sheet-handle" />
        <div className="bottom-sheet-header">
          <h3>{title}</h3>
          <button className="bottom-sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="bottom-sheet-content">
          {options.map((option, index) => (
            <button
              key={index}
              className={`bottom-sheet-option ${option.primary ? 'primary' : ''}`}
              onClick={() => {
                option.onClick();
                onClose();
              }}
            >
              <span className="option-icon">{option.icon}</span>
              <div className="option-text">
                <span className="option-label">{option.label}</span>
                {option.description && (
                  <span className="option-description">{option.description}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default MobileBottomSheet;
