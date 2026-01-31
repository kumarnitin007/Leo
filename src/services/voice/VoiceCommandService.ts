import IntentClassifier from './IntentClassifier';
import EntityExtractor from './EntityExtractor';
import SpeechService from './SpeechService';
import VoiceCommandLogger from './VoiceCommandLogger';
import { ParsedCommand } from './types';
import * as storage from '../../storage';
import * as todoService from '../todoService';
import dbService from './VoiceCommandDatabaseService';

// Small UUID v4 generator used for creating deterministic IDs for created items
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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

      const sessionId = generateUUID();
      switch (intent) {
        case 'CREATE_TASK': {
          const title = parsed.entities.find(e=>e.type==='TITLE')?.normalizedValue || parsed.transcript;
          const newId = generateUUID();
          const task = { id: newId, name: title } as any;

          // call storage.addTask if available
          if ((storage as any).addTask) {
            await (storage as any).addTask(task);
            createdId = newId;
          }

          // Try to save command to DB and link back to task
          try {
            const cmdId = await dbService.saveCommand({
              userId: userId || undefined,
              sessionId,
              rawTranscript: parsed.transcript,
              intentType: parsed.intent.type as any,
              entityType: 'TASK',
              memoDate: parsed.entities.find(e=>e.type==='DATE')?.normalizedValue || null,
              extractedTitle: title,
              extractedPriority: parsed.entities.find(e=>e.type==='PRIORITY')?.normalizedValue || undefined,
              extractedTags: parsed.entities.filter(e=>e.type==='TAG').map(e=>e.normalizedValue || e.value),
              overallConfidence: parsed.overallConfidence,
              isValid: true,
              outcome: 'SUCCESS' as any,
              createdItemType: 'task',
              createdItemId: createdId
            });

            // Attempt to update task with voice metadata if updateTask exists
            if ((storage as any).updateTask && createdId) {
              await (storage as any).updateTask(createdId, { createdViaVoice: true, voiceCommandId: cmdId, voiceConfidence: parsed.overallConfidence });
            }
          } catch (err) {
            console.warn('CREATE_TASK: db save/link failed', err);
          }

          break;
        }
        case 'CREATE_EVENT': {
          const title = parsed.entities.find(e=>e.type==='TITLE')?.normalizedValue || parsed.transcript;
          const newId = generateUUID();
          const ev = { id: newId, title } as any;
          if ((storage as any).addEvent) {
            await (storage as any).addEvent(ev);
            createdId = newId;
          }

          try {
            const cmdId = await dbService.saveCommand({
              userId: userId || undefined,
              sessionId,
              rawTranscript: parsed.transcript,
              intentType: parsed.intent.type as any,
              entityType: 'EVENT',
              memoDate: parsed.entities.find(e=>e.type==='DATE')?.normalizedValue || null,
              memoTime: parsed.entities.find(e=>e.type==='TIME')?.normalizedValue || null,
              extractedTitle: title,
              extractedTags: parsed.entities.filter(e=>e.type==='TAG').map(e=>e.normalizedValue || e.value),
              overallConfidence: parsed.overallConfidence,
              isValid: true,
              outcome: 'SUCCESS' as any,
              createdItemType: 'event',
              createdItemId: createdId
            });

            if ((storage as any).updateEvent && createdId) {
              await (storage as any).updateEvent(createdId, { createdViaVoice: true, voiceCommandId: cmdId, voiceConfidence: parsed.overallConfidence });
            }
          } catch (err) {
            console.warn('CREATE_EVENT: db save/link failed', err);
          }

          break;
        }
        case 'CREATE_TODO': {
          // Extract text from TITLE entity or use transcript
          const title = parsed.entities.find(e=>e.type==='TITLE')?.normalizedValue || parsed.transcript;
          const priorityEntity = parsed.entities.find(e=>e.type==='PRIORITY');
          const priority = priorityEntity?.normalizedValue || 'medium';

          try {
            const todoItem = await todoService.createTodoItem({
              text: title,
              priority: priority as 'low' | 'medium' | 'high' | 'urgent',
            });
            createdId = todoItem.id;

            // Log to DB
            await dbService.saveCommand({
              userId: userId || undefined,
              sessionId,
              rawTranscript: parsed.transcript,
              intentType: parsed.intent.type as any,
              entityType: 'TODO',
              extractedTitle: title,
              extractedPriority: priority,
              overallConfidence: parsed.overallConfidence,
              isValid: true,
              outcome: 'SUCCESS' as any,
              createdItemType: 'todo',
              createdItemId: createdId
            });
          } catch (err) {
            console.warn('CREATE_TODO: failed', err);
          }
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
