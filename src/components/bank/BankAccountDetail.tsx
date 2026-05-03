/**
 * BankAccountDetail — full-screen / split-panel account detail view.
 *
 * Spec:  docs/redesign/VAULT_ACCOUNTS_CURSOR_PROMPT.md
 * Mocks: docs/redesign/Mobile Account 1.png, Mobile Account 2.png
 *
 * Pure presentation: receives the entire account list + selected index from
 * BankDashboard and re-renders. No data fetching here.
 *
 * Mobile: full-screen; swipe left/right navigates to next/prev account.
 * Desktop: 2-column with a fixed sidebar listing all accounts grouped into
 *          Assets / Liabilities + a net-worth footer.
 */
import React, { useMemo, useRef, useCallback } from 'react';
import type { BankAccount, Currency } from '../../types/bankRecords';
import { CURRENCY_SYMBOLS } from '../../bank/bankDashboardConstants';
import { convertCurrency, daysSinceUpdated } from '../../bank/bankDashboardFormat';
import {
  lookupInstitutionMeta,
  sectorIcon,
  sectorChipColor,
  type InstitutionMeta,
} from '../../bank/institutionMeta';
import { perfStart } from '../../utils/perfLogger';

const TOKENS = {
  activeBorder: '#1D9E75',
  tealFill: '#1D9E75',
  redFill: '#EF4444',
  liabilityText: '#A32D2D',
  positiveText: '#0F6E56',
  timelineBg: '#FAEEDA',
  timelineText: '#854F0B',
  timelineSub: '#AA7020',
  overdueBg: '#FCEBEB',
  overdueText: '#A32D2D',
  creditBg: '#E1F5EE',
  debitBg: '#FCEBEB',
  retirementChipBg: '#E1F5EE',
  retirementChipText: '#0F6E56',
  mortgageChipBg: '#FAEEDA',
  mortgageChipText: '#854F0B',
  liabilityChipBg: '#FCEBEB',
  liabilityChipText: '#A32D2D',
  darkBtn: '#1D1D1D',
  paper: '#FFFFFF',
  paperAlt: '#FAFAF9',
  border: '#E5E7EB',
  borderSoft: '#EEF0F3',
  tertiaryText: '#9CA3AF',
  secondaryText: '#6B7280',
  primaryText: '#111827',
} as const;

const LIABILITY_TYPES = new Set(['Credit Card', 'Loan']);
const isLiabilityAcc = (a: BankAccount): boolean =>
  (Number(a.amount) || 0) < 0 || LIABILITY_TYPES.has(a.type || '');

interface BankAccountDetailProps {
  accounts: BankAccount[];
  selectedIdx: number;
  onClose: () => void;
  onEdit: (idx: number) => void;
  onSelectIdx: (idx: number) => void;
  onUpdateBalance?: (idx: number) => void;
  fmt: (n: number | string | null | undefined, currency?: Currency) => string;
  fmtFull: (n: number | string | null | undefined, currency?: Currency) => string;
  fmtDate: (s: string | null | undefined) => string;
  getBankColor: (bank: string) => string;
  displayCurrency: 'ORIGINAL' | Currency;
  exchangeRates: { USD: number; EUR: number; GBP: number };
  isMobile: boolean;
}

