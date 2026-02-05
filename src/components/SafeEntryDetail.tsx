/**
 * Safe Entry Detail Component
 * 
 * Displays decrypted entry details with copy functionality
 * Opens as a modal/popup for consistent UX with documents
 */

import React, { useState, useEffect } from 'react';
import { SafeEntry, Tag, SafeEntryEncryptedData } from '../types';
import { CryptoKey } from '../utils/encryption';
import { decryptSafeEntry, deleteSafeEntry, markSafeEntryAccessed } from '../storage';
import { generateTOTP, getTOTPRemainingSeconds } from '../utils/totp';
import Portal from './Portal';

interface SafeEntryDetailProps {
  entry: SafeEntry;
  tags: Tag[];
  encryptionKey: CryptoKey;
  onEdit: (entry: SafeEntry) => void;
  onDelete: () => void;
  onClose: () => void;
}

const SafeEntryDetail: React.FC<SafeEntryDetailProps> = ({
  entry,
  tags,
  encryptionKey,
  onEdit,
  onDelete,
  onClose
}) => {
  const [encryptedData, setEncryptedData] = useState<SafeEntryEncryptedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showCustomFields, setShowCustomFields] = useState<Record<number, boolean>>({});
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpRemaining, setTotpRemaining] = useState<number>(0);

  useEffect(() => {
    loadEntryData();
  }, [entry]);

  // Update TOTP code every second if TOTP secret exists
  useEffect(() => {
    if (!encryptedData?.totpSecret) {
      setTotpCode(null);
      return;
    }

    const updateTOTP = async () => {
      try {
        const code = await generateTOTP(encryptedData.totpSecret!);
        setTotpCode(code);
        setTotpRemaining(getTOTPRemainingSeconds());
      } catch (error) {
        console.error('Error generating TOTP:', error);
      }
    };

    updateTOTP();
    const interval = setInterval(updateTOTP, 1000);
    return () => clearInterval(interval);
  }, [encryptedData?.totpSecret]);

  const loadEntryData = async () => {
    try {
      // Check if entry is already decrypted (shared entries)
      if (entry.decryptedData) {
        console.log('[SafeEntryDetail] ✅ Using pre-decrypted data (shared entry)');
        setEncryptedData(entry.decryptedData);
      } else {
        // Decrypt with user's master key (own entries)
        console.log('[SafeEntryDetail] 🔓 Decrypting with master key (own entry)');
        const decryptedJson = await decryptSafeEntry(entry, encryptionKey);
        const data: SafeEntryEncryptedData = JSON.parse(decryptedJson);
        setEncryptedData(data);
      }
      
      // Mark as accessed
      await markSafeEntryAccessed(entry.id);
    } catch (error) {
      console.error('Error loading entry data:', error);
      alert('Failed to load entry data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard`);
    });
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      try {
        await deleteSafeEntry(entry.id);
        onDelete();
      } catch (error) {
        console.error('Error deleting entry:', error);
        alert('Failed to delete entry. Please try again.');
      }
    }
  };

  const getCategoryName = () => {
    if (!entry.categoryTagId) return 'Uncategorized';
    const tag = tags.find(t => t.id === entry.categoryTagId);
    return tag?.name || 'Unknown';
  };

  const getCategoryColor = () => {
    if (!entry.categoryTagId) return '#667eea';
    const tag = tags.find(t => t.id === entry.categoryTagId);
    return tag?.color || '#667eea';
  };

  if (isLoading) {
    return (
      <Portal>
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <p>Loading entry...</p>
          </div>
        </div>
      </Portal>
    );
  }

  if (!encryptedData) {
    return (
      <Portal>
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <p>Failed to load entry data.</p>
            <button onClick={onClose} style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              marginTop: '1rem'
            }}>
              Close
            </button>
          </div>
        </div>
      </Portal>
    );
  }

  return (
    <Portal>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        overflowY: 'auto'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '1rem',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '1.25rem',
            borderRadius: '1rem 1rem 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'white' }}>{entry.title}</h2>
              {entry.isFavorite && <span>⭐</span>}
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '1.25rem'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '1.25rem' }}>

          {entry.url && (
            <div style={{ marginBottom: '0.75rem' }}>
              <a
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#3b82f6', textDecoration: 'none', fontSize: '0.875rem' }}
              >
                🔗 {entry.url}
              </a>
              <button
                onClick={() => handleCopyToClipboard(entry.url!, 'URL')}
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.125rem 0.375rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.65rem'
                }}
              >
                Copy
              </button>
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <span style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: getCategoryColor(),
              color: 'white',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 500
            }}>
              {getCategoryName()}
            </span>
          
            {/* Display user-created tags */}
            {entry.tags && entry.tags.length > 0 && (
              entry.tags.map(tagId => {
                const tag = tags.find(t => t.id === tagId && !t.isSystemCategory);
                if (!tag) return null;
                return (
                  <span
                    key={tagId}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: tag.color || '#667eea',
                      color: 'white',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                  >
                    {tag.name}
                  </span>
                );
              })
            )}
          </div>

      {/* Encrypted Information */}
      <div style={{ marginBottom: '1rem' }}>
        
        {encryptedData.username && (
          <div style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.125rem', fontSize: '0.75rem', opacity: 0.7 }}>
                  Username/Email
                </label>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{encryptedData.username}</div>
              </div>
              <button
                onClick={() => handleCopyToClipboard(encryptedData.username!, 'Username')}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '0.7rem'
                }}
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {encryptedData.password && (
          <div style={{
            marginBottom: '0.75rem',
            padding: '0.75rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.125rem', fontSize: '0.75rem', opacity: 0.7 }}>
                  Password
                </label>
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: 500,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  {showPassword ? encryptedData.password : '•'.repeat(12)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => handleCopyToClipboard(encryptedData.password!, 'Password')}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.7rem'
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        )}

        {encryptedData.notes && (
          <div style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem'
          }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
              Notes
            </label>
            <div style={{ 
              fontSize: '1rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {encryptedData.notes}
            </div>
          </div>
        )}

        {encryptedData.expiryDate && (
          <div style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem'
          }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>
              Expiry Date
            </label>
            <div style={{ fontSize: '1rem', fontWeight: 500 }}>
              {new Date(encryptedData.expiryDate).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* TOTP Code Display */}
        {encryptedData.totpSecret && (
          <div style={{
            marginBottom: '1rem',
            padding: '1.5rem',
            backgroundColor: '#dbeafe',
            border: '2px solid #3b82f6',
            borderRadius: '0.5rem'
          }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', opacity: 0.7 }}>
              Two-Factor Authentication Code
              {encryptedData.totpIssuer && ` (${encryptedData.totpIssuer})`}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                letterSpacing: '0.5rem',
                color: '#1e40af'
              }}>
                {totpCode || '------'}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                Expires in {totpRemaining}s
              </div>
              {totpCode && (
                <button
                  onClick={() => handleCopyToClipboard(totpCode, 'TOTP Code')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem'
                  }}
                >
                  📋 Copy
                </button>
              )}
            </div>
          </div>
        )}

        {/* Category-Specific Fields */}
        {getCategoryName() === 'Credit Card' && (encryptedData.cardNumber || encryptedData.cardholderName) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Credit Card Details</h4>
            {encryptedData.cardNumber && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Card Number</label>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.cardNumber}</div>
              </div>
            )}
            {encryptedData.cardholderName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Cardholder</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.cardholderName}</div>
              </div>
            )}
            {encryptedData.billingAddress && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Billing Address</label>
                <div style={{ fontSize: '1rem', whiteSpace: 'pre-wrap' }}>{encryptedData.billingAddress}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'Bank Account' && (encryptedData.accountNumber || encryptedData.bankName) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Bank Account Details</h4>
            {encryptedData.bankName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Bank Name</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.bankName}</div>
              </div>
            )}
            {encryptedData.accountNumber && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Account Number</label>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.accountNumber}</div>
              </div>
            )}
            {encryptedData.accountType && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Account Type</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.accountType}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'Stock Trading Account' && (encryptedData.brokerName || encryptedData.tradingPlatform) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Trading Account Details</h4>
            {encryptedData.brokerName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Broker</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.brokerName}</div>
              </div>
            )}
            {encryptedData.tradingPlatform && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Platform</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.tradingPlatform}</div>
              </div>
            )}
            {encryptedData.tradingAccountType && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Account Type</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.tradingAccountType}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'Identity Documents' && (encryptedData.documentNumber || encryptedData.issueDate) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Identity Document Details</h4>
            {encryptedData.documentNumber && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Document Number</label>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.documentNumber}</div>
              </div>
            )}
            {encryptedData.issueDate && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Issue Date</label>
                <div style={{ fontSize: '1rem' }}>{new Date(encryptedData.issueDate).toLocaleDateString()}</div>
              </div>
            )}
            {encryptedData.issueAuthority && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Issue Authority</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.issueAuthority}</div>
              </div>
            )}
            {encryptedData.issueLocation && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Issue Location</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.issueLocation}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'Insurance' && (encryptedData.policyNumber || encryptedData.provider) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Insurance Details</h4>
            {encryptedData.policyNumber && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Policy Number</label>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.policyNumber}</div>
              </div>
            )}
            {encryptedData.groupNumber && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Group Number</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.groupNumber}</div>
              </div>
            )}
            {encryptedData.provider && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Provider</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.provider}</div>
              </div>
            )}
            {encryptedData.agentName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Agent Name</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.agentName}</div>
              </div>
            )}
            {encryptedData.agentPhone && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Agent Phone</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.agentPhone}</div>
              </div>
            )}
            {encryptedData.agentEmail && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Agent Email</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.agentEmail}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'Medical' && (encryptedData.memberId || encryptedData.provider) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Medical Details</h4>
            {encryptedData.memberId && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Member ID</label>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.memberId}</div>
              </div>
            )}
            {encryptedData.medicalGroupNumber && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Group Number</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.medicalGroupNumber}</div>
              </div>
            )}
            {encryptedData.medicalProvider && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Provider</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.medicalProvider}</div>
              </div>
            )}
            {encryptedData.planName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Plan Name</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.planName}</div>
              </div>
            )}
            {encryptedData.rxBin && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>RX BIN</label>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.rxBin}</div>
              </div>
            )}
            {encryptedData.rxPCN && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>RX PCN</label>
                <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.rxPCN}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'License/Software' && (encryptedData.licenseKey || encryptedData.productName) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>License/Software Details</h4>
            {encryptedData.licenseKey && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>License Key</label>
                    <div style={{ fontSize: '1rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{encryptedData.licenseKey}</div>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(encryptedData.licenseKey!, 'License Key')}
                    style={{
                      marginLeft: '1rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
            {encryptedData.productName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Product Name</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.productName}</div>
              </div>
            )}
            {encryptedData.version && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Version</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.version}</div>
              </div>
            )}
            {encryptedData.vendor && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Vendor</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.vendor}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'API Key' && (encryptedData.apiKey || encryptedData.serviceName) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>API Key Details</h4>
            {encryptedData.serviceName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Service Name</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.serviceName}</div>
              </div>
            )}
            {encryptedData.apiKey && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>API Key</label>
                    <div style={{ fontSize: '1rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{encryptedData.apiKey}</div>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(encryptedData.apiKey!, 'API Key')}
                    style={{
                      marginLeft: '1rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
            {encryptedData.apiSecret && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>API Secret</label>
                    <div style={{ fontSize: '1rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>{encryptedData.apiSecret}</div>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(encryptedData.apiSecret!, 'API Secret')}
                    style={{
                      marginLeft: '1rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
            {encryptedData.endpoint && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Endpoint</label>
                <div style={{ fontSize: '1rem', wordBreak: 'break-all' }}>{encryptedData.endpoint}</div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'WiFi' && (encryptedData.networkName || encryptedData.securityType) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>WiFi Network Details</h4>
            {encryptedData.networkName && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Network Name (SSID)</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.networkName}</div>
              </div>
            )}
            {encryptedData.securityType && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Security Type</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.securityType}</div>
              </div>
            )}
            {encryptedData.password && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Password</label>
                    <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.password}</div>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(encryptedData.password!, 'WiFi Password')}
                    style={{
                      marginLeft: '1rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {getCategoryName() === 'Gift Card' && (encryptedData.cardNumber || encryptedData.merchant) && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Gift Card Details</h4>
            {encryptedData.merchant && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Merchant</label>
                <div style={{ fontSize: '1rem' }}>{encryptedData.merchant}</div>
              </div>
            )}
            {encryptedData.giftCardNumber && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Card Number</label>
                    <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.giftCardNumber}</div>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(encryptedData.giftCardNumber!, 'Card Number')}
                    style={{
                      marginLeft: '1rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
            {encryptedData.giftCardPin && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>PIN</label>
                    <div style={{ fontSize: '1rem', fontFamily: 'monospace' }}>{encryptedData.giftCardPin}</div>
                  </div>
                  <button
                    onClick={() => handleCopyToClipboard(encryptedData.giftCardPin!, 'PIN')}
                    style={{
                      marginLeft: '1rem',
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            )}
            {encryptedData.balance !== undefined && encryptedData.balance !== null && (
              <div style={{ marginBottom: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>Balance</label>
                <div style={{ fontSize: '1rem', fontWeight: 500 }}>${encryptedData.balance.toFixed(2)}</div>
              </div>
            )}
          </div>
        )}

        {/* Custom Fields */}
        {encryptedData.customFields && encryptedData.customFields.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Custom Fields</h4>
            {encryptedData.customFields.map((field, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '0.75rem',
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', opacity: 0.7 }}>
                      {field.key || `Field ${index + 1}`}
                      {field.isEncrypted && <span style={{ marginLeft: '0.5rem' }}>🔒</span>}
                    </label>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: 500,
                      fontFamily: field.isEncrypted && !showCustomFields[index] ? 'monospace' : 'inherit',
                      wordBreak: 'break-all'
                    }}>
                      {field.isEncrypted && !showCustomFields[index] 
                        ? '•'.repeat(16) 
                        : field.value}
                    </div>
                  </div>
                  {field.isEncrypted && (
                    <button
                      onClick={() => setShowCustomFields({ ...showCustomFields, [index]: !showCustomFields[index] })}
                      style={{
                        marginLeft: '1rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      {showCustomFields[index] ? '👁️‍🗨️ Hide' : '👁️ Show'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div style={{
        padding: '0.5rem',
        backgroundColor: '#f9fafb',
        borderRadius: '0.375rem',
        marginBottom: '1rem',
        fontSize: '0.7rem',
        opacity: 0.7
      }}>
        <div>Created: {new Date(entry.createdAt).toLocaleString()}</div>
        <div>Updated: {new Date(entry.updatedAt).toLocaleString()}</div>
        {entry.lastAccessedAt && (
          <div>Last accessed: {new Date(entry.lastAccessedAt).toLocaleString()}</div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={() => onEdit(entry)}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500
          }}
        >
          ✎ Edit
        </button>
        <button
          onClick={handleDelete}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500
          }}
        >
          🗑 Delete
        </button>
      </div>
          </div>{/* Close Content */}
        </div>{/* Close modal box */}
      </div>{/* Close backdrop */}
    </Portal>
  );
};

export default SafeEntryDetail;

