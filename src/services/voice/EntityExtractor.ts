import { Entity, EntityType } from './types';

/**
 * Minimal entity extractor: title, simple date keywords, time, priority, tags (#tag)
 */
export class EntityExtractor {
  extract(transcript: string): Entity[] {
    const entities: Entity[] = [];
    const text = transcript;

    // Title: naive - remove common trigger phrases
    let title = text.replace(/remind me to|remind me|add task|create task|schedule|add to list|add item|journal|note to self/gi, '');
    title = title.replace(/\b(at|on|in|tomorrow|today|next)\b/gi, '');
    title = title.replace(/\s+/g, ' ').trim();
    if (title) {
      entities.push({ type: 'TITLE', value: title, normalizedValue: title, confidence: 0.9 });
    }

    // Dates: today / tomorrow / next week / Monday
    const lower = text.toLowerCase();
    if (lower.includes('today')) {
      entities.push({ type: 'DATE', value: 'today', normalizedValue: new Date().toISOString().split('T')[0], confidence: 0.9 });
    } else if (lower.includes('tomorrow')) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      entities.push({ type: 'DATE', value: 'tomorrow', normalizedValue: d.toISOString().split('T')[0], confidence: 0.9 });
    } else {
      // day names
      const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      for (const d of days) {
        if (lower.includes(d)) {
          entities.push({ type: 'DATE', value: d, normalizedValue: d, confidence: 0.8 });
          break;
        }
      }
    }

    // Time HH:MM am/pm
    const timeMatch = text.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3];
      if (ampm) {
        if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
        if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
      }
      const normalized = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
      entities.push({ type: 'TIME', value: timeMatch[0], normalizedValue: normalized, confidence: 0.9 });
    }

    // Priority keywords
    if (/urgent|asap|right away/.test(lower)) {
      entities.push({ type: 'PRIORITY', value: 'HIGH', normalizedValue: 'HIGH', confidence: 0.9 });
    } else if (/tomorrow|soon/.test(lower)) {
      entities.push({ type: 'PRIORITY', value: 'MEDIUM', normalizedValue: 'MEDIUM', confidence: 0.6 });
    }

    // Tags: #shopping or shopping keywords
    const tagMatches = Array.from(text.matchAll(/#(\w+)/g));
    for (const m of tagMatches) {
      entities.push({ type: 'TAG', value: m[1], normalizedValue: m[1], confidence: 0.95 });
    }

    return entities;
  }
}

export default EntityExtractor;
