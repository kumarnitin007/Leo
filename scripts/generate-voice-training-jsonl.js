const fs = require('fs');
const path = require('path');

const CONFIDENCE_MAP = { HIGH: 0.9, MEDIUM: 0.6, LOW: 0.3 };

function parseArrayValue(val) {
  const inner = val.replace(/^\[|\]$/g, '').trim();
  if (!inner) return [];
  const parts = inner.match(/("[^"]*"|[^,\s]+)/g) || [];
  return parts.map((p) => {
    const s = p.trim();
    if (/^".*"$/.test(s)) return s.replace(/^"|"$/g, '');
    if (/^\d+$/.test(s)) return Number(s);
    if (/^(TRUE|FALSE)$/i.test(s)) return s.toLowerCase() === 'true';
    return s.replace(/^"|"$/g, '');
  });
}

function parseValue(raw) {
  if (!raw) return undefined;
  const v = raw.trim();
  if (v === 'NULL') return null;
  if (v === 'NEEDS_USER_INPUT') return undefined;
  if (/^\[.*\]$/.test(v)) return parseArrayValue(v);
  if (/^".*"$/.test(v)) return v.replace(/^"|"$/g, '');
  if (/^(TRUE|FALSE)$/i.test(v)) return v.toLowerCase() === 'true';
  if (/^\d+$/.test(v)) return Number(v);
  if (Object.keys(CONFIDENCE_MAP).includes(v)) return CONFIDENCE_MAP[v];
  return v;
}

function parseBlock(block) {
  const entry = { example: block };
  const utteranceMatch = block.match(/"([^\"]+)"\s*::/);
  const utterance = utteranceMatch ? utteranceMatch[1].trim() : block.trim();
  entry.rawTranscript = utterance;
  const after = block.split('::')[1] || '';
  const normalized = after.replace(/\n/g, ' ').replace(/\s*\|\s*/g, '|').trim();
  const tokens = normalized.split('|').map((t) => t.trim()).filter(Boolean);
  for (const tok of tokens) {
    const eqIdx = tok.indexOf('=');
    if (eqIdx === -1) continue;
    const key = tok.slice(0, eqIdx).trim();
    const rawVal = tok.slice(eqIdx + 1).trim();
    const parsed = parseValue(rawVal);
    switch (key) {
      case 'INTENT':
        entry.intentType = parsed;
        break;
      case 'ENTITY_TYPE':
        entry.entityType = parsed;
        break;
      case 'MEMO_DATE':
        entry.memoDateExpression = parsed;
        entry.memoDate = parsed;
        break;
      case 'MEMO_TIME':
        entry.memoTimeExpression = parsed;
        entry.memoTime = parsed;
        break;
      case 'PRIORITY':
        entry.extractedPriority = parsed;
        break;
      case 'RECURRENCE':
        entry.extractedRecurrence = parsed;
        break;
      case 'RECURRENCE_HUMAN':
        entry.extractedRecurrenceHuman = parsed;
        break;
      case 'TITLE':
        if (parsed === undefined) {
          entry.missingFields = (entry.missingFields || []).concat('TITLE');
        } else {
          entry.extractedTitle = parsed;
        }
        break;
      case 'TAGS':
        entry.extractedTags = parsed || [];
        break;
      case 'DURATION':
        entry.extractedDuration = typeof parsed === 'number' ? parsed : parsed ? Number(parsed) : null;
        break;
      case 'LOCATION':
        entry.extractedLocation = parsed;
        break;
      case 'ATTENDEES':
        entry.extractedAttendees = parsed || [];
        break;
      case 'ALL_DAY':
        entry.allDayEvent = !!parsed;
        break;
      case 'CONFIDENCE':
        entry.confidence = typeof parsed === 'number' ? parsed : CONFIDENCE_MAP[parsed] || 0;
        entry.intentConfidence = entry.confidence;
        entry.overallConfidence = entry.confidence;
        break;
      case 'MISSING_FIELDS':
        entry.missingFields = parsed || [];
        break;
      case 'NOTE':
        entry.note = parsed;
        break;
      case 'CONTENT':
        if (parsed === undefined) {
          entry.missingFields = (entry.missingFields || []).concat('CONTENT');
        } else {
          entry.content = parsed;
        }
        break;
      case 'SENTIMENT_SCORE':
        entry.sentimentScore = parsed;
        break;
      case 'MOOD':
        entry.mood = parsed;
        break;
      case 'ORIGINAL_TRANSCRIPT':
        entry.originalTranscript = parsed;
        break;
      case 'CORRECTED_TRANSCRIPT':
        entry.correctedTranscript = parsed;
        break;
      case 'TYPOS_CORRECTED':
        entry.typosCorrected = parsed || [];
        break;
      default:
        entry[key.toLowerCase()] = parsed;
        break;
    }
  }
  return entry;
}

function generate() {
  const mdPath = path.resolve(process.cwd(), 'VOICE_COMMAND_TRAINING_DATA_AND_SCHEMA.md');
  if (!fs.existsSync(mdPath)) {
    console.error('Missing VOICE_COMMAND_TRAINING_DATA_AND_SCHEMA.md');
    process.exit(1);
  }
  const content = fs.readFileSync(mdPath, 'utf8');
  const regex = /"([^\"]+)"\s*::([\s\S]*?)(?=\n\s*\n|$)/g;
  const out = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    const block = `${m[0]}`;
    out.push(parseBlock(block));
  }

  // write JSONL
  const outPath = path.resolve(process.cwd(), 'src', 'data', 'voice-training.jsonl');
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fd = fs.openSync(outPath, 'w');
  for (const obj of out) {
    fs.writeSync(fd, JSON.stringify(obj) + '\n');
  }
  fs.closeSync(fd);
  console.log('Wrote', out.length, 'examples to', outPath);
}

if (require.main === module) {
  generate();
}
