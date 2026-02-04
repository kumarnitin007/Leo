/**
 * Notification Settings Component
 * 
 * UI for configuring web push notifications
 */

import React, { useState, useEffect } from 'react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationSettings,
  saveNotificationSettings,
  showLocalNotification,
  NotificationSettings as NotificationSettingsType,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../services/notificationService';

const NotificationSettings: React.FC = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [settings, setSettings] = useState<NotificationSettingsType>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    setPermission(getNotificationPermission());
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getNotificationSettings();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const granted = await requestNotificationPermission();
      setPermission(granted ? 'granted' : 'denied');
      
      if (granted) {
        setSuccess('Notifications enabled! You can now configure your preferences below.');
        // Auto-enable notifications
        const newSettings = { ...settings, enabled: true };
        setSettings(newSettings);
        await saveNotificationSettings(newSettings);
      } else {
        setError('Notification permission denied. Please enable in browser settings.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request permission');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await saveNotificationSettings(settings);
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await showLocalNotification(
        '🎯 Test Notification',
        'This is how your Leo notifications will look!',
        { tag: 'test-notification' }
      );
      setSuccess('Test notification sent!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to send test notification');
    }
  };

  if (!isNotificationSupported()) {
    return (
      <div style={{
        padding: '2rem',
        background: '#fef3c7',
        borderRadius: '1rem',
        border: '2px solid #fbbf24',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
        <h3 style={{ margin: '0 0 0.5rem', color: '#92400e' }}>Notifications Not Supported</h3>
        <p style={{ margin: 0, color: '#78350f', fontSize: '0.9rem' }}>
          Your browser doesn't support web push notifications. Try Chrome, Firefox, or Edge.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
        Loading notification settings...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px' }}>
      {/* Permission Status */}
      {permission !== 'granted' && (
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          borderRadius: '1rem',
          border: '2px solid #3b82f6',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>🔔</span>
            <div>
              <h3 style={{ margin: 0, color: '#1e40af', fontSize: '1.1rem' }}>Enable Notifications</h3>
              <p style={{ margin: '0.25rem 0 0', color: '#1e3a8a', fontSize: '0.9rem' }}>
                Get reminders for tasks, events, and track your progress
              </p>
            </div>
          </div>
          <button
            onClick={handleRequestPermission}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem'
            }}
          >
            🔔 Enable Notifications
          </button>
        </div>
      )}

      {/* Success/Error messages */}
      {success && (
        <div style={{
          padding: '0.875rem 1rem',
          background: '#d1fae5',
          color: '#065f46',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}>
          ✓ {success}
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.875rem 1rem',
          background: '#fee2e2',
          color: '#dc2626',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          fontSize: '0.9rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Master Toggle */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        border: '2px solid #e5e7eb'
      }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', marginBottom: '0.25rem' }}>
              🔔 Enable All Notifications
            </div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Master switch for all notification types
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
            disabled={permission !== 'granted'}
            style={{
              width: '20px',
              height: '20px',
              cursor: permission === 'granted' ? 'pointer' : 'not-allowed'
            }}
          />
        </label>
      </div>

      {/* Settings sections - only show if enabled */}
      {settings.enabled && permission === 'granted' && (
        <>
          {/* Daily Reminder */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🌅 Daily Morning Reminder
            </h4>
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={settings.dailyReminderEnabled}
                onChange={(e) => setSettings({ ...settings, dailyReminderEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#374151' }}>
                Send daily reminder
              </span>
            </label>

            {settings.dailyReminderEnabled && (
              <div style={{ marginLeft: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  Preferred time:
                </label>
                <input
                  type="time"
                  value={settings.dailyReminderTime}
                  onChange={(e) => setSettings({ ...settings, dailyReminderTime: e.target.value })}
                  style={{
                    padding: '0.5rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
                  You'll receive a notification around this time each day
                </p>
              </div>
            )}
          </div>

          {/* Event Reminders */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📅 Event Reminders
            </h4>
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={settings.eventRemindersEnabled}
                onChange={(e) => setSettings({ ...settings, eventRemindersEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#374151' }}>
                Remind me before events
              </span>
            </label>

            {settings.eventRemindersEnabled && (
              <div style={{ marginLeft: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  Remind me:
                </label>
                <select
                  value={settings.eventReminderMinutes}
                  onChange={(e) => setSettings({ ...settings, eventReminderMinutes: Number(e.target.value) })}
                  style={{
                    padding: '0.5rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: 'white'
                  }}
                >
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={120}>2 hours before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>
            )}
          </div>

          {/* Streak Milestones */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🔥 Streak Milestones
            </h4>
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={settings.streakMilestonesEnabled}
                onChange={(e) => setSettings({ ...settings, streakMilestonesEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#374151' }}>
                Celebrate streak milestones (5, 10, 30, 100 days, etc.)
              </span>
            </label>
          </div>

          {/* Resolution Alerts */}
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🎯 Resolution Progress Alerts
            </h4>
            
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={settings.resolutionAlertsEnabled}
                onChange={(e) => setSettings({ ...settings, resolutionAlertsEnabled: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', color: '#374151' }}>
                Alert me about resolution progress
              </span>
            </label>

            {settings.resolutionAlertsEnabled && (
              <div style={{ marginLeft: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  Frequency:
                </label>
                <select
                  value={settings.resolutionAlertFrequency}
                  onChange={(e) => setSettings({ ...settings, resolutionAlertFrequency: e.target.value as any })}
                  style={{
                    padding: '0.5rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: 'white'
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (recommended)</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleSave}
          disabled={saving || permission !== 'granted'}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '0.875rem 1.5rem',
            background: saving || permission !== 'granted' ? '#e5e7eb' : '#3b82f6',
            color: saving || permission !== 'granted' ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: saving || permission !== 'granted' ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            fontSize: '1rem'
          }}
        >
          {saving ? 'Saving...' : '💾 Save Settings'}
        </button>

        {permission === 'granted' && (
          <button
            onClick={handleTestNotification}
            style={{
              padding: '0.875rem 1.5rem',
              background: '#f3f4f6',
              color: '#374151',
              border: '2px solid #e5e7eb',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '1rem'
            }}
          >
            🧪 Test Notification
          </button>
        )}
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: '#f9fafb',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb'
      }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#374151' }}>
          📱 How Notifications Work
        </h4>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#6b7280', lineHeight: '1.6' }}>
          <li>Works on desktop and Android (Chrome, Firefox, Edge)</li>
          <li>Daily reminders show around your preferred time</li>
          <li>Event reminders appear before scheduled events</li>
          <li>Notifications work even when app is closed</li>
          <li>You can disable anytime in browser settings</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificationSettings;