const BankAccountDetail: React.FC<BankAccountDetailProps> = ({
  accounts,
  selectedIdx,
  onClose,
  onEdit,
  onSelectIdx,
  onUpdateBalance,
  fmt,
  fmtFull,
  fmtDate,
  getBankColor,
  displayCurrency,
  exchangeRates,
  isMobile,
}) => {
  // ── Perf tracking ──────────────────────────────────────────────
  // We record TWO separate timings:
  //   1. `render` — measured synchronously around this function call (cheap, true render time).
  //   2. `view duration idx=N` — bookended by useEffect cleanup; reflects how long the
  //      user dwelt on a given account before switching away. This is *not* a render
  //      cost; it shows up in console as a high number for the previously-viewed
  //      account when the user navigates. Renamed from the old misleading "render idx=N".
  const renderStart = perfStart('BankAccountDetail', 'render');
  const endViewPerf = useMemo(
    () => perfStart('BankAccountDetail', `view duration idx=${selectedIdx}`),
    [selectedIdx],
  );

  // ── Ordering: assets (visible) → liabilities, sorted within group by amount in
  //    the user's display currency (so a $5 000 USD account ranks above a ₹10 000
  //    INR account). Falls back to raw number when displayCurrency==='ORIGINAL'.
  const ordered = useMemo<{ idx: number; acc: BankAccount; isLiability: boolean }[]>(() => {
    const target = (displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency) as Currency;
    const valueIn = (acc: BankAccount): number => {
      const raw = Math.abs(Number(acc.amount) || 0);
      const cur = (acc.currency && CURRENCY_SYMBOLS[acc.currency as Currency]) ? (acc.currency as Currency) : 'INR';
      return convertCurrency(raw, cur, target, exchangeRates);
    };
    const indexed = accounts.map((acc, idx) => ({ idx, acc, isLiability: isLiabilityAcc(acc) }));
    const visible = indexed.filter(({ acc }) => !acc.hidden);
    visible.sort((a, b) => {
      if (a.isLiability !== b.isLiability) return a.isLiability ? 1 : -1;
      return valueIn(b.acc) - valueIn(a.acc);
    });
    return visible;
  }, [accounts, displayCurrency, exchangeRates]);

  const orderedPos = useMemo(
    () => ordered.findIndex((o) => o.idx === selectedIdx),
    [ordered, selectedIdx],
  );

  const account = accounts[selectedIdx];

  // Sub-accounts at same institution (other accounts with same `bank`)
  const subAccounts = useMemo(() => {
    if (!account?.bank) return [] as { idx: number; acc: BankAccount }[];
    return accounts
      .map((a, i) => ({ idx: i, acc: a }))
      .filter(({ acc }) => acc.bank === account.bank);
  }, [accounts, account?.bank]);

  // Net-worth footer for sidebar (in displayCurrency, falling back to INR for ORIGINAL)
  const netWorth = useMemo(() => {
    const target = (displayCurrency === 'ORIGINAL' ? 'INR' : displayCurrency) as Currency;
    let total = 0;
    accounts.forEach((acc) => {
      if (acc.hidden) return;
      const cur = (acc.currency && CURRENCY_SYMBOLS[acc.currency as Currency]) ? acc.currency as Currency : 'INR';
      total += convertCurrency(Number(acc.amount) || 0, cur, target, exchangeRates);
    });
    return { total, currency: target };
  }, [accounts, displayCurrency, exchangeRates]);

  // ── Swipe (mobile only) ───────────────────────────────────────────────────
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
      if (Math.abs(deltaX) < 50 || deltaY > Math.abs(deltaX)) return;
      if (deltaX < 0 && orderedPos < ordered.length - 1) onSelectIdx(ordered[orderedPos + 1].idx);
      if (deltaX > 0 && orderedPos > 0) onSelectIdx(ordered[orderedPos - 1].idx);
    },
    [ordered, orderedPos, onSelectIdx],
  );

  React.useEffect(() => () => endViewPerf(), [endViewPerf]);
  React.useEffect(() => { renderStart(); });

  if (!account) return null;

  const currency: Currency =
    (account.currency && CURRENCY_SYMBOLS[account.currency as Currency])
      ? (account.currency as Currency)
      : 'INR';
  const meta = lookupInstitutionMeta(account.bank, account.type);
  const brand = meta.brandColor || getBankColor(account.bank);
  const isLiability = isLiabilityAcc(account);
  const amount = Number(account.amount) || 0;
  const stale = daysSinceUpdated(account.lastBalanceUpdatedAt) ?? null;
  const prev = orderedPos > 0 ? ordered[orderedPos - 1] : null;
  const next = orderedPos < ordered.length - 1 ? ordered[orderedPos + 1] : null;

  /* ─────────── Sub-components ─────────── */

  const AccountChips = ({ meta }: { meta: InstitutionMeta }) => {
    const sectorChip = sectorChipColor(meta);
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 }}>
        {account.type && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 999,
              background: sectorChip.bg,
              color: sectorChip.text,
            }}
          >
            {sectorIcon(meta)} {account.type}
          </span>
        )}
        {isLiability && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 999,
              background: TOKENS.liabilityChipBg,
              color: TOKENS.liabilityChipText,
            }}
          >
            Liability
          </span>
        )}
        {account.online && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '3px 9px',
              borderRadius: 999,
              background: '#EEF2FF',
              color: '#3730A3',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            🌐 {account.online}
          </span>
        )}
        {!account.done && account.nextAction && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 999,
              background: '#FEF3C7',
              color: '#92400E',
            }}
          >
            ⚡ Action pending
          </span>
        )}
        {!isLiability && !account.done && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              padding: '3px 9px',
              borderRadius: 999,
              background: TOKENS.retirementChipBg,
              color: TOKENS.retirementChipText,
            }}
          >
            Active
          </span>
        )}
      </div>
    );
  };

  const Avatar = ({ size = 44 }: { size?: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: brand,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        fontWeight: 700,
        flexShrink: 0,
        textTransform: 'uppercase',
      }}
    >
      {(account.bank || '?').slice(0, 1)}
    </div>
  );

  const HeroCard = () => {
    const ytd = computeYTDChange(account);
    const balanceLabel = isLiability ? 'Outstanding balance' : 'Current balance';
    return (
      <div
        style={{
          background: TOKENS.paper,
          border: `0.5px solid ${TOKENS.border}`,
          borderRadius: 14,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Avatar size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.primaryText }}>
                {meta.displayName || account.bank}
              </div>
              <div style={{ fontSize: 11, color: TOKENS.secondaryText }}>
                {(meta.sector ? meta.sector.charAt(0).toUpperCase() + meta.sector.slice(1) : 'Account')}
                {subAccounts.length > 1 ? ` · ${subAccounts.length} accounts` : ' · 1 account'}
              </div>
              <AccountChips meta={meta} />
            </div>
          </div>

          <div
            style={{
              fontSize: isMobile ? 24 : 28,
              fontWeight: 500,
              color: isLiability ? TOKENS.liabilityText : TOKENS.primaryText,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.01em',
            }}
          >
            {fmtFull(account.amount, currency)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: TOKENS.secondaryText }}>{balanceLabel}</span>
            {ytd != null && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: ytd >= 0 ? TOKENS.positiveText : TOKENS.liabilityText,
                }}
              >
                {ytd >= 0 ? '+' : ''}
                {ytd.toFixed(2)}% YTD
              </span>
            )}
            {stale != null && (
              <span style={{ fontSize: 11, color: TOKENS.tertiaryText }}>
                · Updated {stale === 0 ? 'today' : `${stale}d ago`}
              </span>
            )}
          </div>
        </div>

        {/* 3-cell stat row, type-aware */}
        <StatRow account={account} meta={meta} fmt={fmt} fmtFull={fmtFull} currency={currency} isLiability={isLiability} />
      </div>
    );
  };

  const TimelineBadge = () => {
    const lockYear = parseLockYear(account);
    if (lockYear == null) return null;
    const yearsLeft = Math.max(0, lockYear - new Date().getFullYear());
    return (
      <div
        style={{
          background: TOKENS.timelineBg,
          borderRadius: 10,
          padding: '10px 12px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 16 }}>⚡</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: TOKENS.timelineText }}>
            {isLiability ? 'Loan ends' : 'Locked till'} {lockYear}
          </div>
          <div style={{ fontSize: 10, color: TOKENS.timelineSub }}>
            {yearsLeft} year{yearsLeft === 1 ? '' : 's'} remaining
            {!isLiability && account.type?.toUpperCase().includes('401') && ' · early withdrawal penalty applies'}
          </div>
        </div>
      </div>
    );
  };

  const ProgressCard = () => {
    if (isLiability) {
      const progress = computeLoanRepaymentProgress(account);
      if (!progress) return null;
      return (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.primaryText }}>Repayment progress</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.liabilityText }}>{progress.pct}% paid</span>
          </div>
          <ProgressBar pct={progress.pct} fill={TOKENS.redFill} />
          <FooterTriple>
            <FooterCell label="Paid so far" value={fmt(progress.paid, currency)} />
            <FooterCell label="Remaining" value={fmt(progress.remaining, currency)} />
            <FooterCell label="Total loan" value={fmt(progress.original, currency)} />
          </FooterTriple>
        </Card>
      );
    }
    const goal = computeGoalProgress(account);
    if (!goal) return null;
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.primaryText }}>
            Goal progress to {goal.targetYear}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: TOKENS.positiveText }}>{goal.pct}%</span>
        </div>
        <ProgressBar pct={goal.pct} fill={TOKENS.tealFill} />
        <FooterTriple>
          <FooterCell label="Current" value={fmt(amount, currency)} />
          <FooterCell label="Target year" value={String(goal.targetYear)} />
          <FooterCell label="Est. target" value={fmt(goal.target, currency)} />
        </FooterTriple>
      </Card>
    );
  };

  const SubAccountsCard = () => {
    if (subAccounts.length <= 1) return null;
    const currencies = new Set(
      subAccounts.map(({ acc }) =>
        (acc.currency && CURRENCY_SYMBOLS[acc.currency as Currency]) ? acc.currency as Currency : 'INR',
      ),
    );
    const sameCurrency = currencies.size === 1;
    const sum = subAccounts.reduce((s, x) => s + (Number(x.acc.amount) || 0), 0);
    return (
      <Card>
        <CardHeader title="Sub-accounts" />
        {subAccounts.map(({ idx, acc }) => {
          const subCur = (acc.currency && CURRENCY_SYMBOLS[acc.currency as Currency]) ? acc.currency as Currency : 'INR';
          const subColor = brand;
          const isThis = idx === selectedIdx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectIdx(idx)}
              style={{
                width: '100%',
                background: isThis ? '#F3F4F6' : 'transparent',
                border: 'none',
                padding: '8px 4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                borderRadius: 6,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: subColor }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.primaryText, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {acc.bank}
                    {acc.type ? ` ${acc.type}` : ''}
                  </div>
                  {acc.roi && (
                    <div style={{ fontSize: 10, color: TOKENS.secondaryText }}>
                      {(Number(acc.roi) * 100).toFixed(2)}% APY · {labelForType(acc.type)}
                    </div>
                  )}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: TOKENS.primaryText }}>
                {fmt(acc.amount, subCur)}
              </span>
            </button>
          );
        })}
        <div style={{ borderTop: `1px solid ${TOKENS.borderSoft}`, marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TOKENS.secondaryText }}>
          <span>Combined ({subAccounts.length})</span>
          <span style={{ color: TOKENS.primaryText, fontWeight: 600 }}>
            {sameCurrency ? fmt(sum, currency) : 'Mixed currencies'}
          </span>
        </div>
      </Card>
    );
  };

  const RecentActivityCard = () => {
    const history = (account.balanceHistory || []).slice(-5).reverse();
    if (history.length === 0) {
      return (
        <Card>
          <CardHeader title="Recent activity" />
          <div style={{ fontSize: 11, color: TOKENS.tertiaryText, padding: '6px 4px' }}>
            No balance changes recorded yet. Tap <em>Update balance</em> after a deposit or payment to start tracking.
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader title="Recent activity" />
        {history.map((h, i) => {
          const delta = (h.amount ?? 0) - (h.previousAmount ?? h.amount ?? 0);
          // For liabilities, a balance increase is a debit; for assets, a balance increase is a credit.
          const isCredit = isLiability ? delta < 0 : delta >= 0;
          const color = isCredit ? TOKENS.positiveText : TOKENS.liabilityText;
          const bg = isCredit ? TOKENS.creditBg : TOKENS.debitBg;
          const icon = isCredit ? '💚' : '💸';
          const label = h.source || (isCredit ? 'Credit' : 'Debit');
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 4px',
                borderTop: i === 0 ? 'none' : `1px solid ${TOKENS.borderSoft}`,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: bg,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                {icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.primaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </div>
                <div style={{ fontSize: 10, color: TOKENS.tertiaryText }}>{fmtDate(h.date)}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
                {delta === 0 ? fmt(h.amount, currency) : `${delta >= 0 ? '+' : ''}${fmt(delta, currency)}`}
              </span>
            </div>
          );
        })}
        {/* Sparkline */}
        <BalanceSparkline history={account.balanceHistory || []} fmt={fmt} currency={currency} isLiability={isLiability} />
      </Card>
    );
  };

  const AccountDetailsCard = () => (
    <Card>
      <CardHeader title="Account details" />
      <DetailRow label="Institution" value={meta.displayName || account.bank} />
      {account.type && <DetailRow label="Account type" value={account.type} />}
      {account.holders && <DetailRow label="Account holder" value={account.holders} />}
      {account.nominee && <DetailRow label="Nominee" value={account.nominee} />}
      {account.roi && <DetailRow label="Return / APY" value={`${(Number(account.roi) * 100).toFixed(2)}% pa`} />}
      {account.online && <DetailRow label="Online access" value={account.online} />}
      {meta.insurance && (
        <DetailRow
          label={meta.insurance.scheme === 'None' ? 'Risk' : `${meta.insurance.scheme} insured`}
          value={
            meta.insurance.insured === 'no'
              ? 'No deposit insurance'
              : meta.insurance.capDisplay
          }
          tooltip={meta.insurance.notes}
        />
      )}
      {account.accountNumber && <DetailRow label="A/C number" value={account.accountNumber} mono />}
      {account.ifscCode && <DetailRow label="IFSC" value={account.ifscCode} mono />}
      {account.branch && <DetailRow label="Branch" value={account.branch} />}
      {meta.rateBand && <DetailRow label="Typical rate" value={meta.rateBand} muted />}
      {meta.tagline && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: TOKENS.paperAlt,
            borderRadius: 8,
            fontSize: 11,
            color: TOKENS.secondaryText,
            lineHeight: 1.5,
          }}
        >
          💡 {meta.tagline}
          {meta.trivia && (
            <>
              <br />
              <span style={{ color: TOKENS.tertiaryText }}>{meta.trivia}</span>
            </>
          )}
        </div>
      )}
    </Card>
  );

  const LastUpdatedCard = () => {
    const overdue = stale != null && stale > 7;
    return (
      <Card>
        <CardHeader title="Last updated" />
        <DetailRow label="Last balance update" value={stale == null ? '—' : stale === 0 ? 'Today' : `${stale} days ago`} />
        {account.balanceHistory?.[0]?.date && (
          <DetailRow label="Tracking since" value={fmtDate(account.balanceHistory[0].date)} muted />
        )}
        {overdue && (
          <div
            style={{
              background: TOKENS.overdueBg,
              color: TOKENS.overdueText,
              fontSize: 11,
              fontWeight: 600,
              padding: '8px 10px',
              borderRadius: 8,
              marginTop: 8,
            }}
          >
            ⚠ Update recommended every 7 days for accurate net worth.
          </div>
        )}
      </Card>
    );
  };

  /* ─────────── Layout: mobile vs desktop ─────────── */

  if (isMobile) {
    return (
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed',
          inset: 0,
          background: '#F8F8F6',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Mobile header — Journal pattern */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: TOKENS.paper,
            borderBottom: `1px solid ${TOKENS.border}`,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.paperAlt,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: TOKENS.primaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {meta.displayName || account.bank}
            </div>
            <div style={{ fontSize: 11, color: TOKENS.secondaryText }}>
              Accounts · {account.type || 'Account'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEdit(selectedIdx)}
            aria-label="Edit"
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${TOKENS.border}`,
              background: TOKENS.paperAlt,
              cursor: 'pointer',
              fontSize: 14,
              padding: 0,
            }}
          >
            ✎
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HeroCard />
          <TimelineBadge />
          <MobileStatGrid account={account} meta={meta} fmt={fmt} fmtFull={fmtFull} currency={currency} isLiability={isLiability} />
          <ProgressCard />
          <SubAccountsCard />
          <RecentActivityCard />
          <AccountDetailsCard />
          <LastUpdatedCard />

          {/* Update balance + Edit footer */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={() => onEdit(selectedIdx)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${TOKENS.border}`,
                background: TOKENS.paper,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: TOKENS.primaryText,
              }}
            >
              Edit account
            </button>
            <button
              type="button"
              onClick={() => (onUpdateBalance ?? onEdit)(selectedIdx)}
              style={{
                flex: 1.5,
                padding: 12,
                borderRadius: 10,
                border: 'none',
                background: TOKENS.darkBtn,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
              }}
            >
              Update balance
            </button>
          </div>

          {/* Swipe indicator above bottom nav */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
              color: TOKENS.tertiaryText,
              padding: '4px 6px',
              marginBottom: 4,
            }}
          >
            <span style={{ visibility: prev ? 'visible' : 'hidden' }}>← {prev?.acc.bank ?? ''}</span>
            <span style={{ fontSize: 10 }}>swipe to navigate</span>
            <span style={{ visibility: next ? 'visible' : 'hidden' }}>{next?.acc.bank ?? ''} →</span>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Desktop split-panel ─── */
  const sidebarItem = (item: { idx: number; acc: BankAccount }) => {
    const a = item.acc;
    const cur = (a.currency && CURRENCY_SYMBOLS[a.currency as Currency]) ? a.currency as Currency : 'INR';
    const isActive = item.idx === selectedIdx;
    const lia = isLiabilityAcc(a);
    return (
      <button
        key={item.idx}
        type="button"
        onClick={() => onSelectIdx(item.idx)}
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          paddingLeft: 14,
          background: isActive ? TOKENS.paper : 'transparent',
          border: 'none',
          borderLeft: isActive ? `2px solid ${TOKENS.activeBorder}` : '2px solid transparent',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: getBankColor(a.bank), flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 500, color: TOKENS.primaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.bank}
          </div>
          {a.type && (
            <div style={{ fontSize: 10, color: TOKENS.tertiaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.type}
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: lia ? TOKENS.liabilityText : TOKENS.primaryText, flexShrink: 0 }}>
          {fmt(a.amount, cur)}
        </span>
      </button>
    );
  };

  const assets = ordered.filter((o) => !o.isLiability);
  const liabilities = ordered.filter((o) => o.isLiability);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr',
        gap: 0,
        background: TOKENS.paperAlt,
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${TOKENS.border}`,
        minHeight: 600,
      }}
    >
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div style={{ borderRight: `1px solid ${TOKENS.border}`, display: 'flex', flexDirection: 'column', background: TOKENS.paperAlt }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${TOKENS.border}` }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: TOKENS.secondaryText, padding: 0, marginBottom: 6 }}
          >
            ← Back to list
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.primaryText }}>Vault</div>
          <div style={{ fontSize: 11, color: TOKENS.secondaryText }}>Financial accounts</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {assets.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, color: TOKENS.tertiaryText, padding: '8px 14px 4px', letterSpacing: '0.08em' }}>
                ASSETS · {assets.length}
              </div>
              {assets.map(sidebarItem)}
            </>
          )}
          {liabilities.length > 0 && (
            <>
              <div style={{ fontSize: 9, fontWeight: 700, color: TOKENS.tertiaryText, padding: '14px 14px 4px', letterSpacing: '0.08em' }}>
                LIABILITIES · {liabilities.length}
              </div>
              {liabilities.map(sidebarItem)}
            </>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${TOKENS.border}`, padding: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: TOKENS.tertiaryText, letterSpacing: '0.08em' }}>NET WORTH</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: netWorth.total >= 0 ? TOKENS.primaryText : TOKENS.liabilityText, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            {fmt(netWorth.total, netWorth.currency)}
          </div>
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────────── */}
      <div style={{ padding: 18, overflowY: 'auto' }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: TOKENS.tertiaryText, marginBottom: 12 }}>
          Vault <span style={{ color: TOKENS.secondaryText }}>›</span> Accounts <span style={{ color: TOKENS.secondaryText }}>›</span>{' '}
          <span style={{ color: TOKENS.primaryText }}>{meta.displayName || account.bank}</span>
        </div>

        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Avatar size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 500, color: TOKENS.primaryText }}>
              {meta.displayName || account.bank}
            </div>
            <div style={{ fontSize: 12, color: TOKENS.secondaryText }}>
              {(account.type || 'Account')} · {subAccounts.length} account{subAccounts.length === 1 ? '' : 's'}
            </div>
            <AccountChips meta={meta} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => onEdit(selectedIdx)}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                borderRadius: 8,
                border: `0.5px solid ${TOKENS.border}`,
                background: TOKENS.paper,
                color: TOKENS.primaryText,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Edit account
            </button>
            <button
              type="button"
              onClick={() => (onUpdateBalance ?? onEdit)(selectedIdx)}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                borderRadius: 8,
                border: 'none',
                background: TOKENS.darkBtn,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Update balance
            </button>
          </div>
        </div>

        {/* 2-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <HeroCard />
            <TimelineBadge />
            <ProgressCard />
            <RecentActivityCard />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AccountDetailsCard />
            <SubAccountsCard />
            <LastUpdatedCard />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ────────────────────────────── tiny atoms ────────────────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: TOKENS.paper,
        border: `0.5px solid ${TOKENS.border}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: TOKENS.tertiaryText,
        marginBottom: 8,
        textTransform: 'uppercase',
      }}
    >
      {title}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  muted,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  tooltip?: string;
}) {
  return (
    <div
      title={tooltip}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '6px 0',
        borderBottom: `1px solid ${TOKENS.borderSoft}`,
        fontSize: 12,
      }}
    >
      <span style={{ color: TOKENS.secondaryText }}>{label}</span>
      <span
        style={{
          color: muted ? TOKENS.secondaryText : TOKENS.primaryText,
          fontWeight: muted ? 400 : 500,
          fontFamily: mono ? 'monospace' : 'inherit',
          textAlign: 'right',
          maxWidth: '60%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ProgressBar({ pct, fill }: { pct: number; fill: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: fill, transition: 'width 0.3s ease' }} />
    </div>
  );
}

