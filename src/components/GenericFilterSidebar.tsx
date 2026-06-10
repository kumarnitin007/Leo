/**
 * GenericFilterSidebar - Reusable tree-like filter panel
 * Can be used for Events, Items, Tasks, and other views
 */

import React, { useState } from 'react';
import { Tag } from '../types';

export interface GenericFilter {
  type: string;
  value?: string;
}

export interface FilterSection {
  id: string;
  title: string;
  defaultExpanded?: boolean;
  items: FilterItem[];
}

export interface FilterItem {
  filter: GenericFilter;
  icon: string;
  label: string;
  count?: number;
  color?: string;
}

interface GenericFilterSidebarProps {
  title?: string;
  sections: FilterSection[];
  activeFilter: GenericFilter;
  onFilterChange: (filter: GenericFilter) => void;
  isMobile?: boolean;
  onFilterSelected?: () => void;
}

const GenericFilterSidebar: React.FC<GenericFilterSidebarProps> = ({
  title,
  sections,
  activeFilter,
  onFilterChange,
  isMobile = false,
  onFilterSelected,
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach(section => {
      initial[section.id] = section.defaultExpanded ?? true;
    });
    return initial;
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleFilterClick = (filter: GenericFilter) => {
    onFilterChange(filter);
    if (isMobile && onFilterSelected) {
      onFilterSelected();
    }
  };

  const isActive = (filter: GenericFilter) => {
    if (filter.type !== activeFilter.type) return false;
    if (filter.value !== undefined) {
      return filter.value === activeFilter.value;
    }
    return true;
  };

  const FilterButton: React.FC<FilterItem> = ({ filter, icon, label, count, color }) => (
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

  const containerStyle = isMobile ? {
    width: '100%',
    background: 'var(--ck-white)',
    border: '0.5px solid var(--ck-border2)',
    borderRadius: '12px',
    padding: '1.25rem',
    fontFamily: 'var(--ck-font)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
    minHeight: '400px',
  } : {
    width: '220px',
    background: 'var(--ck-white)',
    border: '0.5px solid var(--ck-border2)',
    borderRadius: '10px',
    padding: '1rem',
    fontFamily: 'var(--ck-font)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    minHeight: '450px',
    maxHeight: 'calc(100vh - 250px)',
    overflowY: 'auto' as const,
  };

  return (
    <div style={containerStyle}>
      {isMobile && title && (
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
          {title}
        </h3>
      )}

      {sections.map(section => (
        <React.Fragment key={section.id}>
          <SectionHeader
            title={section.title}
            isExpanded={expandedSections[section.id] ?? true}
            onToggle={() => toggleSection(section.id)}
          />
          {expandedSections[section.id] && (
            <div style={{ marginBottom: '0.75rem' }}>
              {section.items.map((item, idx) => (
                <FilterButton key={`${section.id}-${idx}`} {...item} />
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default GenericFilterSidebar;
