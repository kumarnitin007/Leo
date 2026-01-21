import React from 'react';
import { ReferenceCalendarBrowser } from './ReferenceCalendarBrowser';

interface ReferenceCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDaysChange?: () => void;
}

export const ReferenceCalendarModal: React.FC<ReferenceCalendarModalProps> = ({
  isOpen,
  onClose,
  onDaysChange
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh' }}>
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <h2>📅 Reference Calendars</h2>
          <button className="modal-close" onClick={onClose} style={{ color: 'white' }}>×</button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          padding: '1.5rem',
          overflowY: 'auto'
        }}>
          <ReferenceCalendarBrowser
            onDaysChange={() => {
              onDaysChange?.();
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          position: 'sticky',
          bottom: 0,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          padding: '1.5rem',
          zIndex: 10
        }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '1rem'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
