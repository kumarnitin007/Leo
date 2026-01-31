/**
 * IntentClassifier Tests
 * Tests the intent classification logic for voice commands
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IntentClassifier } from '../../services/voice/IntentClassifier';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;

  beforeEach(() => {
    classifier = new IntentClassifier();
  });

  describe('Task Creation Intent', () => {
    it('should classify "create task" as CREATE_TASK', async () => {
      const result = await classifier.classify('create task to buy groceries');
      expect(result.type).toBe('CREATE_TASK');
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it('should classify "add task" as CREATE_TASK', async () => {
      const result = await classifier.classify('add task to finish homework');
      expect(result.type).toBe('CREATE_TASK');
    });

    it('should classify "remind me" as CREATE_TASK', async () => {
      const result = await classifier.classify('remind me to submit report tomorrow');
      expect(result.type).toBe('CREATE_TASK');
    });
  });

  describe('Event Creation Intent', () => {
    it('should classify "schedule meeting" as CREATE_EVENT', async () => {
      const result = await classifier.classify('schedule meeting with team tomorrow');
      expect(result.type).toBe('CREATE_EVENT');
    });

    it('should classify "appointment" as CREATE_EVENT', async () => {
      const result = await classifier.classify('appointment dentist next Tuesday');
      expect(result.type).toBe('CREATE_EVENT');
    });

    it('should classify "book" as CREATE_EVENT', async () => {
      const result = await classifier.classify('book doctor appointment next week');
      expect(result.type).toBe('CREATE_EVENT');
    });
  });

  describe('To-Do Creation Intent', () => {
    it('should classify "add todo" as CREATE_TODO', async () => {
      const result = await classifier.classify('add todo buy milk');
      expect(result.type).toBe('CREATE_TODO');
    });

    it('should classify "add to my list" as CREATE_TODO', async () => {
      const result = await classifier.classify('add to my list call insurance company');
      expect(result.type).toBe('CREATE_TODO');
    });

    it('should classify "remember to" as CREATE_TODO', async () => {
      const result = await classifier.classify('remember to pick up dry cleaning');
      expect(result.type).toBe('CREATE_TODO');
    });
  });

  describe('Journal Creation Intent', () => {
    it('should classify "journal" as CREATE_JOURNAL', async () => {
      const result = await classifier.classify('journal entry about today');
      expect(result.type).toBe('CREATE_JOURNAL');
    });

    it('should classify "feeling" as CREATE_JOURNAL', async () => {
      const result = await classifier.classify("i'm feeling great today");
      expect(result.type).toBe('CREATE_JOURNAL');
    });
  });

  describe('Milestone Creation Intent', () => {
    it('should classify "milestone" as CREATE_MILESTONE', async () => {
      const result = await classifier.classify('milestone completed marathon');
      expect(result.type).toBe('CREATE_MILESTONE');
    });
  });

  describe('Unknown Intent', () => {
    it('should return UNKNOWN for ambiguous input', async () => {
      const result = await classifier.classify('hello world');
      expect(result.type).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should return UNKNOWN for empty input', async () => {
      const result = await classifier.classify('');
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('Confidence Scores', () => {
    it('should have confidence score in result', async () => {
      const result = await classifier.classify('create task to buy groceries');
      expect(result.confidence).toBeDefined();
      expect(typeof result.confidence).toBe('number');
    });

    it('should have method in result', async () => {
      const result = await classifier.classify('create task');
      expect(result.method).toBe('RULES');
    });
  });
});
