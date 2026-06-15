/**
 * TodoView - Grouped To-Do List with Voice Input
 * 
 * Features:
 * - Grouped view: groups shown as headers, items inside
 * - Ungrouped items under separate "Quick Items" section
 * - Filter by: single group, multiple groups, all
 * - Add via screen input or voice
 * - Priority levels with visual indicators
 */

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useTheme } from './contexts/ThemeContext';
import { TodoItem, TodoGroup, TodoPriority } from './types';
import VoiceCommandModal from './components/VoiceCommand/VoiceCommandModal';
import ShareModal from './components/ShareModal';
import * as todoService from './services/todoService';
import * as sharingService from './services/sharingService';
import { AssignableUser } from './services/todoService';
import GenericFilterSidebar, { GenericFilter, FilterSection } from './components/GenericFilterSidebar';

interface TodoViewProps {
  onNavigate?: (view: string) => void;
}

const PRIORITY_CONFIG: Record<TodoPriority, { color: string; bg: string; label: string; icon: string }> = {
  low: { color: '#10b981', bg: '#d1fae5', label: 'Low', icon: '🟢' },
  medium: { color: '#f59e0b', bg: '#fef3c7', label: 'Medium', icon: '🟡' },
  high: { color: '#f97316', bg: '#ffedd5', label: 'High', icon: '🟠' },
  urgent: { color: '#ef4444', bg: '#fee2e2', label: 'Urgent', icon: '🔴' },
};

const GROUP_ICONS = ['📁', '🏠', '💼', '🎯', '📚', '🛒', '🎨', '💪', '🧘', '🎮', '🍕', '✈️', '📧', '💡', '⭐'];
const GROUP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6'];

/** Avoid 🎤 + "🎤 Voice Memo" in headers and chips when the group icon is already shown separately */
function stripLeadingGroupIcon(name: string, icon: string | undefined): string {
  if (!name) return name;
  let t = name.trim();
  if (icon && t.startsWith(icon)) {
    t = t.slice(icon.length).trim();
  }
  return t || name;
}

