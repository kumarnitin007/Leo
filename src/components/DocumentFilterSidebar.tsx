/**
 * DocumentFilterSidebar - Tree-like filter panel for Safe Documents
 */

import React, { useState } from 'react';
import { Tag, DocumentType, DocumentProvider } from '../types';

export interface DocumentFilter {
  type: 'all' | 'favorites' | 'shared' | 'sharedByMe' | 'expiring' | 'recent' | 'docType' | 'provider' | 'tag';
  value?: string;
}

interface DocumentFilterSidebarProps {
  tags: Tag[];
  activeFilter: DocumentFilter;
  onFilterChange: (filter: DocumentFilter) => void;
  entryCounts: {
    all: number;
    favorites: number;
    shared: number;
    sharedByMe: number;
    expiring: number;
    recent: number;
    byDocType: Record<string, number>;
    byProvider: Record<string, number>;
    byTag: Record<string, number>;
  };
  isMobile?: boolean;
  onFilterSelected?: () => void;
}

const documentTypes: { id: DocumentType; icon: string; label: string }[] = [
  { id: 'invoice', icon: '📄', label: 'Invoice' },
  { id: 'contract', icon: '📜', label: 'Contract' },
  { id: 'identity', icon: '🪪', label: 'Identity' },
  { id: 'insurance', icon: '🏥', label: 'Insurance' },
  { id: 'medical', icon: '⚕️', label: 'Medical' },
  { id: 'tax', icon: '🧾', label: 'Tax' },
  { id: 'warranty', icon: '🛡️', label: 'Warranty' },
  { id: 'license', icon: '📀', label: 'License' },
  { id: 'other', icon: '📁', label: 'Other' },
];

const providers: { id: DocumentProvider; icon: string; label: string }[] = [
  { id: 'google', icon: '🔵', label: 'Google Drive' },
  { id: 'onedrive', icon: '☁️', label: 'OneDrive' },
  { id: 'dropbox', icon: '📦', label: 'Dropbox' },
];

const DocumentFilterSidebar: React.FC<DocumentFilterSidebarProps> = ({
  tags,
  activeFilter,
  onFilterChange,
  entryCounts,
  isMobile = false,
  onFilterSelected,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    quickFilters: true,
    docTypes: true,
    providers: false,
    tags: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleFilterClick = (filter: DocumentFilter) => {
    onFilterChange(filter);
    if (isMobile && onFilterSelected) {
      onFilterSelected();
    }
  };

  const isActive = (filter: DocumentFilter) => {
    if (filter.type !== activeFilter.type) return false;
    if (filter.value !== undefined) {
      return filter.value === activeFilter.value;
    }
    return true;
  };

  const FilterButton: React.FC<{
    filter: DocumentFilter;
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
          📄 Browse Documents
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
          <FilterButton filter={{ type: 'all' }} icon="📋" label="All Documents" count={entryCounts.all} />
          <FilterButton filter={{ type: 'favorites' }} icon="⭐" label="Favorites" count={entryCounts.favorites} color="#f59e0b" />
          <FilterButton filter={{ type: 'shared' }} icon="👥" label="Shared with Me" count={entryCounts.shared} color="#10b981" />
          <FilterButton filter={{ type: 'sharedByMe' }} icon="📤" label="Shared by Me" count={entryCounts.sharedByMe} color="#6366f1" />
          <FilterButton filter={{ type: 'expiring' }} icon="⏰" label="Expiring Soon" count={entryCounts.expiring} color="#ef4444" />
          <FilterButton filter={{ type: 'recent' }} icon="🕐" label="Recently Updated" count={entryCounts.recent} color="#8b5cf6" />
        </div>
      )}

      {/* Document Types */}
      <SectionHeader
        title="Document Types"
        isExpanded={expandedSections.docTypes}
        onToggle={() => toggleSection('docTypes')}
      />
      {expandedSections.docTypes && (
        <div style={{ marginBottom: '0.75rem' }}>
          {documentTypes.map(dt => (
            <FilterButton
              key={dt.id}
              filter={{ type: 'docType', value: dt.id }}
              icon={dt.icon}
              label={dt.label}
              count={entryCounts.byDocType[dt.id] || 0}
            />
          ))}
        </div>
      )}

      {/* Providers */}
      <SectionHeader
        title="Storage Provider"
        isExpanded={expandedSections.providers}
        onToggle={() => toggleSection('providers')}
      />
      {expandedSections.providers && (
        <div style={{ marginBottom: '0.75rem' }}>
          {providers.map(p => (
            <FilterButton
              key={p.id}
              filter={{ type: 'provider', value: p.id }}
              icon={p.icon}
              label={p.label}
              count={entryCounts.byProvider[p.id] || 0}
            />
          ))}
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

export default DocumentFilterSidebar;
