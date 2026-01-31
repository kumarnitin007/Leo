/**
 * Date Utilities Tests
 * Tests date parsing and formatting utilities
 */

import { describe, it, expect } from 'vitest';
import { format, addDays, subDays, startOfWeek, endOfWeek, addMonths, parseISO, isValid } from 'date-fns';

describe('Date Utilities', () => {
  const referenceDate = new Date('2026-01-30T10:00:00');

  describe('Basic Date Operations', () => {
    it('should format dates correctly', () => {
      const formatted = format(referenceDate, 'yyyy-MM-dd');
      expect(formatted).toBe('2026-01-30');
    });

    it('should add days correctly', () => {
      const tomorrow = addDays(referenceDate, 1);
      expect(format(tomorrow, 'yyyy-MM-dd')).toBe('2026-01-31');
    });

    it('should subtract days correctly', () => {
      const yesterday = subDays(referenceDate, 1);
      expect(format(yesterday, 'yyyy-MM-dd')).toBe('2026-01-29');
    });

    it('should add months correctly', () => {
      const nextMonth = addMonths(referenceDate, 1);
      expect(format(nextMonth, 'yyyy-MM')).toBe('2026-02');
    });
  });

  describe('Week Calculations', () => {
    it('should find start of week (Sunday)', () => {
      const weekStart = startOfWeek(referenceDate);
      expect(weekStart.getDay()).toBe(0); // Sunday
    });

    it('should find end of week (Saturday)', () => {
      const weekEnd = endOfWeek(referenceDate);
      expect(weekEnd.getDay()).toBe(6); // Saturday
    });

    it('should find start of week (Monday) with options', () => {
      const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      expect(weekStart.getDay()).toBe(1); // Monday
    });
  });

  describe('Date Parsing', () => {
    it('should parse ISO dates correctly', () => {
      const parsed = parseISO('2026-01-30');
      expect(isValid(parsed)).toBe(true);
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(0); // January is 0
      expect(parsed.getDate()).toBe(30);
    });

    it('should handle invalid dates', () => {
      const parsed = parseISO('invalid-date');
      expect(isValid(parsed)).toBe(false);
    });

    it('should parse ISO datetime correctly', () => {
      const parsed = parseISO('2026-01-30T14:30:00');
      expect(isValid(parsed)).toBe(true);
      expect(parsed.getHours()).toBe(14);
      expect(parsed.getMinutes()).toBe(30);
    });
  });

  describe('Relative Date Calculations', () => {
    it('should calculate next week correctly', () => {
      const nextWeek = addDays(referenceDate, 7);
      expect(format(nextWeek, 'yyyy-MM-dd')).toBe('2026-02-06');
    });

    it('should calculate next month first day', () => {
      const nextMonthFirst = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
      expect(format(nextMonthFirst, 'yyyy-MM-dd')).toBe('2026-02-01');
    });

    it('should handle year rollover', () => {
      const decemberDate = new Date('2026-12-15');
      const nextMonth = addMonths(decemberDate, 1);
      expect(nextMonth.getFullYear()).toBe(2027);
      expect(nextMonth.getMonth()).toBe(0); // January
    });
  });

  describe('Day of Week', () => {
    it('should identify Friday correctly', () => {
      // January 30, 2026 is a Friday
      expect(referenceDate.getDay()).toBe(5); // Friday
    });

    it('should find next Monday', () => {
      const daysToAdd = (1 + 7 - referenceDate.getDay()) % 7 || 7;
      const nextMonday = addDays(referenceDate, daysToAdd);
      expect(nextMonday.getDay()).toBe(1); // Monday
      expect(format(nextMonday, 'yyyy-MM-dd')).toBe('2026-02-02');
    });

    it('should find next specific day', () => {
      const targetDay = 3; // Wednesday
      const currentDay = referenceDate.getDay();
      const daysUntilTarget = (targetDay + 7 - currentDay) % 7 || 7;
      const nextWednesday = addDays(referenceDate, daysUntilTarget);
      expect(nextWednesday.getDay()).toBe(3); // Wednesday
    });
  });

  describe('Quarter Calculations', () => {
    it('should calculate end of Q1', () => {
      const endQ1 = new Date(2026, 2, 31); // March 31, 2026
      expect(format(endQ1, 'yyyy-MM-dd')).toBe('2026-03-31');
    });

    it('should calculate end of Q2', () => {
      const endQ2 = new Date(2026, 5, 30); // June 30, 2026
      expect(format(endQ2, 'yyyy-MM-dd')).toBe('2026-06-30');
    });

    it('should calculate end of Q3', () => {
      const endQ3 = new Date(2026, 8, 30); // September 30, 2026
      expect(format(endQ3, 'yyyy-MM-dd')).toBe('2026-09-30');
    });

    it('should calculate end of Q4', () => {
      const endQ4 = new Date(2026, 11, 31); // December 31, 2026
      expect(format(endQ4, 'yyyy-MM-dd')).toBe('2026-12-31');
    });
  });
});
