/**
 * GoogleSuiteSection — single "Connect Google" group that consolidates all
 * Google-family integrations under one OAuth button.
 *
 * Why this exists:
 *   The previous Integrations grid showed an individual "Connect" button on
 *   every Google service card (Calendar, Drive, Gmail, Tasks). All four use
 *   the same Google sign-in (single OAuth client, additive scopes) so the
 *   per-card button was misleading — clicking any of them opened the same
 *   setup modal. The user asked us to combine them.
 *
 * Behaviour:
 *   - Live status comes from `useGoogleAuth()` (same hook the Fitness Provider
 *     and Google Services sections already use).
 *   - One "Connect Google" / "Reconnect" / "Disconnect" button drives the
 *     entire suite. We default to the `fit` service id when there is no
 *     existing Google session, because that's the only Google service
 *     currently wired end-to-end. Once Calendar / Drive / Gmail / Tasks ship
 *     they will reuse the same tokens with additive scopes — no new button
 *     needed.
 *   - Each service is shown as a compact row with a PLANNED / READY badge
 *     and a one-line description. Rows are non-interactive for now (they're
 *     all PLANNED) but the structure is in place for live "last synced"
 *     timestamps later.
 *
 * SLA: this section is pure rendering on top of `useGoogleAuth`; no extra
 * network calls. Total mount cost is the cost of the hook (already paid by
 * other sections on this page).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useGoogleAuth } from '../integrations/google/hooks/useGoogleAuth';
import { perfStart } from '../utils/perfLogger';

interface SuiteService {
  id: 'google-calendar' | 'google-drive' | 'gmail' | 'google-tasks';
  name: string;
  icon: string;
  description: string;
  status: 'planned' | 'ready';
  /** Sentence shown only when Google is signed in. */
  connectedHint: string;
  /** Sentence shown when not signed in. */
  disconnectedHint: string;
}

const SERVICES: SuiteService[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Two-way sync of events and reminders.',
    status: 'planned',
    connectedHint: 'Calendar sync ships next — your sign-in will carry over.',
    disconnectedHint: 'Will request calendar.readonly + calendar.events scope.',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    icon: '☁️',
    description: 'Backups + document export to Drive.',
    status: 'planned',
    connectedHint: 'Drive backups ship next — your sign-in will carry over.',
    disconnectedHint: 'Will request drive.file scope (only files this app creates).',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '📧',
    description: 'Email-to-task and daily summary emails.',
    status: 'planned',
    connectedHint: 'Email features ship next — your sign-in will carry over.',
    disconnectedHint: 'Will request gmail.send / gmail.readonly scope.',
  },
  {
    id: 'google-tasks',
    name: 'Google Tasks',
    icon: '📋',
    description: 'Bidirectional sync with Google Tasks lists.',
    status: 'planned',
    connectedHint: 'Tasks sync ships next — your sign-in will carry over.',
    disconnectedHint: 'Will request tasks scope to read & write task lists.',
  },
];

/** IDs whose individual cards in IntegrationsView should now be hidden. */
export const GOOGLE_SUITE_IDS = new Set<string>(SERVICES.map((s) => s.id));

const GoogleSuiteSection: React.FC = () => {
  const renderEnd = useRef(perfStart('GoogleSuiteSection', 'render'));
  useEffect(() => {
    renderEnd.current();
  }, []);

  const { isFitConnected, tokenExpired, connectService, disconnectGoogle, loading } =
    useGoogleAuth();

  // Treat "Google signed in" as: any Google scope is currently granted and
  // the token has not expired. We piggyback on isFitConnected because Fit is
  // the only Google service currently wired — once others ship we'll add
  // their `is*Connected` flags to the OR.
  const signedIn = isFitConnected;

  const status = useMemo<{
    label: string;
    tone: 'good' | 'warn' | 'idle';
    primaryButton: string;
  }>(() => {
    if (loading) return { label: 'Checking…', tone: 'idle', primaryButton: 'Connect Google' };
    if (signedIn) return { label: 'Google signed in', tone: 'good', primaryButton: 'Reconnect / change scopes' };
    if (tokenExpired) return { label: 'Google token expired', tone: 'warn', primaryButton: 'Reconnect Google' };
    return { label: 'Not signed in', tone: 'idle', primaryButton: 'Connect Google' };
  }, [loading, signedIn, tokenExpired]);

  const toneColor =
    status.tone === 'good' ? '#166534' :
    status.tone === 'warn' ? '#b91c1c' : '#6b7280';
  const toneBg =
    status.tone === 'good' ? '#dcfce7' :
    status.tone === 'warn' ? '#fee2e2' : '#f3f4f6';
  const toneBorder =
    status.tone === 'good' ? '#86efac' :
    status.tone === 'warn' ? '#fca5a5' : '#e5e7eb';

  const handleConnect = () => {
    // Use the only currently-wired service id; the OAuth screen will reuse
    // already-granted scopes thanks to GoogleAuthManager.buildOAuthUrl.
    connectService('fit');
  };

  return (
    <section
      className="google-suite-section"
      style={{
        background: '#fff',
        border: '0.5px solid #e5e7eb',
        borderRadius: 14,
        padding: 18,
        marginBottom: 18,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      aria-label="Google integrations suite"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ fontSize: 30 }}>🔗</div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span>Google Suite</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: toneBg,
                  color: toneColor,
                  border: `0.5px solid ${toneBorder}`,
                }}
              >
                {status.label.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              One Google sign-in unlocks Calendar, Drive, Gmail, Tasks (and Fit / Contacts
              elsewhere on this page). No per-service API key needed.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleConnect}
            className="btn-connect"
            style={{
              padding: '8px 14px',
              fontWeight: 600,
              borderRadius: 8,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {status.primaryButton}
          </button>
          {signedIn && (
            <button
              onClick={() => {
                if (confirm('Disconnect Google? All Google services (Calendar, Drive, Gmail, Tasks, Fit, Contacts) will stop syncing.')) {
                  void disconnectGoogle();
                }
              }}
              className="btn-disconnect"
              style={{
                padding: '8px 14px',
                fontWeight: 600,
                borderRadius: 8,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Disconnect Google
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginTop: 16,
        }}
      >
        {SERVICES.map((s) => (
          <div
            key={s.id}
            style={{
              border: '0.5px solid #e5e7eb',
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 20 }}>{s.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{s.name}</div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: s.status === 'planned' ? '#fef3c7' : '#dcfce7',
                    color: s.status === 'planned' ? '#854f0b' : '#166534',
                    border: s.status === 'planned' ? '0.5px solid #f59e0b' : '0.5px solid #16a34a',
                  }}
                >
                  {s.status === 'planned' ? 'PLANNED' : 'READY'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.description}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' }}>
                {signedIn ? s.connectedHint : s.disconnectedHint}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default GoogleSuiteSection;
