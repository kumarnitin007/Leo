/**
 * Weekly/Monthly Review Overlay Component
 * 
 * Displays performance review with insights
 * Features:
 * - Weekly and Monthly views
 * - Completion rate metrics
 * - Time patterns analysis
 * - Visual charts
 * - Category breakdown
 */

import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion } from '../types';
import { getTasks, getTaskHistory } from '../storage';
import { getTodayString } from '../utils';
import Portal from './Portal';

interface ReviewOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  period?: 'week' | 'month';
}

interface ReviewData {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  perfectDays: number;
  activeDays: number;
  categoryBreakdown: { category: string; completed: number; total: number }[];
  dailyPattern: { day: string; completed: number; total: number }[];
  topPerformers: { task: Task; completionRate: number }[];
  needsAttention: { task: Task; completionRate: number }[];
}

const ReviewOverlay: React.FC<ReviewOverlayProps> = ({ isOpen, onClose, period = 'week' }) => {
  const [currentPeriod, setCurrentPeriod] = useState<'week' | 'month'>(period);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);

  useEffect(() => {
    if (isOpen) {
      calculateReviewData();
    }
  }, [isOpen, currentPeriod]);

  const calculateReviewData = async () => {
    try {
      const tasks = await getTasks();
      const completions = await getTaskHistory();
      
      if (tasks.length === 0) {
        return;
      }

    // Determine date range
    const today = new Date();
    const startDate = new Date();
    if (currentPeriod === 'week') {
      startDate.setDate(today.getDate() - 7);
    } else {
      startDate.setDate(today.getDate() - 30);
    }

    const startDateStr = getTodayString(startDate);
    const todayStr = getTodayString();

    // Filter completions for period
    const periodCompletions = completions.filter(c => 
      c.date >= startDateStr && c.date <= todayStr
    );

    // Calculate total expected completions (simplified)
    const daysInPeriod = currentPeriod === 'week' ? 7 : 30;
    const totalTasks = tasks.length * daysInPeriod;
    const completedTasks = periodCompletions.length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Calculate perfect days and active days
    const completionsByDate = new Map<string, Set<string>>();
    periodCompletions.forEach(c => {
      if (!completionsByDate.has(c.date)) {
        completionsByDate.set(c.date, new Set());
      }
      completionsByDate.get(c.date)!.add(c.taskId);
    });

    let perfectDays = 0;
    let activeDays = completionsByDate.size;

    completionsByDate.forEach((taskIds) => {
      if (taskIds.size === tasks.length) {
        perfectDays++;
      }
    });

    // Category breakdown
    const categoryMap = new Map<string, { completed: number; total: number }>();
    tasks.forEach(task => {
      const category = task.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { completed: 0, total: daysInPeriod });
      } else {
        categoryMap.get(category)!.total += daysInPeriod;
      }
    });

    periodCompletions.forEach(c => {
      const task = tasks.find(t => t.id === c.taskId);
      if (task) {
        const category = task.category || 'Uncategorized';
        if (categoryMap.has(category)) {
          categoryMap.get(category)!.completed++;
        }
      }
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      completed: data.completed,
      total: data.total
    }));

    // Daily pattern (day of week)
    const dayPattern = new Map<string, { completed: number; total: number }>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let i = 0; i < daysInPeriod; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dayName = dayNames[checkDate.getDay()];
      
      if (!dayPattern.has(dayName)) {
        dayPattern.set(dayName, { completed: 0, total: 0 });
      }
      dayPattern.get(dayName)!.total += tasks.length;
      
      const dateStr = getTodayString(checkDate);
      const dayCompletions = periodCompletions.filter(c => c.date === dateStr);
      dayPattern.get(dayName)!.completed += dayCompletions.length;
    }

    const dailyPattern = Array.from(dayPattern.entries()).map(([day, data]) => ({
      day,
      completed: data.completed,
      total: data.total
    }));

    // Top performers and needs attention
    const taskPerformance = tasks.map(task => {
      const taskCompletions = periodCompletions.filter(c => c.taskId === task.id).length;
      const rate = (taskCompletions / daysInPeriod) * 100;
      return { task, completionRate: rate };
    });

    taskPerformance.sort((a, b) => b.completionRate - a.completionRate);
    const topPerformers = taskPerformance.slice(0, 3);
    const needsAttention = taskPerformance.slice(-3).reverse();

    setReviewData({
      totalTasks,
      completedTasks,
      completionRate,
      perfectDays,
      activeDays,
      categoryBreakdown,
      dailyPattern,
      topPerformers,
      needsAttention
    });
    } catch (error) {
      console.error('Error calculating review data:', error);
      setReviewData(null);
    }
  };

  const getPeriodLabel = () => {
    return currentPeriod === 'week' ? 'Weekly' : 'Monthly';
  };

  const getPeriodEmoji = () => {
    return currentPeriod === 'week' ? '📅' : '🗓️';
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="review-overlay-backdrop" onClick={onClose}>
        <div className="review-overlay-content" onClick={(e) => e.stopPropagation()}>
          <div className="review-overlay-header">
            <h2>{getPeriodEmoji()} {getPeriodLabel()} Performance Review</h2>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="review-period-selector">
            <button
              className={`period-btn ${currentPeriod === 'week' ? 'active' : ''}`}
              onClick={() => setCurrentPeriod('week')}
            >
              📅 Last 7 Days
            </button>
            <button
              className={`period-btn ${currentPeriod === 'month' ? 'active' : ''}`}
              onClick={() => setCurrentPeriod('month')}
            >
              🗓️ Last 30 Days
            </button>
          </div>

          {!reviewData ? (
            <div className="review-loading">
              <p>Loading your review...</p>
            </div>
          ) : (
            <div className="review-content">
              {/* Key Metrics */}
              <div className="review-metrics">
                <div className="review-metric-card">
                  <div className="metric-icon">✅</div>
                  <div className="metric-value">{Math.round(reviewData.completionRate)}%</div>
                  <div className="metric-label">Completion Rate</div>
                </div>
                <div className="review-metric-card">
                  <div className="metric-icon">⭐</div>
                  <div className="metric-value">{reviewData.perfectDays}</div>
                  <div className="metric-label">Perfect Days</div>
                </div>
                <div className="review-metric-card">
                  <div className="metric-icon">📈</div>
                  <div className="metric-value">{reviewData.activeDays}</div>
                  <div className="metric-label">Active Days</div>
                </div>
                <div className="review-metric-card">
                  <div className="metric-icon">🎯</div>
                  <div className="metric-value">{reviewData.completedTasks}</div>
                  <div className="metric-label">Tasks Completed</div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="review-section">
                <h3>📊 Category Breakdown</h3>
                <div className="category-bars">
                  {reviewData.categoryBreakdown.map((cat, index) => {
                    const rate = cat.total > 0 ? (cat.completed / cat.total) * 100 : 0;
                    return (
                      <div key={index} className="category-bar-item">
                        <div className="category-bar-label">
                          <span className="category-name">{cat.category}</span>
                          <span className="category-percentage">{Math.round(rate)}%</span>
                        </div>
                        <div className="category-bar-track">
                          <div 
                            className="category-bar-fill"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day of Week Pattern */}
              <div className="review-section">
                <h3>📆 Daily Patterns</h3>
                <div className="daily-pattern-chart">
                  {reviewData.dailyPattern.map((day, index) => {
                    const rate = day.total > 0 ? (day.completed / day.total) * 100 : 0;
                    return (
                      <div key={index} className="daily-pattern-item">
                        <div className="pattern-bar" style={{ height: `${rate}%` }} />
                        <div className="pattern-label">{day.day.substring(0, 3)}</div>
                        <div className="pattern-value">{Math.round(rate)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top Performers */}
              <div className="review-section">
                <h3>🏆 Top Performers</h3>
                <div className="task-performance-list">
                  {reviewData.topPerformers.map((item, index) => (
                    <div key={index} className="performance-item top">
                      <span className="performance-rank">#{index + 1}</span>
                      <span className="performance-name">{item.task.name}</span>
                      <span className="performance-rate">{Math.round(item.completionRate)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Needs Attention */}
              <div className="review-section">
                <h3>⚠️ Needs Attention</h3>
                <div className="task-performance-list">
                  {reviewData.needsAttention.map((item, index) => (
                    <div key={index} className="performance-item needs-attention">
                      <span className="performance-icon">⚠️</span>
                      <span className="performance-name">{item.task.name}</span>
                      <span className="performance-rate">{Math.round(item.completionRate)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary Message */}
              <div className="review-summary">
                {reviewData.completionRate >= 80 ? (
                  <p>🌟 <strong>Outstanding!</strong> You're crushing your goals! Keep up the amazing work!</p>
                ) : reviewData.completionRate >= 60 ? (
                  <p>💪 <strong>Great progress!</strong> You're doing well. A little more consistency and you'll hit 80%!</p>
                ) : reviewData.completionRate >= 40 ? (
                  <p>📈 <strong>Good effort!</strong> There's room for improvement. Focus on building consistent habits!</p>
                ) : (
                  <p>🌱 <strong>Let's improve!</strong> Small steps lead to big changes. Focus on one task at a time!</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default ReviewOverlay;

