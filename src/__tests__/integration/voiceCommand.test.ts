/**
 * Voice Command Integration Tests
 * Tests the full voice command flow from transcript to command creation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityExtractor } from '../../services/voice/EntityExtractor';
import { IntentClassifier } from '../../services/voice/IntentClassifier';

describe('Voice Command Integration', () => {
  let entityExtractor: EntityExtractor;
  let intentClassifier: IntentClassifier;
  const referenceDate = new Date('2026-01-30T10:00:00');

  beforeEach(() => {
    entityExtractor = new EntityExtractor(referenceDate);
    intentClassifier = new IntentClassifier();
  });

  describe('Full Command Processing', () => {
    it('should process task creation command', async () => {
      const transcript = 'create task to buy groceries tomorrow at 2pm';
      
      const intentResult = await intentClassifier.classify(transcript);
      expect(intentResult.type).toBe('CREATE_TASK');
      
      const entities = entityExtractor.extract(transcript, intentResult.type);
      const dateEntity = entities.find(e => e.type === 'DATE');
      const timeEntity = entities.find(e => e.type === 'TIME');
      const titleEntity = entities.find(e => e.type === 'TITLE');
      
      expect(dateEntity?.normalizedValue).toBe('2026-01-31');
      expect(timeEntity?.normalizedValue).toBe('14:00');
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('buy groceries');
    });

    it('should process event creation command', async () => {
      const transcript = 'schedule meeting with team next Monday at 3pm';
      
      const intentResult = await intentClassifier.classify(transcript);
      expect(intentResult.type).toBe('CREATE_EVENT');
      
      const entities = entityExtractor.extract(transcript, intentResult.type);
      const dateEntity = entities.find(e => e.type === 'DATE');
      const timeEntity = entities.find(e => e.type === 'TIME');
      
      expect(dateEntity?.normalizedValue).toBe('2026-02-02');
      expect(timeEntity?.normalizedValue).toBe('15:00');
    });

    it('should process recurring task command', async () => {
      const transcript = 'add workout routine every weekday at 7am';
      
      const intentResult = await intentClassifier.classify(transcript);
      const entities = entityExtractor.extract(transcript, intentResult.type);
      
      const recurrenceEntity = entities.find(e => e.type === 'RECURRENCE');
      const timeEntity = entities.find(e => e.type === 'TIME');
      
      expect(recurrenceEntity?.normalizedValue).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
      expect(timeEntity?.normalizedValue).toBe('07:00');
    });

    it('should process todo creation command', async () => {
      const transcript = 'add to my list call insurance company';
      
      const intentResult = await intentClassifier.classify(transcript);
      expect(intentResult.type).toBe('CREATE_TODO');
      
      const entities = entityExtractor.extract(transcript, intentResult.type);
      const titleEntity = entities.find(e => e.type === 'TITLE');
      
      expect(titleEntity).toBeDefined();
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('call');
    });

    it('should process journal creation command', async () => {
      const transcript = 'journal entry feeling grateful today';
      
      const intentResult = await intentClassifier.classify(transcript);
      expect(intentResult.type).toBe('CREATE_JOURNAL');
    });
  });

  describe('Complex Commands', () => {
    it('should handle multiple entities', async () => {
      const transcript = 'create task to finish project report by next Friday at 5pm';
      
      const entities = entityExtractor.extract(transcript);
      
      const hasDate = entities.some(e => e.type === 'DATE');
      const hasTime = entities.some(e => e.type === 'TIME');
      const hasTitle = entities.some(e => e.type === 'TITLE');
      
      expect(hasDate).toBe(true);
      expect(hasTime).toBe(true);
      expect(hasTitle).toBe(true);
    });

    it('should handle shopping list items', async () => {
      const transcript = 'add milk to shopping list';
      
      const intentResult = await intentClassifier.classify(transcript);
      const entities = entityExtractor.extract(transcript, intentResult.type);
      const tagEntities = entities.filter(e => e.type === 'TAG');
      
      expect(tagEntities.some(t => t.normalizedValue === 'shopping')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle informal speech', async () => {
      const transcript = 'yo add that thing i gotta do tmrw';
      
      const intentResult = await intentClassifier.classify(transcript);
      const entities = entityExtractor.extract(transcript, intentResult.type);
      
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity?.normalizedValue).toBe('2026-01-31');
    });

    it('should handle ambiguous input gracefully', async () => {
      const transcript = 'something something';
      
      const intentResult = await intentClassifier.classify(transcript);
      expect(intentResult.type).toBe('UNKNOWN');
      expect(intentResult.confidence).toBeLessThan(0.5);
    });
  });

  describe('Command Confidence', () => {
    it('should have confidence for clear commands', async () => {
      const transcript = 'create task to call mom at 5pm today';
      
      const intentResult = await intentClassifier.classify(transcript);
      expect(intentResult.confidence).toBeGreaterThan(0.2);
    });

    it('should have lower confidence for unclear commands', async () => {
      const transcript = 'maybe do something later';
      
      const intentResult = await intentClassifier.classify(transcript);
      expect(intentResult.confidence).toBeLessThan(0.5);
    });
  });

  describe('Entity Extraction Accuracy', () => {
    const testCases = [
      { transcript: 'tomorrow', expectedDate: '2026-01-31' },
      { transcript: 'today', expectedDate: '2026-01-30' },
      { transcript: 'next Monday', expectedDate: '2026-02-02' },
      { transcript: 'December 25th', expectedDate: '2026-12-25' },
    ];

    testCases.forEach(({ transcript, expectedDate }) => {
      it(`should extract date from "${transcript}"`, () => {
        const fullTranscript = `Create task for ${transcript}`;
        const entities = entityExtractor.extract(fullTranscript);
        const dateEntity = entities.find(e => e.type === 'DATE');
        
        expect(dateEntity?.normalizedValue).toBe(expectedDate);
      });
    });

    const timeCases = [
      { transcript: '5pm', expectedTime: '17:00' },
      { transcript: '10am', expectedTime: '10:00' },
      { transcript: '2pm', expectedTime: '14:00' },
      { transcript: 'noon', expectedTime: '12:00' },
    ];

    timeCases.forEach(({ transcript, expectedTime }) => {
      it(`should extract time from "${transcript}"`, () => {
        const fullTranscript = `Create task at ${transcript}`;
        const entities = entityExtractor.extract(fullTranscript);
        const timeEntity = entities.find(e => e.type === 'TIME');
        
        expect(timeEntity?.normalizedValue).toBe(expectedTime);
      });
    });
  });
});
