/**
 * History View Component
 * 
 * Displays progress and statistics with multiple visualization options:
 * - List View: Traditional progress bars
 * - Bar Chart: Vertical bars comparing tasks
 * - Pie Chart: Completion rate distribution
 * - Line Chart: Trend over time
 * 
 * All charts are SVG-based with no external dependencies.
 */

import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion } from './types';
import { loadData } from './storage';
import { formatDate } from './utils';
import HabitTrackingGrid from './components/HabitTrackingGrid';

type ViewMode = 'list' | 'bar' | 'pie' | 'line' | 'grid';

const HistoryView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await loadData();
      setTasks(data.tasks);
      setCompletions(data.completions);
    } catch (error) {
      console.error('Error loading history:', error);
      alert('Error loading history. Please make sure you are signed in.');
    }
  };

  const getTaskCompletions = (taskId: string): TaskCompletion[] => {
    return completions.filter(c => c.taskId === taskId);
  };

  const calculateCompletionRate = (task: Task): number => {
    const last30Days = getLast30Days();
    const taskCompletions = getTaskCompletions(task.id);
    
    const expectedDays = last30Days.filter(date => {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      const dayOfMonth = dateObj.getDate();
      
      switch (task.frequency) {
        case 'daily':
          return true;
        case 'weekly':
          return task.daysOfWeek?.includes(dayOfWeek) || false;
        case 'monthly':
          return task.dayOfMonth === dayOfMonth;
        case 'custom':
          if (task.customFrequency) {
            const monthMatch = task.customFrequency.match(/(\d+)(st|nd|rd|th)\s+of\s+every\s+month/i);
            if (monthMatch) {
              const day = parseInt(monthMatch[1]);
              return dayOfMonth === day;
            }
          }
          return false;
        default:
          return false;
      }
    });

    const completedDays = taskCompletions.filter(c => 
      last30Days.includes(c.date)
    ).length;

    if (expectedDays.length === 0) return 0;
    return Math.round((completedDays / expectedDays.length) * 100);
  };

  const getLast30Days = (): string[] => {
    const days: string[] = [];
    const today = new Date();
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      days.push(formatDate(date));
    }
    
    return days;
  };

  const getRecentCompletions = (task: Task, days: number = 7): { date: string; completed: boolean }[] => {
    const result: { date: string; completed: boolean }[] = [];
    const today = new Date();
    const taskCompletions = getTaskCompletions(task.id);
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      
      const dayOfWeek = date.getDay();
      const dayOfMonth = date.getDate();
      let shouldShow = false;
      
      switch (task.frequency) {
        case 'daily':
          shouldShow = true;
          break;
        case 'weekly':
          shouldShow = task.daysOfWeek?.includes(dayOfWeek) || false;
          break;
        case 'monthly':
          shouldShow = task.dayOfMonth === dayOfMonth;
          break;
        case 'custom':
          if (task.customFrequency) {
            const monthMatch = task.customFrequency.match(/(\d+)(st|nd|rd|th)\s+of\s+every\s+month/i);
            if (monthMatch) {
              const day = parseInt(monthMatch[1]);
              shouldShow = dayOfMonth === day;
            }
          }
          break;
      }
      
      if (shouldShow) {
        const completed = taskCompletions.some(c => c.date === dateStr);
        result.push({ date: dateStr, completed });
      }
    }
    
    return result;
  };

  const getTotalCompletions = (): number => {
    return completions.length;
  };

  const getTaskTimeStats = (taskId: string): { total: number; average: number; count: number } => {
    const taskCompletions = getTaskCompletions(taskId).filter(c => 
      getLast30Days().includes(c.date) && c.durationMinutes
    );
    
    if (taskCompletions.length === 0) {
      return { total: 0, average: 0, count: 0 };
    }
    
    const total = taskCompletions.reduce((sum, c) => sum + (c.durationMinutes || 0), 0);
    const average = Math.round(total / taskCompletions.length);
    
    return { total, average, count: taskCompletions.length };
  };

  const formatDuration = (minutes: number): string => {
    if (minutes === 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  };

  const getOverallCompletionRate = (): number => {
    if (tasks.length === 0) return 0;
    
    const rates = tasks.map(calculateCompletionRate);
    const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    return Math.round(average);
  };

  const getCurrentStreak = (): number => {
    const last30Days = getLast30Days().reverse();
    let streak = 0;
    
    for (const date of last30Days) {
      const tasksForDay = tasks.filter(task => {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay();
        const dayOfMonth = dateObj.getDate();
        
        switch (task.frequency) {
          case 'daily':
            return true;
          case 'weekly':
            return task.daysOfWeek?.includes(dayOfWeek) || false;
          case 'monthly':
            return task.dayOfMonth === dayOfMonth;
          default:
            return false;
        }
      });
      
      if (tasksForDay.length === 0) continue;
      
      const completedForDay = tasksForDay.filter(task => 
        completions.some(c => c.taskId === task.id && c.date === date)
      ).length;
      
      if (completedForDay === tasksForDay.length) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  /**
   * Get daily completion data for line chart
   */
  const getDailyCompletionData = () => {
    const last14Days = [];
    const today = new Date();
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);
      
      const completionsForDay = completions.filter(c => c.date === dateStr).length;
      const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      last14Days.push({ date: dateStr, count: completionsForDay, label });
    }
    
    return last14Days;
  };

  /**
   * Render Bar Chart
   */
  const renderBarChart = () => {
    if (tasks.length === 0) {
      return <p className="no-data-message">No tasks to display in chart view</p>;
    }

    const chartData = tasks.map(task => ({
      name: task.name,
      rate: calculateCompletionRate(task),
      color: task.color || '#667eea'
    })).sort((a, b) => b.rate - a.rate);

    const maxRate = 100;
    const barWidth = 100 / chartData.length - 2;

    return (
      <div className="chart-container">
        <h3 className="chart-title">📊 Completion Rate by Task (Last 30 Days)</h3>
        <div className="bar-chart">
          <svg width="100%" height="400" viewBox="0 0 800 400">
            {/* Y-axis labels */}
            {[0, 25, 50, 75, 100].map((value, idx) => (
              <g key={value}>
                <text x="30" y={350 - (value * 3)} textAnchor="end" fontSize="12" fill="#6b7280">
                  {value}%
                </text>
                <line x1="40" y1={350 - (value * 3)} x2="780" y2={350 - (value * 3)} 
                      stroke="#e5e7eb" strokeWidth="1" />
              </g>
            ))}
            
            {/* Bars */}
            {chartData.map((item, idx) => {
              const x = 60 + (idx * (700 / chartData.length));
              const barHeight = (item.rate / maxRate) * 300;
              const y = 350 - barHeight;
              
              return (
                <g key={idx}>
                  <rect
                    x={x}
                    y={y}
                    width={Math.min(barWidth * 7, 60)}
                    height={barHeight}
                    fill={item.color}
                    opacity="0.8"
                    className="bar-chart-bar"
                  />
                  <text
                    x={x + Math.min(barWidth * 7, 60) / 2}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="bold"
                    fill={item.color}
                  >
                    {item.rate}%
                  </text>
                  <text
                    x={x + Math.min(barWidth * 7, 60) / 2}
                    y={370}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#374151"
                    className="bar-label"
                  >
                    {item.name.length > 12 ? item.name.substring(0, 12) + '...' : item.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  /**
   * Render Pie Chart
   */
  const renderPieChart = () => {
    if (tasks.length === 0) {
      return <p className="no-data-message">No tasks to display in chart view</p>;
    }

    const chartData = tasks.map(task => ({
      name: task.name,
      value: getTaskCompletions(task.id).filter(c => getLast30Days().includes(c.date)).length,
      color: task.color || '#667eea'
    })).filter(item => item.value > 0);

    if (chartData.length === 0) {
      return <p className="no-data-message">No completions to display in pie chart</p>;
    }

    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    let currentAngle = -90; // Start at top

    return (
      <div className="chart-container">
        <h3 className="chart-title">🥧 Completion Distribution (Last 30 Days)</h3>
        <div className="pie-chart-wrapper">
          <svg width="400" height="400" viewBox="0 0 400 400" className="pie-chart">
            <circle cx="200" cy="200" r="150" fill="#f3f4f6" />
            
            {chartData.map((item, idx) => {
              const percentage = (item.value / total) * 100;
              const angle = (item.value / total) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;
              
              // Calculate path for slice
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              
              const x1 = 200 + 150 * Math.cos(startRad);
              const y1 = 200 + 150 * Math.sin(startRad);
              const x2 = 200 + 150 * Math.cos(endRad);
              const y2 = 200 + 150 * Math.sin(endRad);
              
              const largeArc = angle > 180 ? 1 : 0;
              
              const path = `M 200 200 L ${x1} ${y1} A 150 150 0 ${largeArc} 1 ${x2} ${y2} Z`;
              
              currentAngle = endAngle;
              
              return (
                <g key={idx}>
                  <path d={path} fill={item.color} opacity="0.8" className="pie-slice" />
                </g>
              );
            })}
            
            {/* Center circle for donut effect */}
            <circle cx="200" cy="200" r="70" fill="white" />
            <text x="200" y="195" textAnchor="middle" fontSize="20" fontWeight="bold" fill="#1f2937">
              {total}
            </text>
            <text x="200" y="215" textAnchor="middle" fontSize="14" fill="#6b7280">
              Total
            </text>
          </svg>
          
          {/* Legend */}
          <div className="pie-legend">
            {chartData.map((item, idx) => {
              const percentage = ((item.value / total) * 100).toFixed(1);
              return (
                <div key={idx} className="legend-item">
                  <div className="legend-color" style={{ backgroundColor: item.color }}></div>
                  <div className="legend-text">
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-value">{item.value} ({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render Line Chart
   */
  const renderLineChart = () => {
    const data = getDailyCompletionData();
    const maxValue = Math.max(...data.map(d => d.count), 1);
    const points = data.map((d, idx) => {
      const x = 60 + (idx * (700 / (data.length - 1)));
      const y = 350 - ((d.count / maxValue) * 300);
      return { x, y, ...d };
    });

    const pathData = points.map((p, idx) => 
      `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ');

    return (
      <div className="chart-container">
        <h3 className="chart-title">📈 Completion Trend (Last 14 Days)</h3>
        <div className="line-chart">
          <svg width="100%" height="400" viewBox="0 0 800 400">
            {/* Y-axis labels */}
            {[...Array(6)].map((_, idx) => {
              const value = Math.round((maxValue / 5) * idx);
              const y = 350 - ((value / maxValue) * 300);
              return (
                <g key={idx}>
                  <text x="30" y={y + 5} textAnchor="end" fontSize="12" fill="#6b7280">
                    {value}
                  </text>
                  <line x1="40" y1={y} x2="780" y2={y} stroke="#e5e7eb" strokeWidth="1" />
                </g>
              );
            })}
            
            {/* Area under line */}
            <path
              d={`${pathData} L ${points[points.length - 1].x} 350 L 60 350 Z`}
              fill="url(#lineGradient)"
              opacity="0.3"
            />
            
            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke="#667eea"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Data points */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="5" fill="#667eea" className="line-point" />
                <text x={p.x} y={p.y - 15} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#667eea">
                  {p.count}
                </text>
              </g>
            ))}
            
            {/* X-axis labels */}
            {points.filter((_, idx) => idx % 2 === 0).map((p, idx) => (
              <text key={idx} x={p.x} y={375} textAnchor="middle" fontSize="10" fill="#6b7280">
                {p.label}
              </text>
            ))}
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#667eea" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#667eea" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    );
  };

  /**
   * Render List View (original)
   */
  const renderListView = () => {
    return (
      <div className="history-section">
        <h3>Task Performance (Last 30 Days)</h3>
        
        {tasks.length === 0 ? (
          <p className="no-data-message">
            No tasks to show. Add some tasks to start tracking!
          </p>
        ) : (
          tasks.map((task) => {
            const rate = calculateCompletionRate(task);
            const recentCompletions = getRecentCompletions(task);
            
            return (
              <div key={task.id} className="task-history">
                <h4 style={{ '--task-color': task.color } as React.CSSProperties}>
                  {task.name}
                </h4>
                
                <div className="completion-rate">
                  <span style={{ minWidth: '60px', fontWeight: 600, color: '#1f2937' }}>
                    {rate}%
                  </span>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${rate}%`,
                        background: task.color || 'linear-gradient(90deg, #667eea, #764ba2)'
                      }}
                    >
                      {rate > 20 && `${rate}%`}
                    </div>
                  </div>
                  <span style={{ minWidth: '100px', color: '#6b7280', fontSize: '0.875rem' }}>
                    {getTaskCompletions(task.id).filter(c => 
                      getLast30Days().includes(c.date)
                    ).length} completions
                  </span>
                </div>

                {/* Time Statistics */}
                {(() => {
                  const timeStats = getTaskTimeStats(task.id);
                  if (timeStats.count > 0) {
                    return (
                      <div style={{
                        marginTop: '0.75rem',
                        padding: '0.75rem',
                        background: '#f0f9ff',
                        borderRadius: '6px',
                        border: '1px solid #bae6fd'
                      }}>
                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ color: '#0369a1', fontWeight: 600 }}>⏱️ Total time:</span>
                            <span style={{ marginLeft: '0.5rem', color: '#0c4a6e', fontWeight: 600 }}>
                              {formatDuration(timeStats.total)}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: '#0369a1', fontWeight: 600 }}>📊 Average:</span>
                            <span style={{ marginLeft: '0.5rem', color: '#0c4a6e', fontWeight: 600 }}>
                              {formatDuration(timeStats.average)}
                            </span>
                          </div>
                          <div style={{ color: '#075985', fontSize: '0.8rem', opacity: 0.8 }}>
                            ({timeStats.count} tracked sessions)
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {recentCompletions.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      Last 7 scheduled days:
                    </div>
                    <div className="recent-completions">
                      {recentCompletions.map((item, index) => (
                        <div
                          key={index}
                          className={`completion-dot ${item.completed ? 'completed' : 'missed'}`}
                          title={`${item.date}: ${item.completed ? 'Completed' : 'Missed'}`}
                        >
                          {item.completed ? '✓' : '○'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  return (
    <div className="history-view">
      <div className="view-header">
        <h2>Progress & History</h2>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{getTotalCompletions()}</div>
          <div className="stat-label">Total Completions</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{getOverallCompletionRate()}%</div>
          <div className="stat-label">Overall Rate (30 days)</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{getCurrentStreak()}</div>
          <div className="stat-label">Current Streak (days)</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-value">{tasks.length}</div>
          <div className="stat-label">Active Tasks</div>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="view-mode-selector">
        <button
          className={`view-mode-button ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
          title="List View"
        >
          <span className="view-icon">📋</span>
          <span className="view-label">List</span>
        </button>
        <button
          className={`view-mode-button ${viewMode === 'bar' ? 'active' : ''}`}
          onClick={() => setViewMode('bar')}
          title="Bar Chart"
        >
          <span className="view-icon">📊</span>
          <span className="view-label">Bar Chart</span>
        </button>
        <button
          className={`view-mode-button ${viewMode === 'pie' ? 'active' : ''}`}
          onClick={() => setViewMode('pie')}
          title="Pie Chart"
        >
          <span className="view-icon">🥧</span>
          <span className="view-label">Pie Chart</span>
        </button>
        <button
          className={`view-mode-button ${viewMode === 'line' ? 'active' : ''}`}
          onClick={() => setViewMode('line')}
          title="Line Chart"
        >
          <span className="view-icon">📈</span>
          <span className="view-label">Trend</span>
        </button>
        <button
          className={`view-mode-button ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => setViewMode('grid')}
          title="Habit Grid"
        >
          <span className="view-icon">🟩</span>
          <span className="view-label">Habit Grid</span>
        </button>
      </div>

      {/* Render selected view */}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'bar' && renderBarChart()}
      {viewMode === 'pie' && renderPieChart()}
      {viewMode === 'line' && renderLineChart()}
      {viewMode === 'grid' && <HabitTrackingGrid />}
    </div>
  );
};

export default HistoryView;
