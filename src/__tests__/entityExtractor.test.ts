import fs from 'fs';
import path from 'path';
import { parseTrainingExample } from '../utils/parseTrainingExample';

const DATA_PATH = path.resolve(process.cwd(), 'src', 'data', 'voice-training.jsonl');

describe('parseTrainingExample - training dataset', () => {
  let examples: any[] = [];

  beforeAll(() => {
    const content = fs.readFileSync(DATA_PATH, 'utf8').trim();
    examples = content.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  });

  test('all training examples parse without throwing and match key fields', () => {
    expect(examples.length).toBeGreaterThanOrEqual(55);

    for (const ex of examples) {
      const parsed = parseTrainingExample(ex.example);

      // essential checks
      expect(parsed).toBeDefined();
      expect(parsed.rawTranscript).toEqual(ex.rawTranscript);
      if (ex.intentType) expect(parsed.intentType).toEqual(ex.intentType);

      // confidence approx equal (number or undefined)
      if (typeof ex.confidence !== 'undefined') {
        expect(parsed.confidence).toBeCloseTo(ex.confidence as number, 5);
      }

      // date/time fields if present
      if (ex.memoDateExpression) expect(parsed.memoDateExpression).toEqual(ex.memoDateExpression);
      if (ex.memoTimeExpression) expect(parsed.memoTimeExpression).toEqual(ex.memoTimeExpression);

      // title/tags if present
      if (ex.extractedTitle) expect(parsed.extractedTitle).toEqual(ex.extractedTitle);
      if (Array.isArray(ex.extractedTags)) expect(parsed.extractedTags).toEqual(ex.extractedTags);
    }
  });

  test('spot-check specific examples for correctness', () => {
    // find the "Create a task to call mom at 5pm today" example
    const target = examples.find((e) => e.rawTranscript?.includes('call mom'));
    expect(target).toBeDefined();
    const p = parseTrainingExample(target.example);
    expect(p.memoDateExpression).toEqual('TODAY');
    expect(p.memoTimeExpression).toEqual('17:00');
    expect(p.extractedTitle).toEqual('Call mom');

    // check the recurring standup example
    const standup = examples.find((e) => e.rawTranscript?.includes('standup meeting'));
    expect(standup).toBeDefined();
    const s = parseTrainingExample(standup.example);
    expect(s.extractedRecurrence).toContain('FREQ=WEEKLY');
    expect(s.extractedAttendees).toEqual(['John','Sarah','Mike']);
  });
});
