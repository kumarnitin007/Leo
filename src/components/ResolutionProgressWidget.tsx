/**
 * Resolution Progress Widget
 * 
 * Displays resolution progress with visual graphs showing:
 * - Actual progress vs expected progress
 * - Trajectory to meet goals
 * - Collapsible section for dashboard
 */

import React, { useState, useEffect } from 'react';
import { Resolution } from '../types';
import { getResolutions } from '../storage';

interface ProgressData {
  resolution: Resolution;
  actualProgress: number;      // Current value
  expectedProgress: number;    // Where user should be
  targetValue: number;         // Final target
  percentComplete: number;     // Actual / Target * 100
  percentExpected: number;     // Expected / Target * 100
  status: 'ahead' | 'on-track' | 'behind' | 'far-behind';
  daysElapsed: number;
  totalDays: number;
  progressRate: number;        // Items per day actual
  requiredRate: number;        // Items per day needed to finish
}

const ResolutionProgressWidget: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resolutions, setResolutions] = useState<ProgressData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isExpanded && resolutions.length === 0 && !isLoading) {
      loadResolutions();
    }
  }, [isExpanded]);

  const loadResolutions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getResolutions();
      const activeResolutions = data.filter(r => r.status === 'active' && r.progressMetric === 'count' && r.targetValue);
      const progressData = activeResolutions.map(r => calculateProgress(r));
      setResolutions(progressData);
      
      // Check for resolutions that need alerts (only once per day)
      const today = new Date().toISOString().split('T')[0];
      const lastAlertDate = localStorage.getItem('last-resolution-alert-date');
      
      if (lastAlertDate !== today && progressData.length > 0) {
        // Find resolutions that are behind
        const behindResolutions = progressData.filter(p => p.status === 'behind' || p.status === 'far-behind');
        
        if (behindResolutions.length > 0) {
          // Show alert for the most behind resolution
          const mostBehind = behindResolutions[0];
          const gap = mostBehind.actualProgress - mostBehind.expectedProgress;
          
          import('../services/notificationService').then(({ showResolutionAlert }) => {
            const alertStatus = mostBehind.status === 'far-behind' ? 'behind' : mostBehind.status;
            showResolutionAlert(
              mostBehind.resolution.title,
              alertStatus,
              `${mostBehind.actualProgress}/${mostBehind.targetValue} (${gap} behind)`
            ).catch(err => console.warn('Resolution alert failed:', err));
          });
          
          localStorage.setItem('last-resolution-alert-date', today);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resolutions');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgress = (resolution: Resolution): ProgressData => {
    const now = new Date();
    const startDate = new Date(resolution.startDate + 'T00:00:00');
    const endDate = resolution.endDate 
      ? new Date(resolution.endDate + 'T00:00:00')
      : new Date(`${resolution.targetYear}-12-31T23:59:59`);
    
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    
    const targetValue = resolution.targetValue || 1;
    const actualProgress = resolution.currentValue || 0;
    
    // Expected progress based on linear distribution
    const progressRatio = Math.min(1, daysElapsed / totalDays);
    const expectedProgress = Math.round(targetValue * progressRatio);
    
    const percentComplete = Math.min(100, (actualProgress / targetValue) * 100);
    const percentExpected = Math.min(100, (expectedProgress / targetValue) * 100);
    
    // Rates
    const progressRate = daysElapsed > 0 ? actualProgress / daysElapsed : 0;
    const requiredRate = daysRemaining > 0 ? (targetValue - actualProgress) / daysRemaining : 0;
    
    // Status based on how far ahead/behind
    const difference = actualProgress - expectedProgress;
    const tolerancePercent = targetValue * 0.1; // 10% tolerance
    
    let status: ProgressData['status'];
    if (difference >= tolerancePercent) {
      status = 'ahead';
    } else if (difference >= -tolerancePercent) {
      status = 'on-track';
    } else if (difference >= -tolerancePercent * 2) {
      status = 'behind';
    } else {
      status = 'far-behind';
    }
    
    return {
      resolution,
      actualProgress,
      expectedProgress,
      targetValue,
      percentComplete,
      percentExpected,
      status,
      daysElapsed,
      totalDays,
      progressRate,
      requiredRate,
    };
  };

  const getStatusConfig = (status: ProgressData['status']) => {
    switch (status) {
      case 'ahead':
        return { color: '#10b981', bg: '#d1fae5', icon: '🚀', label: 'Ahead!' };
      case 'on-track':
        return { color: '#3b82f6', bg: '#dbeafe', icon: '✓', label: 'On Track' };
      case 'behind':
        return { color: '#f59e0b', bg: '#fef3c7', icon: '⚠️', label: 'Slightly Behind' };
      case 'far-behind':
        return { color: '#ef4444', bg: '#fee2e2', icon: '🔴', label: 'Needs Attention' };
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'health': return '💪';
      case 'fitness': return '🏃';
      case 'career': return '💼';
      case 'personal': return '🌟';
      case 'financial': return '💰';
      case 'relationships': return '❤️';
      case 'learning': return '📚';
      default: return '🎯';
    }
  };

  // Summary stats
  const onTrackCount = resolutions.filter(r => r.status === 'ahead' || r.status === 'on-track').length;
  const totalCount = resolutions.length;

  return (
    <div style={{
      marginTop: '1.5rem',
      borderRadius: '1rem',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #f5d0fe 100%)',
      border: '1px solid #e9d5ff',
      boxShadow: '0 4px 12px rgba(168, 85, 247, 0.1)'
    }}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '1rem 1.25rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🎯</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, color: '#6b21a8', fontSize: '1rem' }}>
              Resolutions Progress
            </div>
            {totalCount > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#9333ea' }}>
                {onTrackCount}/{totalCount} on track
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isExpanded && totalCount > 0 && (
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {resolutions.slice(0, 3).map((p, i) => {
                const config = getStatusConfig(p.status);
                return (
                  <div
                    key={i}
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: config.color,
                    }}
                    title={`${p.resolution.title}: ${config.label}`}
                  />
                );
              })}
            </div>
          )}
          <span style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            color: '#9333ea',
            fontSize: '1.25rem'
          }}>
            ▼
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={{ 
          padding: '0 1.25rem 1.25rem', 
          borderTop: '1px solid #e9d5ff',
          background: 'rgba(255,255,255,0.5)'
        }}>
          {isLoading && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#9333ea' }}>
              Loading resolutions...
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee2e2',
              color: '#dc2626',
              borderRadius: '0.5rem',
              marginTop: '1rem',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {!isLoading && !error && resolutions.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎯</div>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No active resolutions found</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
                Create resolutions in Items → Resolutions
              </p>
            </div>
          )}

          {!isLoading && !error && resolutions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {resolutions.map((progress, idx) => (
                <ResolutionCard key={progress.resolution.id || idx} data={progress} getCategoryIcon={getCategoryIcon} getStatusConfig={getStatusConfig} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Individual Resolution Card with Mini Graph
interface ResolutionCardProps {
  data: ProgressData;
  getCategoryIcon: (category?: string) => string;
  getStatusConfig: (status: ProgressData['status']) => { color: string; bg: string; icon: string; label: string };
}

const ResolutionCard: React.FC<ResolutionCardProps> = ({ data, getCategoryIcon, getStatusConfig }) => {
  const config = getStatusConfig(data.status);
  const { resolution, actualProgress, expectedProgress, targetValue, percentComplete, percentExpected, daysElapsed, totalDays, requiredRate } = data;
  
  // Generate points for mini line chart
  const generateChartPoints = () => {
    const width = 200;
    const height = 60;
    const padding = 5;
    
    // Expected line (diagonal from start to target)
    const expectedLine = `M ${padding},${height - padding} L ${width - padding},${padding}`;
    
    // Actual progress point
    const progressX = padding + ((daysElapsed / totalDays) * (width - 2 * padding));
    const progressY = height - padding - ((actualProgress / targetValue) * (height - 2 * padding));
    
    // Where user should be
    const expectedX = progressX;
    const expectedY = height - padding - ((expectedProgress / targetValue) * (height - 2 * padding));
    
    return { expectedLine, progressX, progressY, expectedX, expectedY, width, height };
  };

  const chart = generateChartPoints();

  return (
    <div style={{
      background: 'white',
      borderRadius: '0.75rem',
      padding: '1rem',
      border: `2px solid ${config.bg}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '1.25rem' }}>{getCategoryIcon(resolution.category)}</span>
          <div>
            <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>{resolution.title}</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {targetValue} times in {resolution.targetYear}
            </div>
          </div>
        </div>
        <div style={{
          padding: '0.25rem 0.5rem',
          background: config.bg,
          color: config.color,
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem'
        }}>
          {config.icon} {config.label}
        </div>
      </div>

      {/* Progress Bars */}
      <div style={{ marginBottom: '0.75rem' }}>
        {/* Actual Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', width: '55px' }}>Actual</span>
          <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${percentComplete}%`,
              background: config.color,
              borderRadius: '9999px',
              transition: 'width 0.5s ease'
            }} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: config.color, minWidth: '50px', textAlign: 'right' }}>
            {actualProgress}/{targetValue}
          </span>
        </div>
        
        {/* Expected Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: '#6b7280', width: '55px' }}>Expected</span>
          <div style={{ flex: 1, height: '8px', background: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden', position: 'relative' }}>
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${percentExpected}%`,
              background: '#9ca3af',
              borderRadius: '9999px',
              opacity: 0.5
            }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', minWidth: '50px', textAlign: 'right' }}>
            {expectedProgress}/{targetValue}
          </span>
        </div>
      </div>

      {/* Mini Chart */}
      <div style={{ 
        background: '#f9fafb', 
        borderRadius: '0.5rem', 
        padding: '0.5rem',
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '0.75rem'
      }}>
        <svg width={chart.width} height={chart.height} style={{ overflow: 'visible' }}>
          {/* Grid lines */}
          <line x1={5} y1={chart.height / 2} x2={chart.width - 5} y2={chart.height / 2} stroke="#e5e7eb" strokeDasharray="2,2" />
          
          {/* Expected trajectory (dashed line) */}
          <path d={chart.expectedLine} stroke="#9ca3af" strokeWidth="2" fill="none" strokeDasharray="4,4" />
          
          {/* Actual trajectory line */}
          <line 
            x1={5} 
            y1={chart.height - 5} 
            x2={chart.progressX} 
            y2={chart.progressY} 
            stroke={config.color} 
            strokeWidth="2.5"
          />
          
          {/* Expected point marker (hollow) */}
          <circle cx={chart.expectedX} cy={chart.expectedY} r="4" fill="white" stroke="#9ca3af" strokeWidth="2" />
          
          {/* Actual point marker (solid) */}
          <circle cx={chart.progressX} cy={chart.progressY} r="5" fill={config.color} stroke="white" strokeWidth="2" />
          
          {/* Labels */}
          <text x={5} y={chart.height + 12} fontSize="8" fill="#9ca3af">Start</text>
          <text x={chart.width - 25} y={chart.height + 12} fontSize="8" fill="#9ca3af">Target</text>
        </svg>
      </div>

      {/* Stats Row */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        fontSize: '0.75rem',
        color: '#6b7280',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div>
          <span style={{ color: '#9ca3af' }}>Gap:</span>{' '}
          <span style={{ 
            fontWeight: 600, 
            color: actualProgress >= expectedProgress ? '#10b981' : '#ef4444'
          }}>
            {actualProgress >= expectedProgress ? '+' : ''}{actualProgress - expectedProgress}
          </span>
        </div>
        <div>
          <span style={{ color: '#9ca3af' }}>Day:</span>{' '}
          <span style={{ fontWeight: 500 }}>{daysElapsed}/{totalDays}</span>
        </div>
        <div>
          <span style={{ color: '#9ca3af' }}>Need:</span>{' '}
          <span style={{ fontWeight: 500 }}>{requiredRate.toFixed(2)}/day</span>
        </div>
      </div>
    </div>
  );
};

export default ResolutionProgressWidget;
