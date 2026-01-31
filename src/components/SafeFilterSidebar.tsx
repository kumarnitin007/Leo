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
  type: 'all' | 'favorites' | 'shared' | 'recent' | 'expiring' | 'category' | 'tag';
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
    recent: number;
    expiring: number;
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
    categories: true,
    tags: true,
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
        background: isActive(filter) ? (color ? `${color}20` : '#3b82f620') : 'transparent',
        border: isMobile ? '1px solid #e5e7eb' : 'none',
        borderRadius: isMobile ? '0.75rem' : '0.5rem',
        cursor: 'pointer',
        fontSize: isMobile ? '1rem' : '0.85rem',
        color: isActive(filter) ? (color || '#3b82f6') : '#4b5563',
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
          background: isActive(filter) ? (color || '#3b82f6') : '#e5e7eb',
          color: isActive(filter) ? 'white' : '#6b7280',
          padding: isMobile ? '4px 10px' : '2px 6px',
          borderRadius: '9999px',
          fontWeight: 600,
        }}>
          {count}
        </span>
      )}
      {isMobile && <span style={{ color: '#9ca3af', fontSize: '1rem' }}>›</span>}
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
        fontSize: '0.7rem',
        fontWeight: 700,
        color: '#9ca3af',
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
        background: 'rgba(255,255,255,0.9)',
        borderRadius: '0.75rem',
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
            background: activeFilter.type === 'all' ? '#3b82f620' : 'none',
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
        background: 'rgba(255,255,255,0.98)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minHeight: '400px',
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#1f2937',
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
                    label={cat.name}
                    count={entryCounts.byTag[cat.id] || 0}
                    color={cat.color}
                  />
                ))}
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
      background: 'rgba(255,255,255,0.95)',
      borderRadius: '0.75rem',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.25rem',
      minHeight: '450px',
      maxHeight: 'calc(100vh - 250px)',
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
            color: '#9ca3af',
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
                  label={cat.name}
                  count={entryCounts.byTag[cat.id] || 0}
                  color={cat.color}
                />
              ))}
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

// Helper to get category icons
function getCategoryIcon(name: string): string {
  const icons: Record<string, string> = {
    'Login': '🔑',
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
