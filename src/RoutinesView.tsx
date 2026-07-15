/**
 * Routines View Component
 * 
 * Manage task routines and templates
 * Features:
 * - Pre-defined routines (Morning, Evening, Workout)
 * - User-created custom routines
 * - Time-of-day assignment
 * - Quick-apply to add all tasks from routine
 */

import React, { useState, useEffect } from 'react';
import { Routine, Task } from './types';
import {
  getRoutines,
  getTasks,
  addRoutine,
  updateRoutine,
  deleteRoutine,
  initializeDefaultRoutines
} from './storage';
import GenericFilterSidebar, { GenericFilter, FilterSection } from './components/GenericFilterSidebar';
import SlideOverPanel from './components/SlideOverPanel';
import FormCollapsible from './components/FormCollapsible';

interface RoutinesViewProps {
  onApplyRoutine?: (tasks: Task[]) => void;
}

const RoutinesView: React.FC<RoutinesViewProps> = ({ onApplyRoutine }) => {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [activeFilter, setActiveFilter] = useState<GenericFilter>({ type: 'all' });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileFilters, setShowMobileFilters] = useState(true);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    timeOfDay: 'anytime' as 'morning' | 'afternoon' | 'evening' | 'anytime',
    selectedTaskIds: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Initialize default routines if none exist
      await initializeDefaultRoutines();
      
      const allRoutines = await getRoutines();
      const allTasks = await getTasks();
      setRoutines(allRoutines);
      setTasks(allTasks);
    } catch (error) {
      console.error('Error loading routines:', error);
      alert('Error loading routines. Please make sure you are signed in.');
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingRoutine(null);
    setFormData({
      name: '',
      description: '',
      timeOfDay: 'anytime',
      selectedTaskIds: []
    });
  };

  const handleEdit = (routine: Routine) => {
    setEditingRoutine(routine);
    setIsCreating(true);
    setFormData({
      name: routine.name,
      description: routine.description || '',
      timeOfDay: routine.timeOfDay,
      selectedTaskIds: routine.taskIds
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a routine name');
      return;
    }

    try {
      if (editingRoutine) {
        // Update existing routine
        await updateRoutine(editingRoutine.id, {
          name: formData.name,
          description: formData.description,
          timeOfDay: formData.timeOfDay,
          taskIds: formData.selectedTaskIds
        });
      } else {
        // Create new routine
        const newRoutine: Routine = {
          id: crypto.randomUUID(),
          name: formData.name,
          description: formData.description,
          timeOfDay: formData.timeOfDay,
          taskIds: formData.selectedTaskIds,
          isPreDefined: false,
          isActive: true, // User-created routines are active by default
          createdAt: new Date().toISOString()
        };
        await addRoutine(newRoutine);
      }

      await loadData();
      setIsCreating(false);
      setEditingRoutine(null);
    } catch (error) {
      console.error('Error saving routine:', error);
      alert('Error saving routine. Please try again.');
    }
  };

  const handleDelete = async (routineId: string) => {
    if (confirm('Are you sure you want to delete this routine?')) {
      try {
        await deleteRoutine(routineId);
        await loadData();
      } catch (error) {
        console.error('Error deleting routine:', error);
        alert('Error deleting routine. Please try again.');
      }
    }
  };

  const handleActivate = async (routine: Routine) => {
    try {
      await updateRoutine(routine.id, { isActive: true });
      await loadData();
    } catch (error) {
      console.error('Error activating routine:', error);
      alert('Error activating routine. Please try again.');
    }
  };

  const handleDeactivate = async (routine: Routine) => {
    try {
      await updateRoutine(routine.id, { isActive: false });
      await loadData();
    } catch (error) {
      console.error('Error deactivating routine:', error);
      alert('Error deactivating routine. Please try again.');
    }
  };

  const handleApply = (routine: Routine) => {
    const routineTasks = tasks.filter(t => routine.taskIds.includes(t.id));
    if (onApplyRoutine) {
      onApplyRoutine(routineTasks);
    }
    alert(`Applied "${routine.name}" routine with ${routineTasks.length} task(s)!`);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingRoutine(null);
  };

  const toggleTaskSelection = (taskId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTaskIds: prev.selectedTaskIds.includes(taskId)
        ? prev.selectedTaskIds.filter(id => id !== taskId)
        : [...prev.selectedTaskIds, taskId]
    }));
  };

  const getTimeIcon = (timeOfDay: string) => {
    const icons = {
      morning: '🌅',
      afternoon: '☀️',
      evening: '🌙',
      anytime: '⏰'
    };
    return icons[timeOfDay as keyof typeof icons] || '⏰';
  };

  const activeRoutines = routines.filter(r => r.isActive && !r.isPreDefined);
  const userRoutines = routines.filter(r => !r.isPreDefined && r.isActive);
  const sampleRoutines = routines.filter(r => r.isPreDefined);
  const activeSampleRoutines = sampleRoutines.filter(r => r.isActive);
  const inactiveSampleRoutines = sampleRoutines.filter(r => !r.isActive);

  const matchTime = (r: Routine) => activeFilter.type !== 'time' || r.timeOfDay === activeFilter.value;
  const timeCount = (t: string) => routines.filter(r => r.timeOfDay === t).length;
  const routineFilterSections: FilterSection[] = [
    {
      id: 'quick',
      title: 'Quick Filters',
      defaultExpanded: true,
      items: [
        { filter: { type: 'all' }, icon: '🔄', label: 'All Routines', count: routines.length },
      ],
    },
    {
      id: 'time',
      title: 'Time of Day',
      defaultExpanded: true,
      items: [
        { filter: { type: 'time', value: 'morning' }, icon: '🌅', label: 'Morning', count: timeCount('morning') },
        { filter: { type: 'time', value: 'afternoon' }, icon: '☀️', label: 'Afternoon', count: timeCount('afternoon') },
        { filter: { type: 'time', value: 'evening' }, icon: '🌙', label: 'Evening', count: timeCount('evening') },
        { filter: { type: 'time', value: 'anytime' }, icon: '⏰', label: 'Anytime', count: timeCount('anytime') },
      ],
    },
  ];
  const routineFilterLabel = activeFilter.type === 'time' ? (activeFilter.value || '') : 'All Routines';

  return (
    <div className="ck-screen routines-view">
      <div className="ck-page-head">
        <div>
          <h2 className="ck-page-title">Routines</h2>
          <p className="ck-page-sub">Task routines for different times of the day</p>
        </div>
        <button onClick={handleCreate} className="ck-btn ck-btn-primary">
          + Create Routine
        </button>
      </div>

      {/* Create/Edit Form */}
      <SlideOverPanel
        isOpen={isCreating}
        onClose={handleCancel}
        title={editingRoutine ? 'Edit Routine' : 'Create New Routine'}
      >
          <form className="routine-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="form-row">
              <div className="form-group">
                <label>Routine Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Morning Routine"
                />
              </div>

              <div className="form-group">
                <label>Time of Day</label>
                <select
                  value={formData.timeOfDay}
                  onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value as any })}
                >
                  <option value="morning">🌅 Morning</option>
                  <option value="afternoon">☀️ Afternoon</option>
                  <option value="evening">🌙 Evening</option>
                  <option value="anytime">⏰ Anytime</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Select Tasks ({formData.selectedTaskIds.length} selected)</label>
              <div className="task-selector">
                {tasks.length === 0 ? (
                  <p className="no-tasks-message">No tasks available. Create some tasks first!</p>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      className={`task-selector-item ${formData.selectedTaskIds.includes(task.id) ? 'selected' : ''}`}
                      onClick={() => toggleTaskSelection(task.id)}
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedTaskIds.includes(task.id)}
                        onChange={() => {}}
                      />
                      <div className="task-info">
                        <span className="task-name">{task.name}</span>
                        {task.category && <span className="task-category">{task.category}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <FormCollapsible title="Description" subtitle="Optional">
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe this routine..."
                rows={2}
              />
            </div>
            </FormCollapsible>

            <div className="form-actions">
              <button type="submit" className="ck-btn ck-btn-primary">
                {editingRoutine ? 'Update Routine' : 'Create Routine'}
              </button>
              <button type="button" onClick={handleCancel} className="ck-btn">
                Cancel
              </button>
            </div>
          </form>
      </SlideOverPanel>

      {/* Main content with sidebar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {isMobile && showMobileFilters && !isCreating && routines.length > 0 ? (
          <GenericFilterSidebar
            title="🔄 Filter Routines"
            sections={routineFilterSections}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            isMobile
            onFilterSelected={() => setShowMobileFilters(false)}
          />
        ) : (
          <>
            {!isMobile && !isCreating && routines.length > 0 && (
              <GenericFilterSidebar
                sections={routineFilterSections}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isMobile && !isCreating && routines.length > 0 && (
                <button
                  className="ck-btn"
                  onClick={() => setShowMobileFilters(true)}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
                >
                  ‹ Filters · {routineFilterLabel}
                </button>
              )}

      {/* Active Sample Routines */}
      {activeSampleRoutines.filter(matchTime).length > 0 && (
        <div className="routines-section">
          <h3>📋 Active Sample Routines</h3>
          <div className="routines-grid">
            {activeSampleRoutines.filter(matchTime).map(routine => (
              <div key={routine.id} className="routine-card routine-active">
                <div className="routine-header">
                  <span className="routine-icon">{getTimeIcon(routine.timeOfDay)}</span>
                  <h4>{routine.name}</h4>
                </div>
                {routine.description && (
                  <p className="routine-description">{routine.description}</p>
                )}
                <div className="routine-meta">
                  <span className="routine-time">{routine.timeOfDay}</span>
                  <span className="routine-tasks">{routine.taskIds.length} task(s)</span>
                </div>
                <div className="routine-actions">
                  <button onClick={() => handleEdit(routine)} className="ck-btn ck-btn-sm">
                    ⚙️ Configure
                  </button>
                  <button 
                    onClick={() => handleApply(routine)} 
                    className="ck-btn ck-btn-sm"
                    disabled={routine.taskIds.length === 0}
                  >
                    ⚡ Apply
                  </button>
                  <button onClick={() => handleDeactivate(routine)} className="ck-btn ck-btn-sm" title="Deactivate this routine">
                    ⏸️ Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive Sample Routines (Templates) */}
      {inactiveSampleRoutines.filter(matchTime).length > 0 && (
        <div className="routines-section">
          <h3>💡 Available Sample Routines</h3>
          <p className="section-description">Activate these pre-built routines to start using them</p>
          <div className="routines-grid">
            {inactiveSampleRoutines.filter(matchTime).map(routine => (
              <div key={routine.id} className="routine-card routine-inactive">
                <div className="routine-header">
                  <span className="routine-icon">{getTimeIcon(routine.timeOfDay)}</span>
                  <h4>{routine.name}</h4>
                </div>
                {routine.description && (
                  <p className="routine-description">{routine.description}</p>
                )}
                <div className="routine-meta">
                  <span className="routine-time">{routine.timeOfDay}</span>
                  <span className="routine-badge">Sample Template</span>
                </div>
                <div className="routine-actions">
                  <button onClick={() => handleActivate(routine)} className="ck-btn ck-btn-sm ck-btn-primary">
                    ✅ Activate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User-created Routines */}
      {userRoutines.filter(matchTime).length > 0 && (
        <div className="routines-section">
          <h3>✨ My Custom Routines</h3>
          <div className="routines-grid">
            {userRoutines.filter(matchTime).map(routine => (
              <div key={routine.id} className="routine-card">
                <div className="routine-header">
                  <span className="routine-icon">{getTimeIcon(routine.timeOfDay)}</span>
                  <h4>{routine.name}</h4>
                </div>
                {routine.description && (
                  <p className="routine-description">{routine.description}</p>
                )}
                <div className="routine-meta">
                  <span className="routine-time">{routine.timeOfDay}</span>
                  <span className="routine-tasks">{routine.taskIds.length} task(s)</span>
                </div>
                <div className="routine-actions">
                  <button onClick={() => handleEdit(routine)} className="ck-btn ck-btn-sm">
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => handleApply(routine)} 
                    className="ck-btn ck-btn-sm"
                    disabled={routine.taskIds.length === 0}
                  >
                    ⚡ Apply
                  </button>
                  <button onClick={() => handleDelete(routine.id)} className="ck-btn ck-btn-sm ck-btn-danger">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoutinesView;

