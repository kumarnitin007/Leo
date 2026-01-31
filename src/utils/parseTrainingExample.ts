import * as fs from 'fs';
import * as path from 'path';
import { IntentType, VoiceCommandLogInsert, Priority } from '../types/voice-command-db.types';

/** Training data entry (parsed from the annotated examples) */
export interface TrainingDataEntry extends VoiceCommandLogInsert {
  // original annotated block from the markdown
  example: string;
  // the full original quoted utterance
  rawTranscript: string;
  // reported confidence in 0-1
  confidence?: number;
  // fields present in the annotation
  missingFields?: string[];
  note?: string;
  originalTranscript?: string;
  correctedTranscript?: string;
  typosCorrected?: string[];
}

const CONFIDENCE_MAP: Record<string, number> = {
  HIGH: 0.9,
  MEDIUM: 0.6,
  LOW: 0.3,
};

function parseArrayValue(val: string): any[] {
  // Remove surrounding [ ]
  const inner = val.trim().replace(/^\[|\]$/g, '').trim();
  if (!inner) return [];
  // split on commas not inside quotes
  const parts = inner.match(/("[^"]*"|[^,\s]+)/g) || [];
  return parts.map((p) => {
    const s = p.trim();
    if (/^".*"$/.test(s)) return s.replace(/^"|"$/g, '');
    if (/^\d+$/.test(s)) return Number(s);
    if (/^(TRUE|FALSE)$/i.test(s)) return s.toLowerCase() === 'true';
    return s.replace(/^"|"$/g, '');
  });
}

function parseValue(raw: string): any {
  if (!raw) return undefined;
  const v = raw.trim();
  if (v === 'NULL') return null;
  if (v === 'NEEDS_USER_INPUT') return undefined;
  if (/^\[.*\]$/.test(v)) return parseArrayValue(v);
  if (/^".*"$/.test(v)) return v.replace(/^"|"$/g, '');
  if (/^(TRUE|FALSE)$/i.test(v)) return v.toLowerCase() === 'true';
  if (/^\d+$/.test(v)) return Number(v);
  // confidence levels
  // Leave tokens like HIGH/MEDIUM/LOW as strings for fields like PRIORITY; handle mapping only for CONFIDENCE key.
  // all-caps token or date aliases -> return as-is
  return v;
}

function toIntentType(s: string): IntentType | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (t === 'UNKNOWN' || t === 'MULTIPLE') return t as IntentType;
  return (t as IntentType) || undefined;
}

/**
 * Parse a single annotated example block into a structured TrainingDataEntry.
 * Input format expected like:
 * "Create a new task" :: \n  INTENT=CREATE_TASK | \n  ENTITY_TYPE=TASK | \n  MEMO_DATE=TODAY | ...
 */
