/**
 * VoiceCommandAnalytics - Show user their voice command patterns and stats
 * 
 * Displays insights about usage, success rates, and common patterns
 */

import React, { useState, useEffect } from 'react';
import dbService from '../../services/voice/VoiceCommandDatabaseService';
import { VoiceCommandLog, IntentType, Outcome } from '../../types/voice-command-db.types';

interface VoiceCommandAnalyticsProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

interface AnalyticsData {
  totalCommands: number;
  successRate: number;
  avgConfidence: number;
  intentBreakdown: Record<string, number>;
  outcomeBreakdown: Record<Outcome, number>;
  topPatterns: Array<{ pattern: string; count: number }>;
  recentTrend: 'up' | 'down' | 'stable';
  mostConfidentIntent: { intent: string; confidence: number };
}

const VoiceCommandAnalytics: React.FC<VoiceCommandAnalyticsProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    if (isOpen && userId) {
      loadAnalytics();
    }
  }, [isOpen, userId, timeRange]);

  const loadAnalytics = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const commands = await dbService.getRecentCommands(userId, 500);
      
      // Filter by time range
      const now = Date.now();
      const filtered = commands.filter(cmd => {
        const age = now - new Date(cmd.createdAt || '').getTime();
        if (timeRange === 'week') return age <= 7 * 24 * 60 * 60 * 1000;
        if (timeRange === 'month') return age <= 30 * 24 * 60 * 60 * 1000;
        return true;
      });

      // Calculate stats
      const totalCommands = filtered.length;
      const successCount = filtered.filter(c => c.outcome === 'SUCCESS').length;
      const successRate = totalCommands > 0 ? (successCount / totalCommands) * 100 : 0;
      
      const confidences = filtered.filter(c => c.overallConfidence).map(c => c.overallConfidence!);
      const avgConfidence = confidences.length > 0 
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
        : 0;

      // Intent breakdown
      const intentBreakdown: Record<string, number> = {};
      filtered.forEach(cmd => {
        intentBreakdown[cmd.intentType] = (intentBreakdown[cmd.intentType] || 0) + 1;
      });

      // Outcome breakdown
      const outcomeBreakdown: Record<Outcome, number> = {
        PENDING: 0,
        SUCCESS: 0,
        CANCELLED: 0,
        FAILED: 0,
        UNDONE: 0,
      };
      filtered.forEach(cmd => {
        if (cmd.outcome) {
          outcomeBreakdown[cmd.outcome] = (outcomeBreakdown[cmd.outcome] || 0) + 1;
        }
      });

      // Top patterns (by title similarity)
      const titleCounts: Record<string, number> = {};
      filtered.forEach(cmd => {
        const title = cmd.extractedTitle?.toLowerCase() || '';
        if (title) {
          titleCounts[title] = (titleCounts[title] || 0) + 1;
        }
      });
      const topPatterns = Object.entries(titleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern, count]) => ({ pattern, count }));

      // Most confident intent
      const intentConfidences: Record<string, number[]> = {};
      filtered.forEach(cmd => {
        if (cmd.overallConfidence) {
          if (!intentConfidences[cmd.intentType]) {
            intentConfidences[cmd.intentType] = [];
          }
          intentConfidences[cmd.intentType].push(cmd.overallConfidence);
        }
      });
      
      let mostConfidentIntent = { intent: 'N/A', confidence: 0 };
      Object.entries(intentConfidences).forEach(([intent, confs]) => {
        const avg = confs.reduce((a, b) => a + b, 0) / confs.length;
        if (avg > mostConfidentIntent.confidence) {
          mostConfidentIntent = { intent, confidence: avg };
        }
      });

      // Calculate trend by comparing recent vs older success rates
      let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
      if (filtered.length >= 4) {
        const midpoint = Math.floor(filtered.length / 2);
        const olderHalf = filtered.slice(0, midpoint);
        const recentHalf = filtered.slice(midpoint);
        
        const olderSuccess = olderHalf.filter(c => c.outcome === 'COMPLETED').length / olderHalf.length;
        const recentSuccess = recentHalf.filter(c => c.outcome === 'COMPLETED').length / recentHalf.length;
        
        const diff = recentSuccess - olderSuccess;
        if (diff > 0.1) recentTrend = 'improving';
        else if (diff < -0.1) recentTrend = 'declining';
      }

      setAnalytics({
        totalCommands,
        successRate,
        avgConfidence,
        intentBreakdown,
        outcomeBreakdown,
        topPatterns,
        recentTrend,
        mostConfidentIntent,
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getIntentLabel = (intent: string): string => {
    const labels: Record<string, string> = {
      'CREATE_TASK': 'Tasks',
      'CREATE_EVENT': 'Events',
      'CREATE_TODO': 'List Items',
      'CREATE_JOURNAL': 'Journals',
      'CREATE_ROUTINE': 'Routines',
      'CREATE_ITEM': 'Items',
      'SCAN_IMAGE_QUICK': 'Quick Scans',
      'SCAN_IMAGE_SMART': 'Smart Scans',
    };
    return labels[intent] || intent;
  };

  return (
    <div className="analytics-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="analytics-modal">
        {/* Header */}
        <div className="analytics-header">
          <div>
            <h2>Voice Command Analytics</h2>
            <p>Your usage patterns and insights</p>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Time Range Selector */}
        <div className="time-range-selector">
          <button 
            className={`range-btn ${timeRange === 'week' ? 'active' : ''}`}
            onClick={() => setTimeRange('week')}
          >
            Last Week
          </button>
          <button 
            className={`range-btn ${timeRange === 'month' ? 'active' : ''}`}
            onClick={() => setTimeRange('month')}
          >
            Last Month
          </button>
          <button 
            className={`range-btn ${timeRange === 'all' ? 'active' : ''}`}
            onClick={() => setTimeRange('all')}
          >
            All Time
          </button>
        </div>

        {/* Content */}
        <div className="analytics-content">
          {loading ? (
            <div className="analytics-loading">
              <div className="loading-spinner">📊</div>
              <p>Analyzing your patterns...</p>
            </div>
          ) : analytics ? (
            <>
              {/* Key Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">🎤</div>
                  <div className="stat-value">{analytics.totalCommands}</div>
                  <div className="stat-label">Total Commands</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">✅</div>
                  <div className="stat-value">{Math.round(analytics.successRate)}%</div>
                  <div className="stat-label">Success Rate</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">🎯</div>
                  <div className="stat-value">{Math.round(analytics.avgConfidence * 100)}%</div>
                  <div className="stat-label">Avg Confidence</div>
                </div>
              </div>

              {/* Intent Breakdown */}
              <div className="section">
                <h3 className="section-title">Most Common Commands</h3>
                <div className="intent-list">
                  {Object.entries(analytics.intentBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([intent, count]) => {
                      const percentage = (count / analytics.totalCommands) * 100;
                      return (
                        <div key={intent} className="intent-item">
                          <div className="intent-info">
                            <span className="intent-name">{getIntentLabel(intent)}</span>
                            <span className="intent-count">{count} times</span>
                          </div>
                          <div className="intent-bar">
                            <div 
                              className="intent-bar-fill"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="intent-percentage">{Math.round(percentage)}%</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Outcome Breakdown */}
              <div className="section">
                <h3 className="section-title">Command Outcomes</h3>
                <div className="outcome-grid">
                  <div className="outcome-item success">
                    <div className="outcome-icon">✓</div>
                    <div className="outcome-value">{analytics.outcomeBreakdown.SUCCESS}</div>
                    <div className="outcome-label">Created</div>
                  </div>
                  <div className="outcome-item pending">
                    <div className="outcome-icon">⏳</div>
                    <div className="outcome-value">{analytics.outcomeBreakdown.PENDING}</div>
                    <div className="outcome-label">Pending</div>
                  </div>
                  <div className="outcome-item cancelled">
                    <div className="outcome-icon">✕</div>
                    <div className="outcome-value">{analytics.outcomeBreakdown.CANCELLED}</div>
                    <div className="outcome-label">Cancelled</div>
                  </div>
                  <div className="outcome-item failed">
                    <div className="outcome-icon">!</div>
                    <div className="outcome-value">{analytics.outcomeBreakdown.FAILED}</div>
                    <div className="outcome-label">Failed</div>
                  </div>
                </div>
              </div>

              {/* Top Patterns */}
              {analytics.topPatterns.length > 0 && (
                <div className="section">
                  <h3 className="section-title">Your Top Patterns</h3>
                  <div className="patterns-list">
                    {analytics.topPatterns.map((pattern, idx) => (
                      <div key={idx} className="pattern-item">
                        <span className="pattern-rank">#{idx + 1}</span>
                        <span className="pattern-text">"{pattern.pattern}"</span>
                        <span className="pattern-count">{pattern.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              <div className="section insights">
                <h3 className="section-title">💡 Insights</h3>
                <div className="insights-list">
                  {analytics.successRate >= 90 && (
                    <div className="insight-item success">
                      <span className="insight-icon">🎉</span>
                      <p>Excellent! Your success rate is {Math.round(analytics.successRate)}%</p>
                    </div>
                  )}
                  {analytics.avgConfidence >= 0.85 && (
                    <div className="insight-item success">
                      <span className="insight-icon">✨</span>
                      <p>You speak very clearly - {Math.round(analytics.avgConfidence * 100)}% avg confidence</p>
                    </div>
                  )}
                  {analytics.mostConfidentIntent.confidence > 0 && (
                    <div className="insight-item info">
                      <span className="insight-icon">🎯</span>
                      <p>
                        You're best at {getIntentLabel(analytics.mostConfidentIntent.intent)} 
                        ({Math.round(analytics.mostConfidentIntent.confidence * 100)}% confidence)
                      </p>
                    </div>
                  )}
                  {analytics.outcomeBreakdown.PENDING > 5 && (
                    <div className="insight-item warning">
                      <span className="insight-icon">⏳</span>
                      <p>You have {analytics.outcomeBreakdown.PENDING} pending commands to review</p>
                    </div>
                  )}
                  {analytics.successRate < 70 && (
                    <div className="insight-item warning">
                      <span className="insight-icon">💡</span>
                      <p>Tip: Speak slowly and clearly for better recognition</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="analytics-empty">
              <span className="empty-icon">📊</span>
              <p>No voice commands yet</p>
              <p className="empty-hint">Start using voice to see your analytics!</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .analytics-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        .analytics-modal {
          background: white;
          border-radius: 1.5rem;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }

        .analytics-header {
          padding: 1.5rem;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .analytics-header h2 {
          margin: 0 0 0.5rem;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .analytics-header p {
          margin: 0;
          font-size: 0.9rem;
          opacity: 0.9;
        }

        .close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .time-range-selector {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          gap: 0.5rem;
          justify-content: center;
        }

        .range-btn {
          padding: 0.5rem 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          background: white;
          color: #6b7280;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .range-btn.active {
          border-color: #3b82f6;
          background: #eff6ff;
          color: #3b82f6;
        }

        .range-btn:hover:not(.active) {
          border-color: #d1d5db;
        }

        .analytics-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .analytics-loading,
        .analytics-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          text-align: center;
          color: #6b7280;
        }

        .loading-spinner {
          font-size: 2.5rem;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-hint {
          font-size: 0.85rem;
          opacity: 0.7;
          margin-top: 0.25rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat-card {
          background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
          border: 2px solid #bae6fd;
          border-radius: 1rem;
          padding: 1.25rem;
          text-align: center;
        }

        .stat-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 0.25rem;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #6b7280;
          font-weight: 500;
        }

        .section {
          margin-bottom: 1.5rem;
          background: #fafafa;
          border-radius: 1rem;
          padding: 1.25rem;
        }

        .section-title {
          margin: 0 0 1rem;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .intent-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .intent-item {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0.5rem;
          align-items: center;
        }

        .intent-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          grid-column: 1 / -1;
          margin-bottom: 0.25rem;
        }

        .intent-name {
          font-size: 0.9rem;
          font-weight: 500;
          color: #374151;
        }

        .intent-count {
          font-size: 0.8rem;
          color: #6b7280;
        }

        .intent-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .intent-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%);
          transition: width 0.3s;
        }

        .intent-percentage {
          font-size: 0.75rem;
          font-weight: 600;
          color: #3b82f6;
        }

        .outcome-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.75rem;
        }

        .outcome-item {
          text-align: center;
          padding: 1rem 0.5rem;
          border-radius: 0.75rem;
          border: 2px solid;
        }

        .outcome-item.success {
          background: #dcfce7;
          border-color: #86efac;
        }

        .outcome-item.pending {
          background: #fef3c7;
          border-color: #fde68a;
        }

        .outcome-item.cancelled {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .outcome-item.failed {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .outcome-icon {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .outcome-value {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 0.25rem;
        }

        .outcome-item.success .outcome-value { color: #166534; }
        .outcome-item.pending .outcome-value { color: #92400e; }
        .outcome-item.cancelled .outcome-value { color: #6b7280; }
        .outcome-item.failed .outcome-value { color: #991b1b; }

        .outcome-label {
          font-size: 0.7rem;
          color: #6b7280;
          font-weight: 500;
        }

        .patterns-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .pattern-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          background: white;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
        }

        .pattern-rank {
          font-size: 0.9rem;
          font-weight: 700;
          color: #3b82f6;
          min-width: 2rem;
        }

        .pattern-text {
          flex: 1;
          font-size: 0.9rem;
          color: #374151;
          font-style: italic;
        }

        .pattern-count {
          font-size: 0.8rem;
          font-weight: 600;
          color: #6b7280;
          background: #f3f4f6;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
        }

        .insights-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .insight-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.875rem;
          border-radius: 0.75rem;
          border: 2px solid;
        }

        .insight-item.success {
          background: #dcfce7;
          border-color: #86efac;
        }

        .insight-item.info {
          background: #dbeafe;
          border-color: #93c5fd;
        }

        .insight-item.warning {
          background: #fef3c7;
          border-color: #fde68a;
        }

        .insight-icon {
          font-size: 1.25rem;
        }

        .insight-item p {
          margin: 0;
          font-size: 0.9rem;
          color: #374151;
          font-weight: 500;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }

        @media (max-width: 640px) {
          .analytics-modal {
            max-width: 100%;
            border-radius: 1.5rem 1.5rem 0 0;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .outcome-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .time-range-selector {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceCommandAnalytics;
