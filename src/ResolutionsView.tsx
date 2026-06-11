import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Resolution, Task } from './types';
import { getTasks, getResolutions, addResolution, updateResolution, deleteResolution } from './storage';
import ResolutionCard from './components/ResolutionCard';
import ResolutionModal from './components/ResolutionModal';
import GenericFilterSidebar, { GenericFilter, FilterSection } from './components/GenericFilterSidebar';
import './styles/ResolutionsView.css';

const FitnessGoalCards = lazy(() => import('./components/FitnessGoalCards'));

type FilterTab = 'all' | 'active' | 'completed' | 'paused' | 'abandoned';

const ResolutionsView: React.FC = () => {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<Resolution | undefined>();
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileFilters, setShowMobileFilters] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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
      case 'abandoned':
        return resolutions.filter(r => r.status === 'abandoned');
      default:
        return resolutions;
    }
  };

  const filteredResolutions = getFilteredResolutions();

  const stats = {
    total: resolutions.length,
    active: resolutions.filter(r => r.status === 'active').length,
    completed: resolutions.filter(r => r.status === 'completed').length,
    paused: resolutions.filter(r => r.status === 'paused').length,
    abandoned: resolutions.filter(r => r.status === 'abandoned').length
  };

  const currentYear = new Date().getFullYear();
  const yearResolutions = filteredResolutions.filter(r => r.targetYear === currentYear);

  if (loading) {
    return (
      <div className="ck-screen resolutions-view">
        <div className="ck-page-head">
          <h2 className="ck-page-title">Goals</h2>
        </div>
        <div style={{ color: 'var(--ck-ink3)', padding: '24px 0' }}>Loading resolutions…</div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total', value: stats.total, badge: '' },
    { label: 'Active', value: stats.active, badge: 'ck-badge-purple' },
    { label: 'Completed', value: stats.completed, badge: 'ck-badge-green' },
    { label: 'Paused', value: stats.paused, badge: 'ck-badge-gold' },
    { label: 'Abandoned', value: stats.abandoned, badge: '' },
  ];

  const activeFilter: GenericFilter = { type: 'status', value: filterTab };
  const filterSections: FilterSection[] = [
    {
      id: 'status',
      title: 'Status',
      defaultExpanded: true,
      items: [
        { filter: { type: 'status', value: 'all' }, icon: '🎯', label: 'All Goals', count: stats.total },
        { filter: { type: 'status', value: 'active' }, icon: '🔥', label: 'Active', count: stats.active, color: '#6b5de8' },
        { filter: { type: 'status', value: 'completed' }, icon: '✅', label: 'Completed', count: stats.completed, color: '#16a34a' },
        { filter: { type: 'status', value: 'paused' }, icon: '⏸️', label: 'Paused', count: stats.paused, color: '#d97706' },
        { filter: { type: 'status', value: 'abandoned' }, icon: '🚫', label: 'Abandoned', count: stats.abandoned, color: '#9a9089' },
      ],
    },
  ];
  const handleFilterChange = (f: GenericFilter) => setFilterTab((f.value as FilterTab) || 'all');

  return (
    <div className="ck-screen resolutions-view">
      <div className="ck-page-head">
        <div>
          <h2 className="ck-page-title">Goals</h2>
          <p className="ck-page-sub">Resolutions & long-term goals</p>
        </div>
        <button onClick={handleCreateNew} className="ck-btn ck-btn-primary">
          + New Resolution
        </button>
      </div>

      {error && (
        <div className="ck-card" style={{ borderLeft: '3px solid var(--ck-red)', color: 'var(--ck-red)', marginBottom: '16px' }}>{error}</div>
      )}

      {/* Tracked Fitness Goals */}
      <Suspense fallback={null}>
        <FitnessGoalCards tasks={tasks} />
      </Suspense>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        {statCards.map(s => (
          <div key={s.label} className="ck-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'var(--ck-serif)', color: 'var(--ck-ink)' }}>{s.value}</div>
            <div className="ck-section-label" style={{ marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main content with sidebar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {isMobile && showMobileFilters ? (
          <GenericFilterSidebar
            title="🎯 Filter Goals"
            sections={filterSections}
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            isMobile
            onFilterSelected={() => setShowMobileFilters(false)}
          />
        ) : (
          <>
            {!isMobile && (
              <GenericFilterSidebar
                sections={filterSections}
                activeFilter={activeFilter}
                onFilterChange={handleFilterChange}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {isMobile && (
                <button
                  className="ck-btn"
                  onClick={() => setShowMobileFilters(true)}
                  style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem' }}
                >
                  ‹ Filters · {filterTab === 'all' ? 'All Goals' : filterTab}
                </button>
              )}

              {/* Year Selection */}
              {resolutions.length > 0 && (
                <div className="ck-section-label" style={{ marginBottom: '12px' }}>
                  📅 {currentYear} · {yearResolutions.length} resolutions
                </div>
              )}

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
                <div className="ck-empty">
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎯</div>
                  <h3 style={{ fontFamily: 'var(--ck-serif)', fontWeight: 500, color: 'var(--ck-ink)', margin: '0 0 6px' }}>
                    {filterTab === 'all' ? 'No resolutions yet' : `No ${filterTab} resolutions`}
                  </h3>
                  <p style={{ margin: '0 0 16px' }}>
                    {filterTab === 'all'
                      ? 'Start your journey by creating your first resolution for ' + currentYear
                      : 'Try filtering to see other resolutions'}
                  </p>
                  {filterTab === 'all' && (
                    <button onClick={handleCreateNew} className="ck-btn ck-btn-primary">
                      Create First Resolution
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
