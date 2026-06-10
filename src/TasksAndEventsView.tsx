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
        background: 'var(--ck-white)',
        border: '0.5px solid var(--ck-border2)',
        borderRadius: '12px',
        padding: '5px',
        marginBottom: '1.25rem',
        display: 'flex',
        gap: '4px',
        boxShadow: 'var(--ck-shadow)',
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
                padding: '0.5rem 0.5rem',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--ck-purple)' : 'transparent',
                color: isActive ? '#fff' : 'var(--ck-ink2)',
                fontFamily: 'var(--ck-font)',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
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

