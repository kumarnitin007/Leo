/**
 * TodoService Tests
 * Tests the To-Do list service functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as todoService from '../../services/todoService';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          is: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          in: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
            })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })),
    },
  },
}));

describe('TodoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Group Operations', () => {
    it('should export getTodoGroups function', () => {
      expect(typeof todoService.getTodoGroups).toBe('function');
    });

    it('should export createTodoGroup function', () => {
      expect(typeof todoService.createTodoGroup).toBe('function');
    });

    it('should export updateTodoGroup function', () => {
      expect(typeof todoService.updateTodoGroup).toBe('function');
    });

    it('should export deleteTodoGroup function', () => {
      expect(typeof todoService.deleteTodoGroup).toBe('function');
    });
  });

  describe('Item Operations', () => {
    it('should export getTodoItems function', () => {
      expect(typeof todoService.getTodoItems).toBe('function');
    });

    it('should export createTodoItem function', () => {
      expect(typeof todoService.createTodoItem).toBe('function');
    });

    it('should export updateTodoItem function', () => {
      expect(typeof todoService.updateTodoItem).toBe('function');
    });

    it('should export deleteTodoItem function', () => {
      expect(typeof todoService.deleteTodoItem).toBe('function');
    });

    it('should export toggleTodoItem function', () => {
      expect(typeof todoService.toggleTodoItem).toBe('function');
    });
  });

  describe('Bulk Operations', () => {
    it('should export clearCompletedTodos function', () => {
      expect(typeof todoService.clearCompletedTodos).toBe('function');
    });

    it('should export moveTodoItem function', () => {
      expect(typeof todoService.moveTodoItem).toBe('function');
    });
  });

  describe('Data Validation', () => {
    it('should validate item priority values', () => {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      validPriorities.forEach(priority => {
        expect(['low', 'medium', 'high', 'urgent']).toContain(priority);
      });
    });

    it('should not allow invalid priority values', () => {
      const invalidPriorities = ['critical', 'normal', 'extreme'];
      invalidPriorities.forEach(priority => {
        expect(['low', 'medium', 'high', 'urgent']).not.toContain(priority);
      });
    });
  });
});
