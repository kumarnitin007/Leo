import React, { useState, useEffect } from 'react';
import { Resolution, ResolutionMilestone, Task } from '../types';
import Portal from './Portal';
import '../styles/ResolutionModal.css';

interface ResolutionModalProps {
  isOpen: boolean;
  resolution?: Resolution;
  tasks: Task[];
  onSave: (resolution: Resolution) => void;
  onClose: () => void;
}

const ResolutionModal: React.FC<ResolutionModalProps> = ({
  isOpen,
  resolution,
  tasks,
  onSave,
  onClose
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');
  const [targetYear, setTargetYear] = useState(new Date().getFullYear());
  const [progressMetric, setProgressMetric] = useState<'count' | 'percentage' | 'milestone' | 'binary'>('count');
  const [targetValue, setTargetValue] = useState<number>();
  const [currentValue, setCurrentValue] = useState<number>(0);
  const [color, setColor] = useState('#3498db');
  const [priority, setPriority] = useState(5);
  const [milestones, setMilestones] = useState<ResolutionMilestone[]>([]);
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([]);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneDate, setNewMilestoneDate] = useState('');

  useEffect(() => {
    if (resolution) {
      setTitle(resolution.title);
      setDescription(resolution.description || '');
      setCategory(resolution.category || 'Personal');
      setTargetYear(resolution.targetYear);
      setProgressMetric(resolution.progressMetric);
      setTargetValue(resolution.targetValue);
      setCurrentValue(resolution.currentValue || 0);
      setColor(resolution.color || '#3498db');
      setPriority(resolution.priority || 5);
      setMilestones(resolution.milestones || []);
      setLinkedTaskIds(resolution.linkedTaskIds || []);
    }
  }, [resolution]);

  const handleAddMilestone = () => {
    if (newMilestoneTitle.trim()) {
      const milestone: ResolutionMilestone = {
        id: `milestone-${Date.now()}`,
        title: newMilestoneTitle,
        targetDate: newMilestoneDate || '',
        completed: false
      };
      setMilestones([...milestones, milestone]);
      setNewMilestoneTitle('');
      setNewMilestoneDate('');
    }
  };

  const handleRemoveMilestone = (id: string) => {
    setMilestones(milestones.filter(m => m.id !== id));
  };

  const handleToggleMilestone = (id: string) => {
    setMilestones(milestones.map(m =>
      m.id === id
        ? { ...m, completed: !m.completed, completedAt: !m.completed ? new Date().toISOString() : undefined }
        : m
    ));
  };

  const handleToggleTask = (taskId: string) => {
    setLinkedTaskIds(
      linkedTaskIds.includes(taskId)
        ? linkedTaskIds.filter(id => id !== taskId)
        : [...linkedTaskIds, taskId]
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a resolution title');
      return;
    }

    // Generate a proper UUID v4
    const generateUUID = (): string => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const newResolution: Resolution = {
      id: resolution?.id || generateUUID(),
      title,
      description,
      category,
      targetYear,
      startDate: resolution?.startDate || `${targetYear}-01-01`,
      endDate: resolution?.endDate || `${targetYear}-12-31`,
      progressMetric,
      targetValue,
      currentValue,
      milestones: milestones.length > 0 ? milestones : undefined,
      linkedTaskIds: linkedTaskIds.length > 0 ? linkedTaskIds : undefined,
      priority,
      color,
      status: resolution?.status || 'active',
      createdAt: resolution?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(newResolution);
    onClose();
  };

  const categories = [
    'Personal',
    'Health',
    'Career',
    'Financial',
    'Relationships',
    'Education',
    'Hobbies',
    'Travel'
  ];

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="modal-overlay" onClick={onClose}>
        <div className="resolution-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{resolution ? 'Edit Resolution' : 'New Resolution'}</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body">
            {/* Basic Info */}
            <div className="form-group">
              <label>Resolution Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Run a Marathon, Learn Spanish"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Why is this resolution important to you?"
                className="form-textarea"
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="form-select"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Target Year</label>
                <input
                  type="number"
                  value={targetYear}
                  onChange={e => setTargetYear(parseInt(e.target.value))}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(parseInt(e.target.value))}
                  className="form-select"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Color</label>
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="form-color"
                />
              </div>
            </div>

            {/* Progress Metric */}
            <div className="form-group">
              <label>Progress Metric</label>
              <select
                value={progressMetric}
                onChange={e => setProgressMetric(e.target.value as any)}
                className="form-select"
              >
                <option value="count">Count-based (e.g., 52 weekly walks)</option>
                <option value="percentage">Percentage (0-100%)</option>
                <option value="milestone">Milestone-based</option>
                <option value="binary">Binary (Complete or Not)</option>
              </select>
            </div>

            {progressMetric === 'count' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Target Value</label>
                  <input
                    type="number"
                    value={targetValue || ''}
                    onChange={e => setTargetValue(parseInt(e.target.value) || undefined)}
                    placeholder="e.g., 52"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Current Value</label>
                  <input
                    type="number"
                    value={currentValue}
                    onChange={e => setCurrentValue(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="form-input"
                  />
                </div>
              </div>
            )}

            {progressMetric === 'percentage' && (
              <div className="form-group">
                <label>Current Progress (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={currentValue}
                  onChange={e => setCurrentValue(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="form-input"
                />
              </div>
            )}

            {/* Milestones */}
            {(progressMetric === 'milestone' || progressMetric === 'count') && (
              <div className="form-group">
                <label>Milestones (Optional)</label>
                <div className="milestone-input-group">
                  <input
                    type="text"
                    value={newMilestoneTitle}
                    onChange={e => setNewMilestoneTitle(e.target.value)}
                    placeholder="Milestone title"
                    className="form-input"
                  />
                  <input
                    type="date"
                    value={newMilestoneDate}
                    onChange={e => setNewMilestoneDate(e.target.value)}
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={handleAddMilestone}
                    className="btn-primary"
                  >
                    Add
                  </button>
                </div>

                {milestones.length > 0 && (
                  <div className="milestones-list">
                    {milestones.map(milestone => (
                      <div key={milestone.id} className="milestone-item">
                        <input
                          type="checkbox"
                          checked={milestone.completed}
                          onChange={() => handleToggleMilestone(milestone.id)}
                        />
                        <div className="milestone-info">
                          <span className={milestone.completed ? 'completed' : ''}>
                            {milestone.title}
                          </span>
                          {milestone.targetDate && (
                            <span className="milestone-date">{milestone.targetDate}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(milestone.id)}
                          className="btn-remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Linked Tasks */}
            {tasks.length > 0 && (
              <div className="form-group">
                <label>Link Tasks (Optional)</label>
                <p className="form-help">Select tasks that help you achieve this resolution</p>
                <div className="tasks-checklist">
                  {tasks.map(task => (
                    <label key={task.id} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={linkedTaskIds.includes(task.id)}
                        onChange={() => handleToggleTask(task.id)}
                      />
                      <span>{task.name}</span>
                      {task.category && <span className="task-category">{task.category}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary">
              {resolution ? 'Update' : 'Create'} Resolution
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ResolutionModal;
