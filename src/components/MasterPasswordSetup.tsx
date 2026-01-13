/**
 * Master Password Setup Component
 * 
 * First-time setup screen for master password
 */

import React, { useState } from 'react';
import { calculatePasswordStrength, generatePassword } from '../utils/encryption';

interface MasterPasswordSetupProps {
  onComplete: (password: string) => void;
}

const MasterPasswordSetup: React.FC<MasterPasswordSetupProps> = ({ onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = calculatePasswordStrength(password);
  const strengthLabel = strength < 30 ? 'Weak' : strength < 60 ? 'Fair' : strength < 80 ? 'Good' : 'Strong';
  const strengthColor = strength < 30 ? '#ef4444' : strength < 60 ? '#f59e0b' : strength < 80 ? '#3b82f6' : '#10b981';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match. Please try again.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onComplete(password);
    } catch (error) {
      console.error('Error setting up master password:', error);
      alert('Failed to set up master password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePassword = () => {
    const generated = generatePassword(16, true, true, true, true);
    setPassword(generated);
    setConfirmPassword(generated);
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '4rem auto',
      padding: '2rem',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '1rem',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1rem', lineHeight: 1 }}>🦁</div>
        <h1 style={{ margin: 0, fontSize: '2rem', marginBottom: '0.5rem' }}>Welcome to Leo's Safe</h1>
        <p style={{ margin: 0, opacity: 0.7, fontSize: '1.125rem' }}>
          Leo the Lion is your trusted guardian
        </p>
        <p style={{ margin: '0.5rem 0 0 0', opacity: 0.6, fontSize: '0.875rem' }}>
          Create a master password to protect your sensitive data
        </p>
      </div>

      <div style={{
        backgroundColor: '#fef3c7',
        border: '1px solid #fbbf24',
        borderRadius: '0.5rem',
        padding: '1rem',
        marginBottom: '2rem'
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>
          <strong>🦁 Leo's Promise:</strong> Your data is encrypted with military-grade security. 
          Leo protects your secrets, but your master password cannot be recovered if forgotten. 
          Make sure to back up your Safe section data regularly.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Master Password (minimum 4 characters)
          </label>
          <div style={{ position: 'relative' }}>
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
              placeholder="Enter master password"
              autoComplete="new-password"
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
          
          {password && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Strength: {strengthLabel}</span>
                <span style={{ fontSize: '0.875rem', color: strengthColor }}>{strength}%</span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e5e7eb',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${strength}%`,
                  height: '100%',
                  backgroundColor: strengthColor,
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleGeneratePassword}
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            🎲 Generate Strong Password
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Confirm Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                paddingRight: '3rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
              placeholder="Confirm master password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
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
              {showConfirm ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p style={{ margin: '0.5rem 0 0 0', color: '#ef4444', fontSize: '0.875rem' }}>
              Passwords do not match
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || password.length < 4 || password !== confirmPassword}
          style={{
            width: '100%',
            padding: '0.875rem',
            backgroundColor: isSubmitting || password.length < 4 || password !== confirmPassword 
              ? '#9ca3af' 
              : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            cursor: isSubmitting || password.length < 4 || password !== confirmPassword 
              ? 'not-allowed' 
              : 'pointer'
          }}
        >
          {isSubmitting ? 'Setting up...' : 'Setup Safe Section'}
        </button>
      </form>
    </div>
  );
};

export default MasterPasswordSetup;

