/**
 * User Level Service
 * 
 * Manages user levels/tiers for feature gating
 * Supports paid vs unpaid user differentiation
 */

import getSupabaseClient from '../lib/supabase';
import {
  UserLevel,
  UserLevelId,
  AppFeature,
  LevelFeature,
  UserLevelAssignment,
  UserEffectiveLevel,
} from '../types';

// Get supabase client helper
const getClient = () => {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase not configured');
  return client;
};

// Cache for levels and features (they don't change often)
let levelsCache: UserLevel[] | null = null;
let featuresCache: AppFeature[] | null = null;
let levelFeaturesCache: Map<string, LevelFeature[]> | null = null;

// ===== LEVELS =====

export async function getUserLevels(): Promise<UserLevel[]> {
  if (levelsCache) return levelsCache;

  const supabase = getClient();
  const { data, error } = await supabase
    .from('myday_user_levels')
    .select('*')
    .order('tier_order', { ascending: true });

  if (error) throw error;

  levelsCache = (data || []).map(row => ({
    id: row.id as UserLevelId,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    tierOrder: row.tier_order,
    color: row.color,
    icon: row.icon,
    monthlyPrice: parseFloat(row.monthly_price) || 0,
    yearlyPrice: parseFloat(row.yearly_price) || 0,
    isDefault: row.is_default,
  }));

  return levelsCache;
}

export async function getLevelById(levelId: UserLevelId): Promise<UserLevel | null> {
  const levels = await getUserLevels();
  return levels.find(l => l.id === levelId) || null;
}

export async function getDefaultLevel(): Promise<UserLevel> {
  const levels = await getUserLevels();
  return levels.find(l => l.isDefault) || levels[0];
}

// ===== FEATURES =====

export async function getFeatures(): Promise<AppFeature[]> {
  if (featuresCache) return featuresCache;

  const supabase = getClient();
  const { data, error } = await supabase
    .from('myday_features')
    .select('*')
    .order('category', { ascending: true });

  if (error) throw error;

  featuresCache = (data || []).map(row => ({
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
  }));

  return featuresCache;
}

// ===== LEVEL-FEATURE MAPPINGS =====

export async function getLevelFeatures(levelId: UserLevelId): Promise<LevelFeature[]> {
  if (levelFeaturesCache?.has(levelId)) {
    return levelFeaturesCache.get(levelId)!;
  }

  const supabase = getClient();
  const { data, error } = await supabase
    .from('myday_level_features')
    .select('*')
    .eq('level_id', levelId);

  if (error) throw error;

  const features: LevelFeature[] = (data || []).map(row => ({
    levelId: row.level_id as UserLevelId,
    featureId: row.feature_id,
    isEnabled: row.is_enabled,
    limitValue: row.limit_value,
  }));

  if (!levelFeaturesCache) levelFeaturesCache = new Map();
  levelFeaturesCache.set(levelId, features);

  return features;
}

// ===== USER LEVEL ASSIGNMENT =====

export async function getCurrentUserLevel(): Promise<UserLevelId> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'free';

  const { data, error } = await supabase
    .from('myday_user_level_assignments')
    .select('level_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 'free'; // Default to free if no assignment
  }

  return data.level_id as UserLevelId;
}

export async function getUserLevelAssignment(): Promise<UserLevelAssignment | null> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('myday_user_level_assignments')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('assigned_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    userId: data.user_id,
    levelId: data.level_id as UserLevelId,
    assignedAt: data.assigned_at,
    expiresAt: data.expires_at,
    assignedBy: data.assigned_by,
    notes: data.notes,
    subscriptionId: data.subscription_id,
    isActive: data.is_active,
  };
}

export async function getUserEffectiveLevel(): Promise<UserEffectiveLevel> {
  const levelId = await getCurrentUserLevel();
  const level = await getLevelById(levelId) || await getDefaultLevel();
  const levelFeatures = await getLevelFeatures(level.id);
  const assignment = await getUserLevelAssignment();

  const features = new Map<string, { enabled: boolean; limit?: number | null }>();
  for (const lf of levelFeatures) {
    features.set(lf.featureId, {
      enabled: lf.isEnabled,
      limit: lf.limitValue,
    });
  }

  return {
    level,
    features,
    expiresAt: assignment?.expiresAt,
  };
}

// ===== FEATURE CHECKS =====

/**
 * Check if current user has access to a feature
 */
export async function hasFeature(featureId: string): Promise<boolean> {
  const effective = await getUserEffectiveLevel();
  const feature = effective.features.get(featureId);
  return feature?.enabled ?? false;
}

/**
 * Get the limit for a feature (null = unlimited)
 */
export async function getFeatureLimit(featureId: string): Promise<number | null> {
  const effective = await getUserEffectiveLevel();
  const feature = effective.features.get(featureId);
  return feature?.limit ?? null;
}

/**
 * Check if user is within feature limit
 */
export async function isWithinFeatureLimit(featureId: string, currentCount: number): Promise<boolean> {
  const limit = await getFeatureLimit(featureId);
  if (limit === null) return true; // Unlimited
  return currentCount < limit;
}

// ===== ADMIN FUNCTIONS =====

/**
 * Assign a level to a user (admin only)
 */
export async function assignUserLevel(
  userId: string,
  levelId: UserLevelId,
  expiresAt?: string,
  notes?: string
): Promise<UserLevelAssignment> {
  const supabase = getClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  // Deactivate existing assignments
  await supabase
    .from('myday_user_level_assignments')
    .update({ is_active: false })
    .eq('user_id', userId);

  // Create new assignment
  const { data, error } = await supabase
    .from('myday_user_level_assignments')
    .insert({
      id,
      user_id: userId,
      level_id: levelId,
      assigned_at: now,
      expires_at: expiresAt || null,
      assigned_by: user.id,
      notes: notes || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    userId: data.user_id,
    levelId: data.level_id as UserLevelId,
    assignedAt: data.assigned_at,
    expiresAt: data.expires_at,
    assignedBy: data.assigned_by,
    notes: data.notes,
    subscriptionId: data.subscription_id,
    isActive: data.is_active,
  };
}

// ===== CACHE MANAGEMENT =====

export function clearLevelCache(): void {
  levelsCache = null;
  featuresCache = null;
  levelFeaturesCache = null;
}

// ===== QUICK CHECK HELPERS =====

/**
 * Quick check if user is on a paid tier
 */
export async function isPaidUser(): Promise<boolean> {
  const levelId = await getCurrentUserLevel();
  return levelId !== 'free';
}

/**
 * Quick check if user is on pro or higher
 */
export async function isProOrHigher(): Promise<boolean> {
  const levelId = await getCurrentUserLevel();
  return levelId === 'pro' || levelId === 'premium';
}

/**
 * Quick check if user is premium
 */
export async function isPremium(): Promise<boolean> {
  const levelId = await getCurrentUserLevel();
  return levelId === 'premium';
}
