/**
 * Pending Financial Imports Service
 * 
 * Manages temporary storage of financial screenshot scans
 * that are waiting for user approval inside the Safe section.
 * 
 * Storage: localStorage (temporary until approved/dismissed)
 * Security: Data is only previewed outside Safe, changes require Safe unlock
 */

import { PendingFinancialImport, FinancialScreenshotData } from './imageScanning/types';

export type { PendingFinancialImport, FinancialScreenshotData };

const STORAGE_KEY = 'leo_pending_financial_imports';

export const getPendingFinancialImports = (): PendingFinancialImport[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const imports = JSON.parse(data) as PendingFinancialImport[];
    return imports.filter(i => i.status === 'pending');
  } catch {
    return [];
  }
};

export const getAllFinancialImports = (): PendingFinancialImport[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addPendingFinancialImport = (
  extractedData: FinancialScreenshotData,
  imageBase64?: string
): PendingFinancialImport => {
  const imports = getAllFinancialImports();
  
  const newImport: PendingFinancialImport = {
    id: `fin-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    imageBase64,
    extractedData,
    status: 'pending'
  };
  
  imports.push(newImport);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(imports));
  
  console.log('[FinancialImports] Added pending import:', newImport.id);
  return newImport;
};

export const updatePendingImport = (
  id: string,
  updates: Partial<PendingFinancialImport>
): PendingFinancialImport | null => {
  const imports = getAllFinancialImports();
  const index = imports.findIndex(i => i.id === id);
  
  if (index === -1) return null;
  
  imports[index] = { ...imports[index], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(imports));
  
  return imports[index];
};

export const approveFinancialImport = (id: string): PendingFinancialImport | null => {
  return updatePendingImport(id, {
    status: 'approved',
    approvedAt: new Date().toISOString()
  });
};

export const dismissFinancialImport = (id: string): PendingFinancialImport | null => {
  return updatePendingImport(id, { status: 'dismissed' });
};

export const deletePendingImport = (id: string): boolean => {
  const imports = getAllFinancialImports();
  const filtered = imports.filter(i => i.id !== id);
  
  if (filtered.length === imports.length) return false;
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return true;
};

export const clearAllPendingImports = (): void => {
  const imports = getAllFinancialImports();
  const nonPending = imports.filter(i => i.status !== 'pending');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nonPending));
};

export const getPendingImportCount = (): number => {
  return getPendingFinancialImports().length;
};

export const detectBrokerageSource = (text: string): FinancialScreenshotData['source'] => {
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('robinhood')) return 'robinhood';
  if (lowerText.includes('fidelity')) return 'fidelity';
  if (lowerText.includes('schwab') || lowerText.includes('charles schwab')) return 'schwab';
  if (lowerText.includes('vanguard')) return 'vanguard';
  if (lowerText.includes('e*trade') || lowerText.includes('etrade')) return 'etrade';
  if (lowerText.includes('zerodha') || lowerText.includes('kite')) return 'zerodha';
  if (lowerText.includes('groww')) return 'groww';
  if (lowerText.includes('coinbase')) return 'coinbase';
  if (lowerText.includes('sofi')) return 'sofi';

  return 'unknown';
};

export const BROKERAGE_INFO: Record<FinancialScreenshotData['source'], { name: string; icon: string; color: string }> = {
  robinhood: { name: 'Robinhood', icon: '🪶', color: '#00C805' },
  fidelity: { name: 'Fidelity', icon: '📊', color: '#4CAF50' },
  schwab: { name: 'Charles Schwab', icon: '💼', color: '#00A0DF' },
  vanguard: { name: 'Vanguard', icon: '⛵', color: '#C32C2C' },
  etrade: { name: 'E*TRADE', icon: '📈', color: '#6B2D99' },
  zerodha: { name: 'Zerodha', icon: '🔷', color: '#387ED1' },
  groww: { name: 'Groww', icon: '🌱', color: '#00D09C' },
  coinbase: { name: 'Coinbase', icon: '🪙', color: '#0052FF' },
  sofi: { name: 'SoFi', icon: '🏦', color: '#00B4D8' },
  unknown: { name: 'Unknown Brokerage', icon: '💰', color: '#6B7280' }
};
