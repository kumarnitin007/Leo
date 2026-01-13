/**
 * Category-Specific Fields Component
 * 
 * Renders fields based on selected category
 */

import React, { useState } from 'react';
import { SafeEntryEncryptedData, Tag } from '../types';
import { generateTOTPSecret, generateTOTPURI } from '../utils/totp';
import { QRCodeSVG } from 'qrcode.react';

interface SafeCategoryFieldsProps {
  categoryTagId: string | undefined;
  tags: Tag[];
  encryptedData: SafeEntryEncryptedData;
  onDataChange: (data: Partial<SafeEntryEncryptedData>) => void;
}

const SafeCategoryFields: React.FC<SafeCategoryFieldsProps> = ({
  categoryTagId,
  tags,
  encryptedData,
  onDataChange
}) => {
  const [showTOTPQR, setShowTOTPQR] = useState(false);
  const [showCardNumber, setShowCardNumber] = useState(false);
  const [showCVV, setShowCVV] = useState(false);
  const [showPIN, setShowPIN] = useState(false);
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showRoutingNumber, setShowRoutingNumber] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showGiftCardNumber, setShowGiftCardNumber] = useState(false);
  const [showGiftCardPin, setShowGiftCardPin] = useState(false);

  if (!categoryTagId) return null;

  const category = tags.find(t => t.id === categoryTagId);
  const categoryName = category?.name || '';

  // Credit Card fields
  if (categoryName === 'Credit Card') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Credit Card Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Card Number
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type={showCardNumber ? 'text' : 'password'}
              value={encryptedData.cardNumber || ''}
              onChange={(e) => onDataChange({ cardNumber: e.target.value })}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'monospace'
              }}
              placeholder="1234 5678 9012 3456"
            />
            <button
              type="button"
              onClick={() => setShowCardNumber(!showCardNumber)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              {showCardNumber ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              CVV
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type={showCVV ? 'text' : 'password'}
                value={encryptedData.cvv || ''}
                onChange={(e) => onDataChange({ cvv: e.target.value })}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  maxWidth: '120px'
                }}
                placeholder="123"
                maxLength={4}
              />
              <button
                type="button"
                onClick={() => setShowCVV(!showCVV)}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {showCVV ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              PIN
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type={showPIN ? 'text' : 'password'}
                value={encryptedData.pin || ''}
                onChange={(e) => onDataChange({ pin: e.target.value })}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  maxWidth: '120px'
                }}
                placeholder="1234"
                maxLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPIN(!showPIN)}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {showPIN ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Cardholder Name
          </label>
          <input
            type="text"
            value={encryptedData.cardholderName || ''}
            onChange={(e) => onDataChange({ cardholderName: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="John Doe"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Billing Address
          </label>
          <textarea
            value={encryptedData.billingAddress || ''}
            onChange={(e) => onDataChange({ billingAddress: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
            placeholder="123 Main St, City, State, ZIP"
          />
        </div>
      </div>
    );
  }

  // Bank Account fields
  if (categoryName === 'Bank Account') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Bank Account Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Bank Name
          </label>
          <input
            type="text"
            value={encryptedData.bankName || ''}
            onChange={(e) => onDataChange({ bankName: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Chase Bank"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Account Number
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type={showAccountNumber ? 'text' : 'password'}
                value={encryptedData.accountNumber || ''}
                onChange={(e) => onDataChange({ accountNumber: e.target.value })}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: 'monospace'
                }}
                placeholder="1234567890"
              />
              <button
                type="button"
                onClick={() => setShowAccountNumber(!showAccountNumber)}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {showAccountNumber ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Routing Number
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type={showRoutingNumber ? 'text' : 'password'}
                value={encryptedData.routingNumber || ''}
                onChange={(e) => onDataChange({ routingNumber: e.target.value })}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: 'monospace'
                }}
                placeholder="123456789"
                maxLength={9}
              />
              <button
                type="button"
                onClick={() => setShowRoutingNumber(!showRoutingNumber)}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {showRoutingNumber ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Account Type
            </label>
            <select
              value={encryptedData.accountType || ''}
              onChange={(e) => onDataChange({ accountType: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                backgroundColor: 'white'
              }}
            >
              <option value="">Select type</option>
              <option value="Checking">Checking</option>
              <option value="Savings">Savings</option>
              <option value="Money Market">Money Market</option>
              <option value="CD">CD</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              SWIFT Code
            </label>
            <input
              type="text"
              value={encryptedData.swiftCode || ''}
              onChange={(e) => onDataChange({ swiftCode: e.target.value.toUpperCase() })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'monospace',
                textTransform: 'uppercase'
              }}
              placeholder="CHASUS33"
              maxLength={11}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            IBAN (International)
          </label>
          <input
            type="text"
            value={encryptedData.iban || ''}
            onChange={(e) => onDataChange({ iban: e.target.value.toUpperCase() })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontFamily: 'monospace',
              textTransform: 'uppercase'
            }}
            placeholder="US64SVBKUS6S3300958879"
          />
        </div>
      </div>
    );
  }

  // Stock Trading Account fields
  if (categoryName === 'Stock Trading Account') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Stock Trading Account Information</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Broker Name
            </label>
            <input
              type="text"
              value={encryptedData.brokerName || ''}
              onChange={(e) => onDataChange({ brokerName: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Charles Schwab"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Trading Platform
            </label>
            <input
              type="text"
              value={encryptedData.tradingPlatform || ''}
              onChange={(e) => onDataChange({ tradingPlatform: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Thinkorswim, E*TRADE, etc."
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Account Type
            </label>
            <select
              value={encryptedData.accountType || ''}
              onChange={(e) => onDataChange({ accountType: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                backgroundColor: 'white'
              }}
            >
              <option value="">Select type</option>
              <option value="Individual">Individual</option>
              <option value="Joint">Joint</option>
              <option value="IRA">IRA</option>
              <option value="Roth IRA">Roth IRA</option>
              <option value="401(k)">401(k)</option>
              <option value="Trust">Trust</option>
              <option value="Corporate">Corporate</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Account Holder
            </label>
            <input
              type="text"
              value={encryptedData.accountHolder || ''}
              onChange={(e) => onDataChange({ accountHolder: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="John Doe"
            />
          </div>
        </div>
      </div>
    );
  }

  // Identity Documents fields
  if (categoryName === 'Identity Documents') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Identity Document Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Document Number
          </label>
          <input
            type="text"
            value={encryptedData.documentNumber || ''}
            onChange={(e) => onDataChange({ documentNumber: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
              fontFamily: 'monospace'
            }}
            placeholder="Passport, SSN, License number"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Issue Date
            </label>
            <input
              type="date"
              value={encryptedData.issueDate || ''}
              onChange={(e) => onDataChange({ issueDate: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Issue Authority
            </label>
            <input
              type="text"
              value={encryptedData.issueAuthority || ''}
              onChange={(e) => onDataChange({ issueAuthority: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="State, Country, Agency"
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Issue Location
          </label>
          <input
            type="text"
            value={encryptedData.issueLocation || ''}
            onChange={(e) => onDataChange({ issueLocation: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="City, State"
          />
        </div>
      </div>
    );
  }

  // Insurance fields
  if (categoryName === 'Insurance') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Insurance Information</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Policy Number
            </label>
            <input
              type="text"
              value={encryptedData.policyNumber || ''}
              onChange={(e) => onDataChange({ policyNumber: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
              }}
              placeholder="Policy number"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Group Number
            </label>
            <input
              type="text"
              value={encryptedData.groupNumber || ''}
              onChange={(e) => onDataChange({ groupNumber: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Group number"
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Provider
          </label>
          <input
            type="text"
            value={encryptedData.provider || ''}
            onChange={(e) => onDataChange({ provider: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Insurance provider name"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Agent Name
          </label>
          <input
            type="text"
            value={encryptedData.agentName || ''}
            onChange={(e) => onDataChange({ agentName: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Agent name"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Agent Phone
            </label>
            <input
              type="tel"
              value={encryptedData.agentPhone || ''}
              onChange={(e) => onDataChange({ agentPhone: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Phone number"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Agent Email
            </label>
            <input
              type="email"
              value={encryptedData.agentEmail || ''}
              onChange={(e) => onDataChange({ agentEmail: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Email address"
            />
          </div>
        </div>
      </div>
    );
  }

  // Medical fields
  if (categoryName === 'Medical') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Medical Information</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Member ID
            </label>
            <input
              type="text"
              value={encryptedData.memberId || ''}
              onChange={(e) => onDataChange({ memberId: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
              }}
              placeholder="Member ID"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Group Number
            </label>
            <input
              type="text"
              value={encryptedData.medicalGroupNumber || ''}
              onChange={(e) => onDataChange({ medicalGroupNumber: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Group number"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Provider
            </label>
            <input
              type="text"
              value={encryptedData.medicalProvider || ''}
              onChange={(e) => onDataChange({ medicalProvider: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Medical provider"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Plan Name
            </label>
            <input
              type="text"
              value={encryptedData.planName || ''}
              onChange={(e) => onDataChange({ planName: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Plan name"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              RX BIN
            </label>
            <input
              type="text"
              value={encryptedData.rxBin || ''}
              onChange={(e) => onDataChange({ rxBin: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
              }}
              placeholder="RX BIN"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              RX PCN
            </label>
            <input
              type="text"
              value={encryptedData.rxPCN || ''}
              onChange={(e) => onDataChange({ rxPCN: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box',
                fontFamily: 'monospace'
              }}
              placeholder="RX PCN"
            />
          </div>
        </div>
      </div>
    );
  }

  // License/Software fields
  if (categoryName === 'License/Software') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>License/Software Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            License Key
          </label>
          <input
            type="text"
            value={encryptedData.licenseKey || ''}
            onChange={(e) => onDataChange({ licenseKey: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
              fontFamily: 'monospace'
            }}
            placeholder="License key"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Product Name
            </label>
            <input
              type="text"
              value={encryptedData.productName || ''}
              onChange={(e) => onDataChange({ productName: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Product name"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Version
            </label>
            <input
              type="text"
              value={encryptedData.version || ''}
              onChange={(e) => onDataChange({ version: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Version number"
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Vendor
          </label>
          <input
            type="text"
            value={encryptedData.vendor || ''}
            onChange={(e) => onDataChange({ vendor: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Vendor/Company name"
          />
        </div>
      </div>
    );
  }

  // API Key fields
  if (categoryName === 'API Key') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>API Key Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Service Name
          </label>
          <input
            type="text"
            value={encryptedData.serviceName || ''}
            onChange={(e) => onDataChange({ serviceName: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Service name (e.g., AWS, GitHub)"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            API Key
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type={showApiKey ? 'text' : 'password'}
              value={encryptedData.apiKey || ''}
              onChange={(e) => onDataChange({ apiKey: e.target.value })}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'monospace',
                boxSizing: 'border-box'
              }}
              placeholder="API Key"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              {showApiKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            API Secret
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type={showApiSecret ? 'text' : 'password'}
              value={encryptedData.apiSecret || ''}
              onChange={(e) => onDataChange({ apiSecret: e.target.value })}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'monospace',
                boxSizing: 'border-box'
              }}
              placeholder="API Secret"
            />
            <button
              type="button"
              onClick={() => setShowApiSecret(!showApiSecret)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              {showApiSecret ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Endpoint
          </label>
          <input
            type="url"
            value={encryptedData.endpoint || ''}
            onChange={(e) => onDataChange({ endpoint: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="https://api.example.com"
          />
        </div>
      </div>
    );
  }

  // WiFi fields
  if (categoryName === 'WiFi') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>WiFi Network Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Network Name (SSID)
          </label>
          <input
            type="text"
            value={encryptedData.networkName || ''}
            onChange={(e) => onDataChange({ networkName: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Network name"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Security Type
          </label>
          <select
            value={encryptedData.securityType || ''}
            onChange={(e) => onDataChange({ securityType: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              backgroundColor: 'white',
              boxSizing: 'border-box'
            }}
          >
            <option value="">Select security type</option>
            <option value="WPA2">WPA2</option>
            <option value="WPA3">WPA3</option>
            <option value="WPA">WPA</option>
            <option value="WEP">WEP</option>
            <option value="Open">Open (No password)</option>
          </select>
        </div>
      </div>
    );
  }

  // Gift Card fields
  if (categoryName === 'Gift Card') {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Gift Card Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Merchant
          </label>
          <input
            type="text"
            value={encryptedData.merchant || ''}
            onChange={(e) => onDataChange({ merchant: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Merchant name"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Card Number
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type={showGiftCardNumber ? 'text' : 'password'}
              value={encryptedData.giftCardNumber || ''}
              onChange={(e) => onDataChange({ giftCardNumber: e.target.value })}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'monospace',
                boxSizing: 'border-box'
              }}
              placeholder="Gift card number"
            />
            <button
              type="button"
              onClick={() => setShowGiftCardNumber(!showGiftCardNumber)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              {showGiftCardNumber ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              PIN
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type={showGiftCardPin ? 'text' : 'password'}
                value={encryptedData.giftCardPin || ''}
                onChange={(e) => onDataChange({ giftCardPin: e.target.value })}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
                placeholder="PIN"
                maxLength={10}
              />
              <button
                type="button"
                onClick={() => setShowGiftCardPin(!showGiftCardPin)}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                {showGiftCardPin ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Balance
            </label>
            <input
              type="number"
              step="0.01"
              value={encryptedData.balance || ''}
              onChange={(e) => onDataChange({ balance: e.target.value ? parseFloat(e.target.value) : undefined })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
    );
  }

  // TOTP fields (for any category that might need 2FA)
  // Show TOTP section if category is "totp" (special case) or if TOTP data exists
  if (categoryName === 'totp' || encryptedData.totpSecret || encryptedData.totpIssuer || encryptedData.totpAccount) {
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Two-Factor Authentication (TOTP)</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Service Name (Issuer)
          </label>
          <input
            type="text"
            value={encryptedData.totpIssuer || ''}
            onChange={(e) => onDataChange({ totpIssuer: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="Gmail"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Account Identifier
          </label>
          <input
            type="text"
            value={encryptedData.totpAccount || ''}
            onChange={(e) => onDataChange({ totpAccount: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="user@example.com"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            TOTP Secret (Base32)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={encryptedData.totpSecret || ''}
              onChange={(e) => onDataChange({ totpSecret: e.target.value.toUpperCase().replace(/\s/g, '') })}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: 'monospace',
                textTransform: 'uppercase'
              }}
              placeholder="JBSWY3DPEHPK3PXP"
            />
            <button
              type="button"
              onClick={() => {
                const secret = generateTOTPSecret();
                onDataChange({ totpSecret: secret });
              }}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              🎲 Generate
            </button>
          </div>
        </div>

        {encryptedData.totpSecret && encryptedData.totpIssuer && encryptedData.totpAccount && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowTOTPQR(!showTOTPQR)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              {showTOTPQR ? 'Hide QR Code' : 'Show QR Code'}
            </button>
            {showTOTPQR && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                textAlign: 'center'
              }}>
                <QRCodeSVG
                  value={generateTOTPURI(
                    encryptedData.totpSecret,
                    encryptedData.totpIssuer!,
                    encryptedData.totpAccount!
                  )}
                  size={200}
                />
                <p style={{ margin: '1rem 0 0 0', fontSize: '0.875rem', opacity: 0.7 }}>
                  Scan with your authenticator app
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default SafeCategoryFields;

