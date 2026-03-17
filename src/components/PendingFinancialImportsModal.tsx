/**
 * Pending Financial Imports Modal
 * 
 * Displays pending financial screenshot imports for user approval.
 * Only accessible from within the Safe section (after unlock).
 * 
 * Features:
 * - Preview of extracted financial data
 * - Side-by-side comparison with existing records
 * - Accept/Edit/Dismiss actions for each import
 */

import React, { useState, useEffect } from 'react';
import Portal from './Portal';
import { useTheme } from '../contexts/ThemeContext';
import {
  getPendingFinancialImports,
  dismissFinancialImport,
  deletePendingImport,
  BROKERAGE_INFO,
  PendingFinancialImport
} from '../services/pendingFinancialImports';
import { BankAccount, Deposit, BankRecordsData } from '../types/bankRecords';

interface PendingFinancialImportsModalProps {
  show: boolean;
  onClose: () => void;
  bankData: BankRecordsData;
  onApplyImport: (importId: string, updates: AccountUpdate[]) => void;
}

export interface AccountUpdate {
  type: 'account' | 'deposit';
  action: 'update' | 'create' | 'skip';
  existingIndex?: number;
  newBalance: number;
  accountName: string;
  currency: string;
  /** Extracted account type from scan: checking, savings, loan, brokerage, etc. */
  accountType?: string;
}