export function parseTrainingExample(block: string): TrainingDataEntry {
  const entry: any = { example: block };

  // extract utterance
  const utteranceMatch = block.match(/"([^\"]+)"\s*::/);
  const utterance = utteranceMatch ? utteranceMatch[1].trim() : block.trim();
  entry.rawTranscript = utterance;

  // isolate the annotation part after ::
  const after = block.split('::')[1] || '';
  // normalize separators (pipe |) and newlines
  const normalized = after.replace(/\n/g, ' ').replace(/\s*\|\s*/g, '|').trim();
  const tokens = normalized
    .split('|')
    .map((t) => t.trim())
    .filter(Boolean);

  for (const tok of tokens) {
    const eqIdx = tok.indexOf('=');
    if (eqIdx === -1) continue;
    const key = tok.slice(0, eqIdx).trim();
    const rawVal = tok.slice(eqIdx + 1).trim();
    const parsed = parseValue(rawVal);

    switch (key) {
      case 'INTENT':
        entry.intentType = toIntentType(parsed as string) as any;
        break;
      case 'ENTITY_TYPE':
        entry.entityType = parsed as any; // may be TASK/EVENT etc.
        break;
      case 'MEMO_DATE':
        entry.memoDate = typeof parsed === 'string' ? parsed : parsed === null ? null : parsed;
        entry.memoDateExpression = typeof parsed === 'string' ? parsed : null;
        break;
      case 'MEMO_TIME':
        entry.memoTime = parsed as any;
        entry.memoTimeExpression = typeof parsed === 'string' ? parsed : null;
        break;
      case 'PRIORITY':
        entry.extractedPriority = (parsed as Priority) || null;
        break;
      case 'RECURRENCE':
        entry.extractedRecurrence = parsed as any;
        break;
      case 'RECURRENCE_HUMAN':
        entry.extractedRecurrenceHuman = parsed as any;
        break;
      case 'TITLE':
        if (parsed === undefined) {
          // NEEDS_USER_INPUT
          entry.missingFields = (entry.missingFields || []).concat('TITLE');
        } else {
          entry.extractedTitle = parsed as any;
        }
        break;
      case 'TAGS':
        entry.extractedTags = (parsed as any) || [];
        break;
      case 'DURATION':
        if (parsed === null) {
          entry.extractedDuration = null;
        } else if (typeof parsed === 'number') {
          entry.extractedDuration = parsed;
        } else if (typeof parsed === 'string' && /^\d+$/.test(parsed)) {
          entry.extractedDuration = Number(parsed);
        } else {
          entry.extractedDuration = parsed ? Number(parsed) : null;
        }
        break;
      case 'LOCATION':
        entry.extractedLocation = parsed as any;
        break;
      case 'ATTENDEES':
        entry.extractedAttendees = (parsed as any) || [];
        break;
      case 'ALL_DAY':
        entry.allDayEvent = !!parsed;
        break;
      case 'CONFIDENCE':
        if (typeof parsed === 'number') {
          entry.confidence = parsed;
        } else if (typeof parsed === 'string' && CONFIDENCE_MAP[parsed]) {
          entry.confidence = CONFIDENCE_MAP[parsed];
        } else {
          entry.confidence = 0;
        }
        entry.intentConfidence = entry.confidence;
        entry.overallConfidence = entry.confidence;
        break;
      case 'MISSING_FIELDS':
        entry.missingFields = (parsed as any) || [];
        break;
      case 'NOTE':
        entry.note = parsed as any;
        break;
      case 'CONTENT':
        // journal content
        if (parsed === undefined) {
          entry.missingFields = (entry.missingFields || []).concat('CONTENT');
        } else {
          (entry as any).content = parsed;
        }
        break;
      case 'SENTIMENT_SCORE':
        (entry as any).sentimentScore = parsed as any;
        break;
      case 'MOOD':
        (entry as any).mood = parsed as any;
        break;
      case 'TITLE=NEEDS_USER_INPUT':
        entry.missingFields = (entry.missingFields || []).concat('TITLE');
        break;
      case 'ORIGINAL_TRANSCRIPT':
        entry.originalTranscript = parsed as any;
        break;
      case 'CORRECTED_TRANSCRIPT':
        entry.correctedTranscript = parsed as any;
        break;
      case 'TYPOS_CORRECTED':
        entry.typosCorrected = (parsed as any) || [];
        break;
      default:
        // unknown keys: attach to entry as-is
        (entry as any)[key.toLowerCase()] = parsed;
        break;
    }
  }

  // set required minimal fields for insert
  entry.rawTranscript = entry.rawTranscript || utterance;
  entry.intentType = entry.intentType || ('UNKNOWN' as IntentType);

  // clean up missingFields uniqueness
  if (entry.missingFields) {
    entry.missingFields = Array.from(new Set(entry.missingFields));
  }

  // map to TrainingDataEntry
  return entry as TrainingDataEntry;
}

// Optional: small CLI to parse a file and output JSONL
if (require.main === module) {
  const mdPath = path.resolve(process.cwd(), 'VOICE_COMMAND_TRAINING_DATA_AND_SCHEMA.md');
  if (!fs.existsSync(mdPath)) {
    console.error('Could not find VOICE_COMMAND_TRAINING_DATA_AND_SCHEMA.md in project root.');
    process.exit(1);
  }
  const content = fs.readFileSync(mdPath, 'utf8');
  const regex = /"([^\"]+)"\s*::([\s\S]*?)(?=\n\s*\n|$)/g;
  const out: TrainingDataEntry[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    const block = `${m[0]}`;
    try {
      out.push(parseTrainingExample(block));
    } catch (e) {
      console.error('Failed to parse block', block, e);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}
