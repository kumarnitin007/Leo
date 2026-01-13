import React, { useState } from 'react';
import ConfigureView from './ConfigureView';
import RoutinesView from './RoutinesView';

type TasksTab = 'tasks' | 'routines';

const TasksView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TasksTab>('tasks');

  return (
    <div className="tasks-view">
      <div className="view-header">
        <h2>🎯 Tasks & Routines</h2>
      </div>

      <div className="sub-tabs">
        <button
          className={`sub-tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📝 Tasks
        </button>
        <button
          className={`sub-tab ${activeTab === 'routines' ? 'active' : ''}`}
          onClick={() => setActiveTab('routines')}
        >
          🔄 Routines
        </button>
      </div>

      <div className="sub-tab-content">
        {activeTab === 'tasks' && <ConfigureView />}
        {activeTab === 'routines' && <RoutinesView />}
      </div>
    </div>
  );
};

export default TasksView;

