/**
 * Combined Tasks & Events View Component
 * 
 * Consolidates task management and event tracking into one unified interface
 * Sub-tabs: Tasks | Events | Routines | Items | Resolutions
 */

import React, { useState, memo } from 'react';
import ConfigureView from './ConfigureView';
import EventsView from './EventsView';
import RoutinesView from './RoutinesView';
import ItemsView from './ItemsView';
import ResolutionsView from './ResolutionsView';
import TodoView from './TodoView';

interface TasksAndEventsViewProps {
  onNavigate?: (view: string) => void;
  initialTab?: SubTab;
}

type SubTab = 'tasks' | 'events' | 'routines' | 'items' | 'resolutions' | 'todo';

const TasksAndEventsView: React.FC<TasksAndEventsViewProps> = ({ initialTab }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>(initialTab || 'tasks');

  const tabs: { id: SubTab; icon: string; label: string }[] = [
    { id: 'tasks', icon: '✅', label: 'Tasks' },
    { id: 'events', icon: '📅', label: 'Events' },
    { id: 'routines', icon: '🔄', label: 'Routines' },
    { id: 'items', icon: '📦', label: 'Items' },
    { id: 'resolutions', icon: '🎯', label: 'Goals' },
    { id: 'todo', icon: '📝', label: 'Lists' },
  ];

  return (
    <div className="tasks-events-view">
      {/* Sub-tabs Navigation */}
      <div className="sub-tabs" style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: '0.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '0.375rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
      }}>
        {tabs.map(t => {
          const isActive = activeSubTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`sub-tab ${isActive ? 'active' : ''}`}
              style={{
                flex: 1,
                padding: '0.625rem 0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive
                  ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
                  : 'transparent',
                color: isActive ? 'white' : '#6b7280',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 4px 12px rgba(20, 184, 166, 0.35)' : 'none',
                transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="sub-tab-content">
        {activeSubTab === 'tasks' && <ConfigureView />}
        {activeSubTab === 'events' && <EventsView />}
        {activeSubTab === 'routines' && <RoutinesView />}
        {activeSubTab === 'items' && <ItemsView />}
        {activeSubTab === 'resolutions' && <ResolutionsView />}
        {activeSubTab === 'todo' && <TodoView />}
      </div>
    </div>
  );
};

export default TasksAndEventsView;

