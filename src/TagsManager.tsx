/**
 * Tags Manager Component
 * 
 * Manage tags for tasks, events, and journal entries
 * Features:
 * - Create, edit, delete tags
 * - Assign colors to tags
 * - View tag usage statistics
 */

import React, { useState, useEffect } from 'react';
import { Tag, TagSection } from './types';
import { getTags, addTag, updateTag, deleteTag, loadData, importSampleTags } from './storage';
import { useTheme } from './contexts/ThemeContext';

interface TagsManagerProps {
  onClose?: () => void;
}

const TagsManager: React.FC<TagsManagerProps> = ({ onClose }) => {
  const { theme } = useTheme();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  
  // Helper function to create theme-appropriate colors for sections
  const getSectionStyles = () => {
    // Create a light tint of the primary color for background
    const primaryRgb = hexToRgb(theme.colors.primary);
    const lightBg = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`;
    const lighterBg = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`;
    const borderColor = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.3)`;
    const innerBorderColor = `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`;
    
    return {
      containerBg: `linear-gradient(135deg, ${lightBg} 0%, ${lighterBg} 100%)`,
      border: `2px solid ${theme.colors.primary}`,
      shadow: `0 2px 8px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`,
      innerBg: 'rgba(255, 255, 255, 0.7)',
      innerBorder: `2px solid ${innerBorderColor}`,
      textColor: theme.colors.primary,
      accentColor: theme.colors.primary
    };
  };
  
  // Helper to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 102, g: 126, b: 234 }; // fallback to purple
  };
  
  const sectionStyles = getSectionStyles();
  const [formData, setFormData] = useState({
    name: '',
    color: '#667eea',
    trackable: false,
    description: '',
    allowedSections: ['tasks', 'events', 'journals', 'items'] as TagSection[]
  });

  const predefinedColors = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
    '#14B8A6', '#6366F1', '#A855F7', '#F43F5E'
  ];

  const [tagUsage, setTagUsage] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const allTags = await getTags();
      // Filter out safe-only tags (they're managed in Safe section)
      const regularTags = allTags.filter(tag => !tag.isSafeOnly);
      setTags(regularTags);
      
      // Calculate usage for all tags
      const data = await loadData();
      const usageMap = new Map<string, number>();
      
      allTags.forEach(tag => {
        let count = 0;
        
        data.tasks.forEach(task => {
          if (task.tags?.includes(tag.id)) count++;
        });
        
        data.events.forEach(event => {
          if (event.tags?.includes(tag.id)) count++;
        });
        
        data.journalEntries.forEach(entry => {
          if (entry.tags?.includes(tag.id)) count++;
        });
        
        usageMap.set(tag.id, count);
      });
      
      setTagUsage(usageMap);
    } catch (error) {
      console.error('Error loading tags:', error);
      alert('Error loading tags. Please make sure you are signed in.');
    }
  };

  const getTagUsage = (tagId: string): number => {
    return tagUsage.get(tagId) || 0;
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingTag(null);
    setFormData({
      name: '',
      color: predefinedColors[Math.floor(Math.random() * predefinedColors.length)],
      trackable: false,
      description: '',
      allowedSections: ['tasks', 'events', 'journals', 'items']
    });
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setIsCreating(true);
    setFormData({
      name: tag.name,
      color: tag.color,
      trackable: tag.trackable || false,
      description: tag.description || '',
      allowedSections: tag.allowedSections || ['tasks', 'events', 'journals', 'items']
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a tag name');
      return;
    }

    try {
      if (editingTag) {
        await updateTag(editingTag.id, {
          ...formData,
          allowedSections: formData.allowedSections.length > 0 ? formData.allowedSections : undefined
        });
      } else {
        const newTag: Tag = {
          id: crypto.randomUUID(),
          name: formData.name.trim(),
          color: formData.color,
          trackable: formData.trackable,
          description: formData.description.trim() || undefined,
          allowedSections: formData.allowedSections.length > 0 ? formData.allowedSections : undefined,
          createdAt: new Date().toISOString()
        };
        await addTag(newTag);
      }

      await loadTags();
      setIsCreating(false);
      setEditingTag(null);
    } catch (error) {
      console.error('Error saving tag:', error);
      alert('Error saving tag. Please try again.');
    }
  };

  const handleDelete = async (tag: Tag) => {
    const usage = getTagUsage(tag.id);
    const message = usage > 0 
      ? `This tag is used by ${usage} item(s). Are you sure you want to delete it?`
      : 'Are you sure you want to delete this tag?';
      
    if (confirm(message)) {
      try {
        await deleteTag(tag.id);
        await loadTags();
      } catch (error) {
        console.error('Error deleting tag:', error);
        alert('Error deleting tag. Please try again.');
      }
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingTag(null);
  };

  return (
    <div className="tags-manager">
      <div className="tags-manager-header">
        <div>
          <h2>🏷️ Manage Tags</h2>
          <p>Organize your tasks, events, and journal entries</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleCreate} className="btn-primary">
            + New Tag
          </button>
          <button
            onClick={async () => {
              const clearFirst = confirm('Load sample tags? Click OK to clear existing tags and load samples, or Cancel to add to existing tags.');
              if (clearFirst && !confirm('⚠️ This will delete ALL your existing tags. Are you sure?')) return;
              setIsImporting(true);
              const success = await importSampleTags(clearFirst);
              setIsImporting(false);
              if (success) {
                await loadTags();
                alert(`Sample tags ${clearFirst ? 'loaded' : 'added'} successfully!`);
              } else {
                alert('Error importing sample tags. Please try again.');
              }
            }}
            className="btn-secondary"
            disabled={isImporting}
          >
            Load Demo Tags
          </button>
          {onClose && (
            <button onClick={onClose} className="btn-secondary">
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <div className="tag-form-container">
          <h4>{editingTag ? 'Edit Tag' : 'Create New Tag'}</h4>
          <form className="tag-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="form-row">
              <div className="form-group">
                <label>Tag Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Late Night Sleep, Social Meeting"
                  maxLength={30}
                />
              </div>

              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {predefinedColors.map(color => (
                    <button
                      key={color}
                      type="button"
                      className={`color-option ${formData.color === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="color-input"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                background: sectionStyles.containerBg,
                borderRadius: '12px',
                border: sectionStyles.border,
                boxShadow: sectionStyles.shadow
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📊</span>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: sectionStyles.textColor, fontWeight: 600 }}>
                    Track this tag in analytics (auto-count occurrences)
                  </h4>
                </div>
                
                <div style={{
                  padding: '1rem',
                  background: sectionStyles.innerBg,
                  borderRadius: '8px',
                  border: sectionStyles.innerBorder,
                  marginBottom: '0.75rem'
                }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    cursor: 'pointer',
                    marginBottom: '0.5rem'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.trackable}
                      onChange={(e) => setFormData({ ...formData, trackable: e.target.checked })}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        accentColor: sectionStyles.accentColor
                      }}
                    />
                    <span style={{ 
                      fontWeight: 600, 
                      fontSize: '0.95rem',
                      color: sectionStyles.textColor
                    }}>
                      Enable analytics tracking
                    </span>
                  </label>
                  <div style={{ 
                    marginLeft: '2rem',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1rem', color: sectionStyles.textColor }}>ℹ️</span>
                    <span style={{ 
                      fontSize: '0.85rem', 
                      color: sectionStyles.textColor,
                      lineHeight: '1.4',
                      opacity: 0.8
                    }}>
                      Enable this to see counts per month in Insights & Analytics
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {formData.trackable && (
              <div className="form-group">
                <label>Description (Optional)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., Track days when I stay up past midnight"
                  maxLength={100}
                />
                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.25rem 0 0 0' }}>
                  Helps you remember what this tag is tracking
                </p>
              </div>
            )}

            <div className="form-group">
              <div style={{ 
                marginTop: '1.5rem', 
                padding: '1.5rem', 
                background: sectionStyles.containerBg,
                borderRadius: '12px',
                border: sectionStyles.border,
                boxShadow: sectionStyles.shadow
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>📋</span>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: sectionStyles.textColor, fontWeight: 600 }}>
                    Available in Sections
                  </h4>
                </div>
                
                <div style={{
                  padding: '1rem',
                  background: sectionStyles.innerBg,
                  borderRadius: '8px',
                  border: sectionStyles.innerBorder,
                  marginBottom: '0.75rem'
                }}>
                  {(['tasks', 'events', 'journals', 'items'] as TagSection[]).map(section => (
                    <label key={section} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.75rem', 
                      cursor: 'pointer',
                      marginBottom: section !== 'items' ? '0.75rem' : '0'
                    }}>
                      <input
                        type="checkbox"
                        checked={formData.allowedSections.includes(section)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              allowedSections: [...formData.allowedSections, section]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              allowedSections: formData.allowedSections.filter(s => s !== section)
                            });
                          }
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          accentColor: sectionStyles.accentColor
                        }}
                      />
                      <span style={{ 
                        fontWeight: 600, 
                        fontSize: '0.95rem',
                        color: sectionStyles.textColor
                      }}>
                        {section === 'tasks' && '📋 Tasks'}
                        {section === 'events' && '📅 Events'}
                        {section === 'journals' && '📔 Journals'}
                        {section === 'items' && '📦 Items'}
                      </span>
                    </label>
                  ))}
                  <div style={{ 
                    marginLeft: '2rem',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    marginTop: '0.75rem'
                  }}>
                    <span style={{ fontSize: '1rem', color: sectionStyles.textColor }}>ℹ️</span>
                    <span style={{ 
                      fontSize: '0.85rem', 
                      color: sectionStyles.textColor,
                      lineHeight: '1.4',
                      opacity: 0.8
                    }}>
                      Select which sections can use this tag. Leave all unchecked to allow in all sections.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingTag ? 'Update Tag' : 'Create Tag'}
              </button>
              <button type="button" onClick={handleCancel} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tags List */}
      <div className="tags-list">
        {tags.length === 0 ? (
          <div className="no-tags">
            <p>No tags yet. Create your first tag to get started!</p>
          </div>
        ) : (
          <div className="tags-grid">
            {tags.map(tag => {
              const usage = getTagUsage(tag.id);
              return (
                <div key={tag.id} className="tag-item">
                  <div className="tag-item-header">
                    <span 
                      className="tag-color-indicator"
                      style={{ backgroundColor: tag.color }}
                    />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {tag.name}
                        {tag.trackable && (
                          <span style={{
                            fontSize: '0.75rem',
                            background: '#dbeafe',
                            color: '#1e40af',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '8px',
                            fontWeight: 600
                          }}>
                            📊 Trackable
                          </span>
                        )}
                      </h4>
                      {tag.description && (
                        <p style={{ 
                          margin: '0.25rem 0 0 0', 
                          fontSize: '0.85rem', 
                          color: '#6b7280',
                          fontStyle: 'italic'
                        }}>
                          {tag.description}
                        </p>
                      )}
                      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {!tag.allowedSections || tag.allowedSections.length === 0 ? (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            📋 Tasks 📅 Events 📔 Journals 📦 Items
                          </span>
                        ) : (
                          tag.allowedSections.map(section => (
                            <span key={section} style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                              {section === 'tasks' && '📋 Tasks'}
                              {section === 'events' && '📅 Events'}
                              {section === 'journals' && '📔 Journals'}
                              {section === 'items' && '📦 Items'}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="tag-usage">
                    Used in {usage} item{usage !== 1 ? 's' : ''}
                  </div>
                  <div className="tag-actions">
                    <button onClick={() => handleEdit(tag)} className="btn-small btn-edit">
                      ✏️ Edit
                    </button>
                    <button onClick={() => handleDelete(tag)} className="btn-small btn-delete">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="tags-manager-footer">
        <div className="tags-info">
          <p style={{ margin: '0 0 0.75rem 0' }}>
            💡 <strong>Tags help you organize</strong> your tasks, events, and journal entries.
          </p>
          <p style={{ margin: '0 0 0.75rem 0' }}>
            📊 <strong>Trackable Tags</strong> are automatically counted in Insights & Analytics.
            Perfect for tracking habits like:
          </p>
          <ul style={{ margin: '0 0 0 1.5rem', color: '#6b7280' }}>
            <li>Late night sleep (track poor habits)</li>
            <li>Social meetings with friends (track positive activities)</li>
            <li>Exercise days, meditation sessions, etc.</li>
          </ul>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.9rem', color: '#9ca3af' }}>
            Add trackable tags to journal entries to see monthly counts and trends!
          </p>
        </div>
      </div>
    </div>
  );
};

export default TagsManager;

