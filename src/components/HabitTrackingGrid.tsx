/**
 * Habit Tracking Grid Component (GitHub-style)
 * 
 * Visual grid showing daily task completion over time
 * Features:
 * - GitHub-style contribution graph
 * - Color intensity based on completion %
 * - Full year display
 * - User-selectable tasks to track
 * - Hover tooltips with details
 */

import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion } from '../types';
import { getTasks, getTaskHistory } from '../storage';
import { getTodayString } from '../utils';

interface HabitTrackingGridProps {
  daysToShow?: number; // Default: 365 (full year)
}

interface DayData {
  date: string;
  completionRate: number; // 0-100
  completedCount: number;
  totalTasks: number;
  isToday: boolean;
  isFuture: boolean;
}

const HabitTrackingGrid: React.FC<HabitTrackingGridProps> = ({ daysToShow = 365 }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [gridData, setGridData] = useState<DayData[]>([]);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const [showTaskSelector, setShowTaskSelector] = useState(false);

  useEffect(() => {
    const init = async () => {
      await loadTasks();
    };
    init();
  }, []);

  useEffect(() => {
    const calc = async () => {
      if (selectedTaskIds.length > 0) {
        await calculateGridData();
      }
    };
    calc();
  }, [selectedTaskIds, daysToShow]);

  const loadTasks = async () => {
    try {
      const allTasks = await getTasks();
      setTasks(allTasks);
      
      // Auto-select all tasks by default
      if (allTasks.length > 0) {
        setSelectedTaskIds(allTasks.map(t => t.id));
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  };

  const calculateGridData = async () => {
    try {
      const completions = await getTaskHistory();
      const today = getTodayString();
      const data: DayData[] = [];

      // Group completions by date and task
      const completionsByDate = new Map<string, Set<string>>();
      completions.forEach(c => {
        if (selectedTaskIds.includes(c.taskId)) {
          if (!completionsByDate.has(c.date)) {
            completionsByDate.set(c.date, new Set());
          }
          completionsByDate.get(c.date)!.add(c.taskId);
        }
      });

      // Generate data for each day
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = getTodayString(date);
      
      const completedTaskIds = completionsByDate.get(dateStr) || new Set();
      const completedCount = completedTaskIds.size;
      const totalTasks = selectedTaskIds.length;
      const completionRate = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

      data.push({
        date: dateStr,
        completionRate,
        completedCount,
        totalTasks,
        isToday: dateStr === today,
        isFuture: dateStr > today
      });
    }

      setGridData(data);
    } catch (error) {
      console.error('Error calculating grid data:', error);
      setGridData([]);
    }
  };

  const getColorIntensity = (completionRate: number): string => {
    if (completionRate === 0) return '#ebedf0'; // Empty
    if (completionRate <= 25) return '#9be9a8'; // Light green
    if (completionRate <= 50) return '#40c463'; // Medium green
    if (completionRate <= 75) return '#30a14e'; // Dark green
    return '#216e39'; // Darkest green
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectAllTasks = () => {
    setSelectedTaskIds(tasks.map(t => t.id));
  };

  const deselectAllTasks = () => {
    setSelectedTaskIds([]);
  };

  const formatDateForTooltip = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Group days by week
  const weeks: DayData[][] = [];
  let currentWeek: DayData[] = [];
  
  gridData.forEach((day, index) => {
    const date = new Date(day.date + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0 = Sunday

    // Start a new week on Sunday
    if (dayOfWeek === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    currentWeek.push(day);

    // Last day
    if (index === gridData.length - 1) {
      weeks.push(currentWeek);
    }
  });

  // Pad first week with empty days if needed
  if (weeks.length > 0 && weeks[0].length < 7) {
    const firstWeek = weeks[0];
    const firstDate = new Date(firstWeek[0].date + 'T00:00:00');
    const firstDayOfWeek = firstDate.getDay();
    
    for (let i = 0; i < firstDayOfWeek; i++) {
      firstWeek.unshift({
        date: '',
        completionRate: 0,
        completedCount: 0,
        totalTasks: 0,
        isToday: false,
        isFuture: true
      });
    }
  }

  const monthLabels = getMonthLabels();

  function getMonthLabels(): string[] {
    const labels: string[] = [];
    let currentMonth = '';
    
    gridData.forEach((day, index) => {
      if (day.date) {
        const date = new Date(day.date + 'T00:00:00');
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        
        if (monthName !== currentMonth) {
          currentMonth = monthName;
          labels.push(monthName);
        }
      }
    });
    
    return labels;
  }

  const getStats = () => {
    const totalDays = gridData.filter(d => !d.isFuture && d.date).length;
    const perfectDays = gridData.filter(d => d.completionRate === 100 && !d.isFuture).length;
    const activeDays = gridData.filter(d => d.completionRate > 0 && !d.isFuture).length;
    const avgCompletion = totalDays > 0 
      ? Math.round(gridData.reduce((sum, d) => sum + (d.isFuture ? 0 : d.completionRate), 0) / totalDays)
      : 0;

    return { totalDays, perfectDays, activeDays, avgCompletion };
  };

  const stats = getStats();

  if (tasks.length === 0) {
    return (
      <div className="habit-grid-empty">
        <p>No tasks available for tracking. Create some tasks first!</p>
      </div>
    );
  }

  return (
    <div className="habit-tracking-grid">
      <div className="habit-grid-header">
        <div>
          <h3>🟩 Habit Tracking Grid</h3>
          <p>GitHub-style visualization of your task completion over time</p>
        </div>
        <button 
          className="btn-secondary" 
          onClick={() => setShowTaskSelector(!showTaskSelector)}
        >
          {showTaskSelector ? '✓ Done' : '⚙️ Select Tasks'}
        </button>
      </div>

      {/* Task Selector */}
      {showTaskSelector && (
        <div className="task-selector-panel">
          <div className="task-selector-actions">
            <button onClick={selectAllTasks} className="btn-small">Select All</button>
            <button onClick={deselectAllTasks} className="btn-small">Deselect All</button>
            <span className="selected-count">{selectedTaskIds.length} of {tasks.length} selected</span>
          </div>
          <div className="task-selector-list">
            {tasks.map(task => (
              <label key={task.id} className="task-selector-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.includes(task.id)}
                  onChange={() => toggleTaskSelection(task.id)}
                />
                <span>{task.name}</span>
                {task.category && <span className="task-category-badge">{task.category}</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="habit-grid-stats">
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.activeDays}</span>
          <span className="habit-stat-label">Active Days</span>
        </div>
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.perfectDays}</span>
          <span className="habit-stat-label">Perfect Days</span>
        </div>
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.avgCompletion}%</span>
          <span className="habit-stat-label">Avg Completion</span>
        </div>
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.totalDays}</span>
          <span className="habit-stat-label">Total Days</span>
        </div>
      </div>

      {/* Grid */}
      {selectedTaskIds.length === 0 ? (
        <div className="habit-grid-empty">
          <p>Please select at least one task to track</p>
        </div>
      ) : (
        <div className="habit-grid-container">
          <div className="habit-grid">
            <div className="grid-day-labels">
              <div className="day-label">Sun</div>
              <div className="day-label">Mon</div>
              <div className="day-label">Tue</div>
              <div className="day-label">Wed</div>
              <div className="day-label">Thu</div>
              <div className="day-label">Fri</div>
              <div className="day-label">Sat</div>
            </div>
            
            <div className="grid-weeks">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="grid-week">
                  {week.map((day, dayIndex) => (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`grid-day ${day.isToday ? 'today' : ''} ${!day.date ? 'empty' : ''}`}
                      style={{
                        backgroundColor: day.date ? getColorIntensity(day.completionRate) : 'transparent',
                        border: day.isToday ? '2px solid #1f2937' : '1px solid rgba(27, 31, 35, 0.06)'
                      }}
                      onMouseEnter={() => day.date && setHoveredDay(day)}
                      onMouseLeave={() => setHoveredDay(null)}
                      title={day.date ? `${formatDateForTooltip(day.date)}: ${day.completedCount}/${day.totalTasks} (${Math.round(day.completionRate)}%)` : ''}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="habit-grid-legend">
            <span>Less</span>
            <div className="legend-box" style={{ backgroundColor: '#ebedf0' }} />
            <div className="legend-box" style={{ backgroundColor: '#9be9a8' }} />
            <div className="legend-box" style={{ backgroundColor: '#40c463' }} />
            <div className="legend-box" style={{ backgroundColor: '#30a14e' }} />
            <div className="legend-box" style={{ backgroundColor: '#216e39' }} />
            <span>More</span>
          </div>

          {/* Tooltip */}
          {hoveredDay && (
            <div className="habit-tooltip">
              <div className="tooltip-date">{formatDateForTooltip(hoveredDay.date)}</div>
              <div className="tooltip-stats">
                {hoveredDay.completedCount} of {hoveredDay.totalTasks} tasks completed
              </div>
              <div className="tooltip-percentage">{Math.round(hoveredDay.completionRate)}% completion rate</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HabitTrackingGrid;

