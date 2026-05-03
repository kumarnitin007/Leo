/**
 * Institution metadata — static enrichment used by the Account Detail view.
 *
 * Why static (and not a runtime public API)?
 * ------------------------------------------
 * 1. Most "free" bank-info APIs (FDIC BankFind, RBI bank lists, etc.) do not
 *    expose CORS-friendly browser endpoints, so they would require a Vercel
 *    proxy + caching to be reliable.
 * 2. Latency on every account open hurts perceived speed for a private
 *    finance dashboard.
 * 3. The user's data is small and the matching surface is "bank name string"
 *    which is messy. A curated map gives deterministic, instant context.
 *
 * If we ever want live data, swap `lookupInstitutionMeta` to also try a
 * `/api/institution-info?name=...` call and fall back to the local map.
 *
 * Sources cited (public, no auth needed):
 *  - FDIC: https://www.fdic.gov/resources/deposit-insurance/
 *  - DICGC (India): https://www.dicgc.org.in/
 *  - FSCS (UK): https://www.fscs.org.uk/
 *  - CDIC (Canada): https://www.cdic.ca/
 */

export type DepositInsurance = {
  scheme: string;            // FDIC / DICGC / FSCS / CDIC / SIPC / N/A
  capDisplay: string;        // human "$250K", "₹5L", etc.
  insured: 'yes' | 'partial' | 'no' | 'unknown';
  notes?: string;
};

