import React, { useState, useEffect } from 'react';
import {
  getReferenceCalendars,
  getUserEnabledCalendars,
  enableReferenceCalendar,
  disableReferenceCalendar
} from '../services/referenceCalendarStorage';
import { ReferenceCalendar } from '../types';

interface ReferenceCalendarBrowserProps {
  onDaysChange?: () => void;
}

const DOMAIN_ICONS: Record<string, string> = {
  'holiday': '🎉',
  'festival': '🎊',
  'religious': '🙏',
  'financial': '💰',
  'observance': '📌'
};

const GEO_ICONS: Record<string, string> = {
  'IN': '🇮🇳',
  'US': '🇺🇸',
  'JP': '🇯🇵',
  'GLOBAL': '🌍'
};

export const ReferenceCalendarBrowser: React.FC<ReferenceCalendarBrowserProps> = ({
  onDaysChange
}) => {
  const [allCalendars, setAllCalendars] = useState<ReferenceCalendar[]>([]);
  const [enabledCalendarIds, setEnabledCalendarIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [filterGeography, setFilterGeography] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    try {
      setLoading(true);
      setError(null);

      const [calendars, userEnabled] = await Promise.all([
        getReferenceCalendars(),
        getUserEnabledCalendars()
      ]);

      setAllCalendars(calendars);
      setEnabledCalendarIds(new Set(userEnabled.map(c => c.calendar_id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendars');
      console.error('Error loading calendars:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleCalendar = async (calendarId: string) => {
    try {
      const isCurrentlyEnabled = enabledCalendarIds.has(calendarId);

      if (isCurrentlyEnabled) {
        await disableReferenceCalendar(calendarId);
        const newSet = new Set(enabledCalendarIds);
        newSet.delete(calendarId);
        setEnabledCalendarIds(newSet);
      } else {
        await enableReferenceCalendar(calendarId);
        setEnabledCalendarIds(new Set(enabledCalendarIds).add(calendarId));
      }

      onDaysChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update calendar');
      console.error('Error toggling calendar:', err);
    }
  };

  const filteredCalendars = allCalendars.filter(cal => {
    const matchesDomain = !filterDomain || cal.domain === filterDomain;
    const matchesGeography = !filterGeography || cal.geography === filterGeography;
    const matchesSearch =
      !searchText ||
      cal.name.toLowerCase().includes(searchText.toLowerCase()) ||
      cal.description?.toLowerCase().includes(searchText.toLowerCase());

    return matchesDomain && matchesGeography && matchesSearch;
  });

  const enabledCount = enabledCalendarIds.size;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
        <div style={{ fontSize: '2rem', marginRight: '1rem' }}>⏳</div>
        <p style={{ color: '#6b7280', fontWeight: 500 }}>Loading calendars...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
          📅 Select Reference Calendars
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          Enable calendars to see their special days on your dashboard
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #fca5a5',
          borderRadius: '8px',
          padding: '1rem'
        }}>
          <p style={{ color: '#991b1b', fontWeight: 600, fontSize: '0.875rem' }}>⚠️ Error: {error}</p>
        </div>
      )}

      {/* Filter Section - Matching EventsView style */}
      <div className="events-filters" style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: '1rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
          <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
            Search
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem' }}>🔍</span>
            <input
              type="text"
              placeholder="Search calendars..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.5rem 0.5rem 2.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '1.25rem',
                  fontWeight: 700
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        <div style={{ flex: '0 1 150px', minWidth: '120px' }}>
          <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
            Type
          </label>
          <select
            value={filterDomain}
            onChange={e => setFilterDomain(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="">All Categories</option>
            <option value="holiday">🎉 Holiday</option>
            <option value="festival">🎊 Festival</option>
            <option value="religious">🙏 Religious</option>
            <option value="observance">📌 Observance</option>
            <option value="financial">💰 Financial</option>
          </select>
        </div>
        
        <div style={{ flex: '0 1 150px', minWidth: '120px' }}>
          <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
            Region
          </label>
          <select
            value={filterGeography}
            onChange={e => setFilterGeography(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          >
            <option value="">All Regions</option>
            <option value="IN">🇮🇳 India</option>
            <option value="US">🇺🇸 USA</option>
            <option value="JP">🇯🇵 Japan</option>
            <option value="GLOBAL">🌐 Global</option>
          </select>
        </div>
      </div>

      {/* Calendar List - Checkbox Style */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredCalendars.length > 0 ? (
          filteredCalendars.map(calendar => {
            const isEnabled = enabledCalendarIds.has(calendar.id);

            return (
              <div
                key={calendar.id}
                onClick={() => handleToggleCalendar(calendar.id)}
                style={{
                  padding: '1rem',
                  background: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#14b8a6';
                  e.currentTarget.style.background = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.background = 'white';
                }}
              >
                {/* Checkbox */}
                <div style={{ flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={() => handleToggleCalendar(calendar.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      accentColor: '#14b8a6'
                    }}
                  />
                </div>

                {/* Icon */}
                <div style={{ fontSize: '2rem', flexShrink: 0 }}>
                  {DOMAIN_ICONS[calendar.domain] || '📅'}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ 
                    fontWeight: 600, 
                    fontSize: '0.95rem', 
                    color: '#1f2937',
                    margin: 0,
                    marginBottom: '0.25rem'
                  }}>
                    {calendar.name}
                  </h3>
                  <p style={{ 
                    fontSize: '0.875rem', 
                    color: '#6b7280',
                    margin: 0,
                    marginBottom: '0.5rem',
                    lineHeight: '1.4'
                  }}>
                    {calendar.description}
                  </p>

                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: '#f3f4f6',
                      color: '#374151'
                    }}>
                      {DOMAIN_ICONS[calendar.domain]} {calendar.domain}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: '#f3f4f6',
                      color: '#374151'
                    }}>
                      {GEO_ICONS[calendar.geography] || '📍'} {calendar.geography}
                    </span>
                    {calendar.isPreloaded && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        background: '#fef3c7',
                        color: '#92400e'
                      }}>
                        ⭐ Preloaded
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Indicator */}
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.375rem 0.75rem',
                    borderRadius: '6px',
                    background: isEnabled ? '#14b8a6' : '#f3f4f6',
                    color: isEnabled ? 'white' : '#4b5563',
                    whiteSpace: 'nowrap'
                  }}>
                    {isEnabled ? '✓ ON' : 'OFF'}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>📭 No calendars found</p>
            <p style={{ fontSize: '0.875rem' }}>Try adjusting your search filters</p>
          </div>
        )}
      </div>

      {/* Summary Info */}
      {filteredCalendars.length > 0 && (
        <div style={{
          padding: '1rem',
          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
          borderRadius: '8px',
          border: '2px solid #d1d5db'
        }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1f2937', margin: 0 }}>
            ✨ <span style={{ fontWeight: 700, color: '#14b8a6' }}>{enabledCount}</span> calendar{enabledCount !== 1 ? 's' : ''} enabled. Their special days will appear on your dashboard.
          </p>
        </div>
      )}
    </div>
  );
};
