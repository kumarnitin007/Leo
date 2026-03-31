/**
 * Google Services Section
 *
 * Renders inside IntegrationsView.tsx — shows Google Fit, Contacts,
 * and Takeout cards with real OAuth connect/disconnect.
 */

import React, { useState } from 'react';
import { useGoogleAuth } from '../integrations/google';
import { useGoogleContacts } from '../integrations/google/hooks/useGoogleContacts';

const GoogleServicesSection: React.FC = () => {
  const {
    loading,
    isFitConnected,
    isContactsConnected,
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

  const isAnyConnected = isFitConnected || isContactsConnected;

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: isAnyConnected ? '2px solid #10B98140' : '2px solid #E5E7EB',
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
          background: isAnyConnected
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
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              {loading ? 'Checking connection...' :
               isAnyConnected ? `Connected — ${tokens?.scopesGranted?.length || 0} scope(s)` :
               'Not connected'}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>

            {/* Google Fit card */}
            <ServiceCard
              icon="🏃"
              name="Google Fit"
              description="Steps, calories, heart rate, sleep, and more"
              scopes="Fitness activity, body, sleep (read)"
              connected={isFitConnected}
              loading={loading}
              onConnect={() => connectService('fit')}
            />

            {/* Google Contacts card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              background: isContactsConnected ? '#F0FDF4' : '#F9FAFB',
              borderRadius: 12,
              border: `1px solid ${isContactsConnected ? '#10B98130' : '#E5E7EB'}`,
            }}>
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
              <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>
                {isContactsConnected && (
                  <button
                    onClick={handleSyncContacts}
                    disabled={syncing}
                    style={{
                      padding: '6px 12px', fontSize: 11, fontWeight: 600,
                      background: '#fff', color: '#374151', border: '1px solid #D1D5DB',
                      borderRadius: 8, cursor: 'pointer',
                    }}
                  >
                    {syncing ? '⏳ Syncing...' : '🔄 Sync Now'}
                  </button>
                )}
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
              </div>
            </div>

            {/* Google Takeout card */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', background: '#F9FAFB', borderRadius: 12,
              border: '1px solid #E5E7EB',
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>📥</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Google Takeout Import</span>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Import Keep notes as tasks or journal entries</div>
              </div>
              <span style={{
                fontSize: 9, fontWeight: 600, color: '#F59E0B',
                background: '#F59E0B15', padding: '2px 6px', borderRadius: 4,
              }}>COMING SOON</span>
            </div>
          </div>

          {/* Disconnect button */}
          {isAnyConnected && (
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
