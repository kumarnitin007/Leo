import { useState } from 'react';
import VoiceCommandService from '../services/voice/VoiceCommandService';
import { ParsedCommand } from '../services/voice/types';

const service = new VoiceCommandService();

export function useVoiceCommand() {
  const [state, setState] = useState<'idle'|'listening'|'processing'|'confirm'|'done'|'error'>('idle');
  const [parsed, setParsed] = useState<ParsedCommand | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setState('listening');
    try {
      const p = await service.listenAndParse();
      setParsed(p);
      setState('confirm');
    } catch (err: any) {
      setError(String(err));
      setState('error');
    }
  };

  const confirm = async () => {
    if (!parsed) return;
    setState('processing');
    const res = await service.execute(parsed);
    if (res.success) {
      setState('done');
    } else {
      setError(String(res.error));
      setState('error');
    }
    setParsed(null);
  };

  const cancel = () => {
    setParsed(null);
    setState('idle');
  };

  return { state, parsed, error, start, confirm, cancel };
}

export default useVoiceCommand;
