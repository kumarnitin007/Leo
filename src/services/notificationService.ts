/**
 * Notification Service
 * 
 * Handles web push notifications for:
 * - Daily morning reminders
 * - Event reminders (1 hour before)
 * - Streak milestones
 * - Resolution progress alerts
 */

import { getSupabaseClient } from '../lib/supabase';

export interface NotificationSettings {
  enabled: boolean;
  dailyReminderEnabled: boolean;
  dailyReminderTime: string; // HH:mm format (e.g., "08:00")
  eventRemindersEnabled: boolean;
  eventReminderMinutes: number; // Minutes before event (default 60)
  streakMilestonesEnabled: boolean;
  resolutionAlertsEnabled: boolean;
  resolutionAlertFrequency: 'daily' | 'weekly' | 'monthly';
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  dailyReminderEnabled: true,
  dailyReminderTime: '08:00',
  eventRemindersEnabled: true,
  eventReminderMinutes: 60,
  streakMilestonesEnabled: true,
  resolutionAlertsEnabled: true,
  resolutionAlertFrequency: 'weekly',
};

/* ── Option expiry reminders (Trades) ──────────────────────────
 * Trades data is encrypted, so the dashboard writes a small NON-sensitive
 * snapshot of open option legs to localStorage (same pattern as the financial
 * alerts cache). The reminder check reads that snapshot — it never touches the
 * Safe. The on/off + lead-time preference is client-only (localStorage) so it
 * doesn't depend on the notification-settings table schema.
 */
const OPEN_OPTIONS_CACHE_KEY = 'leo_open_options_cache';
const OPTION_EXPIRY_PREF_KEY = 'leo_option_expiry_pref';

export interface CachedOpenOption {
  ticker: string;
  optionType: 'CALL' | 'PUT';
  strike?: number;
  expiration?: string;      // YYYY-MM-DD
  side: 'long' | 'short';
  contracts: number;
  itm?: boolean;            // in-the-money (assignment risk) if the stock price is known
}

export interface OptionExpiryPref {
  enabled: boolean;
  days: number;             // notify when an open leg is within this many days of expiry
}

export const DEFAULT_OPTION_EXPIRY_PREF: OptionExpiryPref = { enabled: true, days: 3 };

/** Called by TradesDashboard whenever open options/prices change. */
export function updateOpenOptionsCache(legs: CachedOpenOption[]): void {
  try {
    localStorage.setItem(OPEN_OPTIONS_CACHE_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), legs }));
  } catch { /* ignore quota */ }
}

export function clearOpenOptionsCache(): void {
  try { localStorage.removeItem(OPEN_OPTIONS_CACHE_KEY); } catch { /* ignore */ }
}

export function getOptionExpiryPref(): OptionExpiryPref {
  try {
    const raw = localStorage.getItem(OPTION_EXPIRY_PREF_KEY);
    if (!raw) return DEFAULT_OPTION_EXPIRY_PREF;
    const p = JSON.parse(raw) as Partial<OptionExpiryPref>;
    return {
      enabled: p.enabled ?? DEFAULT_OPTION_EXPIRY_PREF.enabled,
      days: p.days ?? DEFAULT_OPTION_EXPIRY_PREF.days,
    };
  } catch {
    return DEFAULT_OPTION_EXPIRY_PREF;
  }
}

export function setOptionExpiryPref(pref: OptionExpiryPref): void {
  try { localStorage.setItem(OPTION_EXPIRY_PREF_KEY, JSON.stringify(pref)); } catch { /* ignore */ }
}

/**
 * Check if browser supports notifications
 */
export const isNotificationSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) {
    throw new Error('Notifications are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

/**
 * Show a local notification (doesn't require server)
 */
export const showLocalNotification = async (
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    actions?: Array<{ action: string; title: string }>;
  }
): Promise<void> => {
  if (getNotificationPermission() !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    icon: options?.icon || '/leo-icon.svg',
    badge: options?.badge || '/leo-icon.svg',
    tag: options?.tag,
    data: options?.data,
    vibrate: [200, 100, 200],
    requireInteraction: false,
  } as NotificationOptions);
};

/**
 * Get notification settings from database
 */
