import React, { useCallback, useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { BankDashboardTheme } from '../../bank/bankDashboardTheme';
import { fmt } from '../../bank/bankDashboardFormat';
import type { Currency } from '../../types/bankRecords';

export type ChartSlice = {
  name: string;
  value: number;
  color: string;
  otherDetails?: { name: string; value: number }[];
};

const PIE_TOP_N = 6;

function mergeSlices(data: ChartSlice[]): ChartSlice[] {
  const sorted = [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  if (sorted.length <= PIE_TOP_N) return sorted;
  const top = sorted.slice(0, PIE_TOP_N);
  const rest = sorted.slice(PIE_TOP_N);
  const otherValue = rest.reduce((s, x) => s + x.value, 0);
  return [
    ...top,
    {
      name: `Other (${rest.length})`,
      value: otherValue,
      color: '#64748B',
      otherDetails: rest.map((r) => ({ name: r.name, value: r.value })),
    },
  ];
}

export interface BankDonutBarChartProps {
  theme: BankDashboardTheme;
  data: ChartSlice[];
  vizMode: 'donut' | 'bars';
  setVizMode: (m: 'donut' | 'bars') => void;
  currency: string;
  title: string;
  subtitle?: string;
  isMobile: boolean;
  showLabels?: boolean;
  legendKey?: string;
  showLegend: Set<string>;
  setShowLegend: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function BankDonutBarChart({
  theme: THEME,
  data,
  vizMode,
  setVizMode,
  currency,
  title,
  subtitle,
  isMobile,
  showLabels,
  legendKey,
  showLegend,
  setShowLegend,
}: BankDonutBarChartProps) {
  const merged = useMemo(() => mergeSlices(data), [data]);
  const barData = useMemo(() => [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)), [data]);
  const total = useMemo(() => data.reduce((s, e) => s + e.value, 0), [data]);
  const cur = currency as Currency;

  const donutHeight = isMobile ? 200 : 260;
  const innerR = isMobile ? 44 : 56;
  const outerR = isMobile ? 68 : 84;
  const barRowHeight = isMobile ? 30 : 34;

  const renderDonutLabel = useCallback(
    (props: { cx?: number; cy?: number; midAngle?: number; outerRadius?: number; name?: string; value?: number }) => {
      if (!showLabels) return null;
      const cx = Number(props.cx ?? 0);
      const cy = Number(props.cy ?? 0);
      const midAngle = Number(props.midAngle ?? 0);
      const outerRadius = Number(props.outerRadius ?? 0);
      const name = String(props.name ?? '');
      const value = Number(props.value ?? 0);
      const pct = total ? ((value / total) * 100).toFixed(0) : '0';
      if (Number(pct) < 3) return null;
      const RADIAN = Math.PI / 180;
      const radius = outerRadius + (isMobile ? 16 : 22);
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const shortName = name.length > 12 ? name.slice(0, 10) + '…' : name;
      return (
        <text x={x} y={y} fill={THEME.textLight} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={isMobile ? 8 : 9} fontWeight={600}>
          {shortName} {pct}%
        </text>
      );
    },
    [showLabels, total, THEME.textLight, isMobile],
  );

  const pieTooltip = useCallback(
    (props: { active?: boolean; payload?: ReadonlyArray<{ payload: ChartSlice }> }) => {
      if (!props.active || !props.payload?.length) return null;
      const p = props.payload[0].payload;
      const pct = total ? ((p.value / total) * 100).toFixed(1) : '0';
      return (
        <div style={{ padding: 8, minWidth: 160, maxWidth: 280 }}>
          <div style={{ fontWeight: 700, color: THEME.text, marginBottom: 4 }}>{p.name}</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{fmt(p.value, cur)}</div>
          <div style={{ fontSize: 11, color: THEME.textLight }}>{pct}% of total</div>
          {p.otherDetails && p.otherDetails.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 10, borderTop: `1px solid ${THEME.border}`, paddingTop: 6, maxHeight: 140, overflowY: 'auto' }}>
              {p.otherDetails.map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: THEME.textLight, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</span>
                  <span style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{fmt(row.value, cur)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    },
    [THEME, total, cur],
  );

  const barTooltip = useCallback(
    (props: { active?: boolean; payload?: ReadonlyArray<{ payload: { name: string; value: number } }> }) => {
      if (!props.active || !props.payload?.length) return null;
      const p = props.payload[0].payload;
      const pct = total ? ((p.value / total) * 100).toFixed(1) : '0';
      return (
        <div style={{ padding: 8, minWidth: 140 }}>
          <div style={{ fontWeight: 700, color: THEME.text }}>{p.name}</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{fmt(p.value, cur)}</div>
          <div style={{ fontSize: 11, color: THEME.textLight }}>{pct}%</div>
        </div>
      );
    },
    [THEME, total, cur],
  );

  const lKey = legendKey || 'chart';

  if (data.length === 0) return null;

  return (
    <div style={{ background: THEME.cardBg, borderRadius: isMobile ? 14 : 16, padding: isMobile ? '14px' : '16px 20px', border: `1px solid ${THEME.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: isMobile ? 12 : 13, fontWeight: 700, color: THEME.textLight }}>{title}</div>
          {subtitle && <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', gap: 2, background: THEME.cardBgAlt, borderRadius: 8, padding: 2, border: `1px solid ${THEME.border}` }}>
          <button type="button" onClick={() => setVizMode('donut')} style={{ border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: vizMode === 'donut' ? '#238636' : 'transparent', color: vizMode === 'donut' ? '#fff' : THEME.textMuted }}>Donut</button>
          <button type="button" onClick={() => setVizMode('bars')} style={{ border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', background: vizMode === 'bars' ? '#238636' : 'transparent', color: vizMode === 'bars' ? '#fff' : THEME.textMuted }}>Bars</button>
        </div>
      </div>

      {vizMode === 'donut' ? (
        <div style={{ position: 'relative', width: '100%', minHeight: donutHeight }}>
          <ResponsiveContainer width="100%" height={donutHeight}>
            <PieChart>
              <Pie
                data={merged}
                cx="50%"
                cy="48%"
                innerRadius={innerR}
                outerRadius={outerR}
                paddingAngle={2}
                dataKey="value"
                label={showLabels ? renderDonutLabel : false}
                labelLine={false}
                stroke="#111827"
                strokeWidth={1.5}
              >
                {merged.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip content={pieTooltip} wrapperStyle={{ outline: 'none' }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', maxWidth: isMobile ? 120 : 160 }}>
            <div style={{ fontSize: isMobile ? 9 : 10, color: THEME.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>Total</div>
            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, fontFamily: 'monospace', color: THEME.text, lineHeight: 1.2 }}>{fmt(total, cur)}</div>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.min(isMobile ? 420 : 520, Math.max(isMobile ? 180 : 240, barData.length * barRowHeight))}>
          <BarChart data={barData} layout="vertical" margin={{ left: isMobile ? 4 : 8, right: isMobile ? 12 : 24, top: isMobile ? 4 : 8, bottom: isMobile ? 4 : 8 }} barSize={isMobile ? 16 : 20}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.border} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: isMobile ? 9 : 11, fill: THEME.textMuted }} tickFormatter={(v) => fmt(Number(v), cur)} />
            <YAxis type="category" dataKey="name" width={isMobile ? 92 : 132} tick={{ fontSize: isMobile ? 9 : 11, fill: THEME.text }} interval={0} tickFormatter={(v: string) => (v.length > (isMobile ? 14 : 22) ? `${v.slice(0, isMobile ? 12 : 20)}…` : v)} />
            <Tooltip content={barTooltip} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {barData.map((e, i) => (
                <Cell key={i} fill={e.color} stroke="#111827" strokeWidth={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <p style={{ fontSize: isMobile ? 9 : 10, color: THEME.textMuted, marginTop: isMobile ? 8 : 10, lineHeight: 1.45, marginBottom: 0 }}>
        {vizMode === 'donut'
          ? `Donut shows top ${PIE_TOP_N} by balance; smaller items roll into "Other". Hover a slice for details.`
          : 'Bar chart lists every item — best for reading names.'}
      </p>

      <button
        type="button"
        onClick={() =>
          setShowLegend((prev) => {
            const next = new Set(prev);
            if (next.has(lKey)) next.delete(lKey);
            else next.add(lKey);
            return next;
          })
        }
        style={{ marginTop: 10, background: THEME.cardBgAlt, border: `1px solid ${THEME.border}`, color: THEME.textLight, padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: showLegend.has(lKey) ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
        All items ({data.length})
      </button>
      {showLegend.has(lKey) && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.map((entry, i) => {
            const pct = total ? ((entry.value / total) * 100).toFixed(1) : '0';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 4px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 10, color: THEME.textLight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: THEME.text, whiteSpace: 'nowrap' }}>{fmt(entry.value, cur)}</span>
                <span style={{ fontSize: 9, color: THEME.textMuted, whiteSpace: 'nowrap' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
