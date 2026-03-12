/**
 * Storage Tags Module
 * 
 * Tag CRUD operations and section-based filtering
 */

import { Tag, TagSection } from '../types';
import { requireAuth, generateUUID } from './core';

// ===== TAGS =====

export const getTags = async (): Promise<Tag[]> => {
  const { client } = await requireAuth();

  const { data, error } = await client
    .from('myday_tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }

  return (data || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    trackable: tag.trackable || false,
    description: tag.description,
    allowedSections: tag.allowed_sections || undefined,
    isSafeOnly: tag.is_safe_only || false,
    isSystemCategory: tag.is_system_category || false,
    parentId: tag.parent_id || undefined,
    createdAt: tag.created_at || new Date().toISOString()
  }));
};

/**
 * Get tags available for a specific section
 * @param section - The section to get tags for ('tasks', 'events', 'journals', 'items', 'safe')
 */
export const getTagsForSection = async (section: TagSection): Promise<Tag[]> => {
  const { client, userId } = await requireAuth();

  let query = client
    .from('myday_tags')
    .select('*')
    .eq('user_id', userId);

  if (section === 'safe') {
    query = query.eq('is_safe_only', true);
  } else {
    query = query
      .or('is_safe_only.is.null,is_safe_only.eq.false');
    
    const { data: allTags, error: fetchError } = await query;
    
    if (fetchError) {
      console.error('Error fetching tags for section:', fetchError);
      return [];
    }
    
    const filteredTags = (allTags || []).filter(tag => {
      if (tag.is_safe_only) return false;
      
      if (!tag.allowed_sections || tag.allowed_sections.length === 0) {
        return true;
      }
      
      return tag.allowed_sections.includes(section);
    });
    
    return filteredTags
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        trackable: tag.trackable || false,
        description: tag.description,
        allowedSections: tag.allowed_sections || undefined,
        isSafeOnly: tag.is_safe_only || false,
        isSystemCategory: tag.is_system_category || false,
        parentId: tag.parent_id || undefined,
        createdAt: tag.created_at || new Date().toISOString()
      }));
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) {
    console.error('Error fetching tags for section:', error);
    return [];
  }

  return (data || []).map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    trackable: tag.trackable || false,
    description: tag.description,
    allowedSections: tag.allowed_sections || undefined,
    isSafeOnly: tag.is_safe_only || false,
    isSystemCategory: tag.is_system_category || false,
    parentId: tag.parent_id || undefined,
    createdAt: tag.created_at || new Date().toISOString()
  }));
};

export const saveTag = async (tag: Tag): Promise<void> => {
  const { client, userId } = await requireAuth();

  const { error } = await client
    .from('myday_tags')
    .upsert([{
      id: tag.id || generateUUID(),
      user_id: userId,
      name: tag.name,
      color: tag.color,
      trackable: tag.trackable,
      description: tag.description,
      allowed_sections: tag.allowedSections || null,
      is_safe_only: tag.isSafeOnly || false,
      is_system_category: tag.isSystemCategory || false,
      parent_id: tag.parentId || null
    }], {
      onConflict: 'user_id,name'
    });

  if (error) throw error;
};

export const deleteTag = async (tagId: string): Promise<void> => {
  const { client } = await requireAuth();

  const { error } = await client
    .from('myday_tags')
    .delete()
    .eq('id', tagId);

  if (error) throw error;
};

export const addTag = saveTag;

export const updateTag = async (tagId: string, updates: Partial<Tag>): Promise<void> => {
  const tags = await getTags();
  const tag = tags.find(t => t.id === tagId);
  if (!tag) throw new Error('Tag not found');
  await saveTag({ ...tag, ...updates });
};
