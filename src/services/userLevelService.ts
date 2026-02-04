/**
 * User Level Service
 * 
 * Manages user subscription levels and feature access
 */

import { getSupabaseClient } from '../lib/supabase';

export interface LevelFeature {
  feature_id: string;
  is_enabled: boolean;
  limit_value: number | null;
}

export interface UserLevel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tierOrder: number;
  color: string;
  icon: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

export interface UserLevelAssignment {
  id: string;
  userId: string;
  levelId: string;
  assignedAt: string;
  expiresAt: string | null;
  isActive: boolean;
  level?: UserLevel;
  level_features?: LevelFeature[];
}

/**
 * Get current user's level assignment
 */
export async function getUserLevel(): Promise<UserLevelAssignment | null> {
  try {
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const { data, error } = await client
      .from('myday_user_level_assignments')
      .select(`
        *,
        level:myday_user_levels!myday_user_level_assignments_level_id_fkey(*)
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user level:', error);
      return null;
    }

    if (!data) return null;

    // Fetch level features separately
    const { data: featuresData } = await client
      .from('myday_level_features')
      .select('feature_id, is_enabled, limit_value')
      .eq('level_id', data.level_id);

    // Transform to camelCase
    return {
      id: data.id,
      userId: data.user_id,
      levelId: data.level_id,
      assignedAt: data.assigned_at,
      expiresAt: data.expires_at,
      isActive: data.is_active,
      level: data.level ? {
        id: data.level.id,
        name: data.level.name,
        displayName: data.level.display_name,
        description: data.level.description,
        tierOrder: data.level.tier_order,
        color: data.level.color,
        icon: data.level.icon,
        monthlyPrice: data.level.monthly_price,
        yearlyPrice: data.level.yearly_price,
      } : undefined,
      level_features: featuresData || []
    };
  } catch (err) {
    console.error('Error loading user level:', err);
    return null;
  }
}

/**
 * Get all available levels
 */
export async function getAllLevels(): Promise<UserLevel[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('myday_user_levels')
      .select('*')
      .order('tier_order', { ascending: true });

    if (error) throw error;

    return (data || []).map(level => ({
      id: level.id,
      name: level.name,
      displayName: level.display_name,
      description: level.description,
      tierOrder: level.tier_order,
      color: level.color,
      icon: level.icon,
      monthlyPrice: level.monthly_price,
      yearlyPrice: level.yearly_price,
    }));
  } catch (err) {
    console.error('Error loading levels:', err);
    return [];
  }
}
