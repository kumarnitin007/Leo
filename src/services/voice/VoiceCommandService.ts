import IntentClassifier from './IntentClassifier';
import EntityExtractor from './EntityExtractor';
import SpeechService from './SpeechService';
import VoiceCommandLogger from './VoiceCommandLogger';
import { ParsedCommand, Entity } from './types';
import * as storage from '../../storage';
import * as todoService from '../todoService';
import dbService from './VoiceCommandDatabaseService';
import { JournalEntry, Task, Event, Item, Routine } from '../../types';

// Small UUID v4 generator used for creating deterministic IDs for created items
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Helper to format today's date as YYYY-MM-DD
const getTodayStr = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Helper to get entity value or default
const getEntityValue = (entities: Entity[], type: string, defaultValue: string): { value: string; isDefault: boolean } => {
  const entity = entities.find(e => e.type === type);
  if (entity && entity.normalizedValue) {
    return { value: String(entity.normalizedValue), isDefault: false };
  }
  return { value: defaultValue, isDefault: true };
};

// Execution result with detailed field info
export interface ExecutionResult {
  success: boolean;
  createdId?: string | null;
  error?: any;
  entityType?: string;
  extractedFields?: Record<string, { value: any; isDefault: boolean }>;
  missingMandatory?: string[];
  needsUserInput?: boolean;
}

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

  async execute(parsed: ParsedCommand, userId?: string): Promise<ExecutionResult> {
    try {
      const intent = parsed.intent.type;
      let createdId: string | null = null;
      let entityType: string = '';
      const extractedFields: Record<string, { value: any; isDefault: boolean }> = {};
      const sessionId = generateUUID();

      switch (intent) {
        case 'CREATE_TASK': {
          entityType = 'TASK';
          const titleInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const dateInfo = getEntityValue(parsed.entities, 'DATE', getTodayStr());
          const priorityInfo = getEntityValue(parsed.entities, 'PRIORITY', 'MEDIUM');
          const recurrenceInfo = getEntityValue(parsed.entities, 'RECURRENCE', '');
          const userTags = parsed.entities.filter(e => e.type === 'TAG').map(e => String(e.normalizedValue || e.value));

          extractedFields['name'] = titleInfo;
          extractedFields['specificDate'] = dateInfo;
          extractedFields['priority'] = priorityInfo;
          if (recurrenceInfo.value) extractedFields['frequency'] = recurrenceInfo;
          extractedFields['tags'] = { value: userTags, isDefault: userTags.length === 0 };
          extractedFields['createdViaVoice'] = { value: true, isDefault: false };

          const newId = generateUUID();
          const task: Partial<Task> & { createdViaVoice?: boolean } = {
            id: newId,
            name: String(titleInfo.value),
            weightage: 5,
            frequency: recurrenceInfo.value ? 'custom' : 'daily',
            customFrequency: recurrenceInfo.value || undefined,
            specificDate: !recurrenceInfo.value ? dateInfo.value : undefined,
            tags: userTags,
            createdAt: new Date().toISOString()
          };

          await storage.addTask(task as Task);
          createdId = newId;

          // Log to DB and update task with voice metadata
          try {
            // Ensure priority is uppercase for DB type
            const taskDbPriority = String(priorityInfo.value).toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
            const cmdId = await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              memoDate: dateInfo.value,
              extractedTitle: String(titleInfo.value),
              extractedPriority: taskDbPriority,
              extractedTags: userTags,
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: 'task', createdItemId: createdId
            });
            // Update task with voice metadata
            if ((storage as any).updateTask && createdId) {
              await (storage as any).updateTask(createdId, { 
                createdViaVoice: true, 
                voiceCommandId: cmdId, 
                voiceConfidence: parsed.overallConfidence 
              });
            }
          } catch (err) { console.warn('CREATE_TASK: db logging failed', err); }
          break;
        }

        case 'CREATE_EVENT': {
          entityType = 'EVENT';
          const titleInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const dateInfo = getEntityValue(parsed.entities, 'DATE', getTodayStr());
          const timeInfo = getEntityValue(parsed.entities, 'TIME', '');
          const recurrenceInfo = getEntityValue(parsed.entities, 'RECURRENCE', '');
          const userTags = parsed.entities.filter(e => e.type === 'TAG').map(e => String(e.normalizedValue || e.value));

          extractedFields['name'] = titleInfo;
          extractedFields['date'] = dateInfo;
          if (timeInfo.value) extractedFields['time'] = timeInfo;
          extractedFields['tags'] = { value: userTags, isDefault: userTags.length === 0 };
          extractedFields['createdViaVoice'] = { value: true, isDefault: false };

          const newId = generateUUID();
          let frequency: 'yearly' | 'one-time' | 'custom' = 'one-time';
          if (recurrenceInfo.value) {
            frequency = recurrenceInfo.value.includes('YEARLY') ? 'yearly' : 'custom';
          }

          const event: Partial<Event> = {
            id: newId,
            name: String(titleInfo.value),
            date: dateInfo.value,
            frequency,
            customFrequency: recurrenceInfo.value || undefined,
            tags: userTags,
            notifyDaysBefore: 1,
            priority: 5,
            createdAt: new Date().toISOString()
          };

          await storage.addEvent(event as Event);
          createdId = newId;

          try {
            const cmdId = await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              memoDate: dateInfo.value, memoTime: timeInfo.value || null,
              extractedTitle: String(titleInfo.value),
              extractedTags: userTags,
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: 'event', createdItemId: createdId
            });
            // Update event with voice metadata
            if ((storage as any).updateEvent && createdId) {
              await (storage as any).updateEvent(createdId, { 
                createdViaVoice: true, 
                voiceCommandId: cmdId, 
                voiceConfidence: parsed.overallConfidence 
              });
            }
          } catch (err) { console.warn('CREATE_EVENT: db logging failed', err); }
          break;
        }

        case 'CREATE_TODO': {
          entityType = 'TODO';
          const titleInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const priorityInfo = getEntityValue(parsed.entities, 'PRIORITY', 'medium');
          const dateInfo = getEntityValue(parsed.entities, 'DATE', '');

          extractedFields['text'] = titleInfo;
          extractedFields['priority'] = priorityInfo;
          if (dateInfo.value) extractedFields['dueDate'] = dateInfo;
          extractedFields['createdViaVoice'] = { value: true, isDefault: false };

          // Map priority values (TodoPriority uses lowercase)
          let todoPriority: 'low' | 'medium' | 'high' = 'medium';
          const pVal = String(priorityInfo.value).toLowerCase();
          if (pVal === 'urgent' || pVal === 'high') todoPriority = 'high';
          else if (pVal === 'low') todoPriority = 'low';

          // Map to DB Priority type (uppercase)
          const dbPriority = todoPriority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH';

          // Add "🎤 Voice" to the text as a prefix for visibility (since todos don't have tags)
          const voicePrefix = '🎤 ';
          const todoItem = await todoService.createTodoItem({
            text: voicePrefix + String(titleInfo.value),
            priority: todoPriority,
            dueDate: dateInfo.value || undefined,
          });
          createdId = todoItem.id;

          try {
            const cmdId = await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              extractedTitle: String(titleInfo.value),
              extractedPriority: dbPriority,
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: 'todo', createdItemId: createdId
            });
            // Update todo with voice metadata if supported
            if ((todoService as any).updateTodoItem && createdId) {
              try {
                await (todoService as any).updateTodoItem(createdId, { 
                  createdViaVoice: true, 
                  voiceCommandId: cmdId, 
                  voiceConfidence: parsed.overallConfidence 
                });
              } catch { /* column may not exist yet */ }
            }
          } catch (err) { console.warn('CREATE_TODO: db logging failed', err); }
          break;
        }

        case 'CREATE_JOURNAL': {
          entityType = 'JOURNAL';
          const contentInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const dateInfo = getEntityValue(parsed.entities, 'DATE', getTodayStr());
          const userTags = parsed.entities.filter(e => e.type === 'TAG').map(e => String(e.normalizedValue || e.value));

          extractedFields['content'] = contentInfo;
          extractedFields['date'] = dateInfo;
          extractedFields['tags'] = { value: userTags, isDefault: userTags.length === 0 };
          extractedFields['createdViaVoice'] = { value: true, isDefault: false };

          // Infer mood from content
          let mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible' | undefined;
          const content = String(contentInfo.value).toLowerCase();
          if (/great|amazing|wonderful|fantastic|excellent|awesome/.test(content)) mood = 'great';
          else if (/good|nice|happy|pleased|glad/.test(content)) mood = 'good';
          else if (/okay|fine|alright|meh/.test(content)) mood = 'okay';
          else if (/bad|sad|unhappy|frustrated|stressed/.test(content)) mood = 'bad';
          else if (/terrible|awful|horrible|depressed|miserable/.test(content)) mood = 'terrible';

          if (mood) extractedFields['mood'] = { value: mood, isDefault: false };

          const newId = generateUUID();
          // Prepend voice indicator to content
          const voiceIndicator = '🎤 [Voice Entry]\n\n';
          const journalEntry: JournalEntry = {
            id: newId,
            date: dateInfo.value,
            content: voiceIndicator + String(contentInfo.value),
            mood,
            tags: userTags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await storage.saveJournalEntry(journalEntry);
          createdId = newId;

          try {
            await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              memoDate: dateInfo.value,
              extractedTitle: String(contentInfo.value).substring(0, 100),
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: 'journal', createdItemId: createdId
            });
          } catch (err) { console.warn('CREATE_JOURNAL: db logging failed', err); }
          break;
        }

        case 'CREATE_ITEM': {
          entityType = 'ITEM';
          const titleInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const dateInfo = getEntityValue(parsed.entities, 'DATE', '');

          extractedFields['name'] = titleInfo;
          if (dateInfo.value) extractedFields['expirationDate'] = dateInfo;

          // Default to Note category
          const newId = generateUUID();
          const item: Partial<Item> = {
            id: newId,
            name: String(titleInfo.value),
            category: 'Note',
            expirationDate: dateInfo.value || undefined,
            createdAt: new Date().toISOString()
          };

          if ((storage as any).addItem) {
            await (storage as any).addItem(item);
            createdId = newId;
          }

          try {
            await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              extractedTitle: String(titleInfo.value),
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: 'item', createdItemId: createdId
            });
          } catch (err) { console.warn('CREATE_ITEM: db logging failed', err); }
          break;
        }

        case 'CREATE_ROUTINE': {
          entityType = 'ROUTINE';
          const titleInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const timeInfo = getEntityValue(parsed.entities, 'TIME', 'morning');

          extractedFields['name'] = titleInfo;
          extractedFields['timeOfDay'] = timeInfo;

          // Map time to timeOfDay
          let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime' = 'morning';
          const time = String(timeInfo.value).toLowerCase();
          if (time.includes('afternoon') || (time.includes(':') && parseInt(time) >= 12 && parseInt(time) < 17)) {
            timeOfDay = 'afternoon';
          } else if (time.includes('evening') || time.includes('night') || (time.includes(':') && parseInt(time) >= 17)) {
            timeOfDay = 'evening';
          }

          const newId = generateUUID();
          const routine: Partial<Routine> = {
            id: newId,
            name: String(titleInfo.value),
            timeOfDay,
            taskIds: [], // Empty, user adds tasks later
            isPreDefined: false,
            isActive: true,
            createdAt: new Date().toISOString()
          };

          if ((storage as any).addRoutine) {
            await (storage as any).addRoutine(routine);
            createdId = newId;
          }

          try {
            await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              extractedTitle: String(titleInfo.value),
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: 'routine', createdItemId: createdId
            });
          } catch (err) { console.warn('CREATE_ROUTINE: db logging failed', err); }
          break;
        }

        case 'CREATE_MILESTONE':
        case 'CREATE_RESOLUTION': {
          entityType = intent === 'CREATE_MILESTONE' ? 'MILESTONE' : 'RESOLUTION';
          const titleInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const dateInfo = getEntityValue(parsed.entities, 'DATE', getTodayStr());

          extractedFields['name'] = titleInfo;
          extractedFields['date'] = dateInfo;

          // Use milestones storage if available
          const newId = generateUUID();
          const milestone = {
            id: newId,
            name: String(titleInfo.value),
            date: dateInfo.value,
            type: intent === 'CREATE_RESOLUTION' ? 'resolution' : 'milestone',
            createdAt: new Date().toISOString()
          };

          if ((storage as any).addMilestone) {
            await (storage as any).addMilestone(milestone);
            createdId = newId;
          }

          try {
            await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              memoDate: dateInfo.value,
              extractedTitle: String(titleInfo.value),
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: entityType.toLowerCase(), createdItemId: createdId
            });
          } catch (err) { console.warn(`${intent}: db logging failed`, err); }
          break;
        }

        case 'CREATE_PINNED_EVENT': {
          // Treat as a high-priority event
          entityType = 'PINNED_EVENT';
          const titleInfo = getEntityValue(parsed.entities, 'TITLE', parsed.transcript);
          const dateInfo = getEntityValue(parsed.entities, 'DATE', getTodayStr());

          extractedFields['name'] = titleInfo;
          extractedFields['date'] = dateInfo;

          const newId = generateUUID();
          const event: Partial<Event> = {
            id: newId,
            name: `📌 ${titleInfo.value}`,
            date: dateInfo.value,
            frequency: 'one-time',
            priority: 10, // Highest priority
            notifyDaysBefore: 3,
            createdAt: new Date().toISOString()
          };

          await storage.addEvent(event as Event);
          createdId = newId;

          try {
            await dbService.saveCommand({
              userId: userId || undefined, sessionId,
              rawTranscript: parsed.transcript,
              intentType: intent as any, entityType,
              memoDate: dateInfo.value,
              extractedTitle: String(titleInfo.value),
              overallConfidence: parsed.overallConfidence,
              isValid: true, outcome: 'SUCCESS' as any,
              createdItemType: 'event', createdItemId: createdId
            });
          } catch (err) { console.warn('CREATE_PINNED_EVENT: db logging failed', err); }
          break;
        }

        default:
          console.warn(`Voice command intent "${intent}" not implemented`);
          return {
            success: false,
            error: `Intent "${intent}" is not yet implemented`,
            entityType: 'UNKNOWN',
            needsUserInput: true
          };
      }

      await this.logger.audit('execute_success', { intent, userId });
      return {
        success: true,
        createdId,
        entityType,
        extractedFields,
        needsUserInput: false
      };
    } catch (err) {
      await this.logger.audit('execute_error', { error: String(err), intent: parsed.intent.type, userId });
      return { success: false, error: err, needsUserInput: true };
    }
  }
}

export default VoiceCommandService;
