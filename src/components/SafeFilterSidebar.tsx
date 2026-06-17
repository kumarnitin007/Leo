/**
 * SafeFilterSidebar - Tree-like filter panel for Safe entries
 * 
 * Features:
 * - Quick filters (All, Favorites, Shared, Recently Edited, Expiring)
 * - Category tags (system tags)
 * - Custom tags
 */

import React, { useState } from 'react';
import { Tag } from '../types';

export interface SafeFilter {
  type: 'all' | 'favorites' | 'shared' | 'sharedByMe' | 'recent' | 'expiring' | 'category' | 'tag' | 'uncategorized';
  value?: string; // tag/category id
}

interface SafeFilterSidebarProps {
  tags: Tag[];
  activeFilter: SafeFilter;
  onFilterChange: (filter: SafeFilter) => void;
  entryCounts: {
    all: number;
    favorites: number;
    shared: number;
    sharedByMe: number;
    recent: number;
    expiring: number;
    uncategorized: number;
    byTag: Record<string, number>;
  };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
  onFilterSelected?: () => void; // Called when user selects a filter on mobile
}

const SafeFilterSidebar: React.FC<SafeFilterSidebarProps> = ({
  tags,
  activeFilter,
  onFilterChange,
  entryCounts,
  isCollapsed = false,
  onToggleCollapse,
  isMobile = false,
  onFilterSelected,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    quickFilters: true,
    categories: false,
    tags: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const systemCategories = tags.filter(t => t.isSystemCategory);
  const customTags = tags.filter(t => !t.isSystemCategory && t.isSafeOnly);

  const isActive = (filter: SafeFilter) => {
    if (filter.type !== activeFilter.type) return false;
    if (filter.type === 'category' || filter.type === 'tag') {
      return filter.value === activeFilter.value;
    }
    return true;
  };

  const handleFilterClick = (filter: SafeFilter) => {
    onFilterChange(filter);
    if (isMobile && onFilterSelected) {
      onFilterSelected();
    }
  };

  const FilterButton: React.FC<{
    filter: SafeFilter;
    icon: string;
    label: string;
    count?: number;
    color?: string;
  }> = ({ filter, icon, label, count, color }) => (
    <button
      onClick={() => handleFilterClick(filter)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? '0.75rem' : '0.5rem',
        padding: isMobile ? '1rem' : '0.5rem 0.75rem',
        background: isActive(filter) ? (color ? `${color}20` : 'var(--ck-purple-light)') : 'transparent',
        border: isMobile ? '0.5px solid var(--ck-border2)' : 'none',
        borderRadius: isMobile ? '0.75rem' : '0.5rem',
        cursor: 'pointer',
        fontFamily: 'var(--ck-font)',
        fontSize: isMobile ? '1rem' : '0.85rem',
        color: isActive(filter) ? (color || 'var(--ck-purple)') : 'var(--ck-ink2)',
        fontWeight: isActive(filter) ? 600 : 400,
        textAlign: 'left',
        transition: 'all 0.15s',
        marginBottom: isMobile ? '0.5rem' : 0,
      }}
    >
      <span style={{ fontSize: isMobile ? '1.5rem' : '1rem', width: isMobile ? '2rem' : '1.5rem', textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && (
        <span style={{
          fontSize: isMobile ? '0.8rem' : '0.7rem',
          background: isActive(filter) ? (color || 'var(--ck-purple)') : 'var(--ck-cream)',
          color: isActive(filter) ? 'white' : 'var(--ck-ink3)',
          padding: isMobile ? '4px 10px' : '2px 6px',
          borderRadius: '9999px',
          fontWeight: 600,
        }}>
          {count}
        </span>
      )}
      {isMobile && <span style={{ color: 'var(--ck-ink3)', fontSize: '1rem' }}>›</span>}
    </button>
  );

  const SectionHeader: React.FC<{
    title: string;
    isExpanded: boolean;
    onToggle: () => void;
  }> = ({ title, isExpanded, onToggle }) => (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.25rem',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--ck-font)',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: 'var(--ck-ink3)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {title}
      <span style={{ fontSize: '0.65rem' }}>{isExpanded ? '▼' : '▶'}</span>
    </button>
  );

  if (isCollapsed) {
    return (
      <div style={{
        width: '48px',
        background: 'var(--ck-white)',
        border: '0.5px solid var(--ck-border2)',
        borderRadius: '10px',
        padding: '0.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '0.5rem',
          }}
          title="Expand filters"
        >
          ▶
        </button>
        <button
          onClick={() => onFilterChange({ type: 'all' })}
          style={{
            background: activeFilter.type === 'all' ? 'var(--ck-purple-light)' : 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '0.5rem',
            borderRadius: '0.5rem',
          }}
          title="All entries"
        >
          📋
        </button>
        <button
          onClick={() => onFilterChange({ type: 'favorites' })}
          style={{
            background: activeFilter.type === 'favorites' ? '#f59e0b20' : 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '0.5rem',
            borderRadius: '0.5rem',
          }}
          title="Favorites"
        >
          ⭐
        </button>
        <button
          onClick={() => onFilterChange({ type: 'shared' })}
          style={{
            background: activeFilter.type === 'shared' ? '#10b98120' : 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '0.5rem',
            borderRadius: '0.5rem',
          }}
          title="Shared with me"
        >
          👥
        </button>
      </div>
    );
  }

  // Mobile full-screen view
  if (isMobile) {
    return (
      <div style={{
        width: '100%',
        background: 'var(--ck-white)',
        border: '0.5px solid var(--ck-border2)',
        borderRadius: '12px',
        padding: '1.25rem',
        fontFamily: 'var(--ck-font)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minHeight: '400px',
      }}>
        <h3 style={{
          fontFamily: 'var(--ck-serif)',
          fontSize: '1.2rem',
          fontWeight: 500,
          color: 'var(--ck-ink)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          🔍 Browse Entries
        </h3>
        
        {/* Quick Filters */}
        <SectionHeader
          title="Quick Filters"
          isExpanded={expandedSections.quickFilters}
          onToggle={() => toggleSection('quickFilters')}
        />
        {expandedSections.quickFilters && (
          <div style={{ marginBottom: '1rem' }}>
            <FilterButton filter={{ type: 'all' }} icon="📋" label="All Entries" count={entryCounts.all} />
            <FilterButton filter={{ type: 'favorites' }} icon="⭐" label="Favorites" count={entryCounts.favorites} color="#f59e0b" />
            <FilterButton filter={{ type: 'shared' }} icon="👥" label="Shared with Me" count={entryCounts.shared} color="#10b981" />
            <FilterButton filter={{ type: 'sharedByMe' }} icon="📤" label="Shared by Me" count={entryCounts.sharedByMe} color="#3b82f6" />
            <FilterButton filter={{ type: 'recent' }} icon="🕐" label="Recently Edited" count={entryCounts.recent} color="#8b5cf6" />
            <FilterButton filter={{ type: 'expiring' }} icon="⏰" label="Expiring Soon" count={entryCounts.expiring} color="#ef4444" />
          </div>
        )}

        {/* Categories */}
        {systemCategories.length > 0 && (
          <>
            <SectionHeader
              title="Categories"
              isExpanded={expandedSections.categories}
              onToggle={() => toggleSection('categories')}
            />
            {expandedSections.categories && (
              <div style={{ marginBottom: '1rem' }}>
                {systemCategories.map(cat => (
                  <FilterButton
                    key={cat.id}
                    filter={{ type: 'category', value: cat.id }}
                    icon={getCategoryIcon(cat.name)}
                    label={getCategoryDisplayName(cat.name)}
                    count={entryCounts.byTag[cat.id] || 0}
                    color={cat.color}
                  />
                ))}
                <FilterButton
                  filter={{ type: 'uncategorized' }}
                  icon="📁"
                  label="Uncategorized"
                  count={entryCounts.uncategorized}
                />
              </div>
            )}
          </>
        )}

        {/* Custom Tags */}
        {customTags.length > 0 && (
          <>
            <SectionHeader
              title="Tags"
              isExpanded={expandedSections.tags}
              onToggle={() => toggleSection('tags')}
            />
            {expandedSections.tags && (
              <div>
                {customTags.map(tag => (
                  <FilterButton
                    key={tag.id}
                    filter={{ type: 'tag', value: tag.id }}
                    icon="🏷️"
                    label={tag.name}
                    count={entryCounts.byTag[tag.id] || 0}
                    color={tag.color}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{
      width: '220px',
      background: 'var(--ck-white)',
      border: '0.5px solid var(--ck-border2)',
      borderRadius: '10px',
      padding: '1rem',
      fontFamily: 'var(--ck-font)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      minHeight: '820px',
      maxHeight: 'calc(100vh - 120px)',
      overflowY: 'auto',
    }}>
      {/* Collapse button */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          style={{
            alignSelf: 'flex-end',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: 'var(--ck-ink3)',
            padding: '0.25rem',
            marginBottom: '0.5rem',
          }}
          title="Collapse filters"
        >
          ◀ Collapse
        </button>
      )}

      {/* Quick Filters */}
      <SectionHeader
        title="Quick Filters"
        isExpanded={expandedSections.quickFilters}
        onToggle={() => toggleSection('quickFilters')}
      />
      {expandedSections.quickFilters && (
        <div style={{ marginBottom: '0.75rem' }}>
          <FilterButton filter={{ type: 'all' }} icon="📋" label="All Entries" count={entryCounts.all} />
          <FilterButton filter={{ type: 'favorites' }} icon="⭐" label="Favorites" count={entryCounts.favorites} color="#f59e0b" />
          <FilterButton filter={{ type: 'shared' }} icon="👥" label="Shared with Me" count={entryCounts.shared} color="#10b981" />
          <FilterButton filter={{ type: 'sharedByMe' }} icon="📤" label="Shared by Me" count={entryCounts.sharedByMe} color="#3b82f6" />
          <FilterButton filter={{ type: 'recent' }} icon="🕐" label="Recently Edited" count={entryCounts.recent} color="#8b5cf6" />
          <FilterButton filter={{ type: 'expiring' }} icon="⏰" label="Expiring Soon" count={entryCounts.expiring} color="#ef4444" />
        </div>
      )}

      {/* Categories */}
      {systemCategories.length > 0 && (
        <>
          <SectionHeader
            title="Categories"
            isExpanded={expandedSections.categories}
            onToggle={() => toggleSection('categories')}
          />
          {expandedSections.categories && (
            <div style={{ marginBottom: '0.75rem' }}>
              {systemCategories.map(cat => (
                <FilterButton
                  key={cat.id}
                  filter={{ type: 'category', value: cat.id }}
                  icon={getCategoryIcon(cat.name)}
                  label={getCategoryDisplayName(cat.name)}
                  count={entryCounts.byTag[cat.id] || 0}
                  color={cat.color}
                />
              ))}
              <FilterButton
                filter={{ type: 'uncategorized' }}
                icon="📁"
                label="Uncategorized"
                count={entryCounts.uncategorized}
              />
            </div>
          )}
        </>
      )}

      {/* Custom Tags */}
      {customTags.length > 0 && (
        <>
          <SectionHeader
            title="Tags"
            isExpanded={expandedSections.tags}
            onToggle={() => toggleSection('tags')}
          />
          {expandedSections.tags && (
            <div>
              {customTags.map(tag => (
                <FilterButton
                  key={tag.id}
                  filter={{ type: 'tag', value: tag.id }}
                  icon="🏷️"
                  label={tag.name}
                  count={entryCounts.byTag[tag.id] || 0}
                  color={tag.color}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Helper to shorten long category names for the narrow filter panel.
// Underlying tag names/ids are unchanged — this only affects the label shown.
function getCategoryDisplayName(name: string): string {
  const short: Record<string, string> = {
    'Stock Trading Account': 'Stock Trading',
    'Identity Documents': 'Identity Docs',
  };
  return short[name] || name;
}

// Helper to get category icons
function getCategoryIcon(name: string): string {
  const icons: Record<string, string> = {
    'Login': '🔑',
    'Stock Trading Account': '📈',
    'Identity Documents': '🪪',
    'Credit Card': '💳',
    'Identity': '🪪',
    'Bank Account': '🏦',
    'Secure Note': '📝',
    'Software License': '📀',
    'WiFi Password': '📶',
    'SSH Key': '🔐',
    'API Key': '🔗',
    'Passport': '🛂',
    'Insurance': '🏥',
    'Crypto Wallet': '₿',
    'Email Account': '📧',
    'Social Media': '💬',
    'Membership': '🎫',
    'Vehicle': '🚗',
    'Medical': '⚕️',
    'Education': '🎓',
    'Travel': '✈️',
    'Subscription': '📺',
    'Gift Card': '🎁',
    'Stock Account': '📈',
    'TOTP/2FA': '🔢',
  };
  return icons[name] || '📁';
}

export default SafeFilterSidebar;
