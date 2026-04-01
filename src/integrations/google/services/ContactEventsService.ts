/**
 * Contact Events Service
 *
 * Auto-creates birthday and anniversary events in the Leo Calendar
 * from synced Google Contacts. Skips duplicates by checking existing
 * events by name + date pattern.
 */

import { getSupabaseClient } from '../../../lib/supabase';
import { getEvents, addEvent } from '../../../storage/events';
import { getContactsWithBirthdays, getContactsWithAnniversaries } from './ContactsService';
import type { GoogleContact } from '../types/contacts.types';
import type { Event } from '../../../types';

export interface ContactEventsResult {
  birthdaysCreated: number;
  anniversariesCreated: number;
  skipped: number;
}

/**
 * Scan synced contacts for birthdays/anniversaries and create
 * yearly recurring events in Leo Calendar. Skips if an event
 * with the same name + date already exists.
 */
export async function createContactEvents(userId: string): Promise<ContactEventsResult> {
  const existingEvents = await getEvents();
  const existingSet = new Set(
    existingEvents.map(e => `${e.name.toLowerCase()}|${e.date}`),
  );

  let birthdaysCreated = 0;
  let anniversariesCreated = 0;
  let skipped = 0;

  const bdContacts = await getContactsWithBirthdays(userId);
  for (const c of bdContacts) {
    if (!c.birthday || !c.name) { skipped++; continue; }
    const dateMMDD = toMMDD(c.birthday);
    if (!dateMMDD) { skipped++; continue; }

    const eventName = `🎂 ${c.name}'s Birthday`;
    if (existingSet.has(`${eventName.toLowerCase()}|${dateMMDD}`)) {
      skipped++;
      continue;
    }

    const yearFromBD = extractYear(c.birthday);

    const event: Event = {
      id: '',
      name: eventName,
      description: `Auto-created from Google Contacts`,
      category: 'Birthday',
      date: dateMMDD,
      frequency: 'yearly',
      year: yearFromBD ?? undefined,
      notifyDaysBefore: 1,
      priority: 7,
      color: '#F472B6',
      createdAt: new Date().toISOString(),
    };

    try {
      await addEvent(event);
      birthdaysCreated++;
      existingSet.add(`${eventName.toLowerCase()}|${dateMMDD}`);
    } catch (err: any) {
      console.warn(`[ContactEvents] Failed to create birthday for ${c.name}:`, err.message);
    }
  }

  const annContacts = await getContactsWithAnniversaries(userId);
  for (const c of annContacts) {
    if (!c.anniversary || !c.name) { skipped++; continue; }
    const dateMMDD = toMMDD(c.anniversary);
    if (!dateMMDD) { skipped++; continue; }

    const eventName = `💍 ${c.name}'s Anniversary`;
    if (existingSet.has(`${eventName.toLowerCase()}|${dateMMDD}`)) {
      skipped++;
      continue;
    }

    const yearFromAnn = extractYear(c.anniversary);

    const event: Event = {
      id: '',
      name: eventName,
      description: `Auto-created from Google Contacts`,
      category: 'Anniversary',
      date: dateMMDD,
      frequency: 'yearly',
      year: yearFromAnn ?? undefined,
      notifyDaysBefore: 1,
      priority: 8,
      color: '#A78BFA',
      createdAt: new Date().toISOString(),
    };

    try {
      await addEvent(event);
      anniversariesCreated++;
      existingSet.add(`${eventName.toLowerCase()}|${dateMMDD}`);
    } catch (err: any) {
      console.warn(`[ContactEvents] Failed to create anniversary for ${c.name}:`, err.message);
    }
  }

  console.info(
    `[ContactEvents] Created ${birthdaysCreated} birthday + ${anniversariesCreated} anniversary events, skipped ${skipped}`,
  );

  return { birthdaysCreated, anniversariesCreated, skipped };
}

/**
 * Convert a date string (YYYY-MM-DD or MM-DD) to MM-DD format for yearly events.
 */
function toMMDD(dateStr: string): string | null {
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
  if (parts.length === 2) return dateStr;
  return null;
}

function extractYear(dateStr: string): number | null {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0]);
    return isNaN(y) ? null : y;
  }
  return null;
}
