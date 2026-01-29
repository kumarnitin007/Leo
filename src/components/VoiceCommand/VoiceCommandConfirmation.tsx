import React from 'react';
import { ParsedCommand } from '../../services/voice/types';

interface Props {
  parsed?: ParsedCommand | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const VoiceCommandConfirmation: React.FC<Props> = ({ parsed, onConfirm, onCancel }) => {
  if (!parsed) return null;

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: 'white', padding: '1rem 1.25rem', borderRadius: 12, width: 480, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        <h3 style={{ marginTop: 0 }}>Confirm Voice Command</h3>
        <p style={{ margin: '0.5rem 0' }}><strong>Intent:</strong> {parsed.intent.type} ({Math.round(parsed.overallConfidence*100)}%)</p>
        <p style={{ margin: '0.5rem 0' }}><strong>Transcript:</strong> {parsed.transcript}</p>
        <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 12 }}>
          {parsed.entities.map((e, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
              <div>{e.type}: {String(e.normalizedValue ?? e.value)}</div>
              <div style={{ color: '#6b7280' }}>{Math.round(e.confidence*100)}%</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white' }}>Confirm & Create</button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCommandConfirmation;
