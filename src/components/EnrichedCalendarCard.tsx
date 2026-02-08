// =====================================================
// ENRICHED CALENDAR CARD: Template-based rich display
// =====================================================

import React, { useState, useEffect } from 'react';
import type { EnrichedCalendarDay } from '../types/calendar';
import { getEnrichedCalendarDay } from '../services/referenceCalendarService';

interface EnrichedCalendarCardProps {
  dayIdentifier: string;
  eventDate: Date;
  daysUntil: number;
  onClose?: () => void;
  onActionClick?: (actionType: string, actionTarget?: string) => void;
}

export const EnrichedCalendarCard: React.FC<EnrichedCalendarCardProps> = ({
  dayIdentifier,
  eventDate,
  daysUntil,
  onClose,
  onActionClick,
}) => {
  const [data, setData] = useState<EnrichedCalendarDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const enrichedData = await getEnrichedCalendarDay(dayIdentifier);
        
        if (!enrichedData) {
          throw new Error('No enriched data found');
        }
        
        setData(enrichedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [dayIdentifier]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getDaysUntilText = () => {
    if (daysUntil === 0) return 'TODAY';
    if (daysUntil === 1) return 'TOMORROW';
    if (daysUntil < 0) return `${Math.abs(daysUntil)} DAYS AGO`;
    return `IN ${daysUntil} DAY${daysUntil !== 1 ? 'S' : ''}`;
  };

  if (loading) {
    return (
      <div className="enriched-calendar-card">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="enriched-calendar-card">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: '#ef4444' }}>Failed to load enriched data</p>
          {onClose && (
            <button onClick={onClose} className="btn-secondary" style={{ marginTop: '1rem' }}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  const { enrichment, facts, statistics, tips, timelineItems, quickIdeas, externalResources, actionItems } = data;

  return (
    <div className="enriched-calendar-card" style={{
      width: '100%',
      maxWidth: '500px',
      background: 'white',
      borderRadius: '20px',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    }}>
      {/* Header with gradient background */}
      <div
        style={{
          background: `linear-gradient(135deg, ${enrichment.gradientStart} 0%, ${enrichment.gradientEnd} 100%)`,
          padding: '24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              fontSize: '20px',
              fontWeight: 'bold',
              zIndex: 10,
            }}
            aria-label="Close"
          >
            ×
          </button>
        )}

        {/* Background decorative emoji */}
        {enrichment.backgroundEmoji && (
          <div
            style={{
              position: 'absolute',
              fontSize: '120px',
              opacity: 0.1,
              right: '-20px',
              top: '-30px',
              transform: 'rotate(15deg)',
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            {enrichment.backgroundEmoji}
          </div>
        )}

        {/* Countdown badge */}
        {daysUntil >= -7 && (
          <div
            style={{
              background: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              padding: '8px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <span style={{ fontSize: '14px' }}>⏰</span>
            <span style={{ color: 'white', fontSize: '14px', fontWeight: 600, letterSpacing: '0.5px' }}>
              {getDaysUntilText()}
            </span>
          </div>
        )}

        {/* Title */}
        <div>
          <h1 style={{ color: 'white', fontSize: '32px', margin: '0 0 8px 0', fontWeight: 700 }}>
            {enrichment.iconEmoji} {enrichment.dayName}
          </h1>
          {enrichment.tagline && (
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '16px', margin: 0 }}>
              {enrichment.tagline}
            </p>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              background: 'rgba(255,255,255,0.3)',
              color: 'white',
            }}
          >
            {enrichment.templateCategory}
          </span>
          {enrichment.isMajorHoliday && (
            <span
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 500,
                background: '#FFD700',
                color: '#8B4513',
              }}
            >
              Major Holiday
            </span>
          )}
        </div>

        {/* Date */}
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>
          {formatDate(eventDate)}
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '20px', maxHeight: '60vh', overflowY: 'auto' }}>
        {/* Origin Story */}
        {enrichment.originStory && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
              📖 Origin Story
            </h3>
            <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6' }}>
              {enrichment.originStory}
            </p>
          </div>
        )}

        {/* Statistics */}
        {statistics.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              📊 By The Numbers
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {statistics.map((stat) => (
                <div
                  key={stat.id}
                  style={{
                    background: '#f9fafb',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  {stat.statIcon && (
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>{stat.statIcon}</div>
                  )}
                  <div style={{ fontSize: '24px', fontWeight: 700, color: enrichment.primaryColor }}>
                    {stat.statValue}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    {stat.statLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Facts */}
        {facts.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              💡 Did You Know?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {facts.slice(0, 3).map((fact) => (
                <div
                  key={fact.id}
                  style={{
                    background: '#f9fafb',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    borderLeft: `4px solid ${enrichment.primaryColor}`,
                  }}
                >
                  <p style={{ fontSize: '14px', color: '#374151', margin: 0, lineHeight: '1.5' }}>
                    {fact.content}
                  </p>
                  {fact.sourceName && (
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', marginBottom: 0 }}>
                      Source: {fact.sourceName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        {tips.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              🎯 Pro Tips
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tips.map((tip) => (
                <div
                  key={tip.id}
                  style={{
                    background: '#fef3c7',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    borderLeft: '4px solid #f59e0b',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>{tip.iconEmoji}</span>
                    <strong style={{ fontSize: '14px', color: '#92400e' }}>{tip.title}</strong>
                  </div>
                  <p style={{ fontSize: '13px', color: '#78350f', margin: 0, lineHeight: '1.5' }}>
                    {tip.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {timelineItems.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              ⏱️ Preparation Timeline
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {timelineItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '24px',
                      flexShrink: 0,
                    }}
                  >
                    {item.iconEmoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {item.description}
                    </div>
                    <div style={{ fontSize: '12px', color: enrichment.primaryColor, marginTop: '4px', fontWeight: 500 }}>
                      {item.daysBefore} days before
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Ideas */}
        {quickIdeas.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              💡 Quick Ideas
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {quickIdeas.map((idea) => (
                <div
                  key={idea.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: enrichment.primaryColor,
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 500,
                  }}
                >
                  <span>{idea.ideaEmoji}</span>
                  <span>{idea.ideaLabel}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* External Resources */}
        {externalResources.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
              🔗 Learn More
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {externalResources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f9fafb')}
                >
                  <span style={{ fontSize: '24px' }}>{resource.iconEmoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                      {resource.resourceTitle}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {resource.resourceDescription}
                    </div>
                  </div>
                  {resource.estimatedTime && (
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                      {resource.estimatedTime}
                    </div>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {actionItems.map((action) => (
                <button
                  key={action.id}
                  onClick={() => onActionClick?.(action.actionType, action.actionTarget ?? undefined)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    background: action.isPrimary ? enrichment.primaryColor : '#f3f4f6',
                    color: action.isPrimary ? 'white' : '#374151',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span>{action.actionIcon}</span>
                  <span>{action.actionLabel}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
