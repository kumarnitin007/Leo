/**
 * SpeechService: wrapper around Web Speech API for minimal transcription
 * Falls back to prompt() when unavailable (safe, non-intrusive)
 */
export class SpeechService {
  private recognition: any | null = null;

  constructor() {
    const AnyWin: any = window as any;
    const Rec = AnyWin.SpeechRecognition || AnyWin.webkitSpeechRecognition || null;
    if (Rec) {
      this.recognition = new Rec();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    }
  }

  async transcribeOnce(): Promise<{ transcript: string; confidence: number }> {
    if (!this.recognition) {
      // Fallback: prompt
      const t = window.prompt('Speech API not available. Please type the command:');
      return { transcript: t || '', confidence: t ? 0.5 : 0 };
    }

    return new Promise((resolve, reject) => {
      const rec = this.recognition;
      let finished = false;
      rec.onresult = (ev: any) => {
        try {
          const result = ev.results[0][0];
          finished = true;
          resolve({ transcript: result.transcript, confidence: result.confidence ?? 0.8 });
        } catch (err) {
          finished = true;
          reject(new Error('Speech recognition failed to parse result'));
        }
      };
      rec.onerror = (err: any) => {
        if (finished) return;
        // err can be a SpeechRecognitionErrorEvent - map common codes to friendly messages
        const code = err?.error || err?.type || err?.message || '';
        const mapping: Record<string,string> = {
          'not-allowed': 'Microphone access denied. Allow microphone permissions in your browser.',
          'service-not-allowed': 'Microphone access denied. Allow microphone permissions in your browser.',
          'no-speech': 'No speech detected. Please try again and speak clearly.',
          'aborted': 'Speech recognition was aborted. Please try again.',
          'network': 'Network error during speech recognition.'
        };
        const message = mapping[code] || (typeof code === 'string' && code.length ? String(code) : 'Speech recognition error');
        try { rec.stop(); } catch (_) {}
        finished = true;
        reject(new Error(message));
      };
      rec.onend = () => {
        if (!finished) resolve({ transcript: '', confidence: 0 });
      };
      try {
        rec.start();
      } catch (err) {
        reject(new Error('Unable to start speech recognition. Check microphone permissions.'));
      }
    });
  }
}

export default SpeechService;
