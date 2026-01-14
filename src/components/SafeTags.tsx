import React, { useEffect, useState } from 'react';
import { Tag } from '../types';
import { getSafeTags, createSafeTag, deleteTag } from '../storage';

interface SafeTagsProps {
  onClose?: () => void;
  onTagsChange?: () => void;
}

const SafeTags: React.FC<SafeTagsProps> = ({ onClose, onTagsChange }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#667eea');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const t = await getSafeTags();
      // Only show user-created safe tags, not system categories
      setTags(t.filter(tag => !tag.isSystemCategory));
    } catch (e: any) {
      console.error('Error loading safe tags:', e);
      setError('Failed to load tags');
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    try {
      const created = await createSafeTag(newTagName.trim(), newTagColor);
      if (created) {
        setNewTagName('');
        setIsCreating(false);
        await load();
        if (onTagsChange) onTagsChange();
      }
    } catch (e: any) {
      console.error('Create safe tag error:', e);
      setError('Failed to create tag');
    }
  };

  const handleDelete = async (tagId: string) => {
    if (!confirm('Delete this tag? This will not delete entries using the tag.')) return;
    try {
      await deleteTag(tagId);
      await load();
      if (onTagsChange) onTagsChange();
    } catch (e: any) {
      console.error('Delete safe tag error:', e);
      setError('Failed to delete tag');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200
    }}>
      <div style={{ backgroundColor: 'white', borderRadius: '1rem', padding: '1.5rem', width: '720px', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>🏷️ Safe Tags</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { setIsCreating(true); }} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem' }}>+ New</button>
            {onClose && <button onClick={onClose} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Close</button>}
          </div>
        </div>

        {error && <p style={{ color: '#ef4444' }}>{error}</p>}

        {isCreating && (
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name" style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }} />
            <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} style={{ width: '48px', height: '36px', border: 'none', background: 'transparent' }} />
            <button onClick={handleCreate} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Create</button>
            <button onClick={() => { setIsCreating(false); setNewTagName(''); }} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '0.5rem' }}>Cancel</button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
          {tags.map(tag => (
            <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: tag.color || '#667eea', borderRadius: '4px' }} />
                <div>{tag.name}</div>
              </div>
              <div>
                <button onClick={() => handleDelete(tag.id)} style={{ padding: '0.25rem 0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SafeTags;
