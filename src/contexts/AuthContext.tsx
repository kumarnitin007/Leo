/* @refresh reset */
/**
 * Authentication Context
 * 
 * Manages user authentication state throughout the app
 * Provides current user, loading state, and auth functions
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSupabaseClient, getCurrentUser, signOut, onAuthStateChange } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        setError(null);
        // If demo mode is enabled locally, synthesize a demo user and skip Supabase calls
        const demoFlag = localStorage.getItem('myday-demo');
        if (demoFlag === 'true') {
          const demoProfileRaw = localStorage.getItem('myday-demo-profile');
          const demoProfile = demoProfileRaw ? JSON.parse(demoProfileRaw) : { id: 'demo', username: 'Demo User', email: 'demo@example.com' };
          // Create a minimal synthetic User object to satisfy downstream checks
          const demoUser: any = {
            id: demoProfile.id,
            email: demoProfile.email,
            user_metadata: { username: demoProfile.username }
          };
          console.debug('AuthProvider: demo mode enabled, using synthetic demo user', { demoProfile: { id: demoProfile.id, email: demoProfile.email } });
          setUser(demoUser as unknown as User);
          setLoading(false);
          return;
        }

        console.debug('AuthProvider: calling getCurrentUser()');
        const currentUser = await getCurrentUser();
        console.debug('AuthProvider: getCurrentUser returned', !!currentUser);
        setUser(currentUser);
      } catch (error: any) {
        console.error('Error loading user:', error);
        setUser(null);
        
        // Set user-friendly error message
        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
          setError('Unable to connect to server. Please check your internet connection and try again.');
        } else if (error?.message?.includes('paused') || error?.message?.includes('inactive')) {
          setError('Service is temporarily unavailable. Please try again in a few moments.');
        } else if (error?.message?.includes('timeout')) {
          setError('Connection timeout. Please check your internet and try again.');
        } else {
          setError('Unable to sign in. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange((event, session) => {
      console.debug('AuthProvider:onAuthStateChange', { event, hasSession: !!session });
      if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    error,
    signOut: handleSignOut,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