function FooterTriple({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        marginTop: 10,
        paddingTop: 10,
        borderTop: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      {children}
    </div>
  );
}

function FooterCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: TOKENS.tertiaryText }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: TOKENS.primaryText, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function StatRow({
  account,
  meta,
  fmt,
  fmtFull,
  currency,
  isLiability,
}: {
  account: BankAccount;
  meta: InstitutionMeta;
  fmt: (n: number | string | null | undefined, c?: Currency) => string;
  fmtFull: (n: number | string | null | undefined, c?: Currency) => string;
  currency: Currency;
  isLiability: boolean;
}) {
  let cells: { label: string; value: string; sub?: string }[];

  if (meta.sector === 'mortgage' || (isLiability && account.type?.toLowerCase().includes('loan'))) {
    const emi = parseEmiFromNotes(account);
    const rate = account.roi ? `${(Number(account.roi) * 100).toFixed(2)}%` : (meta.rateBand?.split(' ')[0] ?? '—');
    const endYear = parseLockYear(account);
    cells = [
      { label: 'Monthly EMI', value: emi ? fmt(emi, currency) : '—', sub: 'Auto-deduct' },
      { label: 'Interest rate', value: rate, sub: 'Fixed' },
      { label: 'Loan end', value: endYear ? String(endYear) : '—', sub: endYear ? `${Math.max(0, endYear - new Date().getFullYear())} yrs left` : '' },
    ];
  } else if (meta.sector === 'retirement' || meta.sector === 'investment') {
    cells = [
      { label: 'Account holder', value: account.holders || '—', sub: 'Primary' },
      { label: 'Nominee', value: account.nominee || '—', sub: account.nominee ? 'Beneficiary' : '' },
      { label: 'Return rate', value: account.roi ? `${(Number(account.roi) * 100).toFixed(2)}%` : (meta.rateBand?.split(' ')[0] ?? '—'), sub: 'Annual' },
    ];
  } else {
    const apy = account.roi ? `${(Number(account.roi) * 100).toFixed(2)}%` : (meta.rateBand?.split(' ')[0] ?? '—');
    cells = [
      { label: 'APY', value: apy, sub: meta.sector === 'banking' ? 'Savings' : '' },
      { label: 'Account holder', value: account.holders || '—', sub: account.nominee ? `Nominee: ${account.nominee}` : '' },
      { label: meta.insurance?.scheme === 'None' ? 'Risk' : `${meta.insurance?.scheme ?? 'FDIC'} insured`, value: meta.insurance?.insured === 'no' ? 'No' : (meta.insurance?.capDisplay ?? '—'), sub: meta.insurance?.notes?.split('—')[0]?.trim() || '' },
    ];
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderTop: `1px solid ${TOKENS.borderSoft}`,
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            padding: 14,
            borderRight: i < cells.length - 1 ? `1px solid ${TOKENS.borderSoft}` : 'none',
          }}
        >
          <div style={{ fontSize: 10, color: TOKENS.tertiaryText }}>{c.label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.primaryText, marginTop: 2 }}>
            {c.value}
          </div>
          {c.sub && <div style={{ fontSize: 10, color: TOKENS.secondaryText, marginTop: 1 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function MobileStatGrid({
  account,
  meta,
  fmt,
  fmtFull,
  currency,
  isLiability,
}: {
  account: BankAccount;
  meta: InstitutionMeta;
  fmt: (n: number | string | null | undefined, c?: Currency) => string;
  fmtFull: (n: number | string | null | undefined, c?: Currency) => string;
  currency: Currency;
  isLiability: boolean;
}) {
  // Re-use StatRow's logic but render as 2x2 grid of independent cards.
  let cells: { label: string; value: string; sub?: string }[];

  if (meta.sector === 'mortgage' || (isLiability && account.type?.toLowerCase().includes('loan'))) {
    const emi = parseEmiFromNotes(account);
    const rate = account.roi ? `${(Number(account.roi) * 100).toFixed(2)}%` : (meta.rateBand?.split(' ')[0] ?? '—');
    const endYear = parseLockYear(account);
    cells = [
      { label: 'Monthly EMI', value: emi ? fmt(emi, currency) : '—', sub: 'Auto-deduct' },
      { label: 'Interest rate', value: rate, sub: 'Fixed' },
      { label: 'Account holder', value: account.holders || '—', sub: 'Primary' },
      { label: 'Loan end', value: endYear ? String(endYear) : '—', sub: endYear ? `${Math.max(0, endYear - new Date().getFullYear())} yrs left` : '' },
    ];
  } else if (meta.sector === 'retirement' || meta.sector === 'investment') {
    cells = [
      { label: 'Account holder', value: account.holders || '—', sub: 'Primary' },
      { label: 'Nominee', value: account.nominee || '—', sub: account.nominee ? 'Beneficiary' : '' },
      { label: 'Return rate', value: account.roi ? `${(Number(account.roi) * 100).toFixed(2)}%` : (meta.rateBand?.split(' ')[0] ?? '—'), sub: 'Annual' },
      { label: 'Status', value: account.done ? 'Done' : 'Active', sub: 'Locked · Info 2' },
    ];
  } else {
    const apy = account.roi ? `${(Number(account.roi) * 100).toFixed(2)}%` : (meta.rateBand?.split(' ')[0] ?? '—');
    cells = [
      { label: 'APY', value: apy, sub: 'Savings' },
      { label: 'Account holder', value: account.holders || '—', sub: 'Primary' },
      { label: meta.insurance?.scheme === 'None' ? 'Risk' : `${meta.insurance?.scheme ?? 'FDIC'}`, value: meta.insurance?.insured === 'no' ? 'No' : (meta.insurance?.capDisplay ?? '—'), sub: 'Insured' },
      { label: 'Online', value: account.online || '—', sub: '' },
    ];
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            background: TOKENS.paper,
            border: `0.5px solid ${TOKENS.border}`,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontSize: 10, color: TOKENS.tertiaryText }}>{c.label}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: TOKENS.primaryText, marginTop: 4 }}>{c.value}</div>
          {c.sub && <div style={{ fontSize: 10, color: TOKENS.secondaryText, marginTop: 2 }}>{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function BalanceSparkline({
  history,
  fmt,
  currency,
  isLiability,
}: {
  history: { date: string; amount: number }[];
  fmt: (n: number | string | null | undefined, c?: Currency) => string;
  currency: Currency;
  isLiability: boolean;
}) {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const ys = sorted.map((h) => Number(h.amount) || 0);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || Math.abs(max) || 1;
  const w = 280;
  const h = 50;
  const pad = 4;
  const stroke = isLiability ? TOKENS.redFill : TOKENS.tealFill;
  const fill = isLiability ? '#FCEBEB' : '#E1F5EE';

  const points = sorted.map((p, i) => {
    const x = pad + (i / Math.max(1, sorted.length - 1)) * (w - pad * 2);
    const y = h - pad - ((Number(p.amount) - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${pad + (w - pad * 2)},${h - pad} L ${pad},${h - pad} Z`;

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${TOKENS.borderSoft}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: TOKENS.tertiaryText, marginBottom: 4 }}>
        <span>Balance trend · {sorted.length} pts</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmt(min, currency)} → {fmt(max, currency)}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true">
        <path d={areaPath} fill={fill} opacity={0.6} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => {
          const [x, y] = p.split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 2 : 1.2} fill={stroke} />;
        })}
      </svg>
    </div>
  );
}

/* ────────────────────────────── helpers ────────────────────────────── */

function labelForType(t: string | undefined): string {
  if (!t) return 'Account';
  const x = t.toLowerCase();
  if (x.includes('saving')) return 'High-yield';
  if (x.includes('checking')) return 'Checking';
  if (x.includes('fd')) return 'Fixed deposit';
  if (x.includes('rd')) return 'Recurring deposit';
  if (x.includes('credit')) return 'Credit card';
  if (x.includes('loan')) return 'Loan';
  return t;
}

function computeYTDChange(account: BankAccount): number | null {
  const history = account.balanceHistory || [];
  if (history.length === 0) return null;
  const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
  // Find last entry before YTD-start, otherwise first entry of the year.
  let baseline: number | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (new Date(sorted[i].date).getTime() < startOfYear) {
      baseline = Number(sorted[i].amount) || 0;
      break;
    }
  }
  if (baseline == null) {
    const ytdEntries = sorted.filter((h) => new Date(h.date).getTime() >= startOfYear);
    if (ytdEntries.length === 0) return null;
    baseline = Number(ytdEntries[0].previousAmount ?? ytdEntries[0].amount) || 0;
  }
  const current = Number(account.amount) || 0;
  if (!baseline) return null;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function parseLockYear(account: BankAccount): number | null {
  const blob = `${account.notes || ''} ${account.detail || ''} ${account.nextAction || ''}`;
  const m = /(?:lock(?:ed)?(?:\s*till)?|matur\w+|ends?\s*on|until|by)\s*(20\d{2})/i.exec(blob);
  if (m) return Number(m[1]);
  const m2 = /\b(20[3-7]\d)\b/.exec(blob); // future-ish 4-digit
  if (m2) return Number(m2[1]);
  return null;
}

function parseEmiFromNotes(account: BankAccount): number | null {
  const blob = `${account.notes || ''} ${account.detail || ''} ${account.nextAction || ''}`.toLowerCase();
  const m = /emi\s*[:=]?\s*([₹$£€]?\s*[\d,.]+\s*[kml]?)/i.exec(blob);
  if (!m) return null;
  const raw = m[1].replace(/[₹$£€,\s]/g, '').toLowerCase();
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  if (raw.endsWith('k')) return n * 1000;
  if (raw.endsWith('m') || raw.endsWith('l')) return n * 100000;
  return n;
}

function computeLoanRepaymentProgress(account: BankAccount): { pct: number; paid: number; remaining: number; original: number } | null {
  const history = account.balanceHistory || [];
  const current = Math.abs(Number(account.amount) || 0);
  if (history.length === 0 && !current) return null;
  // Original = max absolute balance ever seen, OR the first history entry if larger than current.
  let original = current;
  if (history.length > 0) {
    const peakAbs = Math.max(...history.map((h) => Math.abs(Number(h.amount) || 0)));
    original = Math.max(original, peakAbs);
  }
  if (original <= current) return null; // can't compute progress
  const paid = original - current;
  const pct = Math.min(100, Math.round((paid / original) * 100));
  return { pct, paid, remaining: current, original };
}

function computeGoalProgress(account: BankAccount): { pct: number; targetYear: number; target: number } | null {
  // Heuristic: if account has a parsed lock/end year and ROI, project forward.
  const lockYear = parseLockYear(account);
  if (!lockYear) return null;
  const yearsLeft = Math.max(0, lockYear - new Date().getFullYear());
  const current = Number(account.amount) || 0;
  if (current <= 0) return null;
  const roi = Number(account.roi) || 0.07; // assume 7% if unknown for retirement projection
  const target = current * Math.pow(1 + roi, yearsLeft || 1);
  if (target <= 0) return null;
  const pct = Math.min(100, Math.round((current / target) * 100));
  return { pct, targetYear: lockYear, target };
}

export default BankAccountDetail;