export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  try {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return DEFAULT_NOTIFICATION_SETTINGS;

    const { data, error } = await client
      .from('myday_notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching notification settings:', error);
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    if (!data) return DEFAULT_NOTIFICATION_SETTINGS;

    return {
      enabled: data.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
      dailyReminderEnabled: data.daily_reminder_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.dailyReminderEnabled,
      dailyReminderTime: data.daily_reminder_time ?? DEFAULT_NOTIFICATION_SETTINGS.dailyReminderTime,
      eventRemindersEnabled: data.event_reminders_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.eventRemindersEnabled,
      eventReminderMinutes: data.event_reminder_minutes ?? DEFAULT_NOTIFICATION_SETTINGS.eventReminderMinutes,
      streakMilestonesEnabled: data.streak_milestones_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.streakMilestonesEnabled,
      resolutionAlertsEnabled: data.resolution_alerts_enabled ?? DEFAULT_NOTIFICATION_SETTINGS.resolutionAlertsEnabled,
      resolutionAlertFrequency: data.resolution_alert_frequency ?? DEFAULT_NOTIFICATION_SETTINGS.resolutionAlertFrequency,
    };
  } catch (err) {
    console.error('Error loading notification settings:', err);
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
};

/**
 * Save notification settings to database
 */
export const saveNotificationSettings = async (settings: NotificationSettings): Promise<void> => {
  const client = getSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const now = new Date().toISOString();

  const { error } = await client
    .from('myday_notification_settings')
    .upsert({
      user_id: user.id,
      enabled: settings.enabled,
      daily_reminder_enabled: settings.dailyReminderEnabled,
      daily_reminder_time: settings.dailyReminderTime,
      event_reminders_enabled: settings.eventRemindersEnabled,
      event_reminder_minutes: settings.eventReminderMinutes,
      streak_milestones_enabled: settings.streakMilestonesEnabled,
      resolution_alerts_enabled: settings.resolutionAlertsEnabled,
      resolution_alert_frequency: settings.resolutionAlertFrequency,
      updated_at: now,
    }, {
      onConflict: 'user_id'
    });

  if (error) throw error;
};

/**
 * Schedule daily reminder notification
 * Called when user opens app - checks if reminder should fire
 */
export const checkAndShowDailyReminder = async (): Promise<void> => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.dailyReminderEnabled) return;
  if (getNotificationPermission() !== 'granted') return;

  // Check if we already showed today's reminder
  const lastShown = localStorage.getItem('last-daily-reminder');
  const today = new Date().toISOString().split('T')[0];
  
  if (lastShown === today) return; // Already shown today

  // Check if it's time to show (within 1 hour of preferred time)
  const now = new Date();
  const [hours, minutes] = settings.dailyReminderTime.split(':').map(Number);
  const preferredTime = new Date();
  preferredTime.setHours(hours, minutes, 0, 0);
  
  const diffMinutes = Math.abs(now.getTime() - preferredTime.getTime()) / (1000 * 60);
  
  if (diffMinutes <= 60) {
    // Show reminder
    await showLocalNotification(
      '🎯 Good Morning!',
      'Ready to tackle your day? Check your tasks and events.',
      {
        tag: 'daily-reminder',
        data: { type: 'daily-reminder', date: today }
      }
    );
    
    localStorage.setItem('last-daily-reminder', today);
  }
};

/**
 * Check for upcoming events and show reminders
 */
export const checkEventReminders = async (): Promise<void> => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.eventRemindersEnabled) return;
  if (getNotificationPermission() !== 'granted') return;

  try {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;

    // Get events for today
    const today = new Date().toISOString().split('T')[0];
    const { data: events } = await client
      .from('myday_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today);

    if (!events || events.length === 0) return;

    const now = new Date();
    const reminderWindow = settings.eventReminderMinutes * 60 * 1000; // Convert to ms

    for (const event of events) {
      // Skip if already notified
      const notifiedKey = `event-notified-${event.id}-${today}`;
      if (localStorage.getItem(notifiedKey)) continue;

      // Check if event has a time and is within reminder window
      if (event.time) {
        const [hours, minutes] = event.time.split(':').map(Number);
        const eventTime = new Date();
        eventTime.setHours(hours, minutes, 0, 0);
        
        const timeUntilEvent = eventTime.getTime() - now.getTime();
        
        // Show notification if within reminder window (e.g., 60 minutes before)
        if (timeUntilEvent > 0 && timeUntilEvent <= reminderWindow) {
          const minutesUntil = Math.round(timeUntilEvent / (1000 * 60));
          
          await showLocalNotification(
            `📅 ${event.name}`,
            `Starting in ${minutesUntil} minute${minutesUntil !== 1 ? 's' : ''}`,
            {
              tag: `event-${event.id}`,
              data: { type: 'event-reminder', eventId: event.id }
            }
          );
          
          localStorage.setItem(notifiedKey, 'true');
        }
      }
    }
  } catch (err) {
    console.error('Error checking event reminders:', err);
  }
};

/**
 * Check open option legs (from the non-sensitive cache) and remind about any
 * expiring within the configured lead time, flagging in-the-money legs as
 * assignment risk. Deduped per day + set signature so it fires at most once a
 * day and again only if the set of expiring legs changes.
 */
