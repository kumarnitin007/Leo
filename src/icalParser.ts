/**
 * iCalendar Parser Utility
 * 
 * Parses iCalendar (.ics) files from Google Calendar and other sources
 * Extracts events and converts them to our Event format
 */

import { Event, EventFrequencyType } from './types';

interface ICalEvent {
  summary: string;
  description?: string;
  dtstart: string;
  dtend?: string;
  rrule?: string;
  uid: string;
}

/**
 * Parse iCalendar content and extract events
 */
export const parseICalendar = (icalContent: string): ICalEvent[] => {
  const events: ICalEvent[] = [];
  const lines = icalContent.split(/\r?\n/);
  
  let inEvent = false;
  let currentEvent: Partial<ICalEvent> = {};
  let lastProperty = '';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line continuation (lines starting with space)
    if (line.startsWith(' ') && lastProperty) {
      line = line.substring(1);
      // Append to previous property
      if (lastProperty === 'SUMMARY' && currentEvent.summary) {
        currentEvent.summary += line;
      } else if (lastProperty === 'DESCRIPTION' && currentEvent.description) {
        currentEvent.description += line;
      }
      continue;
    }
    
    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
    } else if (line === 'END:VEVENT' && inEvent) {
      if (currentEvent.summary && currentEvent.dtstart && currentEvent.uid) {
        events.push(currentEvent as ICalEvent);
      }
      inEvent = false;
      currentEvent = {};
    } else if (inEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8);
        lastProperty = 'SUMMARY';
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12);
        lastProperty = 'DESCRIPTION';
      } else if (line.startsWith('DTSTART')) {
        const match = line.match(/DTSTART[^:]*:(.*)/);
        if (match) {
          currentEvent.dtstart = match[1];
        }
        lastProperty = 'DTSTART';
      } else if (line.startsWith('DTEND')) {
        const match = line.match(/DTEND[^:]*:(.*)/);
        if (match) {
          currentEvent.dtend = match[1];
        }
        lastProperty = 'DTEND';
      } else if (line.startsWith('RRULE:')) {
        currentEvent.rrule = line.substring(6);
        lastProperty = 'RRULE';
      } else if (line.startsWith('UID:')) {
        currentEvent.uid = line.substring(4);
        lastProperty = 'UID';
      } else {
        lastProperty = '';
      }
    }
  }
  
  return events;
};

/**
 * Parse iCalendar date string to Date object
 */
const parseICalDate = (dateStr: string): Date => {
  // Handle formats: 20210716, 20210716T093500, 20210716T093500Z
  const cleanStr = dateStr.replace(/[-:]/g, '');
  
  if (cleanStr.length >= 8) {
    const year = parseInt(cleanStr.substring(0, 4));
    const month = parseInt(cleanStr.substring(4, 6)) - 1;
    const day = parseInt(cleanStr.substring(6, 8));
    
    if (cleanStr.length > 8 && cleanStr.includes('T')) {
      const hour = parseInt(cleanStr.substring(9, 11)) || 0;
      const minute = parseInt(cleanStr.substring(11, 13)) || 0;
      return new Date(year, month, day, hour, minute);
    }
    
    return new Date(year, month, day);
  }
  
  return new Date();
};

/**
 * Detect category from event summary
 */
const detectCategory = (summary: string): string => {
  const lowerSummary = summary.toLowerCase();
  
  // Check for keywords
  if (lowerSummary.includes('birthday') || lowerSummary.includes('bday')) {
    return 'Birthday';
  }
  if (lowerSummary.includes('anniversary') || lowerSummary.includes('anni')) {
    return 'Anniversary';
  }
  if (lowerSummary.includes('memorial') || lowerSummary.includes('memory')) {
    return 'Memorial';
  }
  if (lowerSummary.includes('death') || lowerSummary.includes('passing')) {
    return 'Death Anniversary';
  }
  if (lowerSummary.includes('remembrance') || lowerSummary.includes('tribute')) {
    return 'Remembrance';
  }
  if (lowerSummary.includes('holiday') || lowerSummary.includes('christmas') || 
      lowerSummary.includes('thanksgiving') || lowerSummary.includes('new year')) {
    return 'Holiday';
  }
  
  return 'Special Event';
};

/**
 * Get color based on category
 */
const getColorForCategory = (category: string): string => {
  const colors: { [key: string]: string } = {
    'Birthday': '#EC4899',
    'Anniversary': '#EF4444',
    'Holiday': '#8B5CF6',
    'Special Event': '#3B82F6',
    'Death Anniversary': '#6b7280',
    'Memorial': '#4b5563',
    'Remembrance': '#6b7280',
  };
  return colors[category] || '#667eea';
};

/**
 * Convert iCal events to our Event format
 */
export const convertICalEventsToEvents = (icalEvents: ICalEvent[]): Omit<Event, 'id' | 'createdAt'>[] => {
  const events: Omit<Event, 'id' | 'createdAt'>[] = [];
  
  icalEvents.forEach(icalEvent => {
    try {
      const startDate = parseICalDate(icalEvent.dtstart);
      const category = detectCategory(icalEvent.summary);
      const color = getColorForCategory(category);
      
      // Check if it's a recurring event
      const isYearly = icalEvent.rrule && icalEvent.rrule.includes('FREQ=YEARLY');
      
      let dateStr: string;
      let frequency: EventFrequencyType;
      let year: number | undefined;
      
      if (isYearly) {
        // For yearly events, use MM-DD format
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        dateStr = `${month}-${day}`;
        frequency = 'yearly';
        year = startDate.getFullYear();
      } else {
        // For one-time events, use YYYY-MM-DD format
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        frequency = 'one-time';
      }
      
      // Extract notification days from TRIGGER in VALARM (if exists)
      let notifyDaysBefore = 0;
      if (icalEvent.rrule && icalEvent.rrule.includes('TRIGGER:-P')) {
        const match = icalEvent.rrule.match(/TRIGGER:-P(\d+)D/);
        if (match) {
          notifyDaysBefore = parseInt(match[1]);
        }
      }
      
      // Set default notification days to 3 for all categories (bulk upload default)
      if (notifyDaysBefore === 0) {
        notifyDaysBefore = 3;
      }
      
      events.push({
        name: icalEvent.summary,
        description: icalEvent.description,
        category,
        date: dateStr,
        frequency,
        year,
        notifyDaysBefore,
        color
      });
    } catch (error) {
      console.error('Error converting event:', icalEvent.summary, error);
    }
  });
  
  return events;
};

/**
 * Main function to import events from iCalendar file
 */
export const importFromICalendar = async (fileContent: string): Promise<Omit<Event, 'id' | 'createdAt'>[]> => {
  const icalEvents = parseICalendar(fileContent);
  const events = convertICalEventsToEvents(icalEvents);
  return events;
};

/**
 * Filter events to only include birthdays, anniversaries, and memorials
 */
export const filterPersonalEvents = (events: Omit<Event, 'id' | 'createdAt'>[]): Omit<Event, 'id' | 'createdAt'>[] => {
  const personalCategories = [
    'Birthday',
    'Anniversary', 
    'Death Anniversary',
    'Memorial',
    'Remembrance',
    'Holiday'
  ];
  
  return events.filter(event => personalCategories.includes(event.category || ''));
};

