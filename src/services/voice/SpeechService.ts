/// <reference path="../../types/speech.d.ts" />
/**
 * SpeechService: wrapper around Web Speech API for minimal transcription
 * Falls back to prompt() when unavailable (safe, non-intrusive)
 */
export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;

  /**
   * Hard release: abort + stop + clear handlers. WebKit/Safari often keeps the mic indicator
   * until recognition is fully torn down — graceful stop alone is not always enough.
   */
  forceRelease(): void {
    const rec = this.recognition;
    if (!rec) {
      this.isListening = false;
      return;
    }
    try {
      rec.abort();
    } catch {
      /* InvalidStateError: not started */
    }
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
    this.isListening = false;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onnomatch = null;
  }

  constructor() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (Rec) {
      this.recognition = new Rec();
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
    }
  }

  /**
   * Stop the speech recognition and release the microphone
   */
  stop(): void {
    this.forceRelease();
  }

  /**
   * Abort the speech recognition immediately (for cleanup)
   */
  abort(): void {
    this.forceRelease();
  }

  async transcribeOnce(): Promise<{ transcript: string; confidence: number }> {
    if (!this.recognition) {
      // Fallback: prompt
      const t = window.prompt('Speech API not available. Please type the command:');
      return { transcript: t || '', confidence: t ? 0.5 : 0 };
    }

    // Stop any existing recognition first
    this.forceRelease();

    return new Promise((resolve, reject) => {
      const rec = this.recognition;
      if (!rec) {
        reject(new Error('Speech recognition not available'));
        return;
      }
      let finished = false;
      
      const finalize = () => {
        this.forceRelease();
      };

      rec.onresult = (ev: SpeechRecognitionEvent) => {
        try {
          const result = ev.results[0][0];
          finished = true;
          finalize();
          resolve({ transcript: result.transcript, confidence: result.confidence ?? 0.8 });
        } catch (err) {
          finished = true;
          finalize();
          reject(new Error('Speech recognition failed to parse result'));
        }
      };
      
      rec.onerror = (err: SpeechRecognitionErrorEvent) => {
        if (finished) return;
        // err can be a SpeechRecognitionErrorEvent - map common codes to friendly messages
        const code = err?.error || '';
        const mapping: Record<string,string> = {
          'not-allowed': 'Microphone access denied. Allow microphone permissions in your browser.',
          'service-not-allowed': 'Microphone access denied. Allow microphone permissions in your browser.',
          'no-speech': 'No speech detected. Please try again and speak clearly.',
          'aborted': 'Speech recognition was aborted. Please try again.',
          'network': 'Network error during speech recognition.'
        };
        const message = mapping[code] || (typeof code === 'string' && code.length ? String(code) : 'Speech recognition error');
        finished = true;
        finalize();
        reject(new Error(message));
      };
      
      rec.onend = () => {
        if (!finished) {
          finished = true;
          finalize();
          resolve({ transcript: '', confidence: 0 });
        }
      };
      
      try {
        this.isListening = true;
        rec.start();
      } catch (err) {
        this.isListening = false;
        finalize();
        reject(new Error('Unable to start speech recognition. Check microphone permissions.'));
      }
    });
  }
}

/** One shared instance — Web Speech uses one mic; multiple `SpeechService` instances left Safari holding capture. */
let sharedSpeechService: SpeechService | null = null;

export function getSharedSpeechService(): SpeechService {
  if (!sharedSpeechService) {
    sharedSpeechService = new SpeechService();
  }
  return sharedSpeechService;
}

/** Tear down recognition from any code path (modal, history confirm, hooks share the same instance). */
export function releaseGlobalSpeechRecognition(): void {
  getSharedSpeechService().forceRelease();
}

export default SpeechService;