export const checkOptionExpiryReminders = async (): Promise<void> => {
  if (getNotificationPermission() !== 'granted') return;
  const settings = await getNotificationSettings();
  if (!settings.enabled) return;
  const pref = getOptionExpiryPref();
  if (!pref.enabled) return;

  let cache: { updatedAt: string; legs: CachedOpenOption[] } | null = null;
  try {
    const raw = localStorage.getItem(OPEN_OPTIONS_CACHE_KEY);
    cache = raw ? JSON.parse(raw) : null;
  } catch { cache = null; }
  if (!cache || !Array.isArray(cache.legs) || cache.legs.length === 0) return;
  // Don't nag on stale data (dashboard not opened in a while).
  if (Date.now() - new Date(cache.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000) return;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const soon = cache.legs
    .filter(l => !!l.expiration)
    .map(l => {
      const exp = new Date(`${l.expiration}T00:00:00`);
      const dte = Math.round((exp.getTime() - startOfToday.getTime()) / 86400000);
      return { ...l, dte };
    })
    .filter(l => l.dte >= 0 && l.dte <= pref.days)
    .sort((a, b) => a.dte - b.dte);
  if (soon.length === 0) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const signature = `${todayStr}|${soon.map(l => `${l.ticker}${l.optionType}${l.strike}${l.expiration}`).join(',')}`;
  if (localStorage.getItem('last-option-expiry') === signature) return;

  const when = (dte: number) => (dte === 0 ? 'today' : dte === 1 ? 'tomorrow' : `${dte}d`);
  const label = (l: typeof soon[number]) =>
    `${l.ticker} $${l.strike} ${l.optionType} (${when(l.dte)})${l.itm ? ' ⚠ITM' : ''}`;
  const itmCount = soon.filter(l => l.itm).length;

  const title = soon.length === 1
    ? `⏰ Option expiring ${when(soon[0].dte)}`
    : `⏰ ${soon.length} options expiring soon`;
  const body =
    soon.slice(0, 4).map(label).join(' · ') +
    (soon.length > 4 ? ` +${soon.length - 4} more` : '') +
    (itmCount ? ` — ${itmCount} in-the-money (assignment risk)` : '');

  await showLocalNotification(title, body, { tag: 'option-expiry', data: { type: 'option-expiry' } });
  localStorage.setItem('last-option-expiry', signature);
};

/**
 * Show streak milestone notification
 */
export const showStreakMilestone = async (streakDays: number): Promise<void> => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.streakMilestonesEnabled) return;
  if (getNotificationPermission() !== 'granted') return;

  // Only show on milestone days (5, 10, 15, 20, 30, 50, 100, etc.)
  const milestones = [5, 10, 15, 20, 30, 50, 75, 100, 150, 200, 365];
  if (!milestones.includes(streakDays)) return;

  let emoji = '🔥';
  let message = `${streakDays} days in a row!`;
  
  if (streakDays >= 100) {
    emoji = '🏆';
    message = `Incredible! ${streakDays} day streak!`;
  } else if (streakDays >= 30) {
    emoji = '⭐';
    message = `Amazing! ${streakDays} day streak!`;
  }

  await showLocalNotification(
    `${emoji} Streak Milestone!`,
    message,
    {
      tag: `streak-${streakDays}`,
      data: { type: 'streak-milestone', days: streakDays }
    }
  );
};

/**
 * Show resolution progress alert
 */
export const showResolutionAlert = async (
  resolutionTitle: string,
  status: 'ahead' | 'on-track' | 'behind',
  progress: string
): Promise<void> => {
  const settings = await getNotificationSettings();
  
  if (!settings.enabled || !settings.resolutionAlertsEnabled) return;
  if (getNotificationPermission() !== 'granted') return;

  const statusEmoji = {
    'ahead': '🚀',
    'on-track': '✓',
    'behind': '⚠️'
  };

  const statusText = {
    'ahead': 'You\'re ahead of schedule!',
    'on-track': 'You\'re on track!',
    'behind': 'Time to catch up!'
  };

  await showLocalNotification(
    `${statusEmoji[status]} ${resolutionTitle}`,
    `${progress} - ${statusText[status]}`,
    {
      tag: 'resolution-alert',
      data: { type: 'resolution-alert', status }
    }
  );
};

/**
 * Initialize notification system on app load
 */
export const initializeNotifications = async (): Promise<void> => {
  if (!isNotificationSupported()) return;

  // Check and show daily reminder
  await checkAndShowDailyReminder();

  // Set up periodic event reminder checks (every 5 minutes)
  setInterval(checkEventReminders, 5 * 60 * 1000);
  
  // Initial check
  await checkEventReminders();

  // Option expiry reminders (from the non-sensitive open-options cache).
  await checkOptionExpiryReminders();
  setInterval(() => { checkOptionExpiryReminders().catch(() => {}); }, 60 * 60 * 1000);
};
