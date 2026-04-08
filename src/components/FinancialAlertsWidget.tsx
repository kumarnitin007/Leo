/**
 * Financial Alerts Widget
 * 
 * Displays a cached summary of financial alerts on the home page.
 * The cache is updated when user opens Safe's Financial tab.
 * No sensitive data is stored - only counts and summaries.
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

/** One cached alert row (home dashboard preview; amounts may appear in description) */
export interface CachedFinancialAlert {
  title: string;
  description: string;
  daysUntil: number;
  severity: 'urgent' | 'warning' | 'info';
  type: string;
  /** Bank / institution name when relevant */
  bankName?: string;
  /** Bill / subscription name (bills) */
  billName?: string;
  /** FD product line: type · duration · id */
  fdDetail?: string;
  /** Row type label: Account | Deposit | Bill */
  kindLabel?: string;
  /** Due date column (formatted) */
  dueDateLabel?: string;
  /** Amount column (formatted) */
  amountLabel?: string;
}

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
  alerts: CachedFinancialAlert[];
}

/** Preview layouts on home — pick one to keep later; stored in localStorage */
export type FinancialAlertsLayoutMode =
  | 'standard'
  | 'bankFirst'
  | 'table'
  | 'oneLine';

const CACHE_KEY = 'leo_financial_alerts_cache';
const LAYOUT_MODE_KEY = 'leo_financial_alerts_layout_mode';

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

function getLayoutMode(): FinancialAlertsLayoutMode {
  try {
    const v = localStorage.getItem(LAYOUT_MODE_KEY) as FinancialAlertsLayoutMode | null;
    if (v === 'standard' || v === 'bankFirst' || v === 'table' || v === 'oneLine') return v;
    if (v === 'typeTags') return 'table';
  } catch {
    /* ignore */
  }
  return 'standard';
}

