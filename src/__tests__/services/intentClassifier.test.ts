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
    it('should classify "create task" as CREATE_TASK', () => {
      const result = classifier.classify('create a task to buy groceries');
      expect(result.intent).toBe('CREATE_TASK');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should classify "add task" as CREATE_TASK', () => {
      const result = classifier.classify('add task to finish homework');
      expect(result.intent).toBe('CREATE_TASK');
    });

    it('should classify "new task" as CREATE_TASK', () => {
      const result = classifier.classify('new task call mom at 5pm');
      expect(result.intent).toBe('CREATE_TASK');
    });

    it('should classify "remind me" as CREATE_TASK', () => {
      const result = classifier.classify('remind me to submit report tomorrow');
      expect(result.intent).toBe('CREATE_TASK');
    });
  });

  describe('Event Creation Intent', () => {
    it('should classify "schedule meeting" as CREATE_EVENT', () => {
      const result = classifier.classify('schedule meeting with team tomorrow');
      expect(result.intent).toBe('CREATE_EVENT');
    });

    it('should classify "create event" as CREATE_EVENT', () => {
      const result = classifier.classify('create event birthday party on Saturday');
      expect(result.intent).toBe('CREATE_EVENT');
    });

    it('should classify "add appointment" as CREATE_EVENT', () => {
      const result = classifier.classify('add appointment dentist next Tuesday');
      expect(result.intent).toBe('CREATE_EVENT');
    });

    it('should classify "book" as CREATE_EVENT', () => {
      const result = classifier.classify('book doctor appointment next week');
      expect(result.intent).toBe('CREATE_EVENT');
    });
  });

  describe('To-Do Creation Intent', () => {
    it('should classify "add to-do" as CREATE_TODO', () => {
      const result = classifier.classify('add to-do buy milk');
      expect(result.intent).toBe('CREATE_TODO');
    });

    it('should classify "new todo" as CREATE_TODO', () => {
      const result = classifier.classify('new todo finish reading chapter 5');
      expect(result.intent).toBe('CREATE_TODO');
    });

    it('should classify "add to my list" as CREATE_TODO', () => {
      const result = classifier.classify('add to my list call insurance company');
      expect(result.intent).toBe('CREATE_TODO');
    });
  });

  describe('Journal Creation Intent', () => {
    it('should classify "write journal" as CREATE_JOURNAL', () => {
      const result = classifier.classify('write journal entry about today');
      expect(result.intent).toBe('CREATE_JOURNAL');
    });

    it('should classify "add journal" as CREATE_JOURNAL', () => {
      const result = classifier.classify('add journal feeling great today');
      expect(result.intent).toBe('CREATE_JOURNAL');
    });

    it('should classify "diary entry" as CREATE_JOURNAL', () => {
      const result = classifier.classify('diary entry had a productive day');
      expect(result.intent).toBe('CREATE_JOURNAL');
    });
  });

  describe('Milestone Creation Intent', () => {
    it('should classify "add milestone" as CREATE_MILESTONE', () => {
      const result = classifier.classify('add milestone completed marathon');
      expect(result.intent).toBe('CREATE_MILESTONE');
    });

    it('should classify "create milestone" as CREATE_MILESTONE', () => {
      const result = classifier.classify('create milestone graduated college June 2026');
      expect(result.intent).toBe('CREATE_MILESTONE');
    });
  });

  describe('Unknown Intent', () => {
    it('should return UNKNOWN for ambiguous input', () => {
      const result = classifier.classify('hello world');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should return UNKNOWN for empty input', () => {
      const result = classifier.classify('');
      expect(result.intent).toBe('UNKNOWN');
    });
  });

  describe('Confidence Scores', () => {
    it('should have higher confidence for explicit triggers', () => {
      const explicit = classifier.classify('create a new task to buy groceries');
      const implicit = classifier.classify('buy groceries');
      expect(explicit.confidence).toBeGreaterThan(implicit.confidence);
    });
  });
});
