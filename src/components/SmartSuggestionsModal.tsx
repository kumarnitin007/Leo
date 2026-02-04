/**
 * Smart Suggestions Modal
 * 
 * Shows extracted items from image scan with actions
 */

import React, { useState } from 'react';
import Portal from './Portal';
import { ExtractedItem, ScanResult } from '../services/imageScanning/types';

interface SmartSuggestionsModalProps {
  show: boolean;
  onClose: () => void;
  result: ScanResult | null;
  onCreateItem: (item: ExtractedItem) => void;
}

const SmartSuggestionsModal: React.FC<SmartSuggestionsModalProps> = ({
  show,
  onClose,
  result,
  onCreateItem
}) => {
  const [processing, setProcessing] = useState<string | null>(null);

  if (!show || !result) return null;

  const handleCreate = async (item: ExtractedItem) => {
    setProcessing(item.id);
    try {
      await onCreateItem(item);
      // Remove item from list after creation
      setTimeout(() => setProcessing(null), 500);
    } catch (error) {
      console.error('Failed to create item:', error);
      setProcessing(null);
      alert('Failed to create item. Please try again.');
    }
  };

  const getDestinationLabel = (dest: string): string => {
    const labels: Record<string, string> = {
      'event': 'Events',
      'task': 'Tasks',
      'todo': 'TO-DO List',
      'journal': 'Journal',
      'safe': 'Safe',
      'gift-card': 'Gift Cards',
      'resolution': 'Resolutions'
    };
    return labels[dest] || dest;
  };

  const getDestinationColor = (dest: string): string => {
    const colors: Record<string, string> = {
      'event': '#3b82f6',
      'task': '#10b981',
      'todo': '#14b8a6',
      'journal': '#8b5cf6',
      'safe': '#10b981',
      'gift-card': '#f59e0b',
      'resolution': '#ec4899'
    };
    return colors[dest] || '#6b7280';
  };

  return (
    <Portal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '1rem',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '1.5rem',
              borderBottom: '2px solid #e5e7eb',
              background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                  {result.mode === 'smart' ? '✨ Smart Scan Results' : '🆓 Quick Scan Results'}
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                  Found {result.items.length} item{result.items.length !== 1 ? 's' : ''} • {result.processingTime}ms
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '1.5rem' }}>
            {result.items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔍</div>
                <h3 style={{ margin: '0 0 0.5rem', color: '#374151' }}>No Items Found</h3>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                  {result.mode === 'smart' 
                    ? 'AI couldn\'t identify any actionable items in this image.'
                    : 'Try using Smart Scan for better accuracy, or ensure the image has clear text.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {result.items.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      border: '2px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      background: 'white',
                      transition: 'all 0.2s',
                      opacity: processing === item.id ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                      {/* Icon */}
                      <div
                        style={{
                          fontSize: '2.5rem',
                          flexShrink: 0
                        }}
                      >
                        {item.icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                            {item.title}
                          </h3>
                          {item.confidence && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.125rem 0.5rem',
                                background: item.confidence > 0.8 ? '#d1fae5' : '#fef3c7',
                                color: item.confidence > 0.8 ? '#065f46' : '#92400e',
                                borderRadius: '0.25rem',
                                fontWeight: 600
                              }}
                            >
                              {Math.round(item.confidence * 100)}%
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                            {item.description}
                          </p>
                        )}

                        {/* Data Preview */}
                        {Object.keys(item.data).length > 0 && (
                          <div
                            style={{
                              background: '#f9fafb',
                              borderRadius: '0.5rem',
                              padding: '0.75rem',
                              marginBottom: '0.75rem',
                              fontSize: '0.875rem'
                            }}
                          >
                            {Object.entries(item.data).slice(0, 3).map(([key, value]) => (
                              <div key={key} style={{ marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: 600, color: '#374151' }}>
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>{' '}
                                <span style={{ color: '#6b7280' }}>
                                  {Array.isArray(value) ? value.join(', ') : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Button */}
                        <button
                          onClick={() => handleCreate(item)}
                          disabled={processing === item.id}
                          style={{
                            width: '100%',
                            padding: '0.75rem 1rem',
                            background: processing === item.id 
                              ? '#e5e7eb' 
                              : getDestinationColor(item.suggestedDestination),
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: 600,
                            cursor: processing === item.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          {processing === item.id ? (
                            <>⏳ Creating...</>
                          ) : (
                            <>
                              ➕ Add to {getDestinationLabel(item.suggestedDestination)}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Raw Text (Debug) */}
            {result.rawText && result.mode === 'quick' && (
              <details style={{ marginTop: '1.5rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280', fontWeight: 600 }}>
                  View Extracted Text
                </summary>
                <pre
                  style={{
                    marginTop: '0.5rem',
                    padding: '1rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    fontSize: '0.75rem',
                    overflow: 'auto',
                    maxHeight: '200px',
                    color: '#374151'
                  }}
                >
                  {result.rawText}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default SmartSuggestionsModal;