function persistLayoutModePreference(mode: FinancialAlertsLayoutMode) {
  try {
    localStorage.setItem(LAYOUT_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function fallbackKindLabel(alert: CachedFinancialAlert): string {
  if (alert.kindLabel) return alert.kindLabel;
  if (alert.type === 'maturity') return 'Deposit';
  if (alert.type === 'bill' || alert.type === 'bill_due') return 'Bill';
  return 'Account';
}

interface FinancialAlertsWidgetProps {
  onNavigateToSafe?: () => void;
}

const LAYOUT_OPTIONS: { id: FinancialAlertsLayoutMode; label: string; hint: string }[] = [
  { id: 'standard', label: 'A · Standard', hint: 'Title + detail' },
  { id: 'bankFirst', label: 'B · Bank first', hint: 'Bank / bill name on top' },
  { id: 'table', label: 'C · Table', hint: 'Bank · Task · Amount · Due' },
  { id: 'oneLine', label: 'D · One line', hint: 'Compact' },
];

const FinancialAlertsWidget: React.FC<FinancialAlertsWidgetProps> = ({
  onNavigateToSafe
}) => {
  const { theme } = useTheme();
  const isWP = theme.id === 'warm-paper';
  const [summary, setSummary] = useState<FinancialAlertsSummary | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [layoutMode, setLayoutModeState] = useState<FinancialAlertsLayoutMode>(() =>
    typeof window !== 'undefined' ? getLayoutMode() : 'standard'
  );
  /** When list is long, show 4 until user expands */
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const applyLayoutMode = (mode: FinancialAlertsLayoutMode) => {
    setLayoutModeState(mode);
    persistLayoutModePreference(mode);
  };

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

  useEffect(() => {
    if (!expanded) setShowAllAlerts(false);
  }, [expanded]);

  // Don't render if no cached summary
  if (!summary) {
    return null;
  }

  const { urgentCount, warningCount, alerts } = summary;
  const visibleAlerts = showAllAlerts || alerts.length <= 4 ? alerts : alerts.slice(0, 4);
  const hiddenCount = alerts.length > 4 ? alerts.length - 4 : 0;

  const primaryIdentifier = (a: CachedFinancialAlert) =>
    (a.bankName && a.bankName.trim()) ||
    (a.billName && a.billName.trim()) ||
    (a.fdDetail && a.fdDetail.trim()) ||
    '';

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

  const renderDaysBadge = (alert: CachedFinancialAlert) => {
    if (alert.daysUntil >= 0) {
      return (
        <div
          style={{
            background: getSeverityColor(alert.severity),
            color: '#fff',
            padding: '3px 10px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {alert.daysUntil === 0 ? 'Today' : `${alert.daysUntil}d`}
        </div>
      );
    }
    return (
      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)' }}>No date</div>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'maturity': return '💰';
      case 'bill_due':
      case 'bill': return '📋';
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
        background: isWP ? '#fff' : 'linear-gradient(135deg, rgba(251, 191, 36, 0.25) 0%, rgba(245, 158, 11, 0.15) 100%)',
        borderRadius: isWP ? '12px' : '1rem',
        overflow: 'hidden',
        marginTop: isWP ? '0.75rem' : '1.5rem',
        border: isWP ? '1px solid #e8e5e0' : '1px solid rgba(245, 158, 11, 0.2)',
        boxShadow: isWP ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.1)'
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
              background: isWP ? 'transparent' : '#dc2626',
              color: isWP ? '#d32f2f' : '#fff',
              border: isWP ? '1.5px solid #d32f2f' : 'none',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: isWP ? 4 : 10
            }}>
              {urgentCount}
            </span>
          )}
          {warningCount > 0 && urgentCount === 0 && (
            <span style={{
              background: isWP ? 'transparent' : '#d97706',
              color: isWP ? '#1a1a1a' : '#fff',
              border: isWP ? '1.5px solid #1a1a1a' : 'none',
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: isWP ? 4 : 10
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
          {/* Layout preview selector — compare A–D, then remove extras once you pick */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              background: 'rgba(255,255,255,0.5)',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(0,0,0,0.45)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Preview layout — tap one to compare
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {LAYOUT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.hint}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    applyLayoutMode(opt.id);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: layoutMode === opt.id ? '2px solid #b45309' : '1px solid rgba(0,0,0,0.12)',
                    background: layoutMode === opt.id ? 'rgba(180,83,9,0.12)' : 'rgba(255,255,255,0.8)',
                    fontSize: 11,
                    fontWeight: layoutMode === opt.id ? 700 : 500,
                    color: '#1a1a2e',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Alerts List - Primary content */}
          {alerts.length > 0 ? (
            <div>
              {layoutMode === 'table' && (
                <div
                  style={{
                    padding: '6px 12px',
                    borderBottom: '1px solid rgba(0,0,0,0.08)',
                    background: 'rgba(255,255,255,0.55)',
                    overflowX: 'auto',
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '72px minmax(80px,1fr) minmax(100px,1.4fr) minmax(72px,1fr) minmax(100px,1.1fr)',
                      gap: 8,
                      alignItems: 'center',
                      fontSize: 9,
                      fontWeight: 700,
                      color: 'rgba(0,0,0,0.45)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      minWidth: 320,
                    }}
                  >
                    <span>Type</span>
                    <span>Bank</span>
                    <span>Task</span>
                    <span>Amount</span>
                    <span style={{ textAlign: 'right' }}>Due</span>
                  </div>
                </div>
              )}
              {visibleAlerts.map((alert, i) => {
                const hasDividerBelow = i < visibleAlerts.length - 1;
                const rowBg =
                  alert.severity === 'urgent'
                    ? 'rgba(220,38,38,0.06)'
                    : alert.severity === 'warning'
                      ? 'rgba(217,119,6,0.06)'
                      : 'transparent';
                const iconBg =
                  alert.type === 'maturity'
                    ? 'rgba(220,38,38,0.1)'
                    : alert.type === 'bill'
                      ? 'rgba(217,119,6,0.1)'
                      : 'rgba(59,130,246,0.1)';
                const kind = fallbackKindLabel(alert);
                const idLine = primaryIdentifier(alert);

                if (layoutMode === 'bankFirst') {
                  const topLine = alert.bankName?.trim() || alert.billName?.trim() || (alert.type === 'maturity' ? alert.fdDetail?.split('·')[0]?.trim() : '') || '—';
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '10px 16px',
                        borderBottom: hasDividerBelow ? '1px solid rgba(0,0,0,0.05)' : 'none',
                        background: rowBg,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 14,
                          background: iconBg,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        {getTypeIcon(alert.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f766e', marginBottom: 2 }}>{topLine}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', lineHeight: 1.35 }}>{alert.title}</div>
                        <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)', marginTop: 2 }}>
                          {[alert.fdDetail, alert.description].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>{renderDaysBadge(alert)}</div>
                    </div>
                  );
                }

                if (layoutMode === 'table') {
                  const bankCol =
                    alert.bankName?.trim() ||
                    alert.billName?.trim() ||
                    '—';
                  const taskCol = alert.title?.trim() || '—';
                  const amountCol =
                    alert.amountLabel?.trim() ||
                    (alert.type === 'action' && !alert.amountLabel ? '—' : alert.description?.trim()) ||
                    '—';
                  const dueText =
                    alert.dueDateLabel?.trim() ||
                    (alert.daysUntil >= 0
                      ? alert.daysUntil === 0
                        ? 'Today'
                        : `${alert.daysUntil}d`
                      : '');
                  return (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderBottom: hasDividerBelow ? '1px solid rgba(0,0,0,0.06)' : 'none',
                        background: rowBg,
                        overflowX: 'auto',
                      }}
                    >
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '72px minmax(80px,1fr) minmax(100px,1.4fr) minmax(72px,1fr) minmax(100px,1.1fr)',
                          gap: 8,
                          alignItems: 'center',
                          fontSize: 11,
                          minWidth: 320,
                        }}
                      >
                        <span style={{ fontWeight: 700, color: getSeverityColor(alert.severity), fontSize: 10 }}>
                          {kind}
                        </span>
                        <span style={{ fontWeight: 600, color: '#0f766e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bankCol}>
                          {bankCol}
                        </span>
                        <span style={{ color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={taskCol}>
                          {taskCol}
                        </span>
                        <span style={{ fontFamily: 'monospace', color: '#374151', fontSize: 10 }} title={amountCol}>
                          {amountCol}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                          {dueText ? <span style={{ color: '#57534e', fontSize: 10 }}>{dueText}</span> : null}
                          {renderDaysBadge(alert)}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (layoutMode === 'oneLine') {
                  const parts = [
                    kind,
                    alert.bankName?.trim(),
                    alert.billName?.trim(),
                    alert.fdDetail?.trim(),
                    alert.title?.trim(),
                  ].filter(Boolean) as string[];
                  const uniq: string[] = [];
                  parts.forEach((p) => {
                    if (!uniq.some((u) => u === p)) uniq.push(p);
                  });
                  const line = uniq.join(' · ');
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderBottom: hasDividerBelow ? '1px solid rgba(0,0,0,0.05)' : 'none',
                        background: rowBg,
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }}>{getTypeIcon(alert.type)}</span>
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                          fontWeight: 500,
                          color: '#1a1a2e',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={line}
                      >
                        {line}
                      </div>
                      {renderDaysBadge(alert)}
                    </div>
                  );
                }

                /* standard */
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 16px',
                      borderBottom: hasDividerBelow ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      background: rowBg,
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                        background: iconBg,
                        flexShrink: 0,
                      }}
                    >
                      {getTypeIcon(alert.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#1a1a2e',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {alert.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.55)', lineHeight: 1.35 }}>
                        {alert.type === 'maturity' && (alert.bankName || alert.fdDetail) ? (
                          <>
                            <span style={{ fontWeight: 600, color: '#0f766e' }}>
                              {[alert.bankName, alert.fdDetail].filter(Boolean).join(' · ')}
                            </span>
                            {alert.description ? <span>{' · '}{alert.description}</span> : null}
                          </>
                        ) : alert.type === 'bill' && alert.billName ? (
                          <>
                            <span style={{ fontWeight: 600, color: '#0f766e' }}>{alert.billName}</span>
                            {alert.description ? <span>{' · '}{alert.description}</span> : null}
                          </>
                        ) : (
                          <>
                            {alert.bankName ? (
                              <span style={{ fontWeight: 600, color: '#0f766e' }}>{alert.bankName}</span>
                            ) : null}
                            {alert.bankName && alert.description ? ' · ' : null}
                            {alert.description}
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>{renderDaysBadge(alert)}</div>
                  </div>
                );
              })}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAllAlerts((v) => !v);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 16px 10px',
                    border: 'none',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                    background: 'rgba(255,255,255,0.35)',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#b45309',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  {showAllAlerts ? 'Show less' : `+${hiddenCount} more — tap to expand`}
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
              ✅ No upcoming actions
            </div>
          )}

          {/* View All Button */}
          {onNavigateToSafe && (
            <button
              onClick={onNavigateToSafe}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderTop: '1px solid rgba(0,0,0,0.08)',
                background: '#b45309',
                color: '#fff',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
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
