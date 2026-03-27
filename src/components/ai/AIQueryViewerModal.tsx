/**
 * AI Query Viewer Modal
 *
 * Shows the exact system prompt + user message sent to OpenAI for any AI call.
 * User can copy the full query to try it standalone in ChatGPT / API playground.
 */

import React, { useState } from 'react';
import Portal from '../Portal';
import type { AIUsage } from '../../services/ai/types';

interface Props {
  show: boolean;
  onClose: () => void;
  abilityLabel: string;
  abilityIcon: string;
  systemPrompt: string;
  userMessage: string;
  usage?: AIUsage;
}

const AIQueryViewerModal: React.FC<Props> = ({
  show, onClose, abilityLabel, abilityIcon,
  systemPrompt, userMessage, usage,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'user' | 'combined'>('combined');

  if (!show) return null;

  const combined = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER MESSAGE ===\n${userMessage}`;

  const handleCopy = () => {
    const text = activeTab === 'system' ? systemPrompt
      : activeTab === 'user' ? userMessage
      : combined;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    color: active ? '#E0E7FF' : '#6B7280',
    background: active ? '#4338CA' : 'transparent',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <Portal>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: 16,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: '#111827', borderRadius: 16,
            border: '1px solid #374151', width: '100%', maxWidth: 640,
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #1F2937',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{abilityIcon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#F9FAFB' }}>
                  {abilityLabel} — Query
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                  Copy this to try in ChatGPT or the OpenAI Playground
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: '#6B7280',
              fontSize: 20, cursor: 'pointer',
            }}>✕</button>
          </div>

          {/* Tabs + Usage */}
          <div style={{
            padding: '10px 20px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderBottom: '1px solid #1F2937',
          }}>
            <div style={{ display: 'flex', gap: 4, background: '#1F2937', borderRadius: 8, padding: 2 }}>
              <button style={tabStyle(activeTab === 'combined')} onClick={() => setActiveTab('combined')}>Combined</button>
              <button style={tabStyle(activeTab === 'system')} onClick={() => setActiveTab('system')}>System</button>
              <button style={tabStyle(activeTab === 'user')} onClick={() => setActiveTab('user')}>User</button>
            </div>
            {usage && (
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#6B7280' }}>
                <span>{usage.promptTokens} in</span>
                <span>{usage.completionTokens} out</span>
                <span style={{ color: '#F59E0B' }}>${usage.costUsd.toFixed(4)}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <pre style={{
              fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
              color: '#D1D5DB', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0,
            }}>
              {activeTab === 'system' ? systemPrompt
                : activeTab === 'user' ? userMessage
                : combined}
            </pre>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #1F2937',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 20px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: copied ? '#059669' : '#4338CA',
                color: 'white', fontSize: 12, fontWeight: 600,
                transition: 'background 0.2s',
              }}
            >
              {copied ? '✓ Copied!' : '📋 Copy to clipboard'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default AIQueryViewerModal;
