import React from 'react';
import { Resolution } from '../types';
import '../styles/ResolutionCard.css';

interface ResolutionCardProps {
  resolution: Resolution;
  onEdit: (resolution: Resolution) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Resolution['status']) => void;
}

const ResolutionCard: React.FC<ResolutionCardProps> = ({
  resolution,
  onEdit,
  onDelete,
  onStatusChange
}) => {
  const progressPercent = resolution.progressMetric === 'percentage' 
    ? resolution.currentValue || 0
    : resolution.targetValue 
      ? Math.min(100, Math.round(((resolution.currentValue || 0) / resolution.targetValue) * 100))
      : 0;

  const completedMilestones = resolution.milestones?.filter(m => m.completed).length || 0;
  const totalMilestones = resolution.milestones?.length || 0;

  const statusEmoji: Record<Resolution['status'], string> = {
    'active': '🚀',
    'paused': '⏸️',
    'abandoned': '❌',
    'completed': '✅'
  };

  const statusLabel: Record<Resolution['status'], string> = {
    'active': 'Active',
    'paused': 'Paused',
    'abandoned': 'Abandoned',
    'completed': 'Completed'
  };

  return (
    <div className="resolution-card" style={{ borderLeftColor: resolution.color || '#3498db' }}>
      <div className="resolution-header">
        <div className="resolution-title-group">
          <h3 className="resolution-title">{resolution.title}</h3>
          {resolution.category && (
            <span className="resolution-category">{resolution.category}</span>
          )}
        </div>
        <span className="resolution-status" title={statusLabel[resolution.status]}>
          {statusEmoji[resolution.status]}
        </span>
      </div>

      {resolution.description && (
        <p className="resolution-description">{resolution.description}</p>
      )}

      <div className="resolution-meta">
        <span className="resolution-year">🗓️ {resolution.targetYear}</span>
        {resolution.priority && (
          <span className="resolution-priority">
            Priority: {Array(resolution.priority).fill('⭐').join('')}
          </span>
        )}
      </div>

      <div className="resolution-progress">
        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-text">
          {resolution.progressMetric === 'count' && (
            <span>{resolution.currentValue || 0} / {resolution.targetValue || 0}</span>
          )}
          {resolution.progressMetric === 'percentage' && (
            <span>{Math.round(resolution.currentValue || 0)}%</span>
          )}
          {resolution.progressMetric === 'milestone' && (
            <span>{completedMilestones} / {totalMilestones} milestones</span>
          )}
          {resolution.progressMetric === 'binary' && (
            <span>{resolution.status === 'completed' ? 'Completed' : 'In Progress'}</span>
          )}
          <span className="progress-percent">{Math.round(progressPercent)}%</span>
        </div>
      </div>

      {resolution.milestones && resolution.milestones.length > 0 && (
        <div className="resolution-milestones">
          <div className="milestones-label">Milestones:</div>
          <div className="milestones-list">
            {resolution.milestones.map(milestone => (
              <div 
                key={milestone.id} 
                className={`milestone-item ${milestone.completed ? 'completed' : ''}`}
              >
                <span className="milestone-checkbox">
                  {milestone.completed ? '✓' : '○'}
                </span>
                <span className="milestone-title">{milestone.title}</span>
                {milestone.targetDate && (
                  <span className="milestone-date">{milestone.targetDate}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {resolution.linkedTaskIds && resolution.linkedTaskIds.length > 0 && (
        <div className="resolution-linked">
          <span className="linked-label">
            📝 {resolution.linkedTaskIds.length} linked task{resolution.linkedTaskIds.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <div className="resolution-actions">
        <button
          className="action-btn edit-btn"
          onClick={() => onEdit(resolution)}
          title="Edit resolution"
        >
          ✏️ Edit
        </button>
        
        {resolution.status === 'active' ? (
          <>
            <button
              className="action-btn pause-btn"
              onClick={() => onStatusChange(resolution.id, 'paused')}
              title="Pause this resolution"
            >
              ⏸️ Pause
            </button>
            <button
              className="action-btn abandon-btn"
              onClick={() => onStatusChange(resolution.id, 'abandoned')}
              title="Mark as abandoned"
            >
              ❌ Abandon
            </button>
            <button
              className="action-btn complete-btn"
              onClick={() => onStatusChange(resolution.id, 'completed')}
              title="Mark as completed"
            >
              ✅ Complete
            </button>
          </>
        ) : resolution.status === 'paused' ? (
          <>
            <button
              className="action-btn resume-btn"
              onClick={() => onStatusChange(resolution.id, 'active')}
              title="Resume this resolution"
            >
              🚀 Resume
            </button>
            <button
              className="action-btn delete-btn"
              onClick={() => onDelete(resolution.id)}
              title="Delete resolution"
            >
              🗑️ Delete
            </button>
          </>
        ) : (
          <button
            className="action-btn delete-btn"
            onClick={() => onDelete(resolution.id)}
            title="Delete resolution"
          >
            🗑️ Delete
          </button>
        )}
      </div>
    </div>
  );
};

export default ResolutionCard;
