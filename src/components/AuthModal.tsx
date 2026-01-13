/**
 * Authentication Modal Component
 * 
 * Handles user sign-up and sign-in for Supabase
 */

import React, { useState } from 'react';
import { signIn, signUp } from '../lib/supabase';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'reset') {
        // Handle password reset
        const { getSupabaseClient } = await import('../lib/supabase');
        const supabase = getSupabaseClient();
        
        if (!supabase) {
          throw new Error('Supabase not configured');
        }

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (resetError) throw resetError;

        setMessage('Password reset email sent! Check your inbox.');
        setTimeout(() => {
          setMode('signin');
          setMessage('');
        }, 3000);
        return;
      }
      
      if (mode === 'signup') {
        const { data, error: signUpError } = await signUp(email, password);
        
        // Check for user already exists error
        if (signUpError) {
          if (signUpError.message.includes('already registered') || 
              signUpError.message.includes('already exists') ||
              signUpError.message.includes('User already registered')) {
            setError('This email is already registered. Please sign in instead.');
            setMode('signin'); // Switch to sign in mode
            return;
          }
          throw signUpError;
        }
        
        // Create user profile in myday_users table
        if (data?.user) {
          const { getSupabaseClient } = await import('../lib/supabase');
          const supabase = getSupabaseClient();
          
          if (supabase) {
            try {
              await supabase.from('myday_users').insert({
                id: data.user.id,
                username: email.split('@')[0], // Use email prefix as default username
                email: email,
                avatar_emoji: '😊' // Default avatar
              });
            } catch (profileError: any) {
              // Ignore duplicate key errors (user profile already exists)
              if (!profileError.message?.includes('duplicate') && 
                  !profileError.message?.includes('unique')) {
                console.error('Error creating user profile:', profileError);
              }
            }
          }
        }
        
        alert('Sign up successful! You can now sign in.');
        setMode('signin'); // Switch to sign in mode
        setPassword(''); // Clear password for security
      } else {
        // Handle sign in
        try {
          const data = await signIn(email, password);
          
          // Ensure user profile exists in myday_users
          if (data?.user) {
            const { getSupabaseClient } = await import('../lib/supabase');
            const supabase = getSupabaseClient();
            
            if (supabase) {
              try {
                // Try to get existing profile
                const { data: existingProfile } = await supabase
                  .from('myday_users')
                  .select('id')
                  .eq('id', data.user.id)
                  .single();
                
                // If no profile exists, create one
                if (!existingProfile) {
                  const { error: insertError } = await supabase
                    .from('myday_users')
                    .insert({
                      id: data.user.id,
                      username: email.split('@')[0],
                      email: email,
                      avatar_emoji: '😊'
                    });
                  
                  if (insertError) {
                    console.error('Failed to create user profile:', insertError);
                  }
                }
              } catch (profileError: any) {
                console.error('Error in profile check/create:', profileError);
              }
            }
          }
          
          onSuccess();
          onClose();
        } catch (signInError: any) {
          // Better error messages for common issues
          if (signInError.message?.includes('Invalid login credentials') ||
              signInError.message?.includes('invalid_credentials')) {
            setError('Invalid email or password. Forgot your password?');
          } else if (signInError.message?.includes('Email not confirmed')) {
            setError('Please confirm your email address first.');
          } else {
            throw signInError;
          }
        }
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      if (!error) { // Only set if we haven't already set a better error message
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
          </h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          {mode !== 'reset' && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
              />
              {mode === 'signup' && (
                <small style={{ color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                  Minimum 6 characters
                </small>
              )}
              {mode === 'signin' && (
                <div style={{ textAlign: 'right', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('reset');
                      setError('');
                      setMessage('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#667eea',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          )}

          {message && (
            <div style={{
              padding: '0.75rem',
              background: '#d1fae5',
              border: '1px solid #10b981',
              borderRadius: '8px',
              color: '#059669',
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              {message}
            </div>
          )}

          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#dc2626',
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '1rem',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Please wait...' : 
             mode === 'signin' ? 'Sign In' : 
             mode === 'signup' ? 'Sign Up' : 
             'Send Reset Email'}
          </button>

          <div style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '0.9rem',
            color: '#6b7280'
          }}>
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: 0
                  }}
                >
                  Sign up
                </button>
              </>
            ) : mode === 'signup' ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: 0
                  }}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setMessage('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: 0
                  }}
                >
                  Back to Sign In
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;


