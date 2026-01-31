/**
 * EntityExtractor Tests
 * 
 * Tests the EntityExtractor class against the voice-training.jsonl dataset
 * to ensure correct extraction of dates, times, priorities, tags, etc.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EntityExtractor } from '../services/voice/EntityExtractor';

const DATA_PATH = path.resolve(process.cwd(), 'src', 'data', 'voice-training.jsonl');

// Reference date for consistent testing (Jan 30, 2026)
const REFERENCE_DATE = new Date('2026-01-30T10:00:00');

describe('EntityExtractor - Training Dataset', () => {
  let examples: any[] = [];
  const extractor = new EntityExtractor(REFERENCE_DATE);

  beforeAll(() => {
    if (fs.existsSync(DATA_PATH)) {
      const content = fs.readFileSync(DATA_PATH, 'utf8').trim();
      examples = content.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    }
  });

  // Test that all examples parse without errors
  it('all training examples parse without throwing', () => {
    if (examples.length === 0) {
      console.warn('Skipping: voice-training.jsonl not found');
      return;
    }
    
    expect(examples.length).toBeGreaterThanOrEqual(50);

    for (const ex of examples) {
      expect(() => {
        extractor.extract(ex.rawTranscript, ex.intentType);
      }).not.toThrow();
    }
  });

  // Test EntityExtractor date extraction
  describe('Date extraction', () => {
    it('extracts TODAY correctly', () => {
      const entities = extractor.extract('Create a task to finish homework today');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.value).toBe('today');
      expect(dateEntity?.normalizedValue).toBe('2026-01-30');
    });

    it('extracts TOMORROW correctly', () => {
      const entities = extractor.extract('Add task to buy groceries tomorrow');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.value).toBe('tomorrow');
      expect(dateEntity?.normalizedValue).toBe('2026-01-31');
    });

    it('extracts YESTERDAY correctly', () => {
      const entities = extractor.extract('Create task for yesterday');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.value).toBe('yesterday');
      expect(dateEntity?.normalizedValue).toBe('2026-01-29');
    });

    it('extracts NEXT WEEK correctly', () => {
      const entities = extractor.extract('Schedule meeting next week');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.value).toBe('next week');
    });

    it('extracts NEXT MONDAY correctly', () => {
      const entities = extractor.extract('Move task to next Monday');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.normalizedValue).toBe('2026-02-02'); // Next Monday after Jan 30, 2026 (Friday)
    });

    it('extracts 1st of next month correctly', () => {
      const entities = extractor.extract('Remind me to pay rent on the 1st of next month');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.normalizedValue).toBe('2026-02-01');
    });

    it('extracts absolute dates - December 25th', () => {
      const entities = extractor.extract('Create birthday party event for December 25th');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.normalizedValue).toBe('2026-12-25');
    });

    it('extracts absolute dates - June 15th', () => {
      const entities = extractor.extract('Create milestone for running first marathon on June 15th');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.normalizedValue).toBe('2026-06-15');
    });

    it('extracts dates with day-month format - 1st April', () => {
      const entities = extractor.extract('Create a new milestone event for 1st April');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.normalizedValue).toBe('2026-04-01');
    });

    it('extracts end of quarter dates', () => {
      const entities = extractor.extract('Add milestone: Launch MVP by end of Q1 2026');
      const dateEntity = entities.find(e => e.type === 'DATE');
      expect(dateEntity).toBeDefined();
      expect(dateEntity?.normalizedValue).toBe('2026-03-31');
    });
  });

  // Test EntityExtractor time extraction
  describe('Time extraction', () => {
    it('extracts 12-hour time - 5pm', () => {
      const entities = extractor.extract('Create a task to call mom at 5pm');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('17:00');
    });

    it('extracts 12-hour time - 2pm', () => {
      const entities = extractor.extract('Schedule team meeting tomorrow at 2pm');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('14:00');
    });

    it('extracts 12-hour time - 10am', () => {
      const entities = extractor.extract('Book dentist appointment next Tuesday at 10am');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('10:00');
    });

    it('extracts 12-hour time - 7pm', () => {
      const entities = extractor.extract('Add dinner with Sarah at Italian restaurant on Friday at 7pm');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('19:00');
    });

    it('extracts end of day', () => {
      const entities = extractor.extract('Add urgent task to submit report by end of day');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('17:00');
    });

    it('extracts time - 9pm', () => {
      const entities = extractor.extract('Add daily journal entry at 9pm every night');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('21:00');
    });

    it('extracts time - 6am', () => {
      const entities = extractor.extract('Create morning routine at 6am every day');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('06:00');
    });

    it('extracts noon correctly', () => {
      const entities = extractor.extract('Schedule lunch meeting at noon');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('12:00');
    });

    it('extracts midnight correctly', () => {
      const entities = extractor.extract('Set reminder for midnight');
      const timeEntity = entities.find(e => e.type === 'TIME');
      expect(timeEntity).toBeDefined();
      expect(timeEntity?.normalizedValue).toBe('00:00');
    });
  });

  // Test EntityExtractor priority extraction
  describe('Priority extraction', () => {
    it('extracts URGENT priority', () => {
      const entities = extractor.extract('Add urgent task to submit report by end of day');
      const priorityEntity = entities.find(e => e.type === 'PRIORITY');
      expect(priorityEntity).toBeDefined();
      expect(priorityEntity?.normalizedValue).toBe('URGENT');
    });

    it('extracts HIGH priority', () => {
      const entities = extractor.extract('Change team meeting to high priority');
      const priorityEntity = entities.find(e => e.type === 'PRIORITY');
      expect(priorityEntity).toBeDefined();
      expect(priorityEntity?.normalizedValue).toBe('HIGH');
    });

    it('extracts LOW priority', () => {
      const entities = extractor.extract('Add low priority task to organize desk');
      const priorityEntity = entities.find(e => e.type === 'PRIORITY');
      expect(priorityEntity).toBeDefined();
      expect(priorityEntity?.normalizedValue).toBe('LOW');
    });
  });

  // Test EntityExtractor recurrence extraction
  describe('Recurrence extraction', () => {
    it('extracts daily recurrence', () => {
      const entities = extractor.extract('Create a new task to jump 50 times every single day');
      const recurrenceEntity = entities.find(e => e.type === 'RECURRENCE');
      expect(recurrenceEntity).toBeDefined();
      expect(recurrenceEntity?.normalizedValue).toBe('FREQ=DAILY');
    });

    it('extracts weekly recurrence - every Monday', () => {
      const entities = extractor.extract('Create weekly standup meeting every Monday at 10am');
      const recurrenceEntity = entities.find(e => e.type === 'RECURRENCE');
      expect(recurrenceEntity).toBeDefined();
      expect(recurrenceEntity?.normalizedValue).toContain('FREQ=WEEKLY');
      expect(recurrenceEntity?.normalizedValue).toContain('BYDAY=MO');
    });

    it('extracts weekday recurrence', () => {
      const entities = extractor.extract('Add workout routine every weekday at 7am');
      const recurrenceEntity = entities.find(e => e.type === 'RECURRENCE');
      expect(recurrenceEntity).toBeDefined();
      expect(recurrenceEntity?.normalizedValue).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    });

    it('extracts multiple days recurrence - Monday and Wednesday', () => {
      const entities = extractor.extract('Create a recurring weekly team standup meeting every Monday and Wednesday at 10am');
      const recurrenceEntity = entities.find(e => e.type === 'RECURRENCE');
      expect(recurrenceEntity).toBeDefined();
      expect(recurrenceEntity?.normalizedValue).toContain('BYDAY=MO,WE');
    });

    it('extracts nightly recurrence', () => {
      const entities = extractor.extract('Add daily journal entry at 9pm every night');
      const recurrenceEntity = entities.find(e => e.type === 'RECURRENCE');
      expect(recurrenceEntity).toBeDefined();
      expect(recurrenceEntity?.normalizedValue).toBe('FREQ=DAILY');
    });
  });

  // Test EntityExtractor title extraction
  describe('Title extraction', () => {
    it('extracts title - Call mom', () => {
      const entities = extractor.extract('Create a task to call mom at 5pm today');
      const titleEntity = entities.find(e => e.type === 'TITLE');
      expect(titleEntity).toBeDefined();
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('call mom');
    });

    it('extracts title - Buy groceries', () => {
      const entities = extractor.extract('Add task to buy groceries tomorrow');
      const titleEntity = entities.find(e => e.type === 'TITLE');
      expect(titleEntity).toBeDefined();
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('buy groceries');
    });

    it('extracts title - Team meeting', () => {
      const entities = extractor.extract('Schedule team meeting tomorrow at 2pm');
      const titleEntity = entities.find(e => e.type === 'TITLE');
      expect(titleEntity).toBeDefined();
      expect(titleEntity?.normalizedValue?.toLowerCase()).toContain('team meeting');
    });

    it('extracts title from informal speech', () => {
      const entities = extractor.extract('yo add that thing i gotta do tmrw');
      const titleEntity = entities.find(e => e.type === 'TITLE');
      expect(titleEntity).toBeDefined();
    });
  });

  // Test EntityExtractor tag extraction
  describe('Tag extraction', () => {
    it('extracts work-related tags', () => {
      const entities = extractor.extract('Schedule team meeting tomorrow at 2pm');
      const tagEntities = entities.filter(e => e.type === 'TAG');
      const tags = tagEntities.map(e => e.normalizedValue);
      expect(tags).toContain('work');
    });

    it('extracts health-related tags', () => {
      const entities = extractor.extract('Book dentist appointment next Tuesday at 10am');
      const tagEntities = entities.filter(e => e.type === 'TAG');
      const tags = tagEntities.map(e => e.normalizedValue);
      expect(tags).toContain('health');
    });

    it('extracts shopping-related tags', () => {
      const entities = extractor.extract('Add milk to shopping list');
      const tagEntities = entities.filter(e => e.type === 'TAG');
      const tags = tagEntities.map(e => e.normalizedValue);
      expect(tags).toContain('shopping');
    });

    it('extracts fitness-related tags', () => {
      const entities = extractor.extract('Add workout routine every weekday at 7am');
      const tagEntities = entities.filter(e => e.type === 'TAG');
      const tags = tagEntities.map(e => e.normalizedValue);
      expect(tags).toContain('fitness');
    });
  });

  // Test EntityExtractor attendee extraction
  describe('Attendee extraction', () => {
    it('extracts single attendee', () => {
      const entities = extractor.extract('Add dinner with Sarah at Italian restaurant on Friday at 7pm');
      const personEntity = entities.find(e => e.type === 'PERSON');
      expect(personEntity).toBeDefined();
      expect(personEntity?.normalizedValue).toContain('Sarah');
    });

    it('extracts multiple attendees', () => {
      const entities = extractor.extract('Create a recurring weekly team standup meeting every Monday and Wednesday at 10am starting next week for the next 3 months with attendees John, Sarah, and Mike');
      const personEntity = entities.find(e => e.type === 'PERSON');
      expect(personEntity).toBeDefined();
      const attendees = personEntity?.normalizedValue as string[];
      expect(attendees).toContain('John');
      expect(attendees).toContain('Sarah');
      expect(attendees).toContain('Mike');
    });
  });
});
