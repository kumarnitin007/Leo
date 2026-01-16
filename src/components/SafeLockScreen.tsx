/**
 * Safe Lock Screen Component
 * 
 * Displayed when safe is locked
 */

import React, { useState } from 'react';

interface SafeLockScreenProps {
  entryCount: number;
  onUnlock: (password: string) => void;
  isUnlocking: boolean;
  // Optional: when user is a demo user, show a demo-unlock button
  isDemoUser?: boolean;
  demoSafePassword?: string | null;
  onOpenChangePassword?: () => void;
}

const SafeLockScreen: React.FC<SafeLockScreenProps> = ({ entryCount, onUnlock, isUnlocking, isDemoUser, demoSafePassword, onOpenChangePassword }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

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
      <h1 style={{ margin: 0, fontSize: '2rem', marginBottom: '0.5rem' }}>Leo's Safe is Locked</h1>
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
          {isUnlocking ? 'Unlocking...' : '🔓 Unlock Safe'}
        </button>
      </form>

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
            Enter Safe (Demo)
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

      <p style={{ 
        margin: '1.5rem 0 0 0', 
        fontSize: '0.875rem', 
        opacity: 0.6,
        lineHeight: 1.6
      }}>
        Auto-locks after 15 minutes of inactivity or when you switch tabs
      </p>
    </div>
  );
};

export default SafeLockScreen;

