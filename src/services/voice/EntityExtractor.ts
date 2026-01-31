/**
 * EntityExtractor - Comprehensive entity extraction from voice transcripts
 * 
 * Handles: dates, times, priorities, tags, recurrence, titles, duration, location, attendees
 * Uses date-fns for robust date calculations
 */

import {
  addDays,
  addWeeks,
  addMonths,
  addHours,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
  nextSunday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  parse,
  isValid,
  setHours,
  setMinutes,
  getDay,
  subDays,
  subWeeks,
} from 'date-fns';
import { Entity, EntityType, IntentType } from './types';

/**
 * EntityExtractor class - extracts structured entities from voice transcripts
 */
export class EntityExtractor {
  private referenceDate: Date;

  constructor(referenceDate?: Date) {
    this.referenceDate = referenceDate || new Date();
  }

  /**
   * Main extraction method
   */
  extract(transcript: string, intentType?: IntentType, context?: { referenceDate?: Date }): Entity[] {
    const entities: Entity[] = [];
    const refDate = context?.referenceDate || this.referenceDate;
    const text = this.normalizeText(transcript);

    // Extract in order of dependency
    const dateEntity = this.extractDate(text, refDate);
    const timeEntity = this.extractTime(text, refDate);
    const priorityEntity = this.extractPriority(text, dateEntity);
    const recurrenceEntity = this.extractRecurrence(text);
    const durationEntity = this.extractDuration(text, intentType);
    const locationEntity = this.extractLocation(text);
    const attendeesEntities = this.extractAttendees(text);
    const tagEntities = this.extractTags(text, intentType);
    
    // Title extraction (must come last - removes other extracted entities)
    const titleEntity = this.extractTitle(text, intentType, {
      date: dateEntity,
      time: timeEntity,
      priority: priorityEntity,
      recurrence: recurrenceEntity,
      location: locationEntity,
      attendees: attendeesEntities,
    });

    // Add non-null entities
    if (dateEntity) entities.push(dateEntity);
    if (timeEntity) entities.push(timeEntity);
    if (priorityEntity) entities.push(priorityEntity);
    if (recurrenceEntity) entities.push(recurrenceEntity);
    if (durationEntity) entities.push(durationEntity);
    if (locationEntity) entities.push(locationEntity);
    entities.push(...attendeesEntities);
    entities.push(...tagEntities);
    if (titleEntity) entities.push(titleEntity);

    return entities;
  }

  /**
   * Normalize text: handle informal speech, typos, filler words
   */
  private normalizeText(text: string): string {
    let normalized = text.toLowerCase();
    
    // Handle informal speech patterns
    const informalReplacements: Record<string, string> = {
      'tmrw': 'tomorrow',
      'tomorow': 'tomorrow',
      'tommorow': 'tomorrow',
      'tmrow': 'tomorrow',
      'tonite': 'tonight',
      'gonna': 'going to',
      'wanna': 'want to',
      'gotta': 'got to',
      'kinda': 'kind of',
      'asap': 'as soon as possible',
      "i'll": 'i will',
      "i've": 'i have',
      "don't": 'do not',
      "can't": 'cannot',
      "won't": 'will not',
    };

    for (const [informal, formal] of Object.entries(informalReplacements)) {
      normalized = normalized.replace(new RegExp(`\\b${informal}\\b`, 'gi'), formal);
    }

    // Remove filler words
    const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'maybe'];
    for (const filler of fillerWords) {
      normalized = normalized.replace(new RegExp(`\\b${filler}\\b,?\\s*`, 'gi'), ' ');
    }

    // Clean up extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }

