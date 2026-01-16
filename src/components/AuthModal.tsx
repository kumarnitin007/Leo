/**
 * Authentication Modal Component
 * 
 * Handles user sign-up and sign-in for Supabase
 */

import React, { useState } from 'react';
import { signIn, signUp, getSupabaseClient } from '../lib/supabase';
import { setMasterPassword } from '../storage';

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
            setError('Please confirm your email address first — check your mailbox for the verification email sent by Supabase.');
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

  // Demo account credentials: prefer env-provided values for production demo flow
  const DEMO_EMAIL = (import.meta.env.VITE_DEMO_EMAIL as string) || 'demo@example.com';
  const DEMO_PASSWORD = (import.meta.env.VITE_DEMO_PASSWORD as string) || 'demo-password-1234';
  const DEMO_SAFE_PASSWORD = (import.meta.env.VITE_DEMO_SAFE_PASSWORD as string) || undefined;

  const attemptDemoLogin = async () => {
    // Try a Supabase-backed demo login if Supabase is configured and env vars were provided.
    setLoading(true);
    setError('');
    try {
      const supabase = getSupabaseClient();
      if (supabase && DEMO_EMAIL && DEMO_PASSWORD) {
        // Attempt sign in with demo creds
        try {
          const data = await signIn(DEMO_EMAIL, DEMO_PASSWORD);

          // Ensure profile exists in myday_users
          try {
            const { data: existingProfile } = await supabase
              .from('myday_users')
              .select('id')
              .eq('id', data.user.id)
              .single();

            if (!existingProfile) {
              await supabase.from('myday_users').insert({
                id: data.user.id,
                username: 'Demo User',
                email: DEMO_EMAIL,
                avatar_emoji: '🎯'
              });
            }
          } catch (profileError) {
            console.error('Demo profile create error:', profileError);
          }

          // If a demo safe password is provided, try to set it (idempotent check inside)
          if (DEMO_SAFE_PASSWORD) {
            try {
              await setMasterPassword(DEMO_SAFE_PASSWORD);
            } catch (mpErr) {
              // ignore if already set or other issues
              console.warn('Could not set demo master password (might already exist):', mpErr);
            }
          }

          onSuccess();
          onClose();
          return;
        } catch (signinErr: any) {
          // If sign in failed, try sign up then sign in
          try {
            const { data, error: signUpError } = await signUp(DEMO_EMAIL, DEMO_PASSWORD);
            if (signUpError && !/already registered|already exists|User already registered/i.test(signUpError.message || '')) {
              throw signUpError;
            }

            if (data?.user) {
              try {
                await supabase.from('myday_users').insert({
                  id: data.user.id,
                  username: 'Demo User',
                  email: DEMO_EMAIL,
                  avatar_emoji: '🎯'
                });
              } catch (profileError: any) {
                if (!profileError.message?.includes('duplicate') && !profileError.message?.includes('unique')) {
                  console.error('Error creating demo profile after signup:', profileError);
                }
              }
            }

            // Attempt sign in again
            const signinResult = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
            if (signinResult?.user) {
              if (DEMO_SAFE_PASSWORD) {
                try { await setMasterPassword(DEMO_SAFE_PASSWORD); } catch {
                  /* ignore */
                }
              }
              onSuccess();
              onClose();
              return;
            }
          } catch (suErr) {
            console.error('Demo supabase signup/signin error:', suErr);
            // fall through to local mode
          }
        }
      }

      // Fall back to local demo mode: set demo flag and demo profile in localStorage
      localStorage.setItem('myday-demo', 'true');
      const demoLocal = {
        id: 'demo',
        username: 'Demo User',
        email: DEMO_EMAIL,
        avatarEmoji: '🎯'
      };
      localStorage.setItem('myday-demo-profile', JSON.stringify(demoLocal));
      // Store demo safe password locally so Safe UI can use it (app currently uses Supabase for Safe; this is best-effort)
      if (DEMO_SAFE_PASSWORD) {
        try {
          localStorage.setItem('myday-demo-safe-password', DEMO_SAFE_PASSWORD);
        } catch (e) {
          console.warn('Failed to store demo safe password locally:', e);
        }
      }
      localStorage.setItem('myday-load-sample-data', 'true');

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Demo login error:', err);
      setError(err.message || 'Demo login failed');
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

          {/* Prominent signup & demo buttons (shown on sign-in view) */}
          {mode === 'signin' && (
            <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  background: 'transparent',
                  border: '2px solid #667eea',
                  color: '#334155',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Create a new account
              </button>

              <button
                type="button"
                onClick={attemptDemoLogin}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  color: '#374151',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Please wait...' : 'Try demo account (no setup)'}
              </button>
            </div>
          )}

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
                  {/* On signup screen we also show a prominent back-to-sign-in button; nothing here for signin */}
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

                  {/* Prominent back-to-sign-in button for the signup view to mirror the signin view's prominence */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => { setMode('signin'); setError(''); setMessage(''); }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        fontSize: '1rem',
                        background: 'transparent',
                        border: '2px solid #667eea',
                        color: '#334155',
                        borderRadius: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      Back to Sign In
                    </button>
                  </div>

                  {/* Also surface the demo button on the signup screen */}
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={attemptDemoLogin}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        fontSize: '1rem',
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        color: '#374151',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {loading ? 'Please wait...' : 'Try demo account (no setup)'}
                    </button>
                  </div>
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


