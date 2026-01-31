/**
 * Validation Tests
 * Tests various validation functions used throughout the app
 */

import { describe, it, expect } from 'vitest';

// Validation functions (inline for testing, these should match app logic)
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPassword = (password: string): boolean => {
  return password.length >= 8;
};

const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const isValidHexColor = (color: string): boolean => {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
};

const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

const isValidPriority = (priority: string): boolean => {
  return ['low', 'medium', 'high', 'urgent'].includes(priority.toLowerCase());
};

const isValidFrequency = (frequency: string): boolean => {
  return ['daily', 'weekly', 'monthly', 'yearly', 'one-time'].includes(frequency.toLowerCase());
};

describe('Email Validation', () => {
  it('should accept valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('test.user@domain.co.uk')).toBe(true);
    expect(isValidEmail('user+tag@example.org')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('invalid')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@.com')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
  });
});

describe('Password Validation', () => {
  it('should accept valid passwords', () => {
    expect(isValidPassword('password123')).toBe(true);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('MySecureP@ss!')).toBe(true);
  });

  it('should reject short passwords', () => {
    expect(isValidPassword('')).toBe(false);
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('short')).toBe(false);
  });
});

describe('URL Validation', () => {
  it('should accept valid URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('https://sub.domain.co.uk/path?query=1')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false);
  });
});

describe('Hex Color Validation', () => {
  it('should accept valid hex colors', () => {
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#6366f1')).toBe(true);
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('#ABC')).toBe(true);
  });

  it('should reject invalid hex colors', () => {
    expect(isValidHexColor('')).toBe(false);
    expect(isValidHexColor('ffffff')).toBe(false);
    expect(isValidHexColor('#ggg')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('#1234567')).toBe(false);
    expect(isValidHexColor('rgb(255,255,255)')).toBe(false);
  });
});

describe('Input Sanitization', () => {
  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
    expect(sanitizeInput('\t\ntrim\n\t')).toBe('trim');
  });

  it('should remove angle brackets', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    expect(sanitizeInput('Hello <b>World</b>')).toBe('Hello bWorld/b');
  });

  it('should handle clean input', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World');
    expect(sanitizeInput('Task: Buy groceries')).toBe('Task: Buy groceries');
  });
});

describe('Priority Validation', () => {
  it('should accept valid priorities', () => {
    expect(isValidPriority('low')).toBe(true);
    expect(isValidPriority('medium')).toBe(true);
    expect(isValidPriority('high')).toBe(true);
    expect(isValidPriority('urgent')).toBe(true);
    expect(isValidPriority('HIGH')).toBe(true);
    expect(isValidPriority('Low')).toBe(true);
  });

  it('should reject invalid priorities', () => {
    expect(isValidPriority('')).toBe(false);
    expect(isValidPriority('critical')).toBe(false);
    expect(isValidPriority('normal')).toBe(false);
    expect(isValidPriority('1')).toBe(false);
  });
});

describe('Frequency Validation', () => {
  it('should accept valid frequencies', () => {
    expect(isValidFrequency('daily')).toBe(true);
    expect(isValidFrequency('weekly')).toBe(true);
    expect(isValidFrequency('monthly')).toBe(true);
    expect(isValidFrequency('yearly')).toBe(true);
    expect(isValidFrequency('one-time')).toBe(true);
    expect(isValidFrequency('DAILY')).toBe(true);
  });

  it('should reject invalid frequencies', () => {
    expect(isValidFrequency('')).toBe(false);
    expect(isValidFrequency('hourly')).toBe(false);
    expect(isValidFrequency('biweekly')).toBe(false);
    expect(isValidFrequency('sometimes')).toBe(false);
  });
});
