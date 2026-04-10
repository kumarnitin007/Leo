/**
 * Google Services Section
 *
 * Renders inside IntegrationsView.tsx — shows Google Fit, Contacts,
 * and Takeout cards with real OAuth connect/disconnect.
 */

import React, { useState, lazy, Suspense } from 'react';
import { useGoogleAuth } from '../integrations/google';
import { hasFitScopes } from '../integrations/google/GoogleAuthManager';
import { useGoogleContacts } from '../integrations/google/hooks/useGoogleContacts';
import { useAuth } from '../contexts/AuthContext';
import { createContactEvents } from '../integrations/google/services/ContactEventsService';

const TakeoutImportPanel = lazy(() => import('./TakeoutImportPanel'));

const GoogleServicesSection: React.FC = () => {
  const { user } = useAuth();
  const {
    loading,
    isFitConnected,
    isContactsConnected,
    tokenExpired,
    connectService,
    disconnectGoogle,
    tokens,
  } = useGoogleAuth();

  const {
    contactCount,
    syncing,
    lastSyncResult,
    syncContacts,
  } = useGoogleContacts();

  const [expanded, setExpanded] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [creatingEvents, setCreatingEvents] = useState(false);

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google? This revokes access for all Google services.')) return;
    setDisconnecting(true);
    try {
      await disconnectGoogle();
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncContacts = async () => {
    const result = await syncContacts();
    if (result) {
      alert(`Sync complete: ${result.total} contacts synced.`);
    }
  };

  const handleCreateCalendarEvents = async () => {
    if (!user?.id) return;
    setCreatingEvents(true);
    try {
      const result = await createContactEvents(user.id);
      alert(
        `Done! Created ${result.birthdaysCreated} birthday and ${result.anniversariesCreated} anniversary events.` +
        (result.skipped > 0 ? ` (${result.skipped} skipped — already existed or missing data)` : ''),
      );
    } catch (err: any) {
      alert('Failed to create events: ' + (err.message || 'Unknown error'));
    } finally {
      setCreatingEvents(false);
    }
  };

  const hasTokens = !!tokens;
  const isAnyConnected = isFitConnected || isContactsConnected;
  const headerStatus = loading
    ? 'Checking connection...'
    : tokenExpired && hasTokens
    ? 'Token expired — reconnect needed'
    : isAnyConnected
    ? `Connected — ${tokens?.scopesGranted?.length || 0} scope(s)`
    : 'Not connected';

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: tokenExpired && hasTokens
        ? '2px solid #EF444440'
        : isAnyConnected ? '2px solid #10B98140' : '2px solid #E5E7EB',
    }}>
      {/* Section Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: tokenExpired && hasTokens
            ? 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)'
            : isAnyConnected
            ? 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)'
            : '#F9FAFB',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🔗</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              Google Services
            </div>
            <div style={{ fontSize: 11, color: tokenExpired ? '#EF4444' : '#6B7280', marginTop: 2 }}>
              {headerStatus}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 12, color: '#9CA3AF', transition: 'transform 0.2s',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
        }}>▶</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem' }}>
          {/* Token expired warning */}
          {tokenExpired && tokens && (
            <div style={{
              margin: '12px 0 0',
              padding: '10px 14px',
              borderRadius: 10,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#991B1B' }}>
                  Google token expired or revoked
                </div>
                <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>
                  Your Google session has expired. Please reconnect to restore services.
                </div>
              </div>
              <button
                onClick={() => connectService('fit')}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: 600,
                  background: '#4285F4', color: 'white', border: 'none',
                  borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >Reconnect</button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>

            {/* Google Fit card */}
            <div style={{
              padding: '12px 14px',
              background: isFitConnected ? '#F0FDF4' : tokenExpired ? '#FEF2F2' : '#F9FAFB',
              borderRadius: 12,
              border: `1px solid ${isFitConnected ? '#10B98130' : tokenExpired ? '#FECACA' : '#E5E7EB'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>🏃</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Google Fit</span>
                    {isFitConnected && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#10B981',
                        background: '#10B98115', padding: '2px 6px', borderRadius: 4,
                      }}>CONNECTED</span>
                    )}
                    {tokenExpired && tokens && hasFitScopes(tokens) && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#EF4444',
                        background: '#EF444415', padding: '2px 6px', borderRadius: 4,
                      }}>EXPIRED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {isFitConnected
                      ? 'Steps, calories, distance, heart rate, and more'
                      : tokenExpired
                      ? 'Token expired — reconnect to resume syncing'
                      : 'Connect to sync fitness data (steps, calories, etc.)'}
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>Scopes: fitness.activity.read, fitness.body.read</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {!isFitConnected && (
                    <button
                      onClick={() => connectService('fit')}
                      disabled={loading}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        background: tokenExpired ? '#EF4444' : '#4285F4', color: 'white', border: 'none',
                        borderRadius: 8, cursor: 'pointer',
                      }}
                    >{tokenExpired ? 'Reconnect' : 'Connect'}</button>
                  )}
                  {isFitConnected && (
                    <span style={{ fontSize: 18, color: '#10B981' }}>✓</span>
                  )}
                </div>
              </div>
            </div>

            {/* Google Contacts card */}
            <div style={{
              padding: '12px 14px',
              background: isContactsConnected ? '#F0FDF4' : '#F9FAFB',
              borderRadius: 12,
              border: `1px solid ${isContactsConnected ? '#10B98130' : '#E5E7EB'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>👥</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Google Contacts</span>
                    {isContactsConnected && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: '#10B981',
                        background: '#10B98115', padding: '2px 6px', borderRadius: 4,
                      }}>CONNECTED</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    {isContactsConnected
                      ? `${contactCount} contacts cached${lastSyncResult ? ` · Last sync: ${lastSyncResult.total} synced` : ''}`
                      : 'Sync contacts for typeahead and birthday events'}
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>Scopes: Contacts (read/write)</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {!isContactsConnected && (
                    <button
                      onClick={() => connectService('contacts')}
                      disabled={loading}
                      style={{
                        padding: '6px 14px', fontSize: 12, fontWeight: 600,
                        background: '#4285F4', color: 'white', border: 'none',
                        borderRadius: 8, cursor: 'pointer',
                      }}
                    >Connect</button>
                  )}
                  {isContactsConnected && (
                    <span style={{ fontSize: 18, color: '#10B981' }}>✓</span>
                  )}
                </div>
              </div>
              {isContactsConnected && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingLeft: 36 }}>
                  <button
                    onClick={handleSyncContacts}
                    disabled={syncing}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 600,
                      background: '#fff', color: '#374151', border: '1px solid #D1D5DB',
                      borderRadius: 8, cursor: 'pointer',
                    }}
                  >
                    {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
                  </button>
                  <button
                    onClick={handleCreateCalendarEvents}
                    disabled={creatingEvents}
                    style={{
                      padding: '5px 12px', fontSize: 11, fontWeight: 600,
                      background: '#fff', color: '#374151', border: '1px solid #D1D5DB',
                      borderRadius: 8, cursor: 'pointer',
                    }}
                  >
                    {creatingEvents ? '⏳ Creating...' : '🎂 Create Birthday Events'}
                  </button>
                </div>
              )}
            </div>

            {/* Google Takeout Import */}
            <div style={{
              padding: '12px 14px', background: '#F9FAFB', borderRadius: 12,
              border: '1px solid #E5E7EB',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>📥</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Google Takeout Import</span>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                    Import Keep notes as tasks or journal entries. Export from{' '}
                    <a href="https://takeout.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }}>
                      takeout.google.com
                    </a>
                  </div>
                </div>
              </div>
              <Suspense fallback={null}>
                <TakeoutImportPanel />
              </Suspense>
            </div>
          </div>

          {/* Disconnect button */}
          {(isAnyConnected || (hasTokens && tokenExpired)) && (
            <div style={{ marginTop: 14, borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600,
                  color: '#EF4444', background: '#EF444410', border: '1px solid #EF444430',
                  borderRadius: 8, cursor: 'pointer',
                }}
              >{disconnecting ? 'Disconnecting...' : 'Disconnect All Google Services'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoogleServicesSection;

// ── Reusable service card for simple connect-only services ─────────────

const ServiceCard: React.FC<{
  icon: string;
  name: string;
  description: string;
  scopes: string;
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
}> = ({ icon, name, description, scopes, connected, loading, onConnect }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: connected ? '#F0FDF4' : '#F9FAFB',
    borderRadius: 12,
    border: `1px solid ${connected ? '#10B98130' : '#E5E7EB'}`,
  }}>
    <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{name}</span>
        {connected && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#10B981',
            background: '#10B98115', padding: '2px 6px', borderRadius: 4,
          }}>CONNECTED</span>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{description}</div>
      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 1 }}>Scopes: {scopes}</div>
    </div>
    <div style={{ flexShrink: 0 }}>
      {!connected && (
        <button
          onClick={onConnect}
          disabled={loading}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            background: '#4285F4', color: 'white', border: 'none',
            borderRadius: 8, cursor: 'pointer',
          }}
        >Connect</button>
      )}
      {connected && (
        <span style={{ fontSize: 18, color: '#10B981' }}>✓</span>
      )}
    </div>
  </div>
);