  /**
   * Extract date from transcript
   */
  private extractDate(text: string, refDate: Date): Entity | null {
    const lower = text.toLowerCase();

    // TODAY
    if (/\btoday\b/.test(lower) || /\bend of day\b/.test(lower)) {
      return {
        type: 'DATE',
        value: 'today',
        normalizedValue: format(refDate, 'yyyy-MM-dd'),
        confidence: 0.95,
      };
    }

    // TOMORROW
    if (/\btomorrow\b/.test(lower)) {
      const tomorrow = addDays(refDate, 1);
      return {
        type: 'DATE',
        value: 'tomorrow',
        normalizedValue: format(tomorrow, 'yyyy-MM-dd'),
        confidence: 0.95,
      };
    }

    // YESTERDAY
    if (/\byesterday\b/.test(lower)) {
      const yesterday = subDays(refDate, 1);
      return {
        type: 'DATE',
        value: 'yesterday',
        normalizedValue: format(yesterday, 'yyyy-MM-dd'),
        confidence: 0.95,
      };
    }

    // NEXT WEEK
    if (/\bnext week\b/.test(lower)) {
      const nextWeek = addWeeks(refDate, 1);
      return {
        type: 'DATE',
        value: 'next week',
        normalizedValue: format(nextWeek, 'yyyy-MM-dd'),
        confidence: 0.9,
      };
    }

    // LAST WEEK
    if (/\blast week\b/.test(lower)) {
      const lastWeek = subWeeks(refDate, 1);
      return {
        type: 'DATE',
        value: 'last week',
        normalizedValue: format(lastWeek, 'yyyy-MM-dd'),
        confidence: 0.9,
      };
    }

    // THIS WEEK
    if (/\bthis week\b/.test(lower)) {
      return {
        type: 'DATE',
        value: 'this week',
        normalizedValue: format(refDate, 'yyyy-MM-dd'),
        confidence: 0.9,
      };
    }

    // NEXT MONTH
    if (/\bnext month\b/.test(lower)) {
      const nextMonth = addMonths(refDate, 1);
      return {
        type: 'DATE',
        value: 'next month',
        normalizedValue: format(nextMonth, 'yyyy-MM-dd'),
        confidence: 0.9,
      };
    }

    // FIRST DAY OF NEXT MONTH / 1st of next month
    if (/\b(1st|first)\s+(of\s+)?next month\b/.test(lower) || /\bfirst day (of )?next month\b/.test(lower)) {
      const nextMonth = addMonths(refDate, 1);
      const firstDay = startOfMonth(nextMonth);
      return {
        type: 'DATE',
        value: '1st of next month',
        normalizedValue: format(firstDay, 'yyyy-MM-dd'),
        confidence: 0.95,
      };
    }

    // END OF Q1/Q2/Q3/Q4 with year
    const quarterMatch = lower.match(/\bend of q([1-4])\s*(\d{4})?\b/);
    if (quarterMatch) {
      const quarter = parseInt(quarterMatch[1]);
      const year = quarterMatch[2] ? parseInt(quarterMatch[2]) : refDate.getFullYear();
      const quarterEndMonth = quarter * 3; // Q1=3, Q2=6, Q3=9, Q4=12
      const endDate = endOfMonth(new Date(year, quarterEndMonth - 1, 1));
      return {
        type: 'DATE',
        value: `end of Q${quarter} ${year}`,
        normalizedValue: format(endDate, 'yyyy-MM-dd'),
        confidence: 0.9,
      };
    }

    // NEXT [DAY OF WEEK]
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const nextDayFunctions = [nextSunday, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday];
    
    for (let i = 0; i < dayNames.length; i++) {
      const dayName = dayNames[i];
      // Match "next monday", "on monday", "by monday", just "monday" at word boundary
      const dayRegex = new RegExp(`\\b(next\\s+)?${dayName}\\b`, 'i');
      if (dayRegex.test(lower)) {
        const nextDayDate = nextDayFunctions[i](refDate);
        return {
          type: 'DATE',
          value: `next ${dayName}`,
          normalizedValue: format(nextDayDate, 'yyyy-MM-dd'),
          confidence: 0.9,
        };
      }
    }

    // NEXT WEEKDAY
    if (/\bnext weekday\b/.test(lower) || /\bevery weekday\b/.test(lower)) {
      // Find next weekday (Mon-Fri)
      let nextDay = addDays(refDate, 1);
      while (getDay(nextDay) === 0 || getDay(nextDay) === 6) {
        nextDay = addDays(nextDay, 1);
      }
      return {
        type: 'DATE',
        value: 'next weekday',
        normalizedValue: format(nextDay, 'yyyy-MM-dd'),
        confidence: 0.85,
      };
    }

    // IN X DAYS
    const inDaysMatch = lower.match(/\bin\s+(\d+)\s+days?\b/);
    if (inDaysMatch) {
      const days = parseInt(inDaysMatch[1]);
      const futureDate = addDays(refDate, days);
      return {
        type: 'DATE',
        value: `in ${days} days`,
        normalizedValue: format(futureDate, 'yyyy-MM-dd'),
        confidence: 0.9,
      };
    }

    // ABSOLUTE DATES: "December 25th", "Dec 25", "12/25", "January 1 2026"
    // Month Day Year format
    const monthDayYearMatch = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})?\b/i);
    if (monthDayYearMatch) {
      const monthName = monthDayYearMatch[1];
      const day = parseInt(monthDayYearMatch[2]);
      const year = monthDayYearMatch[3] ? parseInt(monthDayYearMatch[3]) : refDate.getFullYear();
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = months.indexOf(monthName.toLowerCase());
      if (monthIndex !== -1 && day >= 1 && day <= 31) {
        const date = new Date(year, monthIndex, day);
        if (isValid(date)) {
          return {
            type: 'DATE',
            value: `${monthName} ${day}${monthDayYearMatch[3] ? ` ${year}` : ''}`,
            normalizedValue: format(date, 'yyyy-MM-dd'),
            confidence: 0.95,
          };
        }
      }
    }

    // Day Month format: "1st April", "25th December"
    const dayMonthMatch = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1]);
      const monthName = dayMonthMatch[2];
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const monthIndex = months.indexOf(monthName.toLowerCase());
      if (monthIndex !== -1 && day >= 1 && day <= 31) {
        const year = refDate.getFullYear();
        const date = new Date(year, monthIndex, day);
        // If date is in past, use next year
        if (date < refDate) {
          date.setFullYear(year + 1);
        }
        if (isValid(date)) {
          return {
            type: 'DATE',
            value: `${day} ${monthName}`,
            normalizedValue: format(date, 'yyyy-MM-dd'),
            confidence: 0.95,
          };
        }
      }
    }

    // Short month format: "Dec 25", "Jun 15"
    const shortMonthMatch = lower.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
    if (shortMonthMatch) {
      const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthIndex = shortMonths.indexOf(shortMonthMatch[1].toLowerCase());
      const day = parseInt(shortMonthMatch[2]);
      if (monthIndex !== -1 && day >= 1 && day <= 31) {
        const year = refDate.getFullYear();
        const date = new Date(year, monthIndex, day);
        if (date < refDate) {
          date.setFullYear(year + 1);
        }
        if (isValid(date)) {
          return {
            type: 'DATE',
            value: shortMonthMatch[0],
            normalizedValue: format(date, 'yyyy-MM-dd'),
            confidence: 0.9,
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract time from transcript
   */
  private extractTime(text: string, refDate: Date): Entity | null {
    const lower = text.toLowerCase();

    // IN X HOURS
    const inHoursMatch = lower.match(/\bin\s+(\d+)\s+hours?\b/);
    if (inHoursMatch) {
      const hours = parseInt(inHoursMatch[1]);
      const futureTime = addHours(refDate, hours);
      return {
        type: 'TIME',
        value: `in ${hours} hours`,
        normalizedValue: format(futureTime, 'HH:mm'),
        confidence: 0.9,
      };
    }

    // END OF DAY
    if (/\bend of day\b/.test(lower) || /\bby end of day\b/.test(lower) || /\beod\b/.test(lower)) {
      return {
        type: 'TIME',
        value: 'end of day',
        normalizedValue: '17:00',
        confidence: 0.85,
      };
    }

    // 12-hour format with am/pm: "5pm", "2:30pm", "10am", "7 pm"
    const time12Match = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (time12Match) {
      let hour = parseInt(time12Match[1]);
      const minute = time12Match[2] ? parseInt(time12Match[2]) : 0;
      const period = time12Match[3].toLowerCase();
      
      if (period === 'pm' && hour < 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;

      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      return {
        type: 'TIME',
        value: time12Match[0],
        normalizedValue: timeStr,
        confidence: 0.95,
      };
    }

    // 24-hour format: "17:00", "14:30"
    const time24Match = lower.match(/\b(\d{1,2}):(\d{2})\b/);
    if (time24Match) {
      const hour = parseInt(time24Match[1]);
      const minute = parseInt(time24Match[2]);
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return {
          type: 'TIME',
          value: time24Match[0],
          normalizedValue: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          confidence: 0.95,
        };
      }
    }

    // Natural language times
    if (/\bmorning\b/.test(lower)) {
      return { type: 'TIME', value: 'morning', normalizedValue: '09:00', confidence: 0.8 };
    }
    if (/\bafternoon\b/.test(lower)) {
      return { type: 'TIME', value: 'afternoon', normalizedValue: '14:00', confidence: 0.8 };
    }
    if (/\bevening\b/.test(lower) || /\btonight\b/.test(lower)) {
      return { type: 'TIME', value: 'evening', normalizedValue: '18:00', confidence: 0.8 };
    }
    if (/\blunch\b/.test(lower)) {
      return { type: 'TIME', value: 'lunch', normalizedValue: '12:00', confidence: 0.75 };
    }
    if (/\bdinner\b/.test(lower)) {
      return { type: 'TIME', value: 'dinner', normalizedValue: '18:00', confidence: 0.75 };
    }
    if (/\bnoon\b/.test(lower) || /\bmidday\b/.test(lower)) {
      return { type: 'TIME', value: 'noon', normalizedValue: '12:00', confidence: 0.85 };
    }
    if (/\bmidnight\b/.test(lower)) {
      return { type: 'TIME', value: 'midnight', normalizedValue: '00:00', confidence: 0.85 };
    }

    return null;
  }

  /**
   * Extract priority from transcript
   */
  private extractPriority(text: string, dateEntity: Entity | null): Entity | null {
    const lower = text.toLowerCase();

    // Explicit priorities
    if (/\bur gent\b|\basap\b|\bright away\b|\bimmediately\b|\bcritical\b/.test(lower)) {
      return { type: 'PRIORITY', value: 'urgent', normalizedValue: 'URGENT', confidence: 0.95 };
    }
    if (/\bhigh priority\b|\bimportant\b|\bhigh\b/.test(lower)) {
      return { type: 'PRIORITY', value: 'high', normalizedValue: 'HIGH', confidence: 0.9 };
    }
    if (/\blow priority\b|\bsomeday\b|\bwhenever\b|\blow\b/.test(lower)) {
      return { type: 'PRIORITY', value: 'low', normalizedValue: 'LOW', confidence: 0.85 };
    }

    // Infer priority from date context
    if (dateEntity) {
      const dateVal = dateEntity.value?.toLowerCase() || '';
      if (dateVal === 'today' || /urgent/.test(lower)) {
        return { type: 'PRIORITY', value: 'inferred', normalizedValue: 'MEDIUM', confidence: 0.6 };
      }
    }

    return null;
  }

  /**
   * Extract recurrence patterns
   */
  private extractRecurrence(text: string): Entity | null {
    const lower = text.toLowerCase();

    // Every day / daily
    if (/\bevery\s*(single\s+)?day\b/.test(lower) || /\bdaily\b/.test(lower)) {
      return {
        type: 'RECURRENCE',
        value: 'every day',
        normalizedValue: 'FREQ=DAILY',
        confidence: 0.95,
      };
    }

    // Every weekday (Mon-Fri)
    if (/\bevery weekday\b/.test(lower) || /\bweekdays\b/.test(lower)) {
      return {
        type: 'RECURRENCE',
        value: 'every weekday',
        normalizedValue: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        confidence: 0.95,
      };
    }

    // Every [day(s)] - e.g., "every Monday", "every Monday and Wednesday"
    const daysMap: Record<string, string> = {
      'monday': 'MO', 'mon': 'MO',
      'tuesday': 'TU', 'tue': 'TU',
      'wednesday': 'WE', 'wed': 'WE',
      'thursday': 'TH', 'thu': 'TH',
      'friday': 'FR', 'fri': 'FR',
      'saturday': 'SA', 'sat': 'SA',
      'sunday': 'SU', 'sun': 'SU',
    };

    const everyDaysMatch = lower.match(/\bevery\s+((?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+and\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*)\b/i);
    if (everyDaysMatch) {
      const daysStr = everyDaysMatch[1];
      const daysList = daysStr.split(/\s+and\s+/).map(d => d.trim().toLowerCase());
      const rruleDays = daysList.map(d => daysMap[d]).filter(Boolean).join(',');
      if (rruleDays) {
        return {
          type: 'RECURRENCE',
          value: `every ${daysStr}`,
          normalizedValue: `FREQ=WEEKLY;BYDAY=${rruleDays}`,
          confidence: 0.95,
        };
      }
    }

    // Every week / weekly
    if (/\bevery week\b/.test(lower) || /\bweekly\b/.test(lower)) {
      return {
        type: 'RECURRENCE',
        value: 'every week',
        normalizedValue: 'FREQ=WEEKLY',
        confidence: 0.9,
      };
    }

    // Every X weeks
    const everyXWeeksMatch = lower.match(/\bevery\s+(\d+)\s+weeks?\b/);
    if (everyXWeeksMatch) {
      const interval = parseInt(everyXWeeksMatch[1]);
      return {
        type: 'RECURRENCE',
        value: `every ${interval} weeks`,
        normalizedValue: `FREQ=WEEKLY;INTERVAL=${interval}`,
        confidence: 0.9,
      };
    }

    // Every month / monthly
    if (/\bevery month\b/.test(lower) || /\bmonthly\b/.test(lower)) {
      return {
        type: 'RECURRENCE',
        value: 'every month',
        normalizedValue: 'FREQ=MONTHLY',
        confidence: 0.9,
      };
    }

    // Every night / nightly
    if (/\bevery night\b/.test(lower) || /\bnightly\b/.test(lower)) {
      return {
        type: 'RECURRENCE',
        value: 'every night',
        normalizedValue: 'FREQ=DAILY',
        confidence: 0.9,
      };
    }

    // Recurring / repeat
    if (/\brecurring\b/.test(lower) || /\brepeat\b/.test(lower)) {
      return {
        type: 'RECURRENCE',
        value: 'recurring',
        normalizedValue: 'FREQ=WEEKLY',
        confidence: 0.7,
      };
    }

    return null;
  }

  /**
   * Extract duration
   */
  private extractDuration(text: string, intentType?: IntentType): Entity | null {
    const lower = text.toLowerCase();

    // Explicit duration: "for 30 minutes", "for 2 hours"
    const minutesMatch = lower.match(/\bfor\s+(\d+)\s+minutes?\b/);
    if (minutesMatch) {
      return {
        type: 'DURATION' as EntityType,
        value: `${minutesMatch[1]} minutes`,
        normalizedValue: parseInt(minutesMatch[1]),
        confidence: 0.95,
      };
    }

    const hoursMatch = lower.match(/\bfor\s+(\d+)\s+hours?\b/);
    if (hoursMatch) {
      return {
        type: 'DURATION' as EntityType,
        value: `${hoursMatch[1]} hours`,
        normalizedValue: parseInt(hoursMatch[1]) * 60,
        confidence: 0.95,
      };
    }

    // Default duration for meetings/events
    if (intentType === 'CREATE_EVENT') {
      if (/\bmeeting\b/.test(lower) || /\bstandup\b/.test(lower)) {
        return {
          type: 'DURATION' as EntityType,
          value: 'default meeting',
          normalizedValue: 30,
          confidence: 0.6,
        };
      }
      if (/\bdinner\b/.test(lower) || /\blunch\b/.test(lower)) {
        return {
          type: 'DURATION' as EntityType,
          value: 'default meal',
          normalizedValue: 60,
          confidence: 0.6,
        };
      }
    }

    return null;
  }

  /**
   * Extract location
   */
  private extractLocation(text: string): Entity | null {
    const lower = text.toLowerCase();

    // "at [location]" pattern - but not "at [time]"
    const atMatch = text.match(/\bat\s+([A-Z][a-zA-Z\s]+(?:restaurant|office|cafe|coffee|gym|park|library|hospital|clinic|school|university|college|store|mall|hotel|airport|station))/i);
    if (atMatch) {
      return {
        type: 'LOCATION' as EntityType,
        value: atMatch[1].trim(),
        normalizedValue: atMatch[1].trim(),
        confidence: 0.9,
      };
    }

    // Generic "at [place]" with capital letter
    const genericAtMatch = text.match(/\bat\s+([A-Z][a-zA-Z\s']+?)(?:\s+(?:on|at|for|with|tomorrow|today|next|every|$))/i);
    if (genericAtMatch && !/\d/.test(genericAtMatch[1])) {
      const location = genericAtMatch[1].trim();
      // Exclude time-related words
      if (!['morning', 'afternoon', 'evening', 'night', 'noon'].includes(location.toLowerCase())) {
        return {
          type: 'LOCATION' as EntityType,
          value: location,
          normalizedValue: location,
          confidence: 0.75,
        };
      }
    }

    return null;
  }

  /**
   * Extract attendees
   */
  private extractAttendees(text: string): Entity[] {
    const entities: Entity[] = [];

    // "with [names]" pattern
    const withMatch = text.match(/\bwith\s+((?:[A-Z][a-z]+(?:\s*,\s*|\s+and\s+)?)+)/);
    if (withMatch) {
      const namesStr = withMatch[1];
      const names = namesStr.split(/\s*,\s*|\s+and\s+/).map(n => n.trim()).filter(n => n && /^[A-Z]/.test(n));
      if (names.length > 0) {
        entities.push({
          type: 'PERSON' as EntityType,
          value: names.join(', '),
          normalizedValue: names,
          confidence: 0.9,
        });
      }
    }

    // "attendees [names]" pattern
    const attendeesMatch = text.match(/\battendees?\s+((?:[A-Z][a-z]+(?:\s*,\s*|\s+and\s+)?)+)/);
    if (attendeesMatch) {
      const namesStr = attendeesMatch[1];
      const names = namesStr.split(/\s*,\s*|\s+and\s+/).map(n => n.trim()).filter(n => n && /^[A-Z]/.test(n));
      if (names.length > 0) {
        entities.push({
          type: 'PERSON' as EntityType,
          value: names.join(', '),
          normalizedValue: names,
          confidence: 0.9,
        });
      }
    }

    return entities;
  }

  /**
   * Extract tags based on context
   */
  private extractTags(text: string, intentType?: IntentType): Entity[] {
    const entities: Entity[] = [];
    const lower = text.toLowerCase();
    const tags: string[] = [];

    // Explicit hashtags
    const hashtagMatches = text.matchAll(/#(\w+)/g);
    for (const match of hashtagMatches) {
      tags.push(match[1].toLowerCase());
    }

    // Context-based tag inference
    const tagKeywords: Record<string, string[]> = {
      'work': ['meeting', 'report', 'project', 'client', 'office', 'presentation', 'deadline', 'standup', 'team'],
      'personal': ['family', 'mom', 'dad', 'friend', 'birthday', 'anniversary', 'personal'],
      'health': ['doctor', 'dentist', 'medical', 'gym', 'workout', 'exercise', 'health', 'appointment'],
      'shopping': ['groceries', 'grocery', 'shopping', 'buy', 'store', 'mall', 'list'],
      'finance': ['pay', 'rent', 'bill', 'bills', 'bank', 'money', 'budget'],
      'fitness': ['exercise', 'workout', 'gym', 'run', 'running', 'jump', 'fitness'],
      'study': ['homework', 'study', 'exam', 'school', 'class', 'learn'],
      'social': ['dinner', 'lunch', 'party', 'meet', 'friends'],
      'travel': ['flight', 'hotel', 'trip', 'travel', 'vacation', 'airport', 'packing'],
      'celebration': ['birthday', 'party', 'anniversary', 'celebrate', 'new year'],
    };

    for (const [tag, keywords] of Object.entries(tagKeywords)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword) && !tags.includes(tag)) {
          tags.push(tag);
          break;
        }
      }
    }

    // Create entities for each tag
    for (const tag of tags) {
      entities.push({
        type: 'TAG',
        value: tag,
        normalizedValue: tag,
        confidence: tag.startsWith('#') ? 0.95 : 0.7,
      });
    }

    return entities;
  }

  /**
   * Extract title - the main content after removing other entities
   */
  private extractTitle(
    text: string,
    intentType?: IntentType,
    extractedEntities?: {
      date?: Entity | null;
      time?: Entity | null;
      priority?: Entity | null;
      recurrence?: Entity | null;
      location?: Entity | null;
      attendees?: Entity[];
    }
  ): Entity | null {
    let title = text;

    // Remove trigger phrases
    const triggerPhrases = [
      'create a new task to', 'create a task to', 'create task to', 'add task to',
      'create a new event', 'create event', 'schedule', 'book',
      'remind me to', 'remind me', 'add a new', 'add new', 'add a',
      'create a new', 'create new', 'create a', 'create',
      'write a new journal entry', 'write journal entry', 'journal entry',
      'add a new routine', 'add routine', 'create routine',
      'add a new milestone', 'add milestone', 'create milestone',
      'add to shopping list', 'add to list', 'add to grocery list',
      'add item', 'add items', 'add',
      'note to self',
      'to-do list entry to', 'to do list entry to',
      'um,', 'um ', 'can you', 'please', 'i need to', 'i want to', 'i gotta',
    ];

    for (const phrase of triggerPhrases) {
      const regex = new RegExp(`^\\s*${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'gi');
      title = title.replace(regex, '');
    }

    // Remove extracted date phrases
    if (extractedEntities?.date?.value) {
      const datePatterns = [
        extractedEntities.date.value,
        'today', 'tomorrow', 'yesterday',
        'next week', 'next month', 'this week', 'last week',
        'next monday', 'next tuesday', 'next wednesday', 'next thursday', 'next friday', 'next saturday', 'next sunday',
        'on monday', 'on tuesday', 'on wednesday', 'on thursday', 'on friday', 'on saturday', 'on sunday',
        'by monday', 'by tuesday', 'by wednesday', 'by thursday', 'by friday', 'by saturday', 'by sunday',
        /\bjanuary\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bfebruary\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bmarch\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bapril\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bmay\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bjune\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bjuly\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\baugust\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bseptember\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\boctober\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bnovember\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\bdecember\s+\d{1,2}(?:st|nd|rd|th)?\s*,?\s*\d{0,4}\b/gi,
        /\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)/gi,
      ];

      for (const pattern of datePatterns) {
        if (typeof pattern === 'string') {
          title = title.replace(new RegExp(`\\b${pattern}\\b`, 'gi'), '');
        } else {
          title = title.replace(pattern, '');
        }
      }
    }

    // Remove time phrases
    if (extractedEntities?.time?.value) {
      title = title.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '');
      title = title.replace(/\bby end of day\b/gi, '');
      title = title.replace(/\bend of day\b/gi, '');
      title = title.replace(/\bin\s+\d+\s+hours?\b/gi, '');
    }

    // Remove recurrence phrases
    if (extractedEntities?.recurrence?.value) {
      title = title.replace(/\bevery\s+(?:single\s+)?(?:day|week|month|night|weekday)\b/gi, '');
      title = title.replace(/\bevery\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+and\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))*/gi, '');
      title = title.replace(/\bdaily\b|\bweekly\b|\bmonthly\b|\brecurring\b/gi, '');
    }

    // Remove priority phrases
    title = title.replace(/\burgent\b|\basap\b|\bhigh priority\b|\blow priority\b|\bimportant\b/gi, '');

    // Remove location phrases
    if (extractedEntities?.location?.value) {
      title = title.replace(new RegExp(`\\bat\\s+${extractedEntities.location.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '');
    }

    // Remove attendee phrases
    title = title.replace(/\bwith\s+(?:[A-Z][a-z]+(?:\s*,\s*|\s+and\s+)?)+/g, '');
    title = title.replace(/\battendees?\s+(?:[A-Z][a-z]+(?:\s*,\s*|\s+and\s+)?)+/g, '');

    // Remove duration phrases
    title = title.replace(/\bfor\s+\d+\s+(?:minutes?|hours?)\b/gi, '');
    title = title.replace(/\bfor the next\s+\d+\s+months?\b/gi, '');
    title = title.replace(/\bstarting\s+next\s+week\b/gi, '');

    // Remove hashtags
    title = title.replace(/#\w+/g, '');

    // Remove common connecting words at edges
    title = title.replace(/^(?:to|for|on|at|by|the|a|an|and|or|that|thing)\s+/gi, '');
    title = title.replace(/\s+(?:to|for|on|at|by|the|and|or)$/gi, '');

    // Clean up
    title = title.replace(/\s+/g, ' ').trim();
    title = title.replace(/^[:;,.\-]+|[:;,.\-]+$/g, '').trim();

    // Capitalize first letter
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    if (title.length > 0) {
      return {
        type: 'TITLE',
        value: title,
        normalizedValue: title,
        confidence: title.length > 3 ? 0.9 : 0.6,
      };
    }

    return null;
  }
}

export default EntityExtractor;
