/**
 * VoiceCommandButton - Floating action button for voice commands
 * 
 * Shows a beautiful mic button that opens the VoiceCommandModal
 * when clicked, providing clear visual feedback for voice interactions.
 * 
 * Supports:
 * - Direct creation mode (default)
 * - Prefill & Navigate mode (opens form with data)
 * - Voice history view
 */

import React, { useState, useEffect } from 'react';
import VoiceCommandModal from './VoiceCommandModal';
import VoiceCommandHistory from './VoiceCommandHistory';
import { ParsedCommand } from '../../services/voice/types';
import { VoiceCommandLog } from '../../types/voice-command-db.types';

interface VoiceCommandButtonProps {
  onSuccess?: (message: string) => void;
  isModalMode?: boolean; // If true, only show modal (no floating button)
  onClose?: () => void; // Called when modal closes in modal mode
  onPrefillAndNavigate?: (parsed: ParsedCommand) => void; // Navigate to form with data
  onCreateFromHistory?: (command: VoiceCommandLog) => void; // Create from history
  userId?: string; // For fetching history
}

const VoiceCommandButton: React.FC<VoiceCommandButtonProps> = ({ 
  onSuccess,
  isModalMode = false,
  onClose,
  onPrefillAndNavigate,
  onCreateFromHistory,
  userId,
}) => {
  const [showModal, setShowModal] = useState(isModalMode);
  const [showHistory, setShowHistory] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Keyboard shortcut: Ctrl/Cmd + Shift + V
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        setShowModal(true);
      }
      // Ctrl/Cmd + Shift + H for history
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setShowHistory(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSuccess = (message: string) => {
    onSuccess?.(message);
  };

  const handleClose = () => {
    setShowModal(false);
    onClose?.();
  };

  const handleHistoryClick = () => {
    setShowModal(false);
    setShowHistory(true);
  };

  const handleCreateFromHistory = (command: VoiceCommandLog) => {
    onCreateFromHistory?.(command);
    setShowHistory(false);
  };

  // In modal mode, only render the modal
  if (isModalMode) {
    return (
      <>
        <VoiceCommandModal
          isOpen={showModal}
          onClose={handleClose}
          onSuccess={handleSuccess}
          onPrefillAndNavigate={onPrefillAndNavigate}
          showHistoryButton={!!userId}
          onHistoryClick={handleHistoryClick}
        />
        <VoiceCommandHistory
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          onCreateFromCommand={handleCreateFromHistory}
          userId={userId}
        />
      </>
    );
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setShowModal(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Voice command (Ctrl+Shift+V)"
        title="Voice Command (Ctrl+Shift+V)"
        className="floating-voice-button"
        style={{
          position: 'fixed',
          bottom: '26rem',
          right: '2rem',
          zIndex: 1000,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: isHovered
            ? 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)'
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          boxShadow: isHovered
            ? '0 8px 25px rgba(102, 126, 234, 0.5)'
            : '0 6px 20px rgba(102, 126, 234, 0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          transition: 'all 0.3s ease',
          transform: isHovered ? 'scale(1.1)' : 'scale(1)'
        }}
      >
        🎤
      </button>

      {/* Tooltip on hover */}
      {isHovered && (
        <div
          style={{
            position: 'fixed',
            top: 88,
            right: 24,
            background: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            zIndex: 1001,
            whiteSpace: 'nowrap',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          Voice Command
          <span style={{ opacity: 0.7, marginLeft: '0.5rem' }}>
            Ctrl+Shift+V
          </span>
        </div>
      )}

      {/* Voice Command Modal */}
      <VoiceCommandModal
        isOpen={showModal}
        onClose={handleClose}
        onSuccess={handleSuccess}
        onPrefillAndNavigate={onPrefillAndNavigate}
        showHistoryButton={!!userId}
        onHistoryClick={handleHistoryClick}
      />

      {/* Voice History Modal */}
      <VoiceCommandHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onCreateFromCommand={handleCreateFromHistory}
        userId={userId}
      />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default VoiceCommandButton;
