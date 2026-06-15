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
    color: active ? '#fff' : 'var(--ck-ink2)',
    background: active ? 'var(--ck-purple)' : 'transparent',
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
          position: 'fixed', inset: 0, background: 'rgba(26,23,20,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: 16,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--ck-white)', borderRadius: 16,
            border: '1px solid var(--ck-border2)', width: '100%', maxWidth: 640,
            maxHeight: '85vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', fontFamily: 'var(--ck-font)',
            boxShadow: 'var(--ck-shadow-hover)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid var(--ck-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{abilityIcon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ck-ink)', fontFamily: 'var(--ck-serif)' }}>
                  {abilityLabel} — Query
                </div>
                <div style={{ fontSize: 11, color: 'var(--ck-ink3)', marginTop: 2 }}>
                  Copy this to try in ChatGPT or the OpenAI Playground
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--ck-ink2)',
              fontSize: 20, cursor: 'pointer',
            }}>✕</button>
          </div>

          {/* Tabs + Usage */}
          <div style={{
            padding: '10px 20px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', borderBottom: '1px solid var(--ck-border)',
          }}>
            <div style={{ display: 'flex', gap: 4, background: 'var(--ck-cream)', borderRadius: 8, padding: 2 }}>
              <button style={tabStyle(activeTab === 'combined')} onClick={() => setActiveTab('combined')}>Combined</button>
              <button style={tabStyle(activeTab === 'system')} onClick={() => setActiveTab('system')}>System</button>
              <button style={tabStyle(activeTab === 'user')} onClick={() => setActiveTab('user')}>User</button>
            </div>
            {usage && (
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--ck-ink3)' }}>
                <span>{usage.promptTokens} in</span>
                <span>{usage.completionTokens} out</span>
                <span style={{ color: 'var(--ck-gold)' }}>${usage.costUsd.toFixed(4)}</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <pre style={{
              fontFamily: 'ui-monospace, monospace', fontSize: 12, lineHeight: 1.6,
              color: 'var(--ck-ink2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0, background: 'var(--ck-cream)', borderRadius: 8,
              border: '0.5px solid var(--ck-border2)', padding: 14,
            }}>
              {activeTab === 'system' ? systemPrompt
                : activeTab === 'user' ? userMessage
                : combined}
            </pre>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--ck-border)',
            display: 'flex', justifyContent: 'flex-end', gap: 10,
          }}>
            <button
              onClick={handleCopy}
              style={{
                padding: '8px 20px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: copied ? 'var(--ck-green)' : 'var(--ck-purple)',
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
