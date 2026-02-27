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
      {isMobile && title && (
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#1f2937',
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
