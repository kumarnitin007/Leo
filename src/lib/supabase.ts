/**
 * Supabase Client Configuration
 * 
 * Handles Supabase initialization and provides a singleton client instance
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client instance
 * Returns null if environment variables are not configured
 */
export const getSupabaseClient = (): SupabaseClient | null => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Helpful debug information for local dev
    console.debug('getSupabaseClient: SUPABASE_URL or SUPABASE_ANON_KEY missing', {
      supabaseUrlPresent: !!supabaseUrl,
      supabaseAnonKeyPresent: !!supabaseAnonKey
    });
    console.warn('Supabase credentials not found. Using localStorage fallback.');
    return null;
  }

  if (!supabaseClient) {
    console.debug('getSupabaseClient: creating new Supabase client (anon)');
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    console.debug('getSupabaseClient: supabase client created');
  }

  return supabaseClient;
};

/**
 * Check if Supabase is configured
 */
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data: { user } } = await client.auth.getUser();
  return user;
};

/**
 * Sign up new user
 */
export const signUp = async (email: string, password: string) => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  // Return both data and error for better error handling
  return { data, error };
};

/**
 * Sign in user
 */
export const signIn = async (email: string, password: string) => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
};

/**
 * Sign out user
 */
export const signOut = async () => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client.auth.signOut();
  if (error) throw error;
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  const client = getSupabaseClient();
  if (!client) return () => {};

  const { data: { subscription } } = client.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
};

export default getSupabaseClient;


