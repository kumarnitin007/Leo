/**
 * Safe Lock Screen Component
 * 
 * Displayed when safe is locked
 */

import React, { useState, useEffect } from 'react';

export const SAFE_SESSION_STORAGE_KEY = 'myday-safe-session-minutes';
export const SAFE_SESSION_OPTIONS = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
] as const;

interface SafeLockScreenProps {
  entryCount: number;
  onUnlock: (password: string) => void;
  isUnlocking: boolean;
  isDemoUser?: boolean;
  demoSafePassword?: string | null;
  onOpenChangePassword?: () => void;
  onResetSafe?: () => Promise<void>;
}

const SafeLockScreen: React.FC<SafeLockScreenProps> = ({ entryCount, onUnlock, isUnlocking, isDemoUser, demoSafePassword, onOpenChangePassword, onResetSafe }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState<number>(() => {
    const raw = localStorage.getItem(SAFE_SESSION_STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return SAFE_SESSION_OPTIONS.some(o => o.value === n) ? n : 5;
  });

  useEffect(() => {
    localStorage.setItem(SAFE_SESSION_STORAGE_KEY, String(sessionMinutes));
  }, [sessionMinutes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password) {
      setError('Please enter your master password');
      return;
    }

    await onUnlock(password);
    setPassword(''); // Clear on error
  };

  return (
    <div style={{
      maxWidth: '500px',
      margin: '4rem auto',
      padding: '2rem',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '1rem',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '5rem', marginBottom: '1rem', lineHeight: 1 }}>🦁</div>
      <h1 style={{ margin: 0, fontSize: '2rem', marginBottom: '0.5rem' }}>Leo's Vault is Locked</h1>
      <p style={{ margin: '0.5rem 0', opacity: 0.7, fontSize: '1.125rem' }}>
        Leo the Lion is guarding your secrets
      </p>
      <p style={{ margin: '0 0 2rem 0', opacity: 0.6, fontSize: '0.875rem' }}>
        {entryCount} {entryCount === 1 ? 'entry' : 'entries'} protected
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              style={{
                width: '100%',
                padding: '0.875rem',
                paddingRight: '3rem',
                border: error ? '2px solid #ef4444' : '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Enter master password"
              autoFocus
              autoComplete="current-password"
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
                fontSize: '1.25rem',
                padding: '0.25rem'
              }}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {error && (
            <p style={{ margin: '0.5rem 0 0 0', color: '#ef4444', fontSize: '0.875rem', textAlign: 'left' }}>
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isUnlocking || !password}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: isUnlocking || !password ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: isUnlocking || !password ? 'not-allowed' : 'pointer'
          }}
        >
          {isUnlocking ? 'Unlocking...' : '🔓 Unlock Vault'}
        </button>
      </form>

      <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.35rem' }}>Keep unlocked for</label>
        <select
          value={sessionMinutes}
          onChange={(e) => setSessionMinutes(Number(e.target.value))}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.95rem',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          {SAFE_SESSION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Demo unlock & change password actions */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        {isDemoUser && demoSafePassword && (
          <button
            type="button"
            onClick={async () => {
              // Use demo safe password to unlock without typing
              await onUnlock(demoSafePassword);
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '0.95rem',
              cursor: 'pointer'
            }}
          >
            Enter Vault (Demo)
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenChangePassword && onOpenChangePassword()}
          style={{
            flex: 1,
            padding: '0.75rem',
            backgroundColor: 'transparent',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: '0.5rem',
            fontSize: '0.95rem',
            cursor: 'pointer'
          }}
        >
          Change Master Password
        </button>
      </div>

      {/* Forgot Password link */}
      {onResetSafe && (
        <button
          type="button"
          onClick={() => setShowResetConfirm(true)}
          style={{
            marginTop: '1rem',
            background: 'none',
            border: 'none',
            color: '#ef4444',
            fontSize: '0.85rem',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Forgot Password? Reset Safe
        </button>
      )}

      <p style={{ 
        margin: '1.5rem 0 0 0', 
        fontSize: '0.875rem', 
        opacity: 0.6,
        lineHeight: 1.6
      }}>
        Auto-locks after {sessionMinutes} min of inactivity or when you switch tabs. Clicks, keys, and scroll reset the timer.
      </p>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '450px',
            width: '90%',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ margin: '0 0 1rem 0', color: '#dc2626' }}>Reset Vault?</h2>
            <p style={{ margin: '0 0 1rem 0', color: '#374151', lineHeight: 1.6 }}>
              This will <strong>permanently delete</strong> all your Vault data:
            </p>
            <ul style={{ 
              textAlign: 'left', 
              margin: '0 0 1.5rem 0', 
              padding: '0 0 0 1.5rem',
              color: '#6b7280',
              lineHeight: 1.8,
            }}>
              <li>All saved passwords & logins</li>
              <li>All secure notes</li>
              <li>All bank records & deposits</li>
              <li>All documents in vault</li>
            </ul>
            <p style={{ margin: '0 0 1rem 0', color: '#374151', fontWeight: 600 }}>
              Type <span style={{ color: '#dc2626', fontFamily: 'monospace' }}>RESET</span> to confirm:
            </p>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value.toUpperCase())}
              placeholder="Type RESET"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #fca5a5',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                textAlign: 'center',
                fontFamily: 'monospace',
                marginBottom: '1rem',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetConfirmText('');
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (resetConfirmText !== 'RESET') return;
                  setIsResetting(true);
                  try {
                    await onResetSafe?.();
                    setShowResetConfirm(false);
                    setResetConfirmText('');
                  } finally {
                    setIsResetting(false);
                  }
                }}
                disabled={resetConfirmText !== 'RESET' || isResetting}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: resetConfirmText === 'RESET' ? '#dc2626' : '#fca5a5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  cursor: resetConfirmText === 'RESET' ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                {isResetting ? 'Resetting...' : 'Delete All & Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafeLockScreen;

