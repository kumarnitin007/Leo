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
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load current user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
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
      } catch (error) {
        console.error('Error loading user:', error);
        setUser(null);
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