const PendingFinancialImportsModal: React.FC<PendingFinancialImportsModalProps> = ({
  show,
  onClose,
  bankData,
  onApplyImport
}) => {
  const { theme } = useTheme();
  const themeColors = theme.colors;
  
  // Map theme colors to component-friendly names
  const colors = {
    surface: themeColors.cardBg,
    background: themeColors.background,
    border: themeColors.cardBorder,
    text: themeColors.text,
    textSecondary: themeColors.textLight,
    primary: themeColors.primary
  };
  const [pendingImports, setPendingImports] = useState<PendingFinancialImport[]>([]);
  const [selectedImport, setSelectedImport] = useState<PendingFinancialImport | null>(null);
  const [accountUpdates, setAccountUpdates] = useState<Map<string, AccountUpdate>>(new Map());

  useEffect(() => {
    if (show) {
      loadPendingImports();
    }
  }, [show]);

  const loadPendingImports = () => {
    const imports = getPendingFinancialImports();
    setPendingImports(imports);
    if (imports.length > 0 && !selectedImport) {
      setSelectedImport(imports[0]);
      initializeMatches(imports[0]);
    }
  };

  const initializeMatches = (imp: PendingFinancialImport) => {
    const updates = new Map<string, AccountUpdate>();
    
    imp.extractedData.accounts.forEach((extracted, idx) => {
      const matchedAccount = findMatchingAccount(extracted.name, extracted.type);
      const matchedDeposit = findMatchingDeposit(extracted.name);
      
      const key = `${imp.id}-${idx}`;
      
      if (matchedAccount !== null) {
        updates.set(key, {
          type: 'account',
          action: 'update',
          existingIndex: matchedAccount,
          newBalance: extracted.balance,
          accountName: extracted.name,
          currency: extracted.currency,
          accountType: extracted.type
        });
      } else if (matchedDeposit !== null) {
        updates.set(key, {
          type: 'deposit',
          action: 'update',
          existingIndex: matchedDeposit,
          newBalance: extracted.balance,
          accountName: extracted.name,
          currency: extracted.currency,
          accountType: extracted.type
        });
      } else {
        updates.set(key, {
          type: 'account',
          action: 'create',
          newBalance: extracted.balance,
          accountName: extracted.name,
          currency: extracted.currency,
          accountType: extracted.type
        });
      }
    });
    
    setAccountUpdates(updates);
  };

  const findMatchingAccount = (name: string, extractedType?: string): number | null => {
    const lowerName = name.toLowerCase();
    const isLoan = (extractedType || '').toLowerCase() === 'loan';

    if (isLoan) {
      const bankFromName = lowerName.replace(/\s*loan\s*$/i, '').trim();
      const loanMatchIndex = bankData.accounts.findIndex(
        acc => acc.type.toLowerCase() === 'loan' &&
          (lowerName.includes(acc.bank.toLowerCase()) ||
           acc.bank.toLowerCase().includes(bankFromName) ||
           bankFromName.includes(acc.bank.toLowerCase()))
      );
      if (loanMatchIndex >= 0) return loanMatchIndex;
      const anyLoanIndex = bankData.accounts.findIndex(acc => acc.type.toLowerCase() === 'loan');
      if (anyLoanIndex >= 0 && bankData.accounts.filter(a => a.type.toLowerCase() === 'loan').length === 1) return anyLoanIndex;
      return null;
    }

    const index = bankData.accounts.findIndex(acc =>
      acc.bank.toLowerCase().includes(lowerName) ||
      lowerName.includes(acc.bank.toLowerCase()) ||
      acc.type.toLowerCase().includes(lowerName)
    );
    return index >= 0 ? index : null;
  };

  const findMatchingDeposit = (name: string): number | null => {
    const lowerName = name.toLowerCase();
    const index = bankData.deposits.findIndex(dep =>
      dep.bank.toLowerCase().includes(lowerName) ||
      lowerName.includes(dep.bank.toLowerCase())
    );
    return index >= 0 ? index : null;
  };

  const handleDismiss = (importId: string) => {
    dismissFinancialImport(importId);
    loadPendingImports();
    if (selectedImport?.id === importId) {
      setSelectedImport(pendingImports.length > 1 ? pendingImports[0] : null);
    }
  };

  const handleDelete = (importId: string) => {
    deletePendingImport(importId);
    loadPendingImports();
    if (selectedImport?.id === importId) {
      setSelectedImport(pendingImports.length > 1 ? pendingImports[0] : null);
    }
  };

  const handleApply = () => {
    if (!selectedImport) return;
    
    const updates: AccountUpdate[] = [];
    accountUpdates.forEach((update, key) => {
      if (key.startsWith(selectedImport.id)) {
        updates.push(update);
      }
    });
    
    onApplyImport(selectedImport.id, updates);
    loadPendingImports();
  };

  const toggleAction = (key: string, currentAction: 'update' | 'create' | 'skip') => {
    const update = accountUpdates.get(key);
    if (!update) return;
    
    const actions: Array<'update' | 'create' | 'skip'> = ['update', 'create', 'skip'];
    const nextAction = actions[(actions.indexOf(currentAction) + 1) % 3];
    
    setAccountUpdates(new Map(accountUpdates.set(key, {
      ...update,
      action: nextAction
    })));
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAccountType = (type: string): string => {
    const t = type.toLowerCase();
    if (t === 'checking') return 'Checking';
    if (t === 'savings') return 'Savings';
    if (t === 'loan') return 'Loan';
    if (t === 'brokerage') return 'Brokerage';
    if (t === 'retirement') return 'Retirement';
    if (t === 'crypto') return 'Crypto';
    return type;
  };

  if (!show) return null;

  return (
    <Portal>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: colors.surface,
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '1.5rem',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📊</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: colors.text }}>
                  Pending Financial Imports
                </h2>
                <p style={{ margin: 0, fontSize: '0.875rem', color: colors.textSecondary }}>
                  {pendingImports.length} import{pendingImports.length !== 1 ? 's' : ''} waiting for approval
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: colors.textSecondary
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
            {pendingImports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: colors.textSecondary }}>
                <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>✅</span>
                <p>No pending imports</p>
                <p style={{ fontSize: '0.875rem' }}>
                  Scan a brokerage screenshot from Smart → Image Scan
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {/* Import List */}
                <div style={{ flex: '1 1 250px', minWidth: '250px' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: colors.textSecondary, marginBottom: '0.75rem' }}>
                    SCANNED IMAGES
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {pendingImports.map(imp => {
                      const info = BROKERAGE_INFO[imp.extractedData.source] || {
                        name: (imp.extractedData.source && imp.extractedData.source !== 'unknown')
                          ? String(imp.extractedData.source).charAt(0).toUpperCase() + String(imp.extractedData.source).slice(1)
                          : 'Unknown',
                        icon: '📊',
                        color: colors.primary
                      };
                      const isSelected = selectedImport?.id === imp.id;
                      
                      return (
                        <div
                          key={imp.id}
                          onClick={() => {
                            setSelectedImport(imp);
                            initializeMatches(imp);
                          }}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '0.5rem',
                            border: `2px solid ${isSelected ? colors.primary : colors.border}`,
                            background: isSelected ? `${colors.primary}10` : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>{info.icon}</span>
                            <span style={{ fontWeight: 600, color: colors.text }}>{info.name}</span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                            {imp.extractedData.accounts.length} accounts • {formatDate(imp.createdAt)}
                          </div>
                          <div style={{ 
                            fontSize: '0.875rem', 
                            fontWeight: 600, 
                            color: info.color,
                            marginTop: '0.25rem'
                          }}>
                            {imp.extractedData.totalValue 
                              ? formatCurrency(imp.extractedData.totalValue, imp.extractedData.accounts[0]?.currency || 'USD')
                              : 'Total not available'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Import Details */}
                {selectedImport && (
                  <div style={{ flex: '2 1 400px', minWidth: '300px' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: colors.textSecondary, marginBottom: '0.75rem' }}>
                      REVIEW & MATCH ACCOUNTS
                    </h3>
                    
                    <div style={{ 
                      background: colors.background, 
                      borderRadius: '0.5rem', 
                      padding: '1rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginBottom: '0.5rem' }}>
                        Confidence: {Math.round(selectedImport.extractedData.confidence * 100)}%
                      </div>
                      
                      {selectedImport.extractedData.accounts.map((account, idx) => {
                        const key = `${selectedImport.id}-${idx}`;
                        const update = accountUpdates.get(key);
                        const existingAccount = update?.existingIndex !== undefined && update?.type === 'account'
                          ? bankData.accounts[update.existingIndex]
                          : null;
                        const existingDeposit = update?.existingIndex !== undefined && update?.type === 'deposit'
                          ? bankData.deposits[update.existingIndex]
                          : null;
                        
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '0.75rem',
                              border: `1px solid ${colors.border}`,
                              borderRadius: '0.5rem',
                              marginBottom: '0.5rem',
                              background: colors.surface
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                              <div>
                                <div style={{ fontWeight: 600, color: colors.text }}>{account.name}</div>
                                <div style={{ fontSize: '0.75rem', color: colors.textSecondary }}>
                                  {formatAccountType(account.type)} • {account.currency}
                                </div>
                              </div>
                              <div style={{ 
                                fontSize: '1.125rem', 
                                fontWeight: 700, 
                                color: colors.primary 
                              }}>
                                {formatCurrency(account.type === 'loan' ? Math.abs(account.balance) : account.balance, account.currency)}
                                {account.type === 'loan' && account.balance < 0 && (
                                  <span style={{ fontSize: '0.7rem', color: colors.textSecondary, display: 'block', fontWeight: 400 }}>Principal (stored as negative)</span>
                                )}
                              </div>
                            </div>
                            
                            {/* Match Info + Impact Summary */}
                            {(existingAccount || existingDeposit) && (
                              <div style={{
                                padding: '0.5rem',
                                background: `${colors.primary}10`,
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                marginBottom: '0.5rem'
                              }}>
                                <div style={{ color: colors.textSecondary }}>Matched with existing:</div>
                                <div style={{ fontWeight: 600, color: colors.text }}>
                                  {existingAccount?.bank || existingDeposit?.bank}
                                </div>
                                <div style={{ color: colors.textSecondary }}>
                                  Current: {formatCurrency(
                                    Number(existingAccount?.amount || existingDeposit?.deposit || 0),
                                    account.currency
                                  )}
                                  {' → '}
                                  <span style={{ color: colors.primary, fontWeight: 600 }}>
                                    {formatCurrency(account.type === 'loan' ? Math.abs(account.balance) : account.balance, account.currency)}
                                  </span>
                                </div>
                                {update?.action !== 'skip' && (() => {
                                  const currentVal = Number(existingAccount?.amount ?? existingDeposit?.deposit ?? 0) || 0;
                                  const newVal = account.balance;
                                  const delta = newVal - currentVal;
                                  const isLoan = (account.type || '').toLowerCase() === 'loan';
                                  const absCurrent = Math.abs(currentVal);
                                  const pct = absCurrent !== 0 && !Number.isNaN(delta)
                                    ? Math.round((delta / absCurrent) * 100)
                                    : null;
                                  const isIncrease = delta > 0;
                                  const isDecrease = delta < 0;
                                  const deltaLabel = isLoan
                                    ? (isIncrease ? 'Principal ↑' : 'Principal ↓')
                                    : (isIncrease ? 'will increase by' : 'will decrease by');
                                  const deltaStr = formatCurrency(Math.abs(delta), account.currency);
                                  const pctStr = pct !== null ? ` (${pct > 0 ? '+' : ''}${pct}% ${isDecrease ? 'decrease' : 'increase'})` : '';
                                  return (
                                    <div style={{
                                      marginTop: '0.35rem',
                                      padding: '0.35rem 0.5rem',
                                      background: colors.surface,
                                      borderRadius: '0.25rem',
                                      borderLeft: `3px solid ${isIncrease ? '#10b981' : isDecrease ? '#f59e0b' : colors.border}`,
                                      fontWeight: 600,
                                      color: isIncrease ? '#059669' : isDecrease ? '#d97706' : colors.text
                                    }}>
                                      {account.name} {deltaLabel} {deltaStr}{pctStr}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                            {(!existingAccount && !existingDeposit) && update?.action === 'create' && (
                              <div style={{
                                marginTop: '0.35rem',
                                padding: '0.35rem 0.5rem',
                                background: `${colors.primary}12`,
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: colors.primary
                              }}>
                                New account: {formatCurrency(account.type === 'loan' ? Math.abs(account.balance) : account.balance, account.currency)}
                              </div>
                            )}
                            
                            {/* Action Selector */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {(['update', 'create', 'skip'] as const).map(action => (
                                <button
                                  key={action}
                                  onClick={() => {
                                    const current = accountUpdates.get(key);
                                    if (current) {
                                      setAccountUpdates(new Map(accountUpdates.set(key, {
                                        ...current,
                                        action: action
                                      })));
                                    }
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '0.375rem',
                                    fontSize: '0.75rem',
                                    border: `1px solid ${update?.action === action ? colors.primary : colors.border}`,
                                    borderRadius: '0.25rem',
                                    background: update?.action === action ? `${colors.primary}20` : 'transparent',
                                    color: update?.action === action ? colors.primary : colors.textSecondary,
                                    cursor: 'pointer',
                                    fontWeight: update?.action === action ? 600 : 400
                                  }}
                                >
                                  {action === 'update' && '✏️ Update'}
                                  {action === 'create' && '➕ Create'}
                                  {action === 'skip' && '⏭️ Skip'}
                                </button>
                              ))}
                            </div>
                            
                            {/* Holdings Preview */}
                            {account.holdings && account.holdings.length > 0 && (
                              <details style={{ marginTop: '0.5rem' }}>
                                <summary style={{ 
                                  fontSize: '0.75rem', 
                                  color: colors.textSecondary, 
                                  cursor: 'pointer' 
                                }}>
                                  {account.holdings.length} holdings detected
                                </summary>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
                                  {account.holdings.slice(0, 5).map((h, i) => (
                                    <div key={i} style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between',
                                      padding: '0.25rem 0',
                                      borderBottom: `1px solid ${colors.border}`
                                    }}>
                                      <span>{h.symbol || h.name}</span>
                                      <span style={{ fontWeight: 600 }}>{formatCurrency(h.value, account.currency)}</span>
                                    </div>
                                  ))}
                                  {account.holdings.length > 5 && (
                                    <div style={{ color: colors.textSecondary, padding: '0.25rem 0' }}>
                                      +{account.holdings.length - 5} more...
                                    </div>
                                  )}
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {selectedImport && pendingImports.length > 0 && (
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => handleDelete(selectedImport.id)}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '0.5rem',
                  background: 'transparent',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Delete
              </button>
              <button
                onClick={() => handleDismiss(selectedImport.id)}
                style={{
                  padding: '0.625rem 1.25rem',
                  border: `1px solid #f59e0b`,
                  borderRadius: '0.5rem',
                  background: 'transparent',
                  color: '#f59e0b',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                Dismiss
              </button>
              <button
                onClick={handleApply}
                style={{
                  padding: '0.625rem 1.5rem',
                  border: 'none',
                  borderRadius: '0.5rem',
                  background: colors.primary,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                Apply Changes
              </button>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default PendingFinancialImportsModal;
