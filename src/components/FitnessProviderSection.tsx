/**
 * Fitness Provider Section
 *
 * Lets the user pick one of three fitness providers:
 *   - Google Fit (OAuth)
 *   - Fitbit (OAuth)
 *   - Garmin Connect (CSV import)
 *
 * Renders inside IntegrationsView, replacing the old Google Fit card
 * in GoogleServicesSection.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../integrations/google/hooks/useGoogleAuth';
import { useFitbitAuth } from '../integrations/fitbit/useFitbitAuth';
import { useFitness, getActiveProvider, setActiveProvider, FITNESS_PROVIDERS } from '../integrations/fitness';
import { parseGarminCsv, importGarminData } from '../integrations/garmin/GarminImportService';
import type { FitnessProviderId } from '../integrations/fitness';

const FitnessProviderSection: React.FC = () => {
  const { user } = useAuth();
  const {
    isFitConnected,
    loading: googleLoading,
    connectService: connectGoogleService,
  } = useGoogleAuth();
  const {
    isConnected: fitbitConnected,
    loading: fitbitLoading,
    connect: connectFitbit,
    disconnect: disconnectFitbit,
  } = useFitbitAuth();
  const { fetchRecent, loading: syncing } = useFitness();

  const [activeProvider, setActiveProviderState] = useState<FitnessProviderId>(getActiveProvider());
  const [expanded, setExpanded] = useState(true);
  const [garminImporting, setGarminImporting] = useState(false);
  const [garminResult, setGarminResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectProvider = useCallback((id: FitnessProviderId) => {
    setActiveProvider(id);
    setActiveProviderState(id);
  }, []);

  const isConnected = (id: FitnessProviderId) => {
    switch (id) {
      case 'google_fit': return isFitConnected;
      case 'fitbit': return fitbitConnected;
      case 'garmin': return true;
    }
  };

  const handleConnect = (id: FitnessProviderId) => {
    switch (id) {
      case 'google_fit':
        connectGoogleService('fit');
        break;
      case 'fitbit':
        connectFitbit();
        break;
      case 'garmin':
        fileInputRef.current?.click();
        break;
    }
  };

  const handleGarminFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setGarminImporting(true);
    setGarminResult(null);
    try {
      const text = await file.text();
      const data = parseGarminCsv(text);
      if (!data.length) {
        setGarminResult('No valid data found in CSV. Check the file format.');
        return;
      }
      const result = await importGarminData(user.id, data);
      if (result.errors.length) {
        setGarminResult(`Imported ${result.imported} days with errors: ${result.errors.join(', ')}`);
      } else {
        setGarminResult(`Successfully imported ${result.imported} day(s) of Garmin data.`);
      }
    } catch (err: any) {
      setGarminResult('Import failed: ' + (err.message || 'Unknown error'));
    } finally {
      setGarminImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [user?.id]);

  const handleSync = useCallback(async () => {
    await fetchRecent(7);
  }, [fetchRecent]);

  const providerEntries = (['google_fit', 'fitbit', 'garmin'] as FitnessProviderId[]).map(
    id => ({ ...FITNESS_PROVIDERS[id], connected: isConnected(id) }),
  );

  return (
    <div style={{
      background: 'white',
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: '1.5rem',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: activeProvider ? '2px solid #6366F140' : '2px solid #E5E7EB',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 100%)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>💪</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              Fitness Provider
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
              Active: {FITNESS_PROVIDERS[activeProvider].name}
              {isConnected(activeProvider) ? ' — Connected' : ''}
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
          <p style={{ fontSize: 11, color: '#6B7280', margin: '12px 0 10px', lineHeight: 1.5 }}>
            Choose one fitness provider for step tracking, auto-complete, and analytics.
            Your cached data is preserved when switching.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {providerEntries.map(p => {
              const isActive = activeProvider === p.id;
              const conn = p.connected;
              return (
                <div
                  key={p.id}
                  style={{
                    padding: '12px 14px',
                    background: isActive ? '#EEF2FF' : conn ? '#F0FDF4' : '#F9FAFB',
                    borderRadius: 12,
                    border: isActive
                      ? '2px solid #6366F1'
                      : `1px solid ${conn ? '#10B98130' : '#E5E7EB'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onClick={() => handleSelectProvider(p.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Radio */}
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${isActive ? '#6366F1' : '#D1D5DB'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isActive && (
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: '#6366F1',
                        }} />
                      )}
                    </div>

                    <span style={{ fontSize: 22, flexShrink: 0 }}>{p.icon}</span>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.name}</span>
                        {conn && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: '#10B981',
                            background: '#10B98115', padding: '2px 6px', borderRadius: 4,
                          }}>CONNECTED</span>
                        )}
                        {p.authType === 'manual_import' && (
                          <span style={{
                            fontSize: 9, fontWeight: 600, color: '#F59E0B',
                            background: '#F59E0B15', padding: '2px 6px', borderRadius: 4,
                          }}>CSV IMPORT</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        {p.description}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {p.id !== 'garmin' && !conn && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConnect(p.id); }}
                          disabled={googleLoading || fitbitLoading}
                          style={{
                            padding: '6px 14px', fontSize: 12, fontWeight: 600,
                            background: p.id === 'google_fit' ? '#4285F4' : '#00B0B9',
                            color: 'white', border: 'none',
                            borderRadius: 8, cursor: 'pointer',
                          }}
                        >Connect</button>
                      )}
                      {p.id === 'garmin' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConnect('garmin'); }}
                          disabled={garminImporting}
                          style={{
                            padding: '6px 14px', fontSize: 12, fontWeight: 600,
                            background: '#fff', color: '#374151',
                            border: '1px solid #D1D5DB',
                            borderRadius: 8, cursor: 'pointer',
                          }}
                        >{garminImporting ? 'Importing...' : 'Import CSV'}</button>
                      )}
                      {p.id !== 'garmin' && conn && (
                        <span style={{ fontSize: 18, color: '#10B981' }}>✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sync button for connected OAuth providers */}
          {(activeProvider === 'google_fit' && isFitConnected) ||
           (activeProvider === 'fitbit' && fitbitConnected) ? (
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                onClick={handleSync}
                disabled={syncing}
                style={{
                  padding: '6px 16px', fontSize: 12, fontWeight: 600,
                  background: '#fff', color: '#374151',
                  border: '1px solid #D1D5DB', borderRadius: 8, cursor: 'pointer',
                }}
              >
                {syncing ? '⏳ Syncing...' : `🔄 Sync from ${FITNESS_PROVIDERS[activeProvider].name}`}
              </button>
            </div>
          ) : null}

          {/* Garmin result message */}
          {garminResult && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 8,
              background: garminResult.includes('Successfully') ? '#F0FDF4' : '#FEF2F2',
              color: garminResult.includes('Successfully') ? '#166534' : '#991B1B',
              fontSize: 12,
            }}>
              {garminResult}
            </div>
          )}

          {/* Garmin info */}
          {activeProvider === 'garmin' && (
            <div style={{
              marginTop: 10, padding: '10px 12px', borderRadius: 8,
              background: '#FFFBEB', border: '1px solid #FDE68A',
              fontSize: 11, color: '#92400E', lineHeight: 1.5,
            }}>
              <strong>Garmin CSV Export:</strong> Go to{' '}
              <a href="https://connect.garmin.com" target="_blank" rel="noopener noreferrer"
                style={{ color: '#2563EB' }}>connect.garmin.com</a>
              {' '}→ Reports → Daily Summary → Export CSV.
              Upload that file here. Garmin's API requires a business partnership for direct integration.
            </div>
          )}

          {/* Fitbit disconnect */}
          {fitbitConnected && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => { if (confirm('Disconnect Fitbit?')) disconnectFitbit(); }}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  color: '#EF4444', background: '#EF444410', border: '1px solid #EF444430',
                  borderRadius: 8, cursor: 'pointer',
                }}
              >Disconnect Fitbit</button>
            </div>
          )}

          {/* Hidden file input for Garmin */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleGarminFile}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  );
};

export default FitnessProviderSection;
