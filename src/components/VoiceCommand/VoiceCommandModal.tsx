/**
 * VoiceCommandModal - Beautiful popup modal for voice commands
 * 
 * Opens when user clicks the mic button, providing clear visual feedback
 * for listening state, processing, and confirmation.
 * 
 * Supports two modes:
 * 1. Auto-create: Directly creates the item (default)
 * 2. Prefill & Navigate: Fills data and navigates to the form for review
 */

import React, { useState, useEffect, useCallback } from 'react';
import Portal from '../Portal';
import VoiceCommandService, { ExecutionResult } from '../../services/voice/VoiceCommandService';
import { ParsedCommand } from '../../services/voice/types';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string, result?: ExecutionResult) => void;
  onPrefillAndNavigate?: (parsed: ParsedCommand) => void; // New: for prefill mode
  showHistoryButton?: boolean;
  onHistoryClick?: () => void;
}

type ModalState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'CONFIRM' | 'EXECUTING' | 'SUCCESS' | 'ERROR';

const service = new VoiceCommandService();

const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onPrefillAndNavigate,
  showHistoryButton = true,
  onHistoryClick,
}) => {
  const [state, setState] = useState<ModalState>('IDLE');
  const [transcript, setTranscript] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulseAnimation, setPulseAnimation] = useState(false);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setState('IDLE');
      setTranscript('');
      setParsed(null);
      setError(null);
    }
  }, [isOpen]);

  // Auto-start listening when modal opens
  useEffect(() => {
    if (isOpen && state === 'IDLE') {
      const timer = setTimeout(() => startListening(), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, state]);

  // Pulse animation for listening state
  useEffect(() => {
    if (state === 'LISTENING') {
      const interval = setInterval(() => setPulseAnimation(p => !p), 500);
      return () => clearInterval(interval);
    }
  }, [state]);

  const startListening = async () => {
    setError(null);
    setState('LISTENING');
    setTranscript('');

    try {
      const result = await service.listenAndParse();
      setTranscript(result.transcript);
      setParsed(result);
      setState('CONFIRM');
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      setState('ERROR');

      // Helpful guidance for permission errors
      if (/deny|denied|not-allowed|permission/i.test(msg)) {
        setError('Microphone access denied. Please enable microphone permissions in your browser settings.');
      }
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;

    setState('EXECUTING');
    try {
      const res = await service.execute(parsed);
      setExecutionResult(res);
      if (res.success) {
        setState('SUCCESS');
        setTimeout(() => {
          onSuccess?.('Created from voice command!', res);
          onClose();
        }, 1500);
      } else {
        setError(res.error?.message || 'Failed to execute command');
        setState('ERROR');
      }
    } catch (err: any) {
      setError(err?.message || 'Execution failed');
      setState('ERROR');
    }
  };

  const handleRetry = () => {
    setState('IDLE');
    setError(null);
    setParsed(null);
    setTranscript('');
    setTimeout(() => startListening(), 100);
  };

  const handleCancel = () => {
    setParsed(null);
    setState('IDLE');
    onClose();
  };

  if (!isOpen) return null;

  const getIntentLabel = (type: string) => {
    const labels: Record<string, { icon: string; label: string; color: string }> = {
      'CREATE_TODO': { icon: '📝', label: 'Add To-Do', color: '#8b5cf6' },
      'CREATE_TASK': { icon: '✅', label: 'Create Task', color: '#10b981' },
      'CREATE_EVENT': { icon: '📅', label: 'Create Event', color: '#3b82f6' },
      'CREATE_JOURNAL': { icon: '📔', label: 'Journal Entry', color: '#8b5cf6' },
      'CREATE_ROUTINE': { icon: '🔄', label: 'Create Routine', color: '#f59e0b' },
      'CREATE_ITEM': { icon: '📦', label: 'Add Item', color: '#06b6d4' },
      'CREATE_MILESTONE': { icon: '🎯', label: 'Create Milestone', color: '#ec4899' },
      'CREATE_RESOLUTION': { icon: '🌟', label: 'Create Resolution', color: '#f97316' },
      'CREATE_PINNED_EVENT': { icon: '📌', label: 'Pin Event', color: '#ef4444' },
      'UNKNOWN': { icon: '❓', label: 'Unknown', color: '#6b7280' },
    };
    return labels[type] || labels['UNKNOWN'];
  };

  return (
    <Portal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.target === e.currentTarget && handleCancel()}
      >
        <div
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            width: '100%',
            maxWidth: 480,
            overflow: 'hidden',
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🎤</span>
              <div>
                <h2 style={{ margin: 0, color: 'white', fontSize: '1.25rem', fontWeight: 700 }}>
                  Voice Command
                </h2>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem' }}>
                  Speak naturally to create tasks, events & more
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {showHistoryButton && onHistoryClick && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onHistoryClick();
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: '1rem',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                  title="Voice History"
                >
                  📜
                </button>
              )}
              <button
                onClick={handleCancel}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '1.25rem',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '2rem' }}>
            {/* LISTENING State */}
            {state === 'LISTENING' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: pulseAnimation
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    boxShadow: pulseAnimation
                      ? '0 0 0 20px rgba(239, 68, 68, 0.2), 0 0 0 40px rgba(239, 68, 68, 0.1)'
                      : '0 0 0 10px rgba(239, 68, 68, 0.15)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <span style={{ fontSize: '3rem' }}>🎙️</span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>
                  Listening...
                </h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  Speak your command clearly
                </p>
                
                {/* Audio wave animation */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '4px',
                  marginTop: '1.5rem',
                  height: 40
                }}>
                  {[1,2,3,4,5,6,7].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: 4,
                        background: 'linear-gradient(to top, #667eea, #764ba2)',
                        borderRadius: 2,
                        animation: `audioWave 0.5s ease-in-out ${i * 0.1}s infinite alternate`
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={handleCancel}
                  style={{
                    marginTop: '1.5rem',
                    padding: '0.75rem 2rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* PROCESSING State */}
            {state === 'PROCESSING' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    animation: 'spin 1.5s linear infinite'
                  }}
                >
                  <span style={{ fontSize: '2.5rem' }}>⚙️</span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>
                  Processing...
                </h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  Understanding your command
                </p>
              </div>
            )}

            {/* CONFIRM State */}
            {state === 'CONFIRM' && parsed && (
              <div>
                {/* Transcript */}
                <div
                  style={{
                    background: '#f3f4f6',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    You said:
                  </p>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500, color: '#1f2937' }}>
                    "{transcript}"
                  </p>
                </div>

                {/* Intent */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    background: `${getIntentLabel(parsed.intent.type).color}15`,
                    borderRadius: '0.75rem',
                    border: `2px solid ${getIntentLabel(parsed.intent.type).color}30`
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{getIntentLabel(parsed.intent.type).icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#1f2937' }}>
                      {getIntentLabel(parsed.intent.type).label}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                      {Math.round(parsed.intent.confidence * 100)}% confident
                    </p>
                  </div>
                  <div
                    style={{
                      background: parsed.overallConfidence >= 0.7 ? '#dcfce7' : parsed.overallConfidence >= 0.5 ? '#fef3c7' : '#fee2e2',
                      color: parsed.overallConfidence >= 0.7 ? '#166534' : parsed.overallConfidence >= 0.5 ? '#92400e' : '#991b1b',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: 600
                    }}
                  >
                    {Math.round(parsed.overallConfidence * 100)}%
                  </div>
                </div>

                {/* Extracted Entities */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>
                    Extracted Information:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {parsed.entities.map((entity, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0.75rem',
                          background: 'white',
                          borderRadius: '0.5rem',
                          border: '1px solid #e5e7eb'
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>
                          {entity.type}
                        </span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1f2937' }}>
                          {String(entity.normalizedValue || entity.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Primary Actions Row */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={handleRetry}
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        background: '#f3f4f6',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.375rem'
                      }}
                    >
                      🔄 Retry
                    </button>
                    <button
                      onClick={handleConfirm}
                      style={{
                        flex: 2,
                        padding: '0.75rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.375rem'
                      }}
                    >
                      ✓ Create Now
                    </button>
                  </div>
                  
                  {/* Review & Edit Button (Prefill mode) */}
                  {onPrefillAndNavigate && (
                    <button
                      onClick={() => {
                        if (parsed) {
                          onPrefillAndNavigate(parsed);
                          onClose();
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'white',
                        color: '#667eea',
                        border: '2px solid #667eea',
                        borderRadius: '0.75rem',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.375rem'
                      }}
                    >
                      ✏️ Review & Edit First
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* EXECUTING State */}
            {state === 'EXECUTING' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    animation: 'pulse 1s ease-in-out infinite'
                  }}
                >
                  <span style={{ fontSize: '2.5rem' }}>⚡</span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>
                  Creating...
                </h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  Executing your command
                </p>
              </div>
            )}

            {/* SUCCESS State */}
            {state === 'SUCCESS' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    animation: 'bounceIn 0.5s ease-out'
                  }}
                >
                  <span style={{ fontSize: '2.5rem' }}>✓</span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#10b981' }}>
                  {executionResult?.entityType || 'Item'} Created!
                </h3>
                <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.9rem' }}>
                  Your command has been executed
                </p>
                
                {/* Show extracted fields summary */}
                {executionResult?.extractedFields && Object.keys(executionResult.extractedFields).length > 0 && (
                  <div style={{ 
                    background: '#f9fafb', 
                    borderRadius: '0.75rem', 
                    padding: '0.75rem',
                    textAlign: 'left',
                    maxHeight: '150px',
                    overflowY: 'auto'
                  }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>
                      Fields used:
                    </p>
                    {Object.entries(executionResult.extractedFields).map(([key, info]) => (
                      <div key={key} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.25rem 0',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: '0.8rem'
                      }}>
                        <span style={{ color: '#374151', fontWeight: 500 }}>{key}</span>
                        <span style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.25rem',
                          color: info.isDefault ? '#9ca3af' : '#059669'
                        }}>
                          {typeof info.value === 'object' ? JSON.stringify(info.value) : String(info.value).substring(0, 30)}
                          {info.isDefault && (
                            <span style={{ 
                              fontSize: '0.6rem', 
                              background: '#fef3c7', 
                              color: '#92400e',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '0.25rem'
                            }}>
                              default
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ERROR State */}
            {state === 'ERROR' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem'
                  }}
                >
                  <span style={{ fontSize: '2.5rem' }}>!</span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#ef4444' }}>
                  Oops!
                </h3>
                <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                  {error || 'Something went wrong'}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button
                    onClick={handleCancel}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRetry}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.75rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔄 Try Again
                  </button>
                </div>
              </div>
            )}

            {/* IDLE State */}
            {state === 'IDLE' && (
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    cursor: 'pointer',
                    transition: 'transform 0.2s'
                  }}
                  onClick={startListening}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <span style={{ fontSize: '2.5rem' }}>🎤</span>
                </div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 600, color: '#1f2937' }}>
                  Ready to Listen
                </h3>
                <p style={{ margin: '0 0 1.5rem', color: '#6b7280', fontSize: '0.9rem' }}>
                  Click the mic to start speaking
                </p>
                <button
                  onClick={startListening}
                  style={{
                    padding: '0.875rem 2rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  🎤 Start Speaking
                </button>
              </div>
            )}
          </div>

          {/* Example Commands Footer */}
          {(state === 'IDLE' || state === 'LISTENING') && (
            <div
              style={{
                background: '#f9fafb',
                borderTop: '1px solid #e5e7eb',
                padding: '1rem 1.5rem'
              }}
            >
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>
                💡 Try saying:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {[
                  'Add todo buy groceries',
                  'Remember to call mom',
                  'Schedule meeting at 3pm'
                ].map((example, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.375rem 0.625rem',
                      background: '#e5e7eb',
                      borderRadius: '1rem',
                      color: '#4b5563'
                    }}
                  >
                    "{example}"
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes audioWave {
          0% { height: 8px; }
          100% { height: 32px; }
        }
      `}</style>
    </Portal>
  );
};

export default VoiceCommandModal;
