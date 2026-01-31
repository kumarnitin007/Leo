/**
 * Voice Command Integration Tests
 * Tests the full voice command flow from transcript to command creation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    it('should process task creation command', () => {
      const transcript = 'Create a task to buy groceries tomorrow at 2pm';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.intent).toBe('CREATE_TASK');
      
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      const dateEntity = entities.find(e => e.type === 'DATE');
      const timeEntity = entities.find(e => e.type === 'TIME');
      const titleEntity = entities.find(e => e.type === 'TITLE');
      
      expect(dateEntity?.normalizedValue).toBe('2026-01-31');
      expect(timeEntity?.normalizedValue).toBe('14:00');
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('buy groceries');
    });

    it('should process event creation command', () => {
      const transcript = 'Schedule meeting with team next Monday at 3pm';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.intent).toBe('CREATE_EVENT');
      
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      const dateEntity = entities.find(e => e.type === 'DATE');
      const timeEntity = entities.find(e => e.type === 'TIME');
      
      expect(dateEntity?.normalizedValue).toBe('2026-02-02');
      expect(timeEntity?.normalizedValue).toBe('15:00');
    });

    it('should process recurring task command', () => {
      const transcript = 'Add workout routine every weekday at 7am';
      
      const intentResult = intentClassifier.classify(transcript);
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      
      const recurrenceEntity = entities.find(e => e.type === 'RECURRENCE');
      const timeEntity = entities.find(e => e.type === 'TIME');
      
      expect(recurrenceEntity?.normalizedValue).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
      expect(timeEntity?.normalizedValue).toBe('07:00');
    });

    it('should process urgent task command', () => {
      const transcript = 'Add urgent task to submit report by end of day';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.intent).toBe('CREATE_TASK');
      
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      const priorityEntity = entities.find(e => e.type === 'PRIORITY');
      const timeEntity = entities.find(e => e.type === 'TIME');
      
      expect(priorityEntity?.normalizedValue).toBe('URGENT');
      expect(timeEntity?.normalizedValue).toBe('17:00');
    });

    it('should process todo creation command', () => {
      const transcript = 'Add to my to-do list to call insurance company';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.intent).toBe('CREATE_TODO');
      
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      const titleEntity = entities.find(e => e.type === 'TITLE');
      
      expect(titleEntity).toBeDefined();
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('call');
    });

    it('should process journal creation command', () => {
      const transcript = 'Write journal entry feeling grateful today';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.intent).toBe('CREATE_JOURNAL');
    });
  });

  describe('Complex Commands', () => {
    it('should handle multiple entities', () => {
      const transcript = 'Create high priority task to finish project report by next Friday at 5pm';
      
      const entities = entityExtractor.extract(transcript);
      
      const hasDate = entities.some(e => e.type === 'DATE');
      const hasTime = entities.some(e => e.type === 'TIME');
      const hasPriority = entities.some(e => e.type === 'PRIORITY');
      const hasTitle = entities.some(e => e.type === 'TITLE');
      
      expect(hasDate).toBe(true);
      expect(hasTime).toBe(true);
      expect(hasPriority).toBe(true);
      expect(hasTitle).toBe(true);
    });

    it('should handle attendees in events', () => {
      const transcript = 'Schedule lunch meeting with Sarah and John on Friday at noon';
      
      const entities = entityExtractor.extract(transcript, 'CREATE_EVENT');
      const personEntity = entities.find(e => e.type === 'PERSON');
      
      expect(personEntity).toBeDefined();
    });

    it('should handle shopping list items', () => {
      const transcript = 'Add milk to shopping list';
      
      const intentResult = intentClassifier.classify(transcript);
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      const tagEntities = entities.filter(e => e.type === 'TAG');
      
      expect(tagEntities.some(t => t.normalizedValue === 'shopping')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle informal speech', () => {
      const transcript = 'yo add that thing i gotta do tmrw';
      
      const intentResult = intentClassifier.classify(transcript);
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity?.normalizedValue).toBe('2026-01-31');
    });

    it('should handle filler words', () => {
      const transcript = 'Um, can you like, maybe create a task to, you know, finish report';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.intent).toBe('CREATE_TASK');
      
      const entities = entityExtractor.extract(transcript, intentResult.intent);
      const titleEntity = entities.find(e => e.type === 'TITLE');
      
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('finish');
    });

    it('should handle ambiguous input gracefully', () => {
      const transcript = 'something something';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.confidence).toBeLessThan(0.7);
    });
  });

  describe('Command Confidence', () => {
    it('should have high confidence for clear commands', () => {
      const transcript = 'Create a new task to call mom at 5pm today';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.confidence).toBeGreaterThan(0.7);
    });

    it('should have lower confidence for unclear commands', () => {
      const transcript = 'maybe do something later';
      
      const intentResult = intentClassifier.classify(transcript);
      expect(intentResult.confidence).toBeLessThan(0.7);
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
