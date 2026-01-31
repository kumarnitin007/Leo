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

  // SECURITY: Demo credentials are NEVER exposed to client-side code.
  // Demo login ONLY works via server-side /api/demo-login endpoint.
  // The server reads DEMO_EMAIL and DEMO_PASSWORD from non-VITE_ env vars.

  const attemptDemoLogin = async () => {
    // Demo login MUST go through server-side endpoint for security.
    // The server has access to DEMO_EMAIL and DEMO_PASSWORD (non-VITE_ vars).
    setLoading(true);
    setError('');
    
    const client = getSupabaseClient();
    
    try {
      console.debug('AuthModal: attempting demo login via /api/demo-login');
      const resp = await fetch('/api/demo-login', { method: 'POST' });
      
      if (resp.ok) {
        const json = await resp.json();
        console.debug('AuthModal: /api/demo-login response parsed', { hasSession: !!json?.session });
        const session = json?.session;

        if (session && session.access_token && session.refresh_token && client) {
          await client.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token
          });

          // Create profile if needed
          try {
            const { data: user } = await client.auth.getUser();
            if (user?.user) {
              await client.from('myday_users').upsert({
                id: user.user.id,
                username: 'Demo User',
                email: user.user.email,
                avatar_emoji: '🎯'
              }).select();
            }
          } catch (e) {
            // Profile creation optional
          }

          localStorage.setItem('myday-load-sample-data', 'true');
          onSuccess();
          onClose();
          return;
        }
        
        throw new Error('Demo login returned invalid session');
      }
      
      // Server endpoint not available or failed
      if (resp.status === 404) {
        // In development without server, fall back to local demo mode
        // This mode has LIMITED functionality (no database access)
        console.warn('Demo login API not available. Using local demo mode (limited).');
        
        localStorage.setItem('myday-demo', 'true');
        const demoLocal = { 
          id: 'demo-local', 
          username: 'Demo User (Local)', 
          email: 'demo@local', 
          avatarEmoji: '🎯' 
        };
        localStorage.setItem('myday-demo-profile', JSON.stringify(demoLocal));
        localStorage.setItem('myday-load-sample-data', 'true');
        
        // Show warning that this is limited mode
        alert('⚠️ Demo running in local mode with limited functionality.\n\nTo enable full demo:\n1. Set up /api/demo-login server endpoint\n2. Configure DEMO_EMAIL and DEMO_PASSWORD (non-VITE_) in server env');
        
        onSuccess();
        onClose();
        return;
      }
      
      // Other server errors
      const errorBody = await resp.json().catch(() => ({}));
      throw new Error(errorBody?.error || `Demo login failed (${resp.status})`);
      
    } catch (err: any) {
      console.error('Demo login error:', err);
      setError(err.message || 'Demo login failed. Server endpoint may not be configured.');
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


