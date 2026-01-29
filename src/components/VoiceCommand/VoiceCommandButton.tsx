import React, { useState } from 'react';
import VoiceCommandConfirmation from './VoiceCommandConfirmation';
import VoiceCommandService from '../../services/voice/VoiceCommandService';

const service = new VoiceCommandService();

const VoiceCommandButton: React.FC = () => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [parsed, setParsed] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setListening(true);
    try {
      const p = await service.listenAndParse();
      setParsed(p);
      setTranscript(p.transcript || '');
    } catch (err: any) {
      // Normalize error to message
      const msg = err?.message || String(err);
      setError(msg);
      // Helpful guidance for permission errors
      if (/deny|denied|not-allowed|permission/i.test(msg)) {
        try {
          alert('Microphone access denied. Please enable microphone permissions for this site in your browser settings.');
        } catch {}
      }
    } finally {
      setListening(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsed) return;
    const res = await service.execute(parsed);
    if (res.success) {
      // simple toast
      try { alert('Created from voice command'); } catch {}
    } else {
      alert('Failed to execute command');
    }
    setParsed(null);
    setTranscript('');
  };

  return (
    <>
      <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000 }}>
        <button aria-label="Voice command" onClick={start} style={{ width: 56, height: 56, borderRadius: 28, background: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)', color: 'white', border: 'none', boxShadow: '0 6px 18px rgba(0,0,0,0.18)', cursor: 'pointer' }}>
          {listening ? '🎙️' : '🎤'}
        </button>
        {transcript && (
          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.95)', padding: 8, borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>{transcript}</div>
        )}
        {error && <div style={{ color: 'red', marginTop: 6 }}>{error}</div>}
      </div>
      <VoiceCommandConfirmation parsed={parsed} onConfirm={handleConfirm} onCancel={() => setParsed(null)} />
    </>
  );
};

export default VoiceCommandButton;
