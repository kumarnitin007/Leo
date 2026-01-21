import React, { useState, useEffect } from 'react';
import { Resolution, Task } from './types';
import { getTasks, getResolutions, addResolution, updateResolution, deleteResolution } from './storage';
import ResolutionCard from './components/ResolutionCard';
import ResolutionModal from './components/ResolutionModal';
import './styles/ResolutionsView.css';

type FilterTab = 'all' | 'active' | 'completed' | 'paused';

const ResolutionsView: React.FC = () => {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<Resolution | undefined>();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [resData, taskData] = await Promise.all([
        getResolutions(),
        getTasks()
      ]);
      setResolutions(resData);
      setTasks(taskData);
      setError(null);
    } catch (err: any) {
      console.error('Error loading data:', err);
      const errorMsg = err?.message || 'Failed to load resolutions';
      
      // Check if it's a table not found error
      if (errorMsg.includes('myday_resolutions') || errorMsg.includes('400') || err?.status === 400) {
        setError('⚠️ Resolutions table not initialized. Please run the Supabase migration first (see RESOLUTION_IMPLEMENTATION.md)');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedResolution(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (resolution: Resolution) => {
    setSelectedResolution(resolution);
    setIsModalOpen(true);
  };

  const handleSave = async (resolution: Resolution) => {
    try {
      if (selectedResolution) {
        await updateResolution(resolution.id, resolution);
      } else {
        await addResolution(resolution);
      }
      await loadData();
    } catch (err: any) {
      console.error('Error saving resolution:', err);
      const errorMsg = err?.message || 'Failed to save resolution';
      
      // Check if it's a table not found error
      if (errorMsg.includes('myday_resolutions') || errorMsg.includes('400') || err?.status === 400) {
        setError('⚠️ Resolutions table not initialized. Please run the Supabase migration first (check RESOLUTION_IMPLEMENTATION.md)');
      } else {
        setError(errorMsg);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this resolution?')) {
      try {
        await deleteResolution(id);
        await loadData();
      } catch (err) {
        console.error('Error deleting resolution:', err);
        setError('Failed to delete resolution');
      }
    }
  };

  const handleStatusChange = async (id: string, newStatus: Resolution['status']) => {
    try {
      await updateResolution(id, { status: newStatus });
      await loadData();
    } catch (err) {
      console.error('Error updating resolution status:', err);
      setError('Failed to update resolution');
    }
  };

  const getFilteredResolutions = () => {
    switch (filterTab) {
      case 'active':
        return resolutions.filter(r => r.status === 'active');
      case 'completed':
        return resolutions.filter(r => r.status === 'completed');
      case 'paused':
        return resolutions.filter(r => r.status === 'paused');
      default:
        return resolutions;
    }
  };

  const filteredResolutions = getFilteredResolutions();

  const stats = {
    total: resolutions.length,
    active: resolutions.filter(r => r.status === 'active').length,
    completed: resolutions.filter(r => r.status === 'completed').length,
    paused: resolutions.filter(r => r.status === 'paused').length
  };

  const currentYear = new Date().getFullYear();
  const yearResolutions = filteredResolutions.filter(r => r.targetYear === currentYear);

  if (loading) {
    return (
      <div className="resolutions-view">
        <div className="view-header">
          <h2>🎯 Resolutions</h2>
        </div>
        <div className="loading">Loading resolutions...</div>
      </div>
    );
  }

  return (
    <div className="resolutions-view">
      <div className="view-header">
        <h2>🎯 Resolutions & Goals</h2>
        <button onClick={handleCreateNew} className="btn-create-resolution">
          ➕ New Resolution
        </button>
      </div>

      {error && (
        <div className="error-message">{error}</div>
      )}

      {/* Stats Overview */}
      <div className="resolutions-stats">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card active">
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card completed">
          <div className="stat-number">{stats.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card paused">
          <div className="stat-number">{stats.paused}</div>
          <div className="stat-label">Paused</div>
        </div>
      </div>

      {/* Year Selection */}
      {resolutions.length > 0 && (
        <div className="year-info">
          <span className="year-label">
            📅 {currentYear} ({yearResolutions.length} resolutions)
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          All ({resolutions.length})
        </button>
        <button
          className={`filter-tab ${filterTab === 'active' ? 'active' : ''}`}
          onClick={() => setFilterTab('active')}
        >
          Active ({stats.active})
        </button>
        <button
          className={`filter-tab ${filterTab === 'completed' ? 'active' : ''}`}
          onClick={() => setFilterTab('completed')}
        >
          Completed ({stats.completed})
        </button>
        <button
          className={`filter-tab ${filterTab === 'paused' ? 'active' : ''}`}
          onClick={() => setFilterTab('paused')}
        >
          Paused ({stats.paused})
        </button>
      </div>

      {/* Resolutions Grid */}
      {filteredResolutions.length > 0 ? (
        <div className="resolutions-grid">
          {filteredResolutions
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .map(resolution => (
              <ResolutionCard
                key={resolution.id}
                resolution={resolution}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
              />
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <h3>
            {filterTab === 'all'
              ? 'No resolutions yet'
              : `No ${filterTab} resolutions`}
          </h3>
          <p>
            {filterTab === 'all'
              ? "Start your journey by creating your first resolution for " + currentYear
              : "Try filtering to see other resolutions"}
          </p>
          {filterTab === 'all' && (
            <button onClick={handleCreateNew} className="btn-primary">
              Create First Resolution
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      <ResolutionModal
        isOpen={isModalOpen}
        resolution={selectedResolution}
        tasks={tasks}
        onSave={handleSave}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedResolution(undefined);
        }}
      />
    </div>
  );
};

export default ResolutionsView;
