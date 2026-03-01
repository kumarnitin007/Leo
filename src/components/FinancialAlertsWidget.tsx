/**
 * Financial Alerts Widget
 * 
 * Displays a cached summary of financial alerts on the home page.
 * The cache is updated when user opens Safe's Financial tab.
 * No sensitive data is stored - only counts and summaries.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

// Cached summary stored by BankDashboard (non-sensitive)
export interface FinancialAlertsSummary {
  updatedAt: string;
  netWorth: number;
  totalInvested: number;
  totalMaturity: number;
  gainPercent: number;
  upcomingMaturities: number;
  urgentCount: number;
  warningCount: number;
  pendingBills: number;
  pendingActions: number;
  alerts: Array<{
    title: string;
    description: string;
    daysUntil: number;
    severity: 'urgent' | 'warning' | 'info';
    type: string;
  }>;
}

const CACHE_KEY = 'leo_financial_alerts_cache';

// Call this from BankDashboard to update cache
export function updateFinancialAlertsCache(summary: FinancialAlertsSummary) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(summary));
}

// Clear cache when Safe is locked
export function clearFinancialAlertsCache() {
  localStorage.removeItem(CACHE_KEY);
}

function getFinancialAlertsCache(): FinancialAlertsSummary | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached) as FinancialAlertsSummary;
    // Check if cache is less than 24 hours old
    const cacheAge = Date.now() - new Date(data.updatedAt).getTime();
    if (cacheAge > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

interface FinancialAlertsWidgetProps {
  onNavigateToSafe?: () => void;
}

function formatAmount(n: number): string {
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1) + 'Cr';
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return '₹' + (n / 1000).toFixed(0) + 'K';
  return '₹' + n.toLocaleString();
}

const FinancialAlertsWidget: React.FC<FinancialAlertsWidgetProps> = ({
  onNavigateToSafe
}) => {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<FinancialAlertsSummary | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Load cached summary
    const cached = getFinancialAlertsCache();
    setSummary(cached);

    // Listen for updates
    const handleStorage = () => {
      setSummary(getFinancialAlertsCache());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Don't render if no cached summary
  if (!summary) {
    return null;
  }

  const { urgentCount, warningCount, alerts } = summary;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'urgent': return '#F85149';
      case 'warning': return '#D29922';
      default: return '#58A6FF';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'urgent': return 'rgba(248,81,73,0.1)';
      case 'warning': return 'rgba(210,153,34,0.1)';
      default: return 'rgba(88,166,255,0.1)';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'maturity': return '💰';
      case 'bill_due': return '📋';
      case 'action': return '⚡';
      case 'goal_milestone': return '🎯';
      default: return '💡';
    }
  };

  // Get top alert for collapsed view
  const topAlert = alerts.length > 0 ? alerts[0] : null;
  const alertSummary = topAlert 
    ? `${topAlert.title}${topAlert.daysUntil >= 0 ? ` in ${topAlert.daysUntil} days` : ''}`
    : summary.upcomingMaturities > 0 
      ? `${summary.upcomingMaturities} FD${summary.upcomingMaturities > 1 ? 's' : ''} maturing soon`
      : `${summary.pendingActions} pending actions`;

  return (
    <div 
      className="widget-card financial-alerts-widget"
      style={{
        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(245, 158, 11, 0.15) 100%)',
        borderRadius: '1rem',
        overflow: 'hidden',
        marginTop: '1.5rem',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)'
      }}
    >
      {/* Header - Collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏦</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>Financial Alerts</div>
            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)' }}>
              {alertSummary}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {urgentCount > 0 && (
            <span style={{
              background: '#dc2626',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 10
            }}>
              {urgentCount}
            </span>
          )}
          {warningCount > 0 && urgentCount === 0 && (
            <span style={{
              background: '#d97706',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 10
            }}>
              {warningCount}
            </span>
          )}
          <span style={{ 
            color: 'rgba(0,0,0,0.35)', 
            fontSize: 12,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}>▼</span>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ 
          background: 'rgba(255,255,255,0.4)',
          borderTop: '1px solid rgba(0,0,0,0.05)'
        }}>
          {/* Alerts List - Primary content */}
          {alerts.length > 0 ? (
            <div>
              {alerts.slice(0, 4).map((alert, i) => (
                <div 
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 16px',
                    borderBottom: i < Math.min(3, alerts.length - 1) ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    background: alert.severity === 'urgent' ? 'rgba(220,38,38,0.06)' : alert.severity === 'warning' ? 'rgba(217,119,6,0.06)' : 'transparent'
                  }}
                >
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    background: alert.type === 'maturity' ? 'rgba(220,38,38,0.1)' : alert.type === 'bill' ? 'rgba(217,119,6,0.1)' : 'rgba(59,130,246,0.1)',
                    flexShrink: 0
                  }}>
                    {getTypeIcon(alert.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 13, 
                      fontWeight: 600, 
                      color: '#1a1a2e',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)' }}>
                      {alert.description}
                    </div>
                  </div>
                  <div style={{ 
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    {alert.daysUntil >= 0 ? (
                      <div style={{ 
                        background: getSeverityColor(alert.severity),
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}>
                        {alert.daysUntil === 0 ? 'Today' : `${alert.daysUntil}d`}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)' }}>No date</div>
                    )}
                  </div>
                </div>
              ))}
              {alerts.length > 4 && (
                <div style={{ padding: '6px 16px', fontSize: 11, color: 'rgba(0,0,0,0.4)', textAlign: 'center' }}>
                  +{alerts.length - 4} more
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
              ✅ No upcoming actions
            </div>
          )}

          {/* Quick Stats - Secondary */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-around',
            padding: '10px 16px',
            borderTop: '1px solid rgba(0,0,0,0.05)',
            background: 'rgba(255,255,255,0.3)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{formatAmount(summary.totalInvested)}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase' }}>Invested</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#047857' }}>{formatAmount(summary.totalMaturity)}</div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase' }}>Maturity</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#b45309' }}>+{summary.gainPercent.toFixed(1)}%</div>
              <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase' }}>Gain</div>
            </div>
          </div>

          {/* View All Button */}
          {onNavigateToSafe && (
            <button
              onClick={onNavigateToSafe}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#b45309',
                color: '#fff',
                border: 'none',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Open Financial Dashboard →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FinancialAlertsWidget;
