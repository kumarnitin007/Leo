/**
 * Items View Component
 * 
 * Manages flexible items/resources:
 * - Gift Cards/Vouchers
 * - Subscriptions
 * - Warranties
 * - Important Notes/Reference Info
 * 
 * Features:
 * - View all items in a grid layout
 * - Add new items with category-specific fields
 * - Edit and delete existing items
 * - Filter by category and search
 * - Sort by various criteria
 * - Expiration reminders
 */

import React, { useState, useEffect, useRef } from 'react';
import { Item, ItemCategory, Tag } from './types';
import { 
  getItems, 
  addItem, 
  updateItem, 
  deleteItem,
  getExpiringItems,
  getTags,
  importSampleItems
} from './storage';

interface ItemsViewProps {
  onNavigate?: (view: string) => void;
}

const ItemsView: React.FC<ItemsViewProps> = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [expiringItems, setExpiringItems] = useState<Item[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<string>('name-asc');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Gift Card' as ItemCategory,
    expirationDate: '',
    value: '',
    currency: 'USD',
    merchant: '',
    accountNumber: '',
    autoRenew: false,
    notifyDaysBefore: 0,
    priority: 5,
    color: '#667eea',
    tags: [] as string[],
    isClosed: false
  });

  useEffect(() => {
    loadItems();
    loadTags();
    loadExpiringItems();
  }, []);

  const loadTags = async () => {
    try {
      const allTags = await getTags();
      setTags(allTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadItems = async () => {
    try {
      const allItems = await getItems();
      setItems(allItems);
    } catch (error) {
      console.error('Error loading items:', error);
      alert('Error loading items. Please make sure you are signed in.');
    }
  };

  const loadExpiringItems = async () => {
    try {
      const expiring = await getExpiringItems(30);
      setExpiringItems(expiring);
    } catch (error) {
      console.error('Error loading expiring items:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingItem) {
        await updateItem(editingItem.id, {
          ...formData,
          value: formData.value ? parseFloat(formData.value) : undefined,
          tags: selectedTagIds,
          isClosed: formData.isClosed
        });
      } else {
        const newItem: Item = {
          id: crypto.randomUUID(),
          ...formData,
          value: formData.value ? parseFloat(formData.value) : undefined,
          tags: selectedTagIds,
          isClosed: formData.isClosed,
          createdAt: new Date().toISOString()
        };
        await addItem(newItem);
      }
      
      resetForm();
      await loadItems();
      await loadExpiringItems();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Error saving item. Please try again.');
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setSelectedTagIds(item.tags || []);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      expirationDate: item.expirationDate || '',
      value: item.value?.toString() || '',
      currency: item.currency || 'USD',
      merchant: item.merchant || '',
      accountNumber: item.accountNumber || '',
      autoRenew: item.autoRenew || false,
      notifyDaysBefore: item.notifyDaysBefore || 0,
      priority: item.priority || 5,
      color: item.color || '#667eea',
      tags: item.tags || [],
      isClosed: item.isClosed || false
    });
    setIsEditing(true);
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }
    
    try {
      await deleteItem(itemId);
      await loadItems();
      await loadExpiringItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'Gift Card',
      expirationDate: '',
      value: '',
      currency: 'USD',
      merchant: '',
      accountNumber: '',
      autoRenew: false,
      notifyDaysBefore: 0,
      priority: 5,
      color: '#667eea',
      tags: [],
      isClosed: false
    });
    setSelectedTagIds([]);
    setIsEditing(false);
    setEditingItem(null);
  };

  const getCategoryIcon = (category: ItemCategory): string => {
    const icons: { [key: string]: string } = {
      'Gift Card': '🎁',
      'Subscription': '📱',
      'Warranty': '🛡️',
      'Note': '📝'
    };
    return icons[category] || '📋';
  };

  const formatExpirationDate = (dateStr?: string): string => {
    if (!dateStr) return 'No expiration';
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Expired ${Math.abs(diffDays)} days ago`;
    if (diffDays === 0) return 'Expires today!';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays <= 7) return `Expires in ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatValue = (value?: number, currency?: string): string => {
    if (!value) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(value);
  };

  // Filter and sort items
  const filteredItems = items.filter(item => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch = searchText === '' || 
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.merchant?.toLowerCase().includes(searchText.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'expiration-asc':
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      case 'expiration-desc':
        if (!a.expirationDate && !b.expirationDate) return 0;
        if (!a.expirationDate) return 1;
        if (!b.expirationDate) return -1;
        return new Date(b.expirationDate).getTime() - new Date(a.expirationDate).getTime();
      case 'value-desc':
        return (b.value || 0) - (a.value || 0);
      case 'value-asc':
        return (a.value || 0) - (b.value || 0);
      case 'priority-desc':
        return (b.priority || 5) - (a.priority || 5);
      case 'priority-asc':
        return (a.priority || 5) - (b.priority || 5);
      default:
        return 0;
    }
  });

  // Tag handling
  const availableTags = tags.filter(tag => !selectedTagIds.includes(tag.id));
  const selectedTags = tags.filter(tag => selectedTagIds.includes(tag.id));

  const handleTagSelect = (tagId: string) => {
    if (!selectedTagIds.includes(tagId)) {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  const handleTagRemove = (tagId: string) => {
    setSelectedTagIds(selectedTagIds.filter(id => id !== tagId));
  };

  const handleImportSample = async () => {
    const clearFirst = confirm('Load sample items?\n\nClick OK to clear existing items and load fresh samples, or Cancel to add to existing items.');
    
    if (clearFirst) {
      if (!confirm('⚠️ This will delete ALL your existing items. Are you sure?')) {
        return;
      }
    }

    setIsImporting(true);
    const success = await importSampleItems(clearFirst);
    
    if (success) {
      await loadItems();
      await loadExpiringItems();
      alert(`Sample items ${clearFirst ? 'loaded' : 'added'} successfully!`);
    } else {
      alert('Error importing sample items. Please try again.');
    }
    
    setIsImporting(false);
  };

  return (
    <div className="events-view">
      <div className="events-header">
        <h2>📦 Items & Resources</h2>
        <p>Manage gift cards, subscriptions, warranties, and important notes</p>
      </div>

      {/* Expiring Items Section */}
      {expiringItems.length > 0 && (
        <div className="upcoming-events-section">
          <h3>⏰ Expiring Soon (Next 30 Days)</h3>
          <div className="upcoming-events-list">
            {expiringItems.map((item) => (
              <div 
                key={item.id} 
                className="upcoming-event-card"
                style={{ borderLeft: `4px solid ${item.color || '#667eea'}` }}
              >
                <div className="upcoming-event-icon">{getCategoryIcon(item.category)}</div>
                <div className="upcoming-event-info">
                  <div className="upcoming-event-name">{item.name}</div>
                  <div className="upcoming-event-date">
                    {formatExpirationDate(item.expirationDate)}
                  </div>
                  {item.value && (
                    <div className="upcoming-event-meta">
                      {formatValue(item.value, item.currency)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="events-actions">
        <button className="btn-primary" onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? '✕ Cancel' : '+ Add New Item'}
        </button>
        {items.length === 0 && (
          <button className="btn-secondary" onClick={handleImportSample} disabled={isImporting}>
            {isImporting ? 'Loading...' : '📥 Load Sample Items'}
          </button>
        )}
      </div>

      {/* Filter Section */}
      {items.length > 0 && (
        <div className="events-filters" style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search items..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div style={{ flex: '0 1 150px', minWidth: '120px' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Categories</option>
              <option value="Gift Card">🎁 Gift Card</option>
              <option value="Subscription">📱 Subscription</option>
              <option value="Warranty">🛡️ Warranty</option>
              <option value="Note">📝 Note</option>
            </select>
          </div>
          
          <div style={{ flex: '0 1 150px', minWidth: '120px' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="expiration-asc">Expiration (Earliest)</option>
              <option value="expiration-desc">Expiration (Latest)</option>
              <option value="value-desc">Value (High to Low)</option>
              <option value="value-asc">Value (Low to High)</option>
              <option value="priority-desc">Priority (High to Low)</option>
              <option value="priority-asc">Priority (Low to High)</option>
            </select>
          </div>
          
          {(searchText || filterCategory !== 'all' || sortBy !== 'name-asc') && (
            <button
              onClick={() => {
                setSearchText('');
                setFilterCategory('all');
                setSortBy('name-asc');
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#6b7280',
                whiteSpace: 'nowrap'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {isEditing && (
        <div className="event-form-container">
          <h3>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
          <form onSubmit={handleSubmit} className="event-form">
            <div className="form-row">
              <div className="form-group">
                <label>Item Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Amazon Gift Card"
                />
              </div>
              
              <div className="form-group">
                <label>Category *</label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                >
                  <option value="Gift Card">🎁 Gift Card</option>
                  <option value="Subscription">📱 Subscription</option>
                  <option value="Warranty">🛡️ Warranty</option>
                  <option value="Note">📝 Note</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details..."
                rows={3}
              />
            </div>

            {/* Category-specific fields */}
            {formData.category !== 'Note' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Expiration Date</label>
                    <input
                      type="date"
                      value={formData.expirationDate}
                      onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Notify Days Before</label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={formData.notifyDaysBefore}
                      onChange={(e) => setFormData({ ...formData, notifyDaysBefore: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                    <small>Days before expiration to show reminder</small>
                  </div>
                </div>
              </>
            )}

            {(formData.category === 'Gift Card' || formData.category === 'Subscription') && (
              <div className="form-row">
                <div className="form-group">
                  <label>Value / Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                
                <div className="form-group">
                  <label>Currency</label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="AUD">AUD (A$)</option>
                  </select>
                </div>
              </div>
            )}

            {formData.category === 'Gift Card' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Merchant / Store</label>
                    <input
                      type="text"
                      value={formData.merchant}
                      onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                      placeholder="e.g., Amazon, Target"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Card / Account Number</label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isClosed}
                      onChange={(e) => setFormData({ ...formData, isClosed: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Mark as used/closed (will be hidden from gift cards popup)</span>
                  </label>
                </div>
              </>
            )}

            {formData.category === 'Subscription' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Service Name</label>
                  <input
                    type="text"
                    value={formData.merchant}
                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                    placeholder="e.g., Netflix, Spotify"
                  />
                </div>
                
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.autoRenew}
                      onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                      style={{ marginRight: '0.5rem' }}
                    />
                    Auto-Renew
                  </label>
                </div>
              </div>
            )}

            {formData.category === 'Warranty' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Product / Item</label>
                  <input
                    type="text"
                    value={formData.merchant}
                    onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                    placeholder="e.g., iPhone 15, Laptop"
                  />
                </div>
                
                <div className="form-group">
                  <label>Purchase Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="form-group">
              <label>Tags</label>
              {selectedTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {selectedTags.map(tag => (
                    <span
                      key={tag.id}
                      style={{
                        background: tag.color,
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => handleTagRemove(tag.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.3)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem'
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {availableTags.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleTagSelect(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">Add a tag...</option>
                  {availableTags.map(tag => (
                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })}
                />
                <small>1-10 (for sorting/filtering)</small>
              </div>
              
              <div className="form-group">
                <label>Color</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingItem ? 'Update Item' : 'Add Item'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      <div className="events-list-container">
        {(() => {
          return (
            <>
              <h3>📦 All Items ({sortedItems.length}{sortedItems.length !== items.length ? ` of ${items.length}` : ''})</h3>
              {sortedItems.length === 0 ? (
                <div className="no-events">
                  <p>{items.length === 0 ? 'No items yet. Add your first item to get started!' : 'No items match your filters.'}</p>
                </div>
              ) : (
                <div className="events-grid">
                  {sortedItems.map((item) => (
                    <div key={item.id} className="event-card" style={{ borderLeft: `6px solid ${item.color || '#667eea'}` }}>
                      <div className="event-card-header">
                        <span className="event-icon">{getCategoryIcon(item.category)}</span>
                        <h4>{item.name}</h4>
                      </div>
                      
                      <div className="event-category-badge">{item.category}</div>
                      
                      {item.description && (
                        <div className="event-description">{item.description}</div>
                      )}
                      
                      {item.expirationDate && (
                        <div className="event-date">
                          📅 {formatExpirationDate(item.expirationDate)}
                        </div>
                      )}
                      
                      {item.value && (
                        <div className="event-date" style={{ color: '#10b981', fontWeight: 600 }}>
                          💰 {formatValue(item.value, item.currency)}
                        </div>
                      )}
                      
                      {item.merchant && (
                        <div className="event-description" style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                          🏪 {item.merchant}
                        </div>
                      )}
                      
                      {item.accountNumber && (
                        <div className="event-description" style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                          🔢 {item.accountNumber}
                        </div>
                      )}
                      
                      {item.category === 'Subscription' && item.autoRenew && (
                        <div className="event-meta">
                          <span className="event-frequency-badge">
                            🔄 Auto-Renew
                          </span>
                        </div>
                      )}
                      
                      <div className="event-meta">
                        {item.notifyDaysBefore > 0 && (
                          <span className="event-notify-badge">
                            🔔 Notify {item.notifyDaysBefore}d before
                          </span>
                        )}
                        <span className="event-priority-badge">
                          ⭐ Priority: {item.priority || 5}/10
                        </span>
                      </div>
                      
                      <div className="event-actions">
                        <button className="btn-edit" onClick={() => handleEdit(item)}>
                          ✏️ Edit
                        </button>
                        <button className="btn-delete" onClick={() => handleDelete(item.id)}>
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default ItemsView;

