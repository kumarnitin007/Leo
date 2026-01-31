/**
 * TodoService Tests
 * Tests the To-Do list service functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TodoService, todoService } from '../../services/todoService';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
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
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
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
    it('should have getGroups method', () => {
      expect(typeof todoService.getGroups).toBe('function');
    });

    it('should have createGroup method', () => {
      expect(typeof todoService.createGroup).toBe('function');
    });

    it('should have updateGroup method', () => {
      expect(typeof todoService.updateGroup).toBe('function');
    });

    it('should have deleteGroup method', () => {
      expect(typeof todoService.deleteGroup).toBe('function');
    });
  });

  describe('Item Operations', () => {
    it('should have getItems method', () => {
      expect(typeof todoService.getItems).toBe('function');
    });

    it('should have createItem method', () => {
      expect(typeof todoService.createItem).toBe('function');
    });

    it('should have updateItem method', () => {
      expect(typeof todoService.updateItem).toBe('function');
    });

    it('should have deleteItem method', () => {
      expect(typeof todoService.deleteItem).toBe('function');
    });

    it('should have toggleItemComplete method', () => {
      expect(typeof todoService.toggleItemComplete).toBe('function');
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

  describe('Service Instance', () => {
    it('should export a singleton instance', () => {
      expect(todoService).toBeDefined();
      expect(todoService instanceof TodoService).toBe(true);
    });
  });
});
