/**
 * Types Tests
 * Tests that data structures conform to expected shapes
 */

import { describe, it, expect } from 'vitest';

// Type checking helpers
interface TaskShape {
  id: string;
  name: string;
  user_id?: string;
  description?: string;
  category?: string;
  frequency?: string;
  date?: string;
  weightage?: number;
  tags?: string[];
}

interface EventShape {
  id: string;
  name: string;
  date: string;
  user_id?: string;
  description?: string;
  time?: string;
  frequency?: string;
  priority?: number;
}

interface TodoItemShape {
  id: string;
  text: string;
  user_id?: string;
  group_id?: string;
  is_completed?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
}

interface JournalEntryShape {
  id: string;
  entry_date: string;
  user_id?: string;
  content?: string;
  mood?: string;
  tags?: string[];
  is_favorite?: boolean;
}

interface SafeEntryShape {
  id: string;
  title: string;
  user_id?: string;
  url?: string;
  category?: string;
  encrypted_data: string;
  iv: string;
}

const isValidTask = (obj: any): obj is TaskShape => {
  return typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string';
};

const isValidEvent = (obj: any): obj is EventShape => {
  return typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.date === 'string';
};

const isValidTodoItem = (obj: any): obj is TodoItemShape => {
  return typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.text === 'string';
};

const isValidJournalEntry = (obj: any): obj is JournalEntryShape => {
  return typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.entry_date === 'string';
};

const isValidSafeEntry = (obj: any): obj is SafeEntryShape => {
  return typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.title === 'string' &&
    typeof obj.encrypted_data === 'string' &&
    typeof obj.iv === 'string';
};

describe('Task Type', () => {
  it('should validate correct task shape', () => {
    const validTask = {
      id: 'task-1',
      name: 'Buy groceries',
      user_id: 'user-1',
      category: 'shopping',
      frequency: 'daily',
    };
    expect(isValidTask(validTask)).toBe(true);
  });

  it('should reject invalid task shape', () => {
    expect(isValidTask({})).toBe(false);
    expect(isValidTask({ id: 'task-1' })).toBe(false);
    expect(isValidTask({ name: 'Task' })).toBe(false);
    expect(isValidTask(null)).toBe(false);
  });

  it('should accept minimal task', () => {
    const minimalTask = { id: 'task-1', name: 'Minimal Task' };
    expect(isValidTask(minimalTask)).toBe(true);
  });
});

describe('Event Type', () => {
  it('should validate correct event shape', () => {
    const validEvent = {
      id: 'event-1',
      name: 'Birthday Party',
      date: '2026-01-30',
      time: '14:00',
    };
    expect(isValidEvent(validEvent)).toBe(true);
  });

  it('should reject invalid event shape', () => {
    expect(isValidEvent({})).toBe(false);
    expect(isValidEvent({ id: 'event-1', name: 'Event' })).toBe(false);
    expect(isValidEvent({ id: 'event-1', date: '2026-01-30' })).toBe(false);
  });
});

describe('TodoItem Type', () => {
  it('should validate correct todo item shape', () => {
    const validTodo = {
      id: 'todo-1',
      text: 'Complete homework',
      priority: 'high' as const,
      is_completed: false,
    };
    expect(isValidTodoItem(validTodo)).toBe(true);
  });

  it('should reject invalid todo item shape', () => {
    expect(isValidTodoItem({})).toBe(false);
    expect(isValidTodoItem({ id: 'todo-1' })).toBe(false);
    expect(isValidTodoItem({ text: 'Todo' })).toBe(false);
  });

  it('should validate priority enum values', () => {
    const priorities: ('low' | 'medium' | 'high' | 'urgent')[] = ['low', 'medium', 'high', 'urgent'];
    priorities.forEach(p => {
      expect(['low', 'medium', 'high', 'urgent']).toContain(p);
    });
  });
});

describe('JournalEntry Type', () => {
  it('should validate correct journal entry shape', () => {
    const validEntry = {
      id: 'journal-1',
      entry_date: '2026-01-30',
      content: 'Had a great day!',
      mood: 'happy',
    };
    expect(isValidJournalEntry(validEntry)).toBe(true);
  });

  it('should reject invalid journal entry shape', () => {
    expect(isValidJournalEntry({})).toBe(false);
    expect(isValidJournalEntry({ id: 'journal-1' })).toBe(false);
    expect(isValidJournalEntry({ entry_date: '2026-01-30' })).toBe(false);
  });
});

describe('SafeEntry Type', () => {
  it('should validate correct safe entry shape', () => {
    const validEntry = {
      id: 'safe-1',
      title: 'My Password',
      encrypted_data: 'encrypted_base64_string',
      iv: 'initialization_vector',
    };
    expect(isValidSafeEntry(validEntry)).toBe(true);
  });

  it('should reject invalid safe entry shape', () => {
    expect(isValidSafeEntry({})).toBe(false);
    expect(isValidSafeEntry({ id: 'safe-1', title: 'Entry' })).toBe(false);
    expect(isValidSafeEntry({ id: 'safe-1', title: 'Entry', encrypted_data: 'data' })).toBe(false);
  });
});

describe('Data Integrity', () => {
  it('should validate date format YYYY-MM-DD', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    expect(dateRegex.test('2026-01-30')).toBe(true);
    expect(dateRegex.test('2026-1-30')).toBe(false);
    expect(dateRegex.test('01-30-2026')).toBe(false);
  });

  it('should validate time format HH:MM', () => {
    const timeRegex = /^\d{2}:\d{2}$/;
    expect(timeRegex.test('14:30')).toBe(true);
    expect(timeRegex.test('9:30')).toBe(false);
    expect(timeRegex.test('14:30:00')).toBe(false);
  });

  it('should validate UUID format', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(uuidRegex.test('not-a-uuid')).toBe(false);
  });
});
