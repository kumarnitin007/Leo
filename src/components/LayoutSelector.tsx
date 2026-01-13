/**
 * Layout Selector Component
 * 
 * Allows users to choose between different dashboard layouts:
 * - Uniform Grid: All cards same size
 * - Grid Spans: Cards sized by priority (bigger = more important)
 * - Masonry: Pinterest-style variable height cards
 */

import React from 'react';
import { DashboardLayout } from '../types';

interface LayoutSelectorProps {
  currentLayout: DashboardLayout;
  onLayoutChange: (layout: DashboardLayout) => void;
}

const LayoutSelector: React.FC<LayoutSelectorProps> = ({ currentLayout, onLayoutChange }) => {
  const layouts: Array<{ id: DashboardLayout; name: string; icon: string; description: string }> = [
    {
      id: 'uniform',
      name: 'Uniform Grid',
      icon: '▦',
      description: 'Compact, equal-sized cards'
    },
    {
      id: 'grid-spans',
      name: 'Priority Sized',
      icon: '▧',
      description: 'Width & height by priority'
    },
    {
      id: 'masonry',
      name: 'Masonry',
      icon: '▥',
      description: 'Staggered heights (Pinterest)'
    }
  ];

  return (
    <div className="layout-selector" style={{
      display: 'flex',
      gap: '0.5rem',
      alignItems: 'center',
      background: 'rgba(255, 255, 255, 0.9)',
      padding: '0.5rem',
      borderRadius: '12px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
    }}>
      <span style={{ 
        fontSize: '0.85rem', 
        fontWeight: 600, 
        color: '#6b7280',
        marginRight: '0.25rem'
      }}>
        Layout:
      </span>
      {layouts.map(layout => (
        <button
          key={layout.id}
          onClick={() => onLayoutChange(layout.id)}
          className={`layout-btn ${currentLayout === layout.id ? 'active' : ''}`}
          title={`${layout.name}: ${layout.description}`}
          style={{
            background: currentLayout === layout.id ? '#667eea' : 'white',
            color: currentLayout === layout.id ? 'white' : '#6b7280',
            border: currentLayout === layout.id ? 'none' : '2px solid #e5e7eb',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            cursor: 'pointer',
            fontSize: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            transition: 'all 0.2s',
            fontWeight: 600
          }}
          onMouseEnter={(e) => {
            if (currentLayout !== layout.id) {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.borderColor = '#667eea';
            }
          }}
          onMouseLeave={(e) => {
            if (currentLayout !== layout.id) {
              e.currentTarget.style.background = 'white';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }
          }}
        >
          <span>{layout.icon}</span>
          <span style={{ fontSize: '0.75rem' }}>{layout.name}</span>
        </button>
      ))}
    </div>
  );
};

export default LayoutSelector;

