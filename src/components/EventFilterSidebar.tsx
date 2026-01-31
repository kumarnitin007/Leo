/**
 * EventFilterSidebar - Tree-like filter panel for Events
 */

import React, { useState } from 'react';
import { Tag } from '../types';

export interface EventFilter {
  type: 'all' | 'upcoming' | 'thisMonth' | 'category' | 'tag' | 'frequency' | 'hidden';
  value?: string;
}

interface EventFilterSidebarProps {
  tags: Tag[];
  activeFilter: EventFilter;
  onFilterChange: (filter: EventFilter) => void;
  entryCounts: {
    all: number;
    upcoming: number;
    thisMonth: number;
    hidden: number;
    byCategory: Record<string, number>;
    byFrequency: Record<string, number>;
    byTag: Record<string, number>;
  };
  isMobile?: boolean;
  onFilterSelected?: () => void;
}

const categories = [
  { id: 'Birthday', icon: '🎂', label: 'Birthday' },
  { id: 'Anniversary', icon: '💝', label: 'Anniversary' },
  { id: 'Wedding', icon: '💍', label: 'Wedding' },
  { id: 'Graduation', icon: '🎓', label: 'Graduation' },
  { id: 'Holiday', icon: '🎉', label: 'Holiday' },
  { id: 'Festival', icon: '🎊', label: 'Festival' },
  { id: 'Special Event', icon: '⭐', label: 'Special Event' },
  { id: 'Death Anniversary', icon: '🕯️', label: 'Death Anniversary' },
  { id: 'Memorial', icon: '🌹', label: 'Memorial' },
];

const EventFilterSidebar: React.FC<EventFilterSidebarProps> = ({
  tags,
  activeFilter,
  onFilterChange,
  entryCounts,
  isMobile = false,
  onFilterSelected,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    quickFilters: true,
    categories: true,
    frequency: false,
    tags: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFilterClick = (filter: EventFilter) => {
    onFilterChange(filter);
    if (isMobile && onFilterSelected) {
      onFilterSelected();
    }
  };

  const isActive = (filter: EventFilter) => {
    if (filter.type !== activeFilter.type) return false;
    if (filter.value !== undefined) {
      return filter.value === activeFilter.value;
    }
    return true;
  };

  const FilterButton: React.FC<{
    filter: EventFilter;
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

  const containerStyle = isMobile ? {
    width: '100%',
    background: 'rgba(255,255,255,0.98)',
    borderRadius: '1rem',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    minHeight: '400px',
  } : {
    width: '220px',
    background: 'rgba(255,255,255,0.95)',
    borderRadius: '0.75rem',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    minHeight: '450px',
    maxHeight: 'calc(100vh - 250px)',
    overflowY: 'auto' as const,
  };

  return (
    <div style={containerStyle}>
      {isMobile && (
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#1f2937',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          📅 Browse Events
        </h3>
      )}

      {/* Quick Filters */}
      <SectionHeader
        title="Quick Filters"
        isExpanded={expandedSections.quickFilters}
        onToggle={() => toggleSection('quickFilters')}
      />
      {expandedSections.quickFilters && (
        <div style={{ marginBottom: '0.75rem' }}>
          <FilterButton filter={{ type: 'all' }} icon="📋" label="All Events" count={entryCounts.all} />
          <FilterButton filter={{ type: 'upcoming' }} icon="🔔" label="Upcoming (30 days)" count={entryCounts.upcoming} color="#10b981" />
          <FilterButton filter={{ type: 'thisMonth' }} icon="📆" label="This Month" count={entryCounts.thisMonth} color="#8b5cf6" />
          <FilterButton filter={{ type: 'hidden' }} icon="🙈" label="Hidden from Dashboard" count={entryCounts.hidden} color="#6b7280" />
        </div>
      )}

      {/* Categories */}
      <SectionHeader
        title="Categories"
        isExpanded={expandedSections.categories}
        onToggle={() => toggleSection('categories')}
      />
      {expandedSections.categories && (
        <div style={{ marginBottom: '0.75rem' }}>
          {categories.map(cat => (
            <FilterButton
              key={cat.id}
              filter={{ type: 'category', value: cat.id }}
              icon={cat.icon}
              label={cat.label}
              count={entryCounts.byCategory[cat.id] || 0}
            />
          ))}
        </div>
      )}

      {/* Frequency */}
      <SectionHeader
        title="Frequency"
        isExpanded={expandedSections.frequency}
        onToggle={() => toggleSection('frequency')}
      />
      {expandedSections.frequency && (
        <div style={{ marginBottom: '0.75rem' }}>
          <FilterButton filter={{ type: 'frequency', value: 'yearly' }} icon="🔄" label="Yearly" count={entryCounts.byFrequency['yearly'] || 0} />
          <FilterButton filter={{ type: 'frequency', value: 'one-time' }} icon="⚡" label="One-Time" count={entryCounts.byFrequency['one-time'] || 0} />
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <>
          <SectionHeader
            title="Tags"
            isExpanded={expandedSections.tags}
            onToggle={() => toggleSection('tags')}
          />
          {expandedSections.tags && (
            <div>
              {tags.map(tag => (
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

export default EventFilterSidebar;
