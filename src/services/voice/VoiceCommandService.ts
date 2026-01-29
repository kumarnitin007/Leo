import IntentClassifier from './IntentClassifier';
import EntityExtractor from './EntityExtractor';
import SpeechService from './SpeechService';
import VoiceCommandLogger from './VoiceCommandLogger';
import { ParsedCommand } from './types';
import * as storage from '../../storage';

export class VoiceCommandService {
  classifier: IntentClassifier;
  extractor: EntityExtractor;
  speech: SpeechService;
  logger: VoiceCommandLogger;

  constructor() {
    this.classifier = new IntentClassifier();
    this.extractor = new EntityExtractor();
    this.speech = new SpeechService();
    this.logger = new VoiceCommandLogger();
  }

  async listenAndParse(): Promise<ParsedCommand> {
    const { transcript, confidence: sttConfidence } = await this.speech.transcribeOnce();

    const intent = await this.classifier.classify(transcript);
    const entities = this.extractor.extract(transcript);

    // simple overall confidence
    const entityAvg = entities.length ? entities.reduce((s,e)=>s+e.confidence,0)/entities.length : 0.5;
    const overall = Math.max(0.1, Math.min(1, (intent.confidence * 0.6) + (entityAvg * 0.3) + (sttConfidence * 0.1)));

    const parsed = {
      transcript,
      intent,
      entities,
      overallConfidence: overall,
      timestamp: new Date().toISOString()
    };

    // Log initial parse
    try { await this.logger.logCommand(parsed); } catch (e) { /* swallow */ }

    return parsed;
  }

  async execute(parsed: ParsedCommand, userId?: string): Promise<{ success: boolean; createdId?: string | null; error?: any }> {
    try {
      // Map intents to storage functions where possible
      const intent = parsed.intent.type;
      let createdId: string | null = null;

      switch (intent) {
        case 'CREATE_TASK': {
          const title = parsed.entities.find(e=>e.type==='TITLE')?.normalizedValue || parsed.transcript;
          const task = { id: undefined, name: title } as any;
          // call storage.addTask if available
          if ((storage as any).addTask) {
            await (storage as any).addTask(task);
          }
          break;
        }
        case 'CREATE_EVENT': {
          const title = parsed.entities.find(e=>e.type==='TITLE')?.normalizedValue || parsed.transcript;
          const ev = { id: undefined, title } as any;
          if ((storage as any).addEvent) await (storage as any).addEvent(ev);
          break;
        }
        default:
          // Not implemented: just log the action
          break;
      }

      // Update log with success
      await this.logger.audit('execute_success', { intent: parsed.intent.type, userId });
      return { success: true, createdId: createdId };
    } catch (err) {
      await this.logger.audit('execute_error', { error: String(err), intent: parsed.intent.type, userId });
      return { success: false, error: err };
    }
  }
}

export default VoiceCommandService;
