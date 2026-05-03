/**
 * Tags Manager — Settings → Tags
 * UI matches docs/redesign/TAGS_REDESIGN_CURSOR_PROMPT.md (Crisp Paper / compact cards).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Tag, TagSection } from './types';
import { getTags, addTag, updateTag, deleteTag, loadData } from './storage';
import { TAG_UI, TagSectionPills, TrackableBadge } from './components/tags/tagUiShared';

type FilterChip = 'all' | 'trackable' | 'tasks' | 'events' | 'journals';
type ViewMode = 'card' | 'list';

const ALL_SECTIONS: TagSection[] = ['tasks', 'events', 'journals', 'items'];

const PREDEFINED_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#EC4899', '#14B8A6', '#6366F1', '#F97316',
  '#A855F7', '#06B6D4', '#84CC16',
];

interface TagsManagerProps {
  onClose?: () => void;
  /** When true, use mobile header + stacked form; list rows open edit on tap */
  isMobile?: boolean;
  onMobileBack?: () => void;
}

const TagsManager: React.FC<TagsManagerProps> = ({ onClose, isMobile, onMobileBack }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [filterChip, setFilterChip] = useState<FilterChip>('all');
  const [search, setSearch] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    color: PREDEFINED_COLORS[3],
    trackable: false,
    description: '',
    allowedSections: [...ALL_SECTIONS] as TagSection[],
  });

  const [tagUsage, setTagUsage] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    try {
      const allTags = await getTags();
      const regularTags = allTags.filter((tag) => !tag.isSafeOnly);
      setTags(regularTags);

      const data = await loadData();
      const usageMap = new Map<string, number>();

      allTags.forEach((tag) => {
        let count = 0;
        data.tasks.forEach((task) => {
          if (task.tags?.includes(tag.id)) count++;
        });
        data.events.forEach((event) => {
          if (event.tags?.includes(tag.id)) count++;
        });
        data.journalEntries.forEach((entry) => {
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

  const getTagUsage = (tagId: string): number => tagUsage.get(tagId) || 0;

  const passesFilter = useCallback(
    (tag: Tag): boolean => {
      if (filterChip === 'trackable' && !tag.trackable) return false;
      if (filterChip === 'all') return true;
      const map: Record<string, TagSection> = {
        tasks: 'tasks',
        events: 'events',
        journals: 'journals',
      };
      const sec = map[filterChip];
      const allowed = tag.allowedSections;
      if (!allowed?.length) return true;
      return allowed.includes(sec);
    },
    [filterChip],
  );

  const filteredTags = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tags.filter((t) => {
      if (!passesFilter(t)) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    });
  }, [tags, search, passesFilter]);

  const handleCreate = () => {
    setEditingTag(null);
    setIsCreating(true);
    setFormData({
      name: '',
      color: PREDEFINED_COLORS[Math.floor(Math.random() * PREDEFINED_COLORS.length)],
      trackable: false,
      description: '',
      allowedSections: [...ALL_SECTIONS],
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
      allowedSections:
        tag.allowedSections && tag.allowedSections.length > 0
          ? [...tag.allowedSections]
          : [...ALL_SECTIONS],
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
          allowedSections: formData.allowedSections.length > 0 ? formData.allowedSections : undefined,
        });
      } else {
        const newTag: Tag = {
          id: crypto.randomUUID(),
          name: formData.name.trim(),
          color: formData.color,
          trackable: formData.trackable,
          description: formData.description.trim() || undefined,
          allowedSections: formData.allowedSections.length > 0 ? formData.allowedSections : undefined,
          createdAt: new Date().toISOString(),
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
    const message =
      usage > 0
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

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
    border: `1px solid ${active ? TAG_UI.activeChipBorder : TAG_UI.border}`,
    background: active ? TAG_UI.activeChipBg : TAG_UI.paper,
    color: active ? TAG_UI.activeChipText : TAG_UI.muted,
  });

  const filterChips: { id: FilterChip; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'trackable', label: 'Trackable' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'events', label: 'Events' },
    { id: 'journals', label: 'Journal' },
  ];

  const renderForm = () => (
    <div
      style={{
        background: TAG_UI.paper,
        border: `0.5px solid ${TAG_UI.border}`,
        borderRadius: 12,
        padding: isMobile ? 16 : 20,
        marginBottom: 16,
      }}
    >
      {isMobile && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>{editingTag ? 'Edit tag' : 'New tag'}</span>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${TAG_UI.border}`,
              background: TAG_UI.paperAlt,
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TAG_UI.muted, marginBottom: 6 }}>
              Tag name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Achievement"
              maxLength={30}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${TAG_UI.border}`,
                fontSize: 14,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TAG_UI.muted, marginBottom: 6 }}>
              Color
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {PREDEFINED_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  title={color}
                  onClick={() => setFormData({ ...formData, color })}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: color,
                    border:
                      formData.color === color
                        ? '2px solid #1D1D1D'
                        : '2px solid rgba(255,255,255,0.8)',
                    boxShadow: formData.color === color ? '0 0 0 2px #fff inset' : undefined,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
              <label
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: `2px dashed ${TAG_UI.border}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: TAG_UI.muted,
                  overflow: 'hidden',
                  verticalAlign: 'middle',
                  position: 'relative',
                }}
              >
                <span style={{ pointerEvents: 'none', position: 'relative', zIndex: 1 }}>+</span>
                <input
                  type="color"
                  aria-label="Custom color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  style={{
                    position: 'absolute',
                    inset: -6,
                    width: '140%',
                    height: '140%',
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {formData.trackable && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TAG_UI.muted, marginBottom: 6 }}>
              Description (optional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What this tag tracks"
              maxLength={100}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${TAG_UI.border}`,
                fontSize: 13,
              }}
            />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              border: `1px solid ${TAG_UI.border}`,
              borderRadius: 10,
              padding: 14,
              background: TAG_UI.paperAlt,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 8 }}>Analytics tracking</div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.trackable}
                onChange={(e) => setFormData({ ...formData, trackable: e.target.checked })}
                style={{ marginTop: 2, width: 18, height: 18, accentColor: TAG_UI.tabUnderline }}
              />
              <span>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>Enable analytics tracking</span>
                <div style={{ fontSize: 11, color: TAG_UI.muted, marginTop: 4, lineHeight: 1.4 }}>
                  Auto-count occurrences in Insights & Analytics.
                </div>
              </span>
            </label>
          </div>

          <div
            style={{
              border: `1px solid ${TAG_UI.border}`,
              borderRadius: 10,
              padding: 14,
              background: TAG_UI.paperAlt,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 8 }}>Available in sections</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              {(['tasks', 'events', 'journals', 'items'] as TagSection[]).map((section) => (
                <label key={section} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={formData.allowedSections.includes(section)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, allowedSections: [...formData.allowedSections, section] });
                      } else {
                        setFormData({
                          ...formData,
                          allowedSections: formData.allowedSections.filter((s) => s !== section),
                        });
                      }
                    }}
                    style={{ width: 16, height: 16, accentColor: TAG_UI.tabUnderline }}
                  />
                  {section === 'tasks' && '✅ Tasks'}
                  {section === 'events' && '📅 Events'}
                  {section === 'journals' && '📓 Journals'}
                  {section === 'items' && '📦 Items'}
                </label>
              ))}
            </div>
            <div style={{ fontSize: 10, color: TAG_UI.muted, marginTop: 10, lineHeight: 1.4 }}>
              Leave all unchecked to allow in all sections.
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            flexDirection: isMobile ? 'column-reverse' : 'row',
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            style={{
              padding: isMobile ? '12px' : '8px 18px',
              borderRadius: 8,
              border: `1px solid ${TAG_UI.border}`,
              background: TAG_UI.paper,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              color: '#111',
              flex: isMobile ? 1 : undefined,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: isMobile ? '12px' : '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: TAG_UI.btnDark,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              flex: isMobile ? 2 : undefined,
            }}
          >
            {editingTag ? 'Update tag' : 'Create tag'}
          </button>
        </div>
      </form>
    </div>
  );

  const renderCardGrid = () => (
    <div
      className="tags-redesign-card-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, minmax(0, 1fr))',
        gap: 10,
      }}
    >
      {filteredTags.map((tag) => {
        const usage = getTagUsage(tag.id);
        return (
          <div
            key={tag.id}
            className="tags-redesign-card group"
            style={{
              position: 'relative',
              background: TAG_UI.paper,
              border: `0.5px solid ${TAG_UI.border}`,
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: tag.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tag.name}
                </span>
              </div>
              {tag.trackable && <TrackableBadge />}
            </div>
            {tag.description && (
              <div style={{ fontSize: 11, color: TAG_UI.muted, marginTop: 6, lineHeight: 1.35 }}>{tag.description}</div>
            )}
            <div style={{ marginTop: 10 }}>
              <TagSectionPills allowedSections={tag.allowedSections} />
            </div>
            <div
              style={{
                borderTop: `1px solid ${TAG_UI.border}`,
                marginTop: 12,
                paddingTop: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, color: TAG_UI.muted }}>
                {usage} item{usage !== 1 ? 's' : ''}
              </span>
              {!isMobile && (
                <div
                  className="tags-redesign-card-actions"
                  style={{
                    display: 'flex',
                    gap: 6,
                    opacity: 0,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleEdit(tag)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      border: `1px solid ${TAG_UI.border}`,
                      background: TAG_UI.paper,
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(tag)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      border: `1px solid transparent`,
                      background: 'transparent',
                      color: TAG_UI.deleteText,
                      cursor: 'pointer',
                    }}
                  >
                    Del
                  </button>
                </div>
              )}
            </div>
            {isMobile && (
              <button
                type="button"
                onClick={() => handleEdit(tag)}
                style={{
                  marginTop: 8,
                  width: '100%',
                  padding: 8,
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${TAG_UI.border}`,
                  background: TAG_UI.paperAlt,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderListView = () => (
    <div
      style={{
        background: TAG_UI.paper,
        border: `0.5px solid ${TAG_UI.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: isMobile ? 'none' : 'grid',
          gridTemplateColumns: '1fr 200px 88px 100px',
          gap: 8,
          padding: '10px 14px',
          background: TAG_UI.paperAlt,
          fontSize: 10,
          fontWeight: 700,
          color: TAG_UI.muted,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <span>Tag</span>
        <span>Sections</span>
        <span>Usage</span>
        <span style={{ textAlign: 'right' }}>Actions</span>
      </div>
      {filteredTags.map((tag) => {
        const usage = getTagUsage(tag.id);
        return (
          <div
            key={tag.id}
            className="tags-redesign-list-row group"
            onClick={isMobile ? () => handleEdit(tag) : undefined}
            role={isMobile ? 'button' : undefined}
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'auto 1fr auto auto' : '1fr 200px 88px 100px',
              gap: 8,
              alignItems: 'center',
              padding: '12px 14px',
              borderTop: `1px solid ${TAG_UI.border}`,
              cursor: isMobile ? 'pointer' : 'default',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{tag.name}</span>
                  {tag.trackable && <TrackableBadge />}
                </div>
                {tag.description && (
                  <div style={{ fontSize: 11, color: TAG_UI.muted, marginTop: 2 }}>{tag.description}</div>
                )}
                {isMobile && (
                  <div style={{ marginTop: 8 }}>
                    <TagSectionPills allowedSections={tag.allowedSections} />
                  </div>
                )}
              </div>
            </div>
            {!isMobile && (
              <div style={{ minWidth: 0 }}>
                <TagSectionPills allowedSections={tag.allowedSections} />
              </div>
            )}
            <div style={{ fontSize: 12, color: TAG_UI.muted, textAlign: isMobile ? 'right' : 'left' }}>
              {usage} item{usage !== 1 ? 's' : ''}
            </div>
            {isMobile ? (
              <span style={{ fontSize: 14, color: TAG_UI.muted }}>›</span>
            ) : (
              <div
                className="tags-redesign-list-actions"
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 6,
                  opacity: 0,
                  transition: 'opacity 0.15s',
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(tag);
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    border: 'none',
                    background: 'none',
                    color: '#111',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(tag);
                  }}
                  style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    border: 'none',
                    background: 'none',
                    color: TAG_UI.deleteText,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={`tags-manager tags-manager--redesign${isMobile ? ' tags-manager--mobile' : ''}`}>
      {isMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 16px',
            background: TAG_UI.paper,
            borderBottom: `1px solid ${TAG_UI.border}`,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => onMobileBack?.()}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${TAG_UI.border}`,
              background: TAG_UI.paperAlt,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
            aria-label="Back"
          >
            ‹
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#111' }}>🏷️ Tags</div>
            <div style={{ fontSize: 11, color: TAG_UI.muted }}>Manage your tags</div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating}
            style={{
              background: TAG_UI.btnDark,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              padding: '0 12px',
              height: 34,
              borderRadius: 8,
              border: 'none',
              cursor: isCreating ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: isCreating ? 0.45 : 1,
            }}
          >
            + New
          </button>
        </div>
      )}

      {!isMobile && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}>
              🏷️ Manage tags
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: TAG_UI.muted }}>
              Organize your tasks, events, and journal entries
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleCreate}
              style={{
                background: TAG_UI.btnDark,
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + New tag
            </button>
            {onClose && (
              <button type="button" onClick={onClose} style={{ fontSize: 12, color: TAG_UI.muted, background: 'none', border: 'none', cursor: 'pointer' }}>
                ✕ Close
              </button>
            )}
          </div>
        </div>
      )}

      {isCreating && renderForm()}

      {(!isCreating || !isMobile) && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div
              style={{
                flex: '1 1 200px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: `1px solid ${TAG_UI.border}`,
                borderRadius: 8,
                padding: '8px 12px',
                background: TAG_UI.paper,
              }}
            >
              <span style={{ color: TAG_UI.muted, fontSize: 14 }}>🔍</span>
              <input
                type="search"
                placeholder="Search tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent' }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {filterChips.map((c) => (
                <button key={c.id} type="button" onClick={() => setFilterChip(c.id)} style={chipStyle(filterChip === c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                border: `1px solid ${TAG_UI.border}`,
                borderRadius: 8,
                overflow: 'hidden',
                background: TAG_UI.paperAlt,
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('card')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === 'card' ? '#E5E7EB' : 'transparent',
                }}
                title="Card view"
              >
                ⊞
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  border: 'none',
                  cursor: 'pointer',
                  borderLeft: `1px solid ${TAG_UI.border}`,
                  background: viewMode === 'list' ? '#E5E7EB' : 'transparent',
                }}
                title="List view"
              >
                ☰
              </button>
            </div>
          </div>

          <p style={{ fontSize: 12, color: TAG_UI.muted, margin: '0 0 12px 0' }}>
            {filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}
            {filteredTags.length !== tags.length ? ` (${tags.length} total)` : ''}
          </p>

          {filteredTags.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: TAG_UI.muted, border: `1px dashed ${TAG_UI.border}`, borderRadius: 12 }}>
              No tags match your filters.
            </div>
          ) : viewMode === 'card' ? (
            renderCardGrid()
          ) : (
            renderListView()
          )}
        </>
      )}

      {(!isCreating || !isMobile) && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${TAG_UI.border}`, fontSize: 11, color: TAG_UI.muted, lineHeight: 1.5 }}>
          💡 Tags organize tasks, events, and journal entries. Trackable tags are counted automatically in Insights & Analytics.
        </div>
      )}

      <style>{`
        @media (hover: hover) {
          .tags-redesign-card.group:hover .tags-redesign-card-actions {
            opacity: 1 !important;
          }
          .tags-redesign-list-row.group:hover .tags-redesign-list-actions {
            opacity: 1 !important;
          }
          .tags-redesign-list-row.group:hover {
            background: ${TAG_UI.paperAlt};
          }
        }
      `}</style>
    </div>
  );
};

export default TagsManager;
