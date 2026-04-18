/**
 * ImportReviewModal — shows old vs new account/deposit mapping
 * after Excel import, before applying changes.
 */
import React, { useState, useMemo } from 'react';
import type { ImportDiffSummary, ImportDiffItem, DiffAction } from '../../bank/importMergeEngine';

export { type ImportDiffSummary, type ImportDiffItem, type DiffAction };

interface Props {
  diff: ImportDiffSummary;
  onApprove: () => void;
  onCancel: () => void;
  formatAmount: (n: number, cur?: string) => string;
}

const SECTION_CONFIG: { key: DiffAction; label: string; icon: string; color: string; bg: string; border: string }[] = [
  { key: 'update',    label: 'Updated',    icon: '✏️', color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  { key: 'add',       label: 'New',        icon: '➕', color: '#065f46', bg: '#f0fdf4', border: '#a7f3d0' },
  { key: 'delete',    label: 'Deleted',    icon: '🗑️', color: '#991b1b', bg: '#fef2f2', border: '#fecaca' },
  { key: 'unchanged', label: 'No Change',  icon: '✅', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
];

export default function ImportReviewModal({ diff, onApprove, onCancel, formatAmount }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<DiffAction>>(new Set(['unchanged']));

  const grouped = useMemo(() => {
    const groups: Record<DiffAction, ImportDiffItem[]> = { add: [], update: [], delete: [], unchanged: [] };
    diff.items.forEach(item => groups[item.action].push(item));
    return groups;
  }, [diff.items]);

  const toggleSection = (key: DiffAction) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const sectionValueImpactForAction = (action: DiffAction): number => {
    if (action === 'add') return diff.addedValue;
    if (action === 'delete') return -diff.deletedValue;
    if (action === 'update') return diff.updatedValueDelta;
    return 0;
  };

  const hasChanges = diff.totalAdded > 0 || diff.totalUpdated > 0 || diff.totalDeleted > 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
            Review Import Changes
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
            Review the changes below before applying. Nothing is saved until you click "Apply Changes".
          </div>

          {/* Net impact banner */}
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 10,
            background: diff.netValueImpact >= 0 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${diff.netValueImpact >= 0 ? '#a7f3d0' : '#fecaca'}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 24, lineHeight: 1 }}>
              {diff.netValueImpact > 0 ? '📈' : diff.netValueImpact < 0 ? '📉' : '➡️'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: diff.netValueImpact >= 0 ? '#065f46' : '#991b1b' }}>
                Net Portfolio Impact: {diff.netValueImpact >= 0 ? '+' : ''}{formatAmount(diff.netValueImpact, diff.primaryCurrency)}
                {diff.primaryCurrency !== 'INR' && (
                  <span style={{ fontWeight: 500, color: '#6b7280', marginLeft: 8, fontSize: 11 }}>
                    ({diff.netValueImpactINR >= 0 ? '+' : ''}{formatAmount(diff.netValueImpactINR, 'INR')})
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {diff.addedValue > 0 && <span style={{ color: '#065f46' }}>New: +{formatAmount(diff.addedValue, diff.primaryCurrency)}</span>}
                {diff.updatedValueDelta !== 0 && <span style={{ color: diff.updatedValueDelta >= 0 ? '#065f46' : '#991b1b' }}>Updates: {diff.updatedValueDelta >= 0 ? '+' : ''}{formatAmount(diff.updatedValueDelta, diff.primaryCurrency)}</span>}
                {diff.deletedValue > 0 && <span style={{ color: '#991b1b' }}>Deleted: -{formatAmount(diff.deletedValue, diff.primaryCurrency)}</span>}
              </div>
            </div>
          </div>

          {/* Summary badges */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {SECTION_CONFIG.map(s => {
              const count = s.key === 'add' ? diff.totalAdded : s.key === 'update' ? diff.totalUpdated : s.key === 'delete' ? diff.totalDeleted : diff.totalUnchanged;
              if (count === 0) return null;
              return (
                <span key={s.key} style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 16, fontSize: 10, fontWeight: 700, border: `1px solid ${s.border}` }}>
                  {s.icon} {count} {s.label.toLowerCase()}
                </span>
              );
            })}
            <span style={{ background: '#f3f4f6', color: '#374151', padding: '3px 10px', borderRadius: 16, fontSize: 10, fontWeight: 600 }}>
              {diff.totalAccounts} accts · {diff.totalDeposits} deps · {diff.totalBills} bills · {diff.totalActions} actions
            </span>
          </div>
        </div>

        {/* ── Sections ── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 24px 16px' }}>
          {SECTION_CONFIG.map(({ key, label, icon, color, bg, border }) => {
            const items = grouped[key];
            if (items.length === 0) return null;
            const collapsed = collapsedSections.has(key);
            const impact = sectionValueImpactForAction(key);

            return (
              <div key={key} style={{ marginBottom: 10 }}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 10, border: `1px solid ${border}`,
                    background: bg, cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color, flex: 1 }}>
                    {label} ({items.length})
                  </span>
                  {impact !== 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: impact >= 0 ? '#065f46' : '#991b1b' }}>
                      {impact >= 0 ? '▲' : '▼'} {formatAmount(Math.abs(impact), diff.primaryCurrency)}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: '#9ca3af', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                </button>

                {/* Items */}
                {!collapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, paddingLeft: 8 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        borderRadius: 8, border: `1px solid ${border}40`,
                        background: '#fff',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{item.name}</span>
                            <span style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{item.type}</span>
                            {item.accountType && <span style={{ fontSize: 9, color: '#6b7280' }}>· {item.accountType}</span>}
                          </div>
                          {(item.bank || item.details) && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                              {item.bank}{item.details ? ` · ${item.details}` : ''}
                            </div>
                          )}
                        </div>

                        {(item.oldAmount != null || item.newAmount != null) && (
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {key === 'update' && item.oldAmount != null && item.newAmount != null ? (
                              item.oldAmount === item.newAmount ? (
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                                  {formatAmount(item.newAmount, item.currency)}
                                </div>
                              ) : (
                                <>
                                  <div style={{ fontSize: 9, color: '#9ca3af', textDecoration: 'line-through' }}>
                                    {formatAmount(item.oldAmount, item.currency)}
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: item.newAmount > item.oldAmount ? '#10B981' : '#EF4444' }}>
                                    {formatAmount(item.newAmount, item.currency)}
                                  </div>
                                  <div style={{ fontSize: 8, color: item.newAmount >= item.oldAmount ? '#10B981' : '#EF4444', fontWeight: 600 }}>
                                    {item.newAmount >= item.oldAmount ? '▲' : '▼'} {formatAmount(Math.abs(item.newAmount - item.oldAmount), item.currency)}
                                  </div>
                                </>
                              )
                            ) : key === 'unchanged' ? (
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280' }}>
                                {formatAmount(item.newAmount ?? item.oldAmount ?? 0, item.currency)}
                              </div>
                            ) : key === 'delete' ? (
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#EF4444', textDecoration: 'line-through' }}>
                                {formatAmount(item.oldAmount ?? 0, item.currency)}
                              </div>
                            ) : (
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46' }}>
                                {formatAmount(item.newAmount ?? item.oldAmount ?? 0, item.currency)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#3b82f6' }} />
            <span style={{ fontSize: 11, color: '#374151' }}>
              I've reviewed the changes ({diff.totalAdded + diff.totalUpdated + diff.totalDeleted} changes, {diff.totalUnchanged} unchanged)
            </span>
          </label>
          <button onClick={onCancel} style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db',
            background: '#fff', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={onApprove} disabled={!confirmed || !hasChanges} style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: confirmed && hasChanges ? '#10B981' : '#d1d5db', color: '#fff',
            fontWeight: 700, fontSize: 12, cursor: confirmed && hasChanges ? 'pointer' : 'not-allowed',
          }}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
