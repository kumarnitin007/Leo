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
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    loadCalendars();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '1.5rem',
        borderRadius: '12px',
        color: 'white',
        marginBottom: '0.5rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          📅 Select Reference Calendars
        </h2>
        <p style={{ fontSize: '0.95rem', margin: 0, opacity: 0.95 }}>
          Enable calendars to see enriched holiday cards with facts, tips, and timelines on your dashboard
        </p>
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '8px',
          fontSize: '0.875rem',
          fontWeight: 500
        }}>
          ✨ <span style={{ fontWeight: 700 }}>{enabledCount}</span> calendar{enabledCount !== 1 ? 's' : ''} enabled • {allCalendars.length} available
        </div>
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
                  padding: '1.25rem',
                  background: isEnabled 
                    ? 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' 
                    : 'white',
                  border: isEnabled 
                    ? '2px solid #14b8a6' 
                    : '2px solid #e5e7eb',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  boxShadow: isEnabled 
                    ? '0 4px 12px rgba(20, 184, 166, 0.15)' 
                    : '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = isEnabled
                    ? '0 8px 20px rgba(20, 184, 166, 0.25)'
                    : '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isEnabled
                    ? '0 4px 12px rgba(20, 184, 166, 0.15)'
                    : '0 2px 4px rgba(0,0,0,0.05)';
                }}
              >
                {/* Checkbox - Desktop Only */}
                {!isMobile && (
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
                )}

                {/* Icon with Geography - Desktop Only */}
                {!isMobile && (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '0.25rem',
                    flexShrink: 0 
                  }}>
                    <div style={{ fontSize: '2.5rem' }}>
                      {DOMAIN_ICONS[calendar.domain] || '📅'}
                    </div>
                    <div style={{ fontSize: '1rem' }}>
                      {GEO_ICONS[calendar.geography] || '📍'}
                    </div>
                  </div>
                )}

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
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      background: isEnabled ? '#14b8a6' : '#f3f4f6',
                      color: isEnabled ? 'white' : '#374151'
                    }}>
                      {calendar.domain}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.75rem',
                      borderRadius: '6px',
                      background: isEnabled ? '#0891b2' : '#f3f4f6',
                      color: isEnabled ? 'white' : '#374151'
                    }}>
                      {calendar.geography}
                    </span>
                    {calendar.isPreloaded && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        background: '#fef3c7',
                        color: '#92400e'
                      }}>
                        ⭐ Popular
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Indicator - Desktop Only */}
                {!isMobile && (
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: isEnabled ? '#14b8a6' : '#d1d5db'
                    }}>
                      {isEnabled ? '✓' : '○'}
                    </div>
                  </div>
                )}
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
      {filteredCalendars.length > 0 && enabledCount > 0 && (
        <div style={{
          padding: '1.25rem',
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
          borderRadius: '12px',
          border: '2px solid #14b8a6',
          boxShadow: '0 4px 12px rgba(20, 184, 166, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>✨</span>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0f766e', margin: 0 }}>
              {enabledCount} Calendar{enabledCount !== 1 ? 's' : ''} Enabled
            </p>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#115e59', margin: 0, lineHeight: '1.5' }}>
            You'll see enriched holiday cards with facts, statistics, preparation tips, timelines, and activity ideas for these celebrations on your dashboard.
          </p>
        </div>
      )}
    </div>
  );
};
