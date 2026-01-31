/**
 * Combined Tasks & Events View Component
 * 
 * Consolidates task management and event tracking into one unified interface
 * Sub-tabs: Tasks | Events | Routines | Items | Resolutions
 */

import React, { useState } from 'react';
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
        gap: '0.5rem',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
      }}>
        <button
          onClick={() => setActiveSubTab('tasks')}
          className={`sub-tab ${activeSubTab === 'tasks' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'tasks' 
              ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
              : 'transparent',
            color: activeSubTab === 'tasks' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeSubTab === 'tasks' ? '0 4px 12px rgba(20, 184, 166, 0.35)' : 'none',
            transform: activeSubTab === 'tasks' ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>✅</span>
          Tasks
        </button>
        <button
          onClick={() => setActiveSubTab('events')}
          className={`sub-tab ${activeSubTab === 'events' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'events' 
              ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
              : 'transparent',
            color: activeSubTab === 'events' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeSubTab === 'events' ? '0 4px 12px rgba(20, 184, 166, 0.35)' : 'none',
            transform: activeSubTab === 'events' ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>📅</span>
          Events
        </button>
        <button
          onClick={() => setActiveSubTab('routines')}
          className={`sub-tab ${activeSubTab === 'routines' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'routines' 
              ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
              : 'transparent',
            color: activeSubTab === 'routines' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeSubTab === 'routines' ? '0 4px 12px rgba(20, 184, 166, 0.35)' : 'none',
            transform: activeSubTab === 'routines' ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>🎯</span>
          Routines
        </button>
        <button
          onClick={() => setActiveSubTab('items')}
          className={`sub-tab ${activeSubTab === 'items' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'items' 
              ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
              : 'transparent',
            color: activeSubTab === 'items' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeSubTab === 'items' ? '0 4px 12px rgba(20, 184, 166, 0.35)' : 'none',
            transform: activeSubTab === 'items' ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>📦</span>
          Items
        </button>
        <button
          onClick={() => setActiveSubTab('resolutions')}
          className={`sub-tab ${activeSubTab === 'resolutions' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'resolutions' 
              ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
              : 'transparent',
            color: activeSubTab === 'resolutions' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeSubTab === 'resolutions' ? '0 4px 12px rgba(20, 184, 166, 0.35)' : 'none',
            transform: activeSubTab === 'resolutions' ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>🎯</span>
          Resolutions
        </button>
        <button
          onClick={() => setActiveSubTab('todo')}
          className={`sub-tab ${activeSubTab === 'todo' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            background: activeSubTab === 'todo' 
              ? 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
              : 'transparent',
            color: activeSubTab === 'todo' ? 'white' : '#6b7280',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeSubTab === 'todo' ? '0 4px 12px rgba(20, 184, 166, 0.35)' : 'none',
            transform: activeSubTab === 'todo' ? 'translateY(-2px)' : 'translateY(0)'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>📝</span>
          To-Do
        </button>
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