function isTodoPastDue(dueDate: string | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

const TodoView: React.FC<TodoViewProps> = () => {
  const { theme } = useTheme();
  
  // Data state
  const [groups, setGroups] = useState<TodoGroup[]>([]);
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set()); // empty = all
  const [pastDueOnly, setPastDueOnly] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set()); // Start collapsed
  
  // Input state
  const [newItemText, setNewItemText] = useState('');
  const [newItemGroup, setNewItemGroup] = useState<string | null>(null);
  const [newItemPriority, setNewItemPriority] = useState<TodoPriority>('medium');
  
  // Group management
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TodoGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupIcon, setGroupIcon] = useState('📁');
  const [groupColor, setGroupColor] = useState('#6366f1');
  
  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TodoItem | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [detailEdits, setDetailEdits] = useState<Partial<TodoItem>>({});
  
  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingGroup, setSharingGroup] = useState<TodoGroup | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Load data
  useEffect(() => {
    loadData();
    loadAssignableUsers();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const apply = () => setIsMobileViewport(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsData, itemsData, sharedGroupsData, sharedByMeData] = await Promise.all([
        todoService.getTodoGroups(),
        todoService.getTodoItems('all'),
        sharingService.getTodoGroupsSharedWithMe(),
        sharingService.getMyGroups(), // Get groups I'm a member of to check for shares
      ]);
      
      
      // Load shared TODO groups and their items (received by me)
      const sharedGroups: TodoGroup[] = [];
      const sharedItems: TodoItem[] = [];
      
      for (const share of sharedGroupsData) {
        try {
          // Get the shared group details
          const groupDetails = await todoService.getTodoGroupById(share.todoGroupId);
          if (groupDetails) {
            // Get the sharer's display name
            const sharerName = await todoService.getUserDisplayName(share.sharedBy);
            
            sharedGroups.push({
              ...groupDetails,
              // Mark as shared for UI indication
              isShared: true,
              sharedBy: sharerName || 'Unknown',
              shareMode: share.shareMode,
            } as any);
          }
          
          // Get items in this shared group
          const groupItems = await todoService.getTodoItemsByGroup(share.todoGroupId);
          sharedItems.push(...groupItems.map(item => ({
            ...item,
            isShared: true,
            shareMode: share.shareMode,
          } as any)));
        } catch (err) {
          console.warn(`Failed to load shared group ${share.todoGroupId}:`, err);
        }
      }
      
      // Also load items from MY OWN groups (to see items added by others)
      for (const group of groupsData) {
        try {
          const allGroupItems = await todoService.getTodoItemsByGroup(group.id);
          
          // Add items that aren't already in itemsData (items created by others)
          const newItems = allGroupItems.filter(
            groupItem => !itemsData.some(ownItem => ownItem.id === groupItem.id)
          );
          
          if (newItems.length > 0) {
            sharedItems.push(...newItems);
          }
        } catch (err) {
          console.warn(`Failed to load all items for group ${group.id}:`, err);
        }
      }
      
      setGroups([...groupsData, ...sharedGroups]);
      
      // Deduplicate items: if an item appears in both itemsData and sharedItems, keep only one
      const allItems = [...itemsData, ...sharedItems];
      const uniqueItems = Array.from(
        new Map(allItems.map(item => [item.id, item])).values()
      );
      
      setItems(uniqueItems);
      
      // Don't auto-expand groups - let user expand as needed
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignableUsers = async () => {
    try {
      const users = await todoService.getAssignableUsers();
      setAssignableUsers(users);
    } catch (err) {
      console.warn('Could not load assignable users:', err);
    }
  };

  // Open detail modal
  const openDetailModal = async (item: TodoItem) => {
    // If item has assignedTo, fetch the display name
    let itemWithName = { ...item };
    if (item.assignedTo) {
      const name = await todoService.getUserDisplayName(item.assignedTo);
      itemWithName.assignedToName = name || undefined;
    }
    setSelectedItem(itemWithName);
    setDetailEdits({});
    setShowDetailModal(true);
  };

  // Save detail edits
  const saveDetailEdits = async () => {
    if (!selectedItem) return;
    try {
      // Auto-enable showOnDashboard if due date is set
      const finalDueDate = detailEdits.dueDate ?? selectedItem.dueDate;
      const updates = {
        ...detailEdits,
        // Automatically enable showOnDashboard when due date is set
        showOnDashboard: finalDueDate ? true : (detailEdits.showOnDashboard ?? selectedItem.showOnDashboard ?? false)
      };
      
      const updated = await todoService.updateTodoItem(selectedItem.id, updates);
      setItems(prev => prev.map(item => item.id === selectedItem.id ? updated : item));
      setShowDetailModal(false);
      setSelectedItem(null);
      setDetailEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  // Filter items: completed toggle, optional past-due-only, then group selection
  const filteredItems = items.filter(item => {
    if (!showCompleted && item.isCompleted) return false;
    if (pastDueOnly) {
      if (item.isCompleted || !isTodoPastDue(item.dueDate)) return false;
    }
    if (selectedGroups.size === 0) return true; // All
    if (item.groupId === null || item.groupId === undefined) {
      return selectedGroups.has('ungrouped');
    }
    return selectedGroups.has(item.groupId);
  });

  // Group items by groupId
  const groupedItems: Record<string, TodoItem[]> = {};
  filteredItems.forEach(item => {
    const key = item.groupId || 'ungrouped';
    if (!groupedItems[key]) groupedItems[key] = [];
    groupedItems[key].push(item);
  });

  // Sort items within each group: incomplete first, then by priority, then by order
  const priorityOrder: Record<TodoPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
  Object.keys(groupedItems).forEach(key => {
    groupedItems[key].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      const pa = priorityOrder[a.priority || 'medium'];
      const pb = priorityOrder[b.priority || 'medium'];
      if (pa !== pb) return pa - pb;
      return a.order - b.order;
    });
  });

  // Handlers
  const handleAddItem = async () => {
    if (!newItemText.trim()) return;
    try {
      // Auto-enable showOnDashboard if due date is provided
      const newItem = await todoService.createTodoItem({
        text: newItemText.trim(),
        groupId: newItemGroup || undefined,
        priority: newItemPriority,
        // Note: showOnDashboard will be auto-enabled when due date is set via the detail modal
      });
      setItems(prev => [...prev, newItem]);
      setNewItemText('');
      inputRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  };

  const handleToggleItem = async (id: string) => {
    try {
      const updated = await todoService.toggleTodoItem(id);
      setItems(prev => prev.map(item => item.id === id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle item');
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await todoService.deleteTodoItem(id);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  const handleClearCompleted = async () => {
    try {
      await todoService.clearCompletedTodos();
      setItems(prev => prev.filter(item => !item.isCompleted));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear completed');
    }
  };

  // Group handlers
  const handleSaveGroup = async () => {
    if (!groupName.trim()) return;
    try {
      if (editingGroup) {
        const updated = await todoService.updateTodoGroup(editingGroup.id, {
          name: groupName.trim(),
          icon: groupIcon,
          color: groupColor,
        });
        setGroups(prev => prev.map(g => g.id === editingGroup.id ? updated : g));
      } else {
        const newGroup = await todoService.createTodoGroup({
          name: groupName.trim(),
          icon: groupIcon,
          color: groupColor,
        });
        setGroups(prev => [...prev, newGroup]);
        setExpandedGroups(prev => new Set([...prev, newGroup.id]));
      }
      setShowGroupModal(false);
      setEditingGroup(null);
      setGroupName('');
      setGroupIcon('📁');
      setGroupColor('#6366f1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save group');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Delete this group? Items will be moved to Quick Items.')) return;
    try {
      await todoService.deleteTodoGroup(id);
      setGroups(prev => prev.filter(g => g.id !== id));
      setItems(prev => prev.map(item => item.groupId === id ? { ...item, groupId: undefined } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleGroupFilter = (groupId: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Stats
  const totalItems = items.length;
  const completedItems = items.filter(i => i.isCompleted).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Voice success handler
  const handleVoiceSuccess = (message: string) => {
    loadData(); // Refresh data after voice command
  };

  if (loading) {
    return (
      <div className="ck-screen" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📝</div>
        <p style={{ color: 'var(--ck-ink3)' }}>Loading To-Do list…</p>
      </div>
    );
  }

  const ungroupedCount = items.filter(i => !i.groupId).length;
  const pastDueCount = items.filter(i => !i.isCompleted && isTodoPastDue(i.dueDate)).length;
  const listActiveFilter: GenericFilter = pastDueOnly
    ? { type: 'pastdue' }
    : selectedGroups.size === 1
      ? { type: 'group', value: Array.from(selectedGroups)[0] }
      : { type: 'all' };
  const listFilterSections: FilterSection[] = [
    {
      id: 'quick',
      title: 'Quick Filters',
      defaultExpanded: true,
      items: [
        { filter: { type: 'all' }, icon: '📝', label: 'All Items', count: items.length },
        { filter: { type: 'group', value: 'ungrouped' }, icon: '📋', label: 'Quick Items', count: ungroupedCount },
        { filter: { type: 'pastdue' }, icon: '⏰', label: 'Past Due', count: pastDueCount, color: '#c94a2e' },
      ],
    },
    ...(groups.length > 0 ? [{
      id: 'lists',
      title: 'Lists',
      defaultExpanded: true,
      items: groups.map(g => ({
        filter: { type: 'group', value: g.id },
        icon: g.icon || '📁',
        label: stripLeadingGroupIcon(g.name, g.icon || '📁'),
        count: items.filter(i => i.groupId === g.id).length,
        color: g.color || undefined,
      })),
    }] : []),
  ];
  const handleListFilter = (f: GenericFilter) => {
    if (f.type === 'all') { setSelectedGroups(new Set()); setPastDueOnly(false); }
    else if (f.type === 'pastdue') { setPastDueOnly(true); setSelectedGroups(new Set()); }
    else if (f.type === 'group' && f.value) { setSelectedGroups(new Set([f.value])); setPastDueOnly(false); }
  };

  return (
    <div className="ck-screen">
      {/* Header */}
      <div className="ck-page-head">
        <div>
          <h2 className="ck-page-title">Lists</h2>
          <p className="ck-page-sub">{completedItems} of {totalItems} completed ({progressPercent}%)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setShowVoiceModal(true)} className="ck-btn">
            🎤 Voice Add
          </button>
          <button
            onClick={() => {
              setEditingGroup(null);
              setGroupName('');
              setGroupIcon('📁');
              setGroupColor('#6366f1');
              setShowGroupModal(true);
            }}
            className="ck-btn ck-btn-primary"
          >
            + New List
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#fee2e2',
          color: '#dc2626',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* Progress bar */}
      <div style={{
        background: 'var(--ck-cream)',
        borderRadius: '9999px',
        height: '8px',
        marginBottom: '1.5rem',
        overflow: 'hidden'
      }}>
        <div style={{
          background: 'var(--ck-purple)',
          height: '100%',
          width: `${progressPercent}%`,
          transition: 'width 0.3s ease'
        }} />
      </div>

      {/* Main content with sidebar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {isMobileViewport && showMobileFilters ? (
          <GenericFilterSidebar
            title="📝 Filter Lists"
            sections={listFilterSections}
            activeFilter={listActiveFilter}
            onFilterChange={handleListFilter}
            isMobile
            onFilterSelected={() => setShowMobileFilters(false)}
          />
        ) : (
          <>
            {!isMobileViewport && (
              <GenericFilterSidebar
                sections={listFilterSections}
                activeFilter={listActiveFilter}
                onFilterChange={handleListFilter}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isMobileViewport && (
                <button
                  className="ck-btn"
                  onClick={() => setShowMobileFilters(true)}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
                >
                  ‹ Filters
                </button>
              )}

      {/* Group filter chips — mobile quick toggles */}
      {isMobileViewport && (
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'nowrap',
        marginBottom: '1rem',
        alignItems: 'center',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: '2px',
        maxWidth: '100%'
      }}>
        <span style={{ color: 'var(--ck-ink3)', fontSize: isMobileViewport ? '0.8rem' : '0.85rem', fontWeight: 500, flexShrink: 0 }}>Filter:</span>
        <button
          onClick={() => {
            setSelectedGroups(new Set());
            setPastDueOnly(false);
          }}
          style={{
            padding: isMobileViewport ? '0.3rem 0.55rem' : '0.375rem 0.875rem',
            background: selectedGroups.size === 0 && !pastDueOnly ? 'var(--ck-purple)' : 'var(--ck-cream)',
            color: selectedGroups.size === 0 && !pastDueOnly ? 'white' : 'var(--ck-ink2)',
            border: 'none',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontSize: isMobileViewport ? '0.75rem' : '0.8rem',
            fontWeight: 500,
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          All
        </button>
        <button
          onClick={() => toggleGroupFilter('ungrouped')}
          style={{
            padding: isMobileViewport ? '0.3rem 0.55rem' : '0.375rem 0.875rem',
            background:
              selectedGroups.size === 1 && selectedGroups.has('ungrouped') ? 'var(--ck-ink2)' : 'var(--ck-cream)',
            color:
              selectedGroups.size === 1 && selectedGroups.has('ungrouped') ? 'white' : 'var(--ck-ink2)',
            border: 'none',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontSize: isMobileViewport ? '0.75rem' : '0.8rem',
            fontWeight: 500,
            flexShrink: 0,
            whiteSpace: 'nowrap'
          }}
        >
          {isMobileViewport ? '📋 Quick' : '📋 Quick Items'}
        </button>
        {isMobileViewport && (
          <button
            type="button"
            title="Past due items"
            onClick={() => setPastDueOnly(p => !p)}
            style={{
              padding: '0.3rem 0.5rem',
              background: pastDueOnly ? 'var(--ck-red)' : 'var(--ck-cream)',
              color: pastDueOnly ? 'white' : 'var(--ck-ink2)',
              border: 'none',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              flexShrink: 0,
              whiteSpace: 'nowrap'
            }}
          >
            ⚠️ Due
          </button>
        )}
      </div>
      )}

      {/* Options row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        fontSize: '0.85rem'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--ck-ink2)' }}>
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Completed
        </label>
        {completedItems > 0 && (
          <button
            onClick={handleClearCompleted}
            style={{
              padding: '0.375rem 0.75rem',
              background: 'var(--ck-red-light)',
              color: 'var(--ck-red)',
              border: '0.5px solid rgba(201,74,46,0.3)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            🗑️ Clear {completedItems} completed
          </button>
        )}
      </div>

      {/* Add new item */}
      <div className="ck-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <input
            ref={inputRef}
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            placeholder="Add a new to-do item..."
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '0.7rem 0.9rem',
              border: '0.5px solid var(--ck-border2)',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontFamily: 'var(--ck-font)',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--ck-purple)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--ck-border2)'}
          />
          <button
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
            className="ck-btn ck-btn-primary"
            style={{ opacity: newItemText.trim() ? 1 : 0.5, cursor: newItemText.trim() ? 'pointer' : 'not-allowed' }}
          >
            Add
          </button>
        </div>
        
        {/* Item options */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>Add to List:</label>
            <select
              value={newItemGroup || ''}
              onChange={(e) => setNewItemGroup(e.target.value || null)}
              style={{
                padding: '0.375rem 0.75rem',
                border: '1px solid var(--ck-border2)',
                borderRadius: '0.5rem',
                fontSize: '0.85rem',
                fontFamily: 'var(--ck-font)',
                background: 'var(--ck-white)'
              }}
            >
              <option value="">Quick Items</option>
              {groups
                .filter(g => {
                  // Exclude view-only shared lists
                  const isShared = (g as any).isShared;
                  const shareMode = (g as any).shareMode;
                  return !isShared || shareMode === 'editable';
                })
                .map(g => (
                  <option key={g.id} value={g.id}>
                    {g.icon} {stripLeadingGroupIcon(g.name, g.icon)}
                  </option>
                ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>Priority:</label>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {(Object.keys(PRIORITY_CONFIG) as TodoPriority[]).map(p => (
                <button
                  key={p}
                  onClick={() => setNewItemPriority(p)}
                  title={PRIORITY_CONFIG[p].label}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: newItemPriority === p ? PRIORITY_CONFIG[p].bg : 'transparent',
                    border: `2px solid ${newItemPriority === p ? PRIORITY_CONFIG[p].color : 'transparent'}`,
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  {PRIORITY_CONFIG[p].icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Items grouped */}
      {/* Ungrouped items first */}
      {(selectedGroups.size === 0 || selectedGroups.has('ungrouped')) && (
        <GroupSection
          title="Quick Items"
          icon="📋"
          color="var(--ck-ink2)"
          items={groupedItems['ungrouped'] || []}
          isExpanded={expandedGroups.has('ungrouped')}
          onToggleExpand={() => toggleGroupExpanded('ungrouped')}
          onToggleItem={handleToggleItem}
          onDeleteItem={handleDeleteItem}
          onItemClick={openDetailModal}
          theme={theme}
        />
      )}

      {/* Groups */}
      {groups
        .filter(g => selectedGroups.size === 0 || selectedGroups.has(g.id))
        .map(group => {
          // Don't allow sharing of Voice Memo group
          const canShare = !group.name.toLowerCase().includes('voice memo');
          
          const isSharedGroup = (group as any).isShared;
          const sharedByName = (group as any).sharedBy;
          const groupShareMode = (group as any).shareMode;
          
          return (
            <GroupSection
              key={group.id}
              title={stripLeadingGroupIcon(group.name, group.icon || '📁')}
              icon={group.icon || '📁'}
              color={group.color || '#6366f1'}
              items={groupedItems[group.id] || []}
              isExpanded={expandedGroups.has(group.id)}
              onToggleExpand={() => toggleGroupExpanded(group.id)}
              onToggleItem={handleToggleItem}
              onDeleteItem={handleDeleteItem}
              onItemClick={openDetailModal}
              onEditGroup={!isSharedGroup ? () => {
                setEditingGroup(group);
                setGroupName(group.name);
                setGroupIcon(group.icon || '📁');
                setGroupColor(group.color || '#6366f1');
                setShowGroupModal(true);
              } : undefined}
              onDeleteGroup={!isSharedGroup ? () => handleDeleteGroup(group.id) : undefined}
              onShare={canShare && !isSharedGroup ? () => {
                setSharingGroup(group);
                setShowShareModal(true);
              } : undefined}
              isShared={isSharedGroup}
              sharedBy={sharedByName}
              shareMode={groupShareMode}
              theme={theme}
            />
          );
        })}

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'var(--ck-ink3)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{pastDueOnly ? '✅' : '📝'}</div>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>
            {pastDueOnly ? 'Nothing past due' : 'No to-do items yet'}
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            {pastDueOnly
              ? 'Incomplete items with a due date before today will show here.'
              : 'Add your first item above or use voice input!'}
          </p>
        </div>
      )}
            </div>
          </>
        )}
      </div>

      {/* Group Modal */}
      {showGroupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(26,23,20,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '400px',
            overflow: 'hidden',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid var(--ck-border2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                {editingGroup ? 'Edit List' : 'New List'}
              </h3>
              <button
                onClick={() => setShowGroupModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--ck-ink3)' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  List Name
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Shopping, Work, Personal"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid var(--ck-border2)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Icon
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {GROUP_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setGroupIcon(icon)}
                      style={{
                        width: '40px',
                        height: '40px',
                        border: `2px solid ${groupIcon === icon ? groupColor : 'var(--ck-border2)'}`,
                        borderRadius: '0.5rem',
                        background: groupIcon === icon ? `${groupColor}20` : 'white',
                        cursor: 'pointer',
                        fontSize: '1.25rem'
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Color
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {GROUP_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setGroupColor(color)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: `3px solid ${groupColor === color ? 'var(--ck-ink)' : 'transparent'}`,
                        background: color,
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => setShowGroupModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--ck-cream)',
                    color: 'var(--ck-ink2)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGroup}
                  disabled={!groupName.trim()}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: groupName.trim() ? groupColor : 'var(--ck-border2)',
                    color: groupName.trim() ? 'white' : 'var(--ck-ink3)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: groupName.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500
                  }}
                >
                  {editingGroup ? 'Save Changes' : 'Create List'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Modal */}
      <VoiceCommandModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSuccess={handleVoiceSuccess}
      />

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (() => {
        const isReadonly = (selectedItem as any).shareMode === 'readonly';
        
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26,23,20,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '450px',
              maxHeight: '90vh',
              overflow: 'auto',
              animation: 'slideUp 0.3s ease-out'
            }}>
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--ck-border2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: 'white',
                zIndex: 1
              }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                  📝 List Item Details
                  {isReadonly && (
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      background: '#f59e0b',
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontWeight: 500
                    }}>
                      👁️ View Only
                    </span>
                  )}
                </h3>
              <button
                onClick={() => { setShowDetailModal(false); setSelectedItem(null); }}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--ck-ink3)' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              {/* Text */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>
                  Task
                </label>
                <input
                  type="text"
                  value={detailEdits.text ?? selectedItem.text}
                  onChange={(e) => setDetailEdits({ ...detailEdits, text: e.target.value })}
                  disabled={isReadonly}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid var(--ck-border2)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    opacity: isReadonly ? 0.6 : 1,
                    cursor: isReadonly ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              {/* Priority */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>
                  Priority
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(Object.keys(PRIORITY_CONFIG) as TodoPriority[]).map(p => (
                    <button
                      key={p}
                      onClick={() => !isReadonly && setDetailEdits({ ...detailEdits, priority: p })}
                      disabled={isReadonly}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: (detailEdits.priority ?? selectedItem.priority) === p ? PRIORITY_CONFIG[p].bg : 'var(--ck-cream)',
                        border: `2px solid ${(detailEdits.priority ?? selectedItem.priority) === p ? PRIORITY_CONFIG[p].color : 'var(--ck-border2)'}`,
                        borderRadius: '0.5rem',
                        cursor: isReadonly ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: PRIORITY_CONFIG[p].color,
                        opacity: isReadonly ? 0.6 : 1
                      }}
                    >
                      {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>
                  📅 Due Date <span style={{ fontWeight: 400, color: 'var(--ck-ink3)' }}>(optional)</span>
                </label>
                <input
                  type="date"
                  value={detailEdits.dueDate ?? selectedItem.dueDate ?? ''}
                  onChange={(e) => setDetailEdits({ ...detailEdits, dueDate: e.target.value || undefined })}
                  disabled={isReadonly}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid var(--ck-border2)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    opacity: isReadonly ? 0.6 : 1,
                    cursor: isReadonly ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              {/* Show on Dashboard Info */}
              {(detailEdits.dueDate ?? selectedItem.dueDate) && (
                <div style={{ 
                  marginBottom: '1.25rem',
                  padding: '0.75rem',
                  background: '#eff6ff',
                  borderRadius: '0.5rem',
                  border: '1px solid #bfdbfe'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1rem' }}>ℹ️</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e40af' }}>Will show on Home</div>
                      <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.25rem' }}>
                        This item will automatically appear on your dashboard since it has a due date
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Assigned To */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>
                  👤 Assign To <span style={{ fontWeight: 400, color: 'var(--ck-ink3)' }}>(optional)</span>
                </label>
                {assignableUsers.length > 0 ? (
                  <select
                    value={detailEdits.assignedTo ?? selectedItem.assignedTo ?? ''}
                    onChange={(e) => setDetailEdits({ ...detailEdits, assignedTo: e.target.value || undefined })}
                    disabled={isReadonly}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid var(--ck-border2)',
                      borderRadius: '0.5rem',
                      fontSize: '1rem',
                      background: 'white',
                      opacity: isReadonly ? 0.6 : 1,
                      cursor: isReadonly ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="">Not assigned</option>
                    {assignableUsers.map(user => (
                      <option key={user.userId} value={user.userId}>
                        {user.displayName} ({user.groupName})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    padding: '0.75rem',
                    background: 'var(--ck-cream)',
                    borderRadius: '0.5rem',
                    color: 'var(--ck-ink2)',
                    fontSize: '0.9rem'
                  }}>
                    <span style={{ marginRight: '0.5rem' }}>👥</span>
                    Join a family group in Settings → Groups to assign tasks to others
                  </div>
                )}
                {selectedItem.assignedToName && !detailEdits.assignedTo && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>
                    Currently assigned to: <strong>{selectedItem.assignedToName}</strong>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>
                  📝 Notes <span style={{ fontWeight: 400, color: 'var(--ck-ink3)' }}>(optional)</span>
                </label>
                <textarea
                  value={detailEdits.notes ?? selectedItem.notes ?? ''}
                  onChange={(e) => setDetailEdits({ ...detailEdits, notes: e.target.value || undefined })}
                  placeholder="Add notes or details..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid var(--ck-border2)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Move to group */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--ck-ink2)' }}>
                  📁 List
                </label>
                <select
                  value={detailEdits.groupId ?? selectedItem.groupId ?? ''}
                  onChange={(e) => setDetailEdits({ ...detailEdits, groupId: e.target.value || undefined })}
                  disabled={isReadonly}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid var(--ck-border2)',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    background: 'white',
                    opacity: isReadonly ? 0.6 : 1,
                    cursor: isReadonly ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">📋 Quick Items</option>
                  {groups
                    .filter(g => {
                      // Exclude view-only shared lists
                      const isShared = (g as any).isShared;
                      const shareMode = (g as any).shareMode;
                      return !isShared || shareMode === 'editable';
                    })
                    .map(g => (
                      <option key={g.id} value={g.id}>{g.icon} {stripLeadingGroupIcon(g.name, g.icon)}</option>
                    ))}
                </select>
              </div>

              {/* Meta info */}
              <div style={{ 
                padding: '0.75rem', 
                background: 'var(--ck-cream)', 
                borderRadius: '0.5rem', 
                fontSize: '0.8rem', 
                color: 'var(--ck-ink2)',
                marginBottom: '1.5rem'
              }}>
                <div>Created: {new Date(selectedItem.createdAt).toLocaleDateString()}</div>
                {selectedItem.completedAt && (
                  <div>Completed: {new Date(selectedItem.completedAt).toLocaleDateString()}</div>
                )}
                {selectedItem.assignedAt && (
                  <div>Assigned: {new Date(selectedItem.assignedAt).toLocaleDateString()}</div>
                )}
              </div>
              
              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => { setShowDetailModal(false); setSelectedItem(null); }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'var(--ck-cream)',
                    color: 'var(--ck-ink2)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveDetailEdits}
                  disabled={isReadonly || Object.keys(detailEdits).length === 0}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: isReadonly ? 'var(--ck-gold)' : (Object.keys(detailEdits).length > 0 ? 'var(--ck-purple)' : 'var(--ck-border2)'),
                    color: isReadonly ? 'white' : (Object.keys(detailEdits).length > 0 ? 'white' : 'var(--ck-ink3)'),
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: isReadonly || Object.keys(detailEdits).length === 0 ? 'not-allowed' : 'pointer',
                    fontWeight: 500
                  }}
                >
                  {isReadonly ? '👁️ View Only' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Share Modal */}
      {showShareModal && sharingGroup && (
        <ShareModal
          entityId={sharingGroup.id}
          entityTitle={sharingGroup.name}
          entityType="todo_group"
          onClose={() => {
            setShowShareModal(false);
            setSharingGroup(null);
          }}
          onShared={() => {
            // Optionally reload data to show shared status
            loadData();
          }}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

// Sub-component for group sections
interface GroupSectionProps {
  title: string;
  icon: string;
  color: string;
  items: TodoItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onItemClick: (item: TodoItem) => void;
  onEditGroup?: () => void;
  onDeleteGroup?: () => void;
  onShare?: () => void;
  isShared?: boolean;
  sharedBy?: string;
  shareMode?: 'readonly' | 'editable';
  theme: any;
}

const GroupSection: React.FC<GroupSectionProps> = ({
  title,
  icon,
  color,
  items,
  isExpanded,
  onToggleExpand,
  onToggleItem,
  onDeleteItem,
  onItemClick,
  onEditGroup,
  onDeleteGroup,
  onShare,
  isShared,
  sharedBy,
  shareMode,
  theme,
}) => {
  const completedCount = items.filter(i => i.isCompleted).length;
  
  return (
    <div style={{
      background: 'var(--ck-white)',
      border: '0.5px solid var(--ck-border2)',
      borderRadius: '10px',
      marginBottom: '1rem',
      overflow: 'hidden',
      boxShadow: 'var(--ck-shadow)'
    }}>
      {/* Header */}
      <div
        onClick={onToggleExpand}
        style={{
          padding: '0.85rem 1.1rem',
          background: `${color}0d`,
          borderLeft: `3px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            minWidth: 0,
            flex: 1,
            flexWrap: 'nowrap',
          }}>
            <span style={{
              fontWeight: 600,
              color: 'var(--ck-ink)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}>
              {title}
            </span>
            {isShared && sharedBy && (
              <span style={{
                background: '#10b981',
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                🔗 Shared by {sharedBy}
              </span>
            )}
            {isShared && shareMode === 'readonly' && (
              <span style={{
                background: '#f59e0b',
                color: 'white',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontWeight: 600,
                flexShrink: 0,
              }}>
                👁️ View Only
              </span>
            )}
            <span style={{
              background: 'var(--ck-cream)',
              color: 'var(--ck-ink2)',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
              flexShrink: 0,
            }}>
              {completedCount}/{items.length}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {onShare && (
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: 'var(--ck-ink3)'
              }}
              title="Share list"
            >
              🔗
            </button>
          )}
          {onEditGroup && (
            <button
              onClick={(e) => { e.stopPropagation(); onEditGroup(); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: 'var(--ck-ink3)'
              }}
              title="Edit group"
            >
              ✏️
            </button>
          )}
          {onDeleteGroup && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteGroup(); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: 'var(--ck-ink3)'
              }}
              title="Delete group"
            >
              🗑️
            </button>
          )}
          <span style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            color: 'var(--ck-ink3)'
          }}>
            ▼
          </span>
        </div>
      </div>
      
      {/* Items */}
      {isExpanded && (
        <div style={{ padding: items.length > 0 ? '0.5rem' : 0 }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                background: item.isCompleted ? 'var(--ck-cream)' : 'transparent',
                margin: '0.25rem 0',
                cursor: 'pointer',
                transition: 'background 0.15s'
              }}
              onClick={() => onItemClick(item)}
              onMouseEnter={(e) => { if (!item.isCompleted) e.currentTarget.style.background = 'var(--ck-cream)'; }}
              onMouseLeave={(e) => { if (!item.isCompleted) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (shareMode !== 'readonly') {
                    onToggleItem(item.id);
                  }
                }}
                disabled={shareMode === 'readonly'}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: `2px solid ${item.isCompleted ? '#10b981' : PRIORITY_CONFIG[item.priority || 'medium'].color}`,
                  background: item.isCompleted ? '#10b981' : 'transparent',
                  cursor: shareMode === 'readonly' ? 'not-allowed' : 'pointer',
                  opacity: shareMode === 'readonly' ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.75rem',
                  flexShrink: 0
                }}
              >
                {item.isCompleted && '✓'}
              </button>
              
              {/* Text - minimal display */}
              <span
                style={{
                  flex: 1,
                  textDecoration: item.isCompleted ? 'line-through' : 'none',
                  color: item.isCompleted ? 'var(--ck-ink3)' : 'var(--ck-ink)',
                  fontSize: '0.95rem'
                }}
              >
                {item.text}
              </span>
              
              {/* Indicators - minimal */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                {/* Due date indicator */}
                {item.dueDate && !item.isCompleted && (
                  <span title={`Due: ${item.dueDate}`} style={{ fontSize: '0.7rem', color: 'var(--ck-ink2)' }}>
                    📅
                  </span>
                )}
                {/* Assigned indicator */}
                {item.assignedTo && (
                  <span title="Assigned" style={{ fontSize: '0.7rem', color: 'var(--ck-ink2)' }}>
                    👤
                  </span>
                )}
                {/* Priority indicator */}
                {!item.isCompleted && item.priority && item.priority !== 'medium' && (
                  <span title={PRIORITY_CONFIG[item.priority].label} style={{ fontSize: '0.7rem' }}>
                    {PRIORITY_CONFIG[item.priority].icon}
                  </span>
                )}
              </div>
              
              {/* Delete */}
              {shareMode !== 'readonly' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ck-border2)',
                    padding: '0.25rem',
                    opacity: 0.6,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          
          {items.length === 0 && (
            <div style={{
              padding: '1.5rem',
              textAlign: 'center',
              color: 'var(--ck-ink3)',
              fontSize: '0.9rem'
            }}>
              No items in this group
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TodoView;
