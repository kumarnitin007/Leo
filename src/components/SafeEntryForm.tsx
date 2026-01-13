/**
 * Safe Entry Form Component
 * 
 * Form for adding/editing safe entries
 */

import React, { useState, useEffect } from 'react';
import { SafeEntry, Tag, SafeEntryEncryptedData, SafeCustomField } from '../types';
import { CryptoKey } from '../utils/encryption';
import { addSafeEntry, updateSafeEntry, decryptSafeEntry } from '../storage';
import { generatePassword } from '../utils/encryption';
import SafeCategoryFields from './SafeCategoryFields';
import { generateTOTPSecret } from '../utils/totp';
import TOTPQRCode from './TOTPQRCode';

interface SafeEntryFormProps {
  entry?: SafeEntry;
  tags: Tag[];
  encryptionKey: CryptoKey;
  onSave: () => void;
  onCancel: () => void;
}

const SafeEntryForm: React.FC<SafeEntryFormProps> = ({
  entry,
  tags,
  encryptionKey,
  onSave,
  onCancel
}) => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [categoryTagId, setCategoryTagId] = useState<string>('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  
  // Encrypted fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notes, setNotes] = useState('');
  const [encryptedExpiryDate, setEncryptedExpiryDate] = useState('');
  
  // Category-specific encrypted data
  const [categoryData, setCategoryData] = useState<Partial<SafeEntryEncryptedData>>({});
  
  // Custom fields (up to 5)
  const [customFields, setCustomFields] = useState<SafeCustomField[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load entry data if editing
  useEffect(() => {
    if (entry) {
      setIsLoading(true);
      loadEntryData();
    }
  }, [entry]);

  const loadEntryData = async () => {
    if (!entry) return;

    try {
      // Decrypt entry data
      const decryptedJson = await decryptSafeEntry(entry, encryptionKey);
      const encryptedData: SafeEntryEncryptedData = JSON.parse(decryptedJson);

      // Set plaintext fields
      setTitle(entry.title);
      setUrl(entry.url || '');
      setCategoryTagId(entry.categoryTagId || '');
      setSelectedTagIds(entry.tags || []);
      setIsFavorite(entry.isFavorite);
      setExpiresAt(entry.expiresAt || '');

      // Set encrypted fields
      setUsername(encryptedData.username || '');
      setPassword(encryptedData.password || '');
      setNotes(encryptedData.notes || '');
      setEncryptedExpiryDate(encryptedData.expiryDate || '');
      setCustomFields(encryptedData.customFields || []);
      
      // Set category-specific data
      setCategoryData({
        cardNumber: encryptedData.cardNumber,
        cvv: encryptedData.cvv,
        cardholderName: encryptedData.cardholderName,
        billingAddress: encryptedData.billingAddress,
        pin: encryptedData.pin,
        accountNumber: encryptedData.accountNumber,
        routingNumber: encryptedData.routingNumber,
        bankName: encryptedData.bankName,
        accountType: encryptedData.accountType,
        swiftCode: encryptedData.swiftCode,
        iban: encryptedData.iban,
        brokerName: encryptedData.brokerName,
        tradingPlatform: encryptedData.tradingPlatform,
        accountHolder: encryptedData.accountHolder,
        totpSecret: encryptedData.totpSecret,
        totpIssuer: encryptedData.totpIssuer,
        totpAccount: encryptedData.totpAccount
      });
    } catch (error) {
      console.error('Error loading entry data:', error);
      alert('Failed to load entry data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare encrypted data
      const encryptedData: SafeEntryEncryptedData = {
        username: username || undefined,
        password: password || undefined,
        notes: notes || undefined,
        expiryDate: encryptedExpiryDate || undefined,
        customFields: customFields.length > 0 ? customFields : undefined,
        // Category-specific fields
        ...categoryData
      };

      const encryptedJson = JSON.stringify(encryptedData);

      if (entry) {
        // Update existing entry
        await updateSafeEntry(
          entry.id,
          {
            title: title.trim(),
            url: url.trim() || undefined,
            categoryTagId: categoryTagId || undefined,
            tags: selectedTagIds,
            isFavorite,
            expiresAt: expiresAt || undefined,
            encryptedData: encryptedJson
          },
          encryptionKey
        );
      } else {
        // Create new entry
        await addSafeEntry(
          {
            title: title.trim(),
            url: url.trim() || undefined,
            categoryTagId: categoryTagId || undefined,
            tags: selectedTagIds,
            isFavorite,
            expiresAt: expiresAt || undefined,
            encryptedData: encryptedJson,
            encryptedDataIv: '' // Will be set by addSafeEntry
          },
          encryptionKey
        );
      }

      onSave();
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomField = () => {
    if (customFields.length >= 5) {
      alert('Maximum 5 custom fields allowed');
      return;
    }
    setCustomFields([...customFields, { key: '', value: '', isEncrypted: true }]);
  };

  const handleRemoveCustomField = (index: number) => {
    setCustomFields(customFields.filter((_, i) => i !== index));
  };

  const handleCustomFieldChange = (index: number, field: Partial<SafeCustomField>) => {
    const updated = [...customFields];
    updated[index] = { ...updated[index], ...field };
    setCustomFields(updated);
  };

  const handleGeneratePassword = () => {
    const generated = generatePassword(16, true, true, true, true);
    setPassword(generated);
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`${label} copied to clipboard`);
    });
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading entry data...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '0.5rem',
      padding: '2rem',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h2 style={{ margin: '0 0 2rem 0' }}>
        {entry ? 'Edit Entry' : 'Add New Entry'}
      </h2>

      {/* Plaintext Fields */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Basic Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Title <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="e.g., Gmail Account"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
            placeholder="https://example.com"
            pattern="https?://.*"
            title="Please enter a valid URL starting with http:// or https://"
          />
          {url && url.trim() && !url.match(/^https?:\/\/.+/i) && (
            <p style={{ margin: '0.5rem 0 0 0', color: '#ef4444', fontSize: '0.875rem' }}>
              URL should start with http:// or https://
            </p>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Category
          </label>
          <select
            value={categoryTagId}
            onChange={(e) => setCategoryTagId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
              backgroundColor: 'white'
            }}
          >
            <option value="">Select category</option>
            {tags.map(tag => (
              <option key={tag.id} value={tag.id}>{tag.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Tags
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {tags.map(tag => (
              <label key={tag.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                padding: '0.5rem',
                backgroundColor: selectedTagIds.includes(tag.id) ? tag.color : '#f3f4f6',
                color: selectedTagIds.includes(tag.id) ? 'white' : 'inherit',
                borderRadius: '0.25rem',
                fontSize: '0.875rem'
              }}>
                <input
                  type="checkbox"
                  checked={selectedTagIds.includes(tag.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTagIds([...selectedTagIds, tag.id]);
                    } else {
                      setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
                    }
                  }}
                />
                {tag.name}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(e) => setIsFavorite(e.target.checked)}
            />
            <span>⭐ Favorite</span>
          </label>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Expires At (for filtering)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
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
      </div>

      {/* Encrypted Fields */}
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Encrypted Information</h3>
        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Username/Email
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="username@example.com"
            />
            {username && (
              <button
                type="button"
                onClick={() => handleCopyToClipboard(username, 'Username')}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                📋 Copy
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Password
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '3rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem'
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            <button
              type="button"
              onClick={handleGeneratePassword}
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
            {password && (
              <button
                type="button"
                onClick={() => handleCopyToClipboard(password, 'Password')}
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer'
                }}
              >
                📋 Copy
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              boxSizing: 'border-box',
              fontFamily: 'inherit'
            }}
            placeholder="Additional notes..."
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Encrypted Expiry Date (optional)
          </label>
          <input
            type="date"
            value={encryptedExpiryDate}
            onChange={(e) => setEncryptedExpiryDate(e.target.value)}
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
      </div>

      {/* Category-Specific Fields */}
      <SafeCategoryFields
        categoryTagId={categoryTagId}
        tags={tags}
        encryptedData={{ ...categoryData, username, password, notes, expiryDate: encryptedExpiryDate }}
        onDataChange={(data) => setCategoryData({ ...categoryData, ...data })}
      />

      {/* TOTP Section (for any category) - Show if TOTP data exists */}
      {(categoryData.totpSecret || categoryData.totpIssuer || categoryData.totpAccount) && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem' }}>Two-Factor Authentication (TOTP)</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Service Name (Issuer)
            </label>
            <input
              type="text"
              value={categoryData.totpIssuer || ''}
              onChange={(e) => setCategoryData({ ...categoryData, totpIssuer: e.target.value })}
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
              value={categoryData.totpAccount || ''}
              onChange={(e) => setCategoryData({ ...categoryData, totpAccount: e.target.value })}
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
                value={categoryData.totpSecret || ''}
                onChange={(e) => setCategoryData({ ...categoryData, totpSecret: e.target.value.toUpperCase().replace(/\s/g, '') })}
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
                  setCategoryData({ ...categoryData, totpSecret: secret });
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

          {categoryData.totpSecret && categoryData.totpIssuer && categoryData.totpAccount && (
            <TOTPQRCode
              secret={categoryData.totpSecret}
              issuer={categoryData.totpIssuer}
              account={categoryData.totpAccount}
            />
          )}

          <button
            type="button"
            onClick={() => setCategoryData({ ...categoryData, totpSecret: undefined, totpIssuer: undefined, totpAccount: undefined })}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              marginTop: '1rem'
            }}
          >
            Remove TOTP
          </button>
        </div>
      )}
      
      {/* TOTP Toggle Button */}
      {!categoryData.totpSecret && !categoryData.totpIssuer && !categoryData.totpAccount && (
        <div style={{ marginBottom: '2rem' }}>
          <button
            type="button"
            onClick={() => {
              const secret = generateTOTPSecret();
              setCategoryData({ ...categoryData, totpSecret: secret, totpIssuer: '', totpAccount: '' });
            }}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            + Add Two-Factor Authentication (TOTP)
          </button>
        </div>
      )}

      {/* Custom Fields */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Custom Fields ({customFields.length}/5)</h3>
          {customFields.length < 5 && (
            <button
              type="button"
              onClick={handleAddCustomField}
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
              + Add Field
            </button>
          )}
        </div>

        {customFields.map((field, index) => (
          <div key={index} style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            padding: '1rem',
            backgroundColor: '#f9fafb',
            borderRadius: '0.5rem'
          }}>
            <input
              type="text"
              value={field.key}
              onChange={(e) => handleCustomFieldChange(index, { key: e.target.value })}
              placeholder="Field name"
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
            <input
              type={field.isEncrypted ? 'password' : 'text'}
              value={field.value}
              onChange={(e) => handleCustomFieldChange(index, { value: e.target.value })}
              placeholder="Field value"
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}>
              <input
                type="checkbox"
                checked={field.isEncrypted}
                onChange={(e) => handleCustomFieldChange(index, { isEncrypted: e.target.checked })}
              />
              🔒 Encrypt
            </label>
            <button
              type="button"
              onClick={() => handleRemoveCustomField(index)}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: isSubmitting ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 500
          }}
        >
          {isSubmitting ? 'Saving...' : entry ? 'Update Entry' : 'Create Entry'}
        </button>
      </div>
    </form>
  );
};

export default SafeEntryForm;

