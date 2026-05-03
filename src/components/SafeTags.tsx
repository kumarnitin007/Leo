import React, { useEffect, useState } from 'react';
import { Tag } from '../types';
import { getSafeTags, createSafeTag, deleteTag } from '../storage';
import { TAG_UI, VaultScopePill } from './tags/tagUiShared';

const SAFE_SWATCHES = [
  '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#6366F1',
];

interface SafeTagsProps {
  onClose?: () => void;
  onTagsChange?: () => void;
}

const SafeTags: React.FC<SafeTagsProps> = ({ onClose, onTagsChange }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3B82F6');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      const t = await getSafeTags();
      setTags(t.filter((tag) => !tag.isSystemCategory));
    } catch {
      console.error('[SafeTags] load failed');
      setError('Failed to load tags');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    try {
      const created = await createSafeTag(newTagName.trim(), newTagColor);
      if (created) {
        setNewTagName('');
        setIsCreating(false);
        await load();
        onTagsChange?.();
      }
    } catch {
      setError('Failed to create tag');
    }
  };

  const handleDelete = async (tagId: string) => {
    if (!confirm('Delete this tag? This will not delete entries using the tag.')) return;
    try {
      await deleteTag(tagId);
      await load();
      onTagsChange?.();
    } catch {
      setError('Failed to delete tag');
    }
  };

  const filtered = tags.filter((t) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q);
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: 16,
      }}
    >
      <div
        style={{
          backgroundColor: TAG_UI.paper,
          borderRadius: 16,
          padding: '1.25rem 1.5rem',
          width: '100%',
          maxWidth: 760,
          maxHeight: '85vh',
          overflow: 'auto',
          border: `0.5px solid ${TAG_UI.border}`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 500, color: '#111' }}>🏷️ Vault tags</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: TAG_UI.muted }}>Used on passwords & documents — same visual style as Settings tags.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
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
              <button
                type="button"
                onClick={onClose}
                style={{ fontSize: 12, color: TAG_UI.muted, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕ Close
              </button>
            )}
          </div>
        </div>

        {error && <p style={{ color: TAG_UI.deleteText, fontSize: 12, marginBottom: 10 }}>{error}</p>}

        {isCreating && (
          <div
            style={{
              marginBottom: 16,
              padding: 16,
              border: `1px solid ${TAG_UI.border}`,
              borderRadius: 12,
              background: TAG_UI.paperAlt,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111', marginBottom: 10 }}>New tag</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: TAG_UI.muted, fontWeight: 600 }}>Name</label>
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name"
                style={{
                  width: '100%',
                  marginTop: 6,
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${TAG_UI.border}`,
                  fontSize: 14,
                  background: TAG_UI.paper,
                }}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: TAG_UI.muted, fontWeight: 600 }}>Color</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                {SAFE_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      border: newTagColor === c ? '2px solid #1D1D1D' : '2px solid rgba(255,255,255,0.85)',
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
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: 12, color: TAG_UI.muted }}>+</span>
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    aria-label="Custom color"
                    style={{ position: 'absolute', inset: -8, opacity: 0, width: '160%', cursor: 'pointer' }}
                  />
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewTagName('');
                }}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 8,
                  border: `1px solid ${TAG_UI.border}`,
                  background: TAG_UI.paper,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                style={{
                  flex: 2,
                  padding: 10,
                  borderRadius: 8,
                  border: 'none',
                  background: TAG_UI.btnDark,
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Create tag
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ border: `1px solid ${TAG_UI.border}`, borderRadius: 8, padding: '8px 12px', background: TAG_UI.paper, display: 'flex', gap: 8 }}>
            <span style={{ color: TAG_UI.muted }}>🔍</span>
            <input
              type="search"
              placeholder="Search tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 13, background: 'transparent' }}
            />
          </div>
        </div>

        <p style={{ fontSize: 12, color: TAG_UI.muted, margin: '0 0 12px 0' }}>{filtered.length} tag{filtered.length !== 1 ? 's' : ''}</p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 10,
          }}
        >
          {filtered.map((tag) => (
            <div
              key={tag.id}
              className="vault-tag-card-wrap"
              style={{
                border: `0.5px solid ${TAG_UI.border}`,
                borderRadius: 12,
                padding: 14,
                background: TAG_UI.paper,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: tag.color }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tag.name}
                  </span>
                </div>
                <VaultScopePill />
              </div>
              <div style={{ marginTop: 10 }}>
                <TagSectionMini />
              </div>
              <div
                style={{
                  borderTop: `1px solid ${TAG_UI.border}`,
                  marginTop: 12,
                  paddingTop: 10,
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <div className="vault-tag-card-del" style={{ opacity: 0, transition: 'opacity 0.15s' }}>
                  <button
                    type="button"
                    onClick={() => void handleDelete(tag.id)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: TAG_UI.deleteText,
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: TAG_UI.muted, border: `1px dashed ${TAG_UI.border}`, borderRadius: 12 }}>
            No vault tags yet. Create one to label passwords and documents consistently.
          </div>
        )}

        <style>{`
          @media (hover: hover) {
            .vault-tag-card-del { opacity: 0; }
            .vault-tag-card-wrap:hover .vault-tag-card-del {
              opacity: 1 !important;
            }
            .vault-tag-card-wrap:hover {
              background: ${TAG_UI.paperAlt};
            }
          }
          @media (hover: none), (max-width: 768px) {
            .vault-tag-card-del {
              opacity: 1 !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

/** Static hint — vault tags stay in Vault only */
function TagSectionMini() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, border: `1px solid ${TAG_UI.border}`, color: '#374151', background: TAG_UI.paperAlt }}>
        🔐 Entries
      </span>
      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, border: `1px solid ${TAG_UI.border}`, color: '#374151', background: TAG_UI.paperAlt }}>
        📄 Documents
      </span>
    </div>
  );
}

export default SafeTags;