export type InstitutionMeta = {
  /** Canonical display name (may differ in casing from user input). */
  displayName: string;
  /** Country code (ISO-3166 alpha-2) for grouping/flag rendering. */
  country?: string;
  /** Sector tag we render as a chip. */
  sector?: 'banking' | 'investment' | 'retirement' | 'mortgage' | 'creditcard' | 'pension' | 'crypto' | 'mixed';
  /** Tagline / "did you know" hint shown in detail card. */
  tagline?: string;
  insurance?: DepositInsurance;
  /** Typical rate band for the institution's primary product (e.g. "4.20–4.60% APY"). */
  rateBand?: string;
  /** Brand color override (otherwise we use BankDashboard's palette). */
  brandColor?: string;
  /** Free-form trivia rendered in tooltip (1–2 short lines). */
  trivia?: string;
  /** Source URL we'd link to for more info (no scraping at runtime). */
  homepage?: string;
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Curated map. Keys are lower-cased canonical short names; lookups are        */
/* fuzzy (contains-match in either direction).                                 */
/* ────────────────────────────────────────────────────────────────────────── */

const FDIC_INS: DepositInsurance = {
  scheme: 'FDIC',
  capDisplay: '$250,000',
  insured: 'yes',
  notes: 'FDIC-insured up to $250,000 per depositor, per ownership category.',
};

const SIPC_INS: DepositInsurance = {
  scheme: 'SIPC',
  capDisplay: '$500,000',
  insured: 'partial',
  notes: 'SIPC covers up to $500K in securities (incl. $250K cash) — does not cover market loss.',
};

const DICGC_INS: DepositInsurance = {
  scheme: 'DICGC',
  capDisplay: '₹5,00,000',
  insured: 'yes',
  notes: 'DICGC insures up to ₹5 lakh per depositor per bank in India.',
};

const FSCS_INS: DepositInsurance = {
  scheme: 'FSCS',
  capDisplay: '£85,000',
  insured: 'yes',
  notes: 'FSCS protects deposits up to £85,000 per person per authorised UK firm.',
};

const NO_INS: DepositInsurance = {
  scheme: 'None',
  capDisplay: '—',
  insured: 'no',
  notes: 'Investment / brokerage balances are subject to market risk and are not deposit-insured.',
};

const REG: Record<string, InstitutionMeta> = {
  // ── US: banks & brokerages ──────────────────────────────────────────
  sofi: {
    displayName: 'SoFi Bank',
    country: 'US',
    sector: 'banking',
    tagline: 'Online national bank — high-yield savings + checking.',
    insurance: FDIC_INS,
    rateBand: '4.20–4.60% APY (Savings tier, late 2025)',
    brandColor: '#7C3AED',
    trivia: 'SoFi acquired Golden Pacific Bancorp in 2022 and now operates as a federally chartered national bank.',
    homepage: 'https://www.sofi.com',
  },
  ally: {
    displayName: 'Ally Bank',
    country: 'US',
    sector: 'banking',
    tagline: 'Branchless online savings & auto loans.',
    insurance: FDIC_INS,
    rateBand: '~4.00–4.20% APY (Savings)',
    brandColor: '#7B2D8E',
    homepage: 'https://www.ally.com',
  },
  chase: {
    displayName: 'Chase Bank',
    country: 'US',
    sector: 'banking',
    tagline: 'Largest US retail bank, part of JPMorgan Chase.',
    insurance: FDIC_INS,
    rateBand: 'Mortgage ~6.5–7.5% (30-yr fixed)',
    brandColor: '#117ACA',
    homepage: 'https://www.chase.com',
  },
  fidelity: {
    displayName: 'Fidelity Investments',
    country: 'US',
    sector: 'investment',
    tagline: '#2 US asset manager — brokerage, IRA, 401(k).',
    insurance: SIPC_INS,
    rateBand: 'SPAXX (cash) ~4.0% 7-day yield',
    brandColor: '#398B41',
    homepage: 'https://www.fidelity.com',
  },
  empower: {
    displayName: 'Empower',
    country: 'US',
    sector: 'retirement',
    tagline: 'Retirement plan recordkeeper — major 401(k) provider.',
    insurance: NO_INS,
    rateBand: 'Depends on selected fund',
    brandColor: '#0077C8',
    trivia: 'Acquired Personal Capital in 2020; manages $1.4T+ in retirement assets.',
    homepage: 'https://www.empower.com',
  },
  robinhood: {
    displayName: 'Robinhood',
    country: 'US',
    sector: 'investment',
    tagline: 'Commission-free brokerage; cash sweep up to $2.5M FDIC.',
    insurance: { scheme: 'FDIC (sweep)', capDisplay: '$2.5M', insured: 'partial', notes: 'Cash swept across partner banks (FDIC) — securities covered by SIPC up to $500K.' },
    brandColor: '#00C805',
    homepage: 'https://robinhood.com',
  },
  key: {
    displayName: 'KeyBank',
    country: 'US',
    sector: 'banking',
    insurance: FDIC_INS,
    brandColor: '#D4202C',
    homepage: 'https://www.key.com',
  },
  capital_one: {
    displayName: 'Capital One',
    country: 'US',
    sector: 'banking',
    insurance: FDIC_INS,
    brandColor: '#D03027',
    homepage: 'https://www.capitalone.com',
  },
  // ── India: banks ────────────────────────────────────────────────────
  sbi: {
    displayName: 'State Bank of India',
    country: 'IN',
    sector: 'banking',
    tagline: "India's largest public-sector bank, founded 1806.",
    insurance: DICGC_INS,
    rateBand: '6.50–7.10% (1–5y FD)',
    brandColor: '#1F4D8B',
    homepage: 'https://www.onlinesbi.sbi',
  },
  icici: {
    displayName: 'ICICI Bank',
    country: 'IN',
    sector: 'banking',
    insurance: DICGC_INS,
    rateBand: '6.70–7.10% (1–5y FD)',
    brandColor: '#B92025',
    homepage: 'https://www.icicibank.com',
  },
  hdfc: {
    displayName: 'HDFC Bank',
    country: 'IN',
    sector: 'banking',
    insurance: DICGC_INS,
    rateBand: '6.60–7.10% (1–5y FD)',
    brandColor: '#004C8F',
    homepage: 'https://www.hdfcbank.com',
  },
  axis: {
    displayName: 'Axis Bank',
    country: 'IN',
    sector: 'banking',
    insurance: DICGC_INS,
    brandColor: '#97144D',
    homepage: 'https://www.axisbank.com',
  },
  canara: {
    displayName: 'Canara Bank',
    country: 'IN',
    sector: 'banking',
    insurance: DICGC_INS,
    rateBand: '6.50–7.10% (1–5y FD)',
    brandColor: '#0092C9',
    homepage: 'https://canarabank.com',
  },
  iob: {
    displayName: 'Indian Overseas Bank',
    country: 'IN',
    sector: 'banking',
    insurance: DICGC_INS,
    brandColor: '#003F7D',
    homepage: 'https://www.iob.in',
  },
  yes: {
    displayName: 'Yes Bank',
    country: 'IN',
    sector: 'banking',
    insurance: DICGC_INS,
    brandColor: '#0066B3',
    homepage: 'https://www.yesbank.in',
  },
  post: {
    displayName: 'India Post Office',
    country: 'IN',
    sector: 'banking',
    tagline: 'Government-run small-savings (POMIS, NSC, KVP, RD).',
    insurance: { scheme: 'GoI sovereign backing', capDisplay: '—', insured: 'yes', notes: 'Backed directly by the Government of India.' },
    rateBand: '7.40% (MIS), 7.50% (NSC, current)',
    brandColor: '#C8102E',
    homepage: 'https://www.indiapost.gov.in',
  },
  rec: {
    displayName: 'REC Limited (Bonds)',
    country: 'IN',
    sector: 'banking',
    tagline: 'PSU NBFC — tax-free / 54EC capital-gains bonds.',
    insurance: { scheme: 'PSU bond (no DICGC)', capDisplay: '—', insured: 'partial', notes: 'Maharatna PSU; bonds carry sovereign-adjacent risk but are not DICGC-insured deposits.' },
    brandColor: '#1F4D8B',
    homepage: 'https://www.recindia.nic.in',
  },
  scss: {
    displayName: 'Senior Citizen Savings Scheme (SCSS)',
    country: 'IN',
    sector: 'pension',
    tagline: 'Government scheme for 60+; quarterly interest payout.',
    insurance: { scheme: 'GoI', capDisplay: '—', insured: 'yes', notes: 'Sovereign-backed small-savings scheme.' },
    rateBand: '8.20% (current quarterly reset)',
    brandColor: '#C8102E',
    homepage: 'https://www.indiapost.gov.in/Financial/pages/content/scss.aspx',
  },
  // ── UK ─────────────────────────────────────────────────────────────
  hsbc: {
    displayName: 'HSBC',
    country: 'GB',
    sector: 'banking',
    insurance: FSCS_INS,
    brandColor: '#DB0011',
    homepage: 'https://www.hsbc.co.uk',
  },
};

const SECTOR_ICONS: Record<NonNullable<InstitutionMeta['sector']>, string> = {
  banking: '🏦',
  investment: '📈',
  retirement: '🏖️',
  mortgage: '🏠',
  creditcard: '💳',
  pension: '👴',
  crypto: '🪙',
  mixed: '🏛️',
};

/** Heuristic sector inference from account `type` when meta is missing. */
function inferSectorFromType(type: string | undefined): InstitutionMeta['sector'] {
  if (!type) return undefined;
  const t = type.toLowerCase();
  if (t.includes('mortgage') || t.includes('home loan')) return 'mortgage';
  if (t.includes('credit')) return 'creditcard';
  if (t.includes('401') || t.includes('ira') || t.includes('roth') || t.includes('retire') || t.includes('pension')) return 'retirement';
  if (t.includes('stock') || t.includes('equity') || t.includes('bond') || t.includes('brokerage') || t.includes('mutual')) return 'investment';
  if (t.includes('crypto')) return 'crypto';
  if (t.includes('saving') || t.includes('checking') || t.includes('fd') || t.includes('rd') || t.includes('mis') || t.includes('ppf') || t.includes('scss') || t.includes('deposit')) return 'banking';
  return undefined;
}

const norm = (s: string): string =>
  (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Fuzzy lookup: tries exact key, then contains-match in either direction.
 * Always returns a non-null result with sensible defaults so the caller
 * doesn't need null checks.
 */
export function lookupInstitutionMeta(bankName: string, accountType?: string): InstitutionMeta {
  const n = norm(bankName);
  if (REG[n]) return REG[n];

  for (const k of Object.keys(REG)) {
    if (n.includes(k) || k.includes(n)) return REG[k];
  }

  // Fallback — derive minimal meta from the type so chips/icons still render.
  const sector = inferSectorFromType(accountType);
  return {
    displayName: bankName || 'Account',
    sector,
    insurance: sector === 'investment' || sector === 'retirement' ? NO_INS : undefined,
  };
}

export function sectorIcon(meta: InstitutionMeta): string {
  return meta.sector ? SECTOR_ICONS[meta.sector] : '🏛️';
}

export function sectorChipColor(meta: InstitutionMeta): { bg: string; text: string } {
  switch (meta.sector) {
    case 'retirement':
    case 'pension':
      return { bg: '#E1F5EE', text: '#0F6E56' };
    case 'mortgage':
      return { bg: '#FAEEDA', text: '#854F0B' };
    case 'creditcard':
      return { bg: '#FCEBEB', text: '#A32D2D' };
    case 'investment':
      return { bg: '#E0E7FF', text: '#3730A3' };
    case 'crypto':
      return { bg: '#FEF3C7', text: '#92400E' };
    case 'banking':
    default:
      return { bg: '#F3F4F6', text: '#374151' };
  }
}
