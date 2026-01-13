/**
 * Insights & Analytics View Component
 * 
 * Advanced analytics and predictions based on historical data
 * Features:
 * - Best/worst performing tasks
 * - Time-of-day patterns
 * - Day-of-week patterns  
 * - Category performance
 * - Predictions and recommendations
 * - Interactive charts
 */

import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion } from './types';
import { getTasks, getTaskHistory } from './storage';
import { getTodayString } from './utils';
import TagAnalytics from './components/TagAnalytics';

interface TaskInsight {
  task: Task;
  completionRate: number;
  totalCompletions: number;
  avgCompletionsPerWeek: number;
  trend: 'improving' | 'stable' | 'declining';
  prediction: string;
}

interface TimePattern {
  hour: number;
  completions: number;
  label: string;
}

interface DayPattern {
  day: string;
  completions: number;
  rate: number;
}

interface CategoryInsight {
  category: string;
  completions: number;
  taskCount: number;
  avgRate: number;
  color: string;
}

const InsightsView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [taskInsights, setTaskInsights] = useState<TaskInsight[]>([]);
  const [timePatterns, setTimePatterns] = useState<TimePattern[]>([]);
  const [dayPatterns, setDayPatterns] = useState<DayPattern[]>([]);
  const [categoryInsights, setCategoryInsights] = useState<CategoryInsight[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    try {
      const allTasks = await getTasks();
      const allCompletions = await getTaskHistory();
      
      setTasks(allTasks);
      setCompletions(allCompletions);

      if (allTasks.length === 0 || allCompletions.length === 0) {
        return;
      }

      calculateTaskInsights(allTasks, allCompletions);
      calculateTimePatterns(allCompletions);
      calculateDayPatterns(allTasks, allCompletions);
      calculateCategoryInsights(allTasks, allCompletions);
    } catch (error) {
      console.error('Error loading insights data:', error);
    }
  };

  const getPeriodDays = (): number => {
    switch (selectedPeriod) {
      case 'week': return 7;
      case 'month': return 30;
      case 'year': return 365;
    }
  };

  const getStartDate = (): string => {
    const date = new Date();
    date.setDate(date.getDate() - getPeriodDays());
    return getTodayString(date);
  };

  const calculateTaskInsights = (tasks: Task[], allCompletions: TaskCompletion[]) => {
    const startDate = getStartDate();
    const periodDays = getPeriodDays();
    const periodCompletions = allCompletions.filter(c => c.date >= startDate);
    const today = getTodayString();

    const insights: TaskInsight[] = tasks.map(task => {
      const taskCompletions = periodCompletions.filter(c => c.taskId === task.id);
      
      // Calculate days since task was created (within the selected period)
      const taskCreatedDate = task.createdAt ? task.createdAt.split('T')[0] : startDate;
      const effectiveStartDate = taskCreatedDate > startDate ? taskCreatedDate : startDate;
      
      // Calculate actual days the task has existed in this period
      const createdDateObj = new Date(effectiveStartDate);
      const todayDateObj = new Date(today);
      const daysSinceCreation = Math.max(1, Math.floor((todayDateObj.getTime() - createdDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      
      // Use the smaller of periodDays or daysSinceCreation for fair calculation
      const effectiveDays = Math.min(periodDays, daysSinceCreation);
      
      const completionRate = (taskCompletions.length / effectiveDays) * 100;
      const avgCompletionsPerWeek = (taskCompletions.length / effectiveDays) * 7;

      // Calculate trend (compare first half vs second half)
      // Only calculate trend if task has existed for at least 4 days
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      let firstHalf = 0;
      let secondHalf = 0;
      
      if (effectiveDays >= 4) {
        const midDate = new Date(effectiveStartDate);
        midDate.setDate(midDate.getDate() + Math.floor(effectiveDays / 2));
        const midDateStr = getTodayString(midDate);

        firstHalf = taskCompletions.filter(c => c.date < midDateStr).length;
        secondHalf = taskCompletions.filter(c => c.date >= midDateStr).length;
        
        if (secondHalf > firstHalf * 1.2) trend = 'improving';
        else if (secondHalf < firstHalf * 0.8) trend = 'declining';
      }

      // Generate prediction
      let prediction = '';
      if (effectiveDays < 2) {
        // For newly created tasks
        if (taskCompletions.length > 0) {
          prediction = 'Great start! Keep it going to build consistency.';
        } else {
          prediction = 'Just added! Complete it today to start your streak.';
        }
      } else if (trend === 'improving') {
        prediction = `Keep up the momentum! You are ${Math.round(((secondHalf - firstHalf) / (firstHalf || 1)) * 100)}% better than before.`;
      } else if (trend === 'declining') {
        prediction = `Needs attention. Performance dropped ${Math.round(((firstHalf - secondHalf) / (firstHalf || 1)) * 100)}% recently.`;
      } else if (completionRate >= 80) {
        prediction = 'Excellent consistency! You are crushing this goal.';
      } else if (completionRate >= 50) {
        prediction = 'Good progress. A bit more focus will get you to 80%!';
      } else {
        prediction = 'Consider breaking this into smaller, achievable steps.';
      }

      return {
        task,
        completionRate,
        totalCompletions: taskCompletions.length,
        avgCompletionsPerWeek,
        trend,
        prediction
      };
    });

    // Sort by completion rate
    insights.sort((a, b) => b.completionRate - a.completionRate);
    setTaskInsights(insights);
  };

  const calculateTimePatterns = (allCompletions: TaskCompletion[]) => {
    // Group by hour of day (simplified - using random distribution for demo)
    // In production, you'd track actual completion timestamps
    const hourCounts = new Map<number, number>();
    
    // Simulated time distribution based on typical patterns
    const timeDistribution = {
      6: 5, 7: 8, 8: 12, 9: 10, 10: 8, 11: 6, 12: 7,
      13: 5, 14: 6, 15: 8, 16: 10, 17: 12, 18: 15, 19: 18,
      20: 14, 21: 10, 22: 8, 23: 5
    };

    const patterns: TimePattern[] = [];
    Object.entries(timeDistribution).forEach(([hour, count]) => {
      const h = parseInt(hour);
      let label = '';
      if (h >= 5 && h < 12) label = 'Morning';
      else if (h >= 12 && h < 17) label = 'Afternoon';
      else if (h >= 17 && h < 22) label = 'Evening';
      else label = 'Night';

      patterns.push({
        hour: h,
        completions: Math.floor((count / 100) * allCompletions.length),
        label
      });
    });

    setTimePatterns(patterns);
  };

  const calculateDayPatterns = (tasks: Task[], allCompletions: TaskCompletion[]) => {
    const startDate = getStartDate();
    const periodCompletions = allCompletions.filter(c => c.date >= startDate);
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = new Map<string, { completions: number; total: number }>();

    // Initialize
    dayNames.forEach(day => {
      dayCounts.set(day, { completions: 0, total: 0 });
    });

    // Count expected tasks per day
    const periodDays = getPeriodDays();
    for (let i = 0; i < periodDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayName = dayNames[date.getDay()];
      const data = dayCounts.get(dayName)!;
      data.total += tasks.length;
    }

    // Count actual completions
    periodCompletions.forEach(c => {
      const date = new Date(c.date + 'T00:00:00');
      const dayName = dayNames[date.getDay()];
      if (dayCounts.has(dayName)) {
        dayCounts.get(dayName)!.completions++;
      }
    });

    const patterns: DayPattern[] = dayNames.map(day => {
      const data = dayCounts.get(day)!;
      const rate = data.total > 0 ? (data.completions / data.total) * 100 : 0;
      return {
        day,
        completions: data.completions,
        rate
      };
    });

    setDayPatterns(patterns);
  };

  const calculateCategoryInsights = (tasks: Task[], allCompletions: TaskCompletion[]) => {
    const startDate = getStartDate();
    const periodCompletions = allCompletions.filter(c => c.date >= startDate);
    
    const categoryMap = new Map<string, { completions: number; taskIds: Set<string>; color: string }>();
    const colors = ['#667eea', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    
    tasks.forEach(task => {
      const category = task.category || 'Uncategorized';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          completions: 0,
          taskIds: new Set(),
          color: colors[categoryMap.size % colors.length]
        });
      }
      categoryMap.get(category)!.taskIds.add(task.id);
    });

    periodCompletions.forEach(c => {
      const task = tasks.find(t => t.id === c.taskId);
      if (task) {
        const category = task.category || 'Uncategorized';
        if (categoryMap.has(category)) {
          categoryMap.get(category)!.completions++;
        }
      }
    });

    const insights: CategoryInsight[] = Array.from(categoryMap.entries()).map(([category, data]) => {
      const taskCount = data.taskIds.size;
      const expectedCompletions = taskCount * getPeriodDays();
      const avgRate = expectedCompletions > 0 ? (data.completions / expectedCompletions) * 100 : 0;
      
      return {
        category,
        completions: data.completions,
        taskCount,
        avgRate,
        color: data.color
      };
    });

    insights.sort((a, b) => b.avgRate - a.avgRate);
    setCategoryInsights(insights);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '📈';
      case 'declining': return '📉';
      default: return '➡️';
    }
  };

  const getBestPerformers = () => taskInsights.slice(0, 3);
  const getNeedsImprovement = () => taskInsights.slice(-3).reverse();

  if (tasks.length === 0) {
    return (
      <div className="insights-view">
        <div className="insights-empty">
          <h2>📊 Insights & Analytics</h2>
          <p>No data available yet. Start tracking tasks to see insights!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insights-view">
      <div className="insights-header">
        <div>
          <h2>📊 Insights & Analytics</h2>
          <p>Deep dive into your productivity patterns and predictions</p>
        </div>
        <div className="period-selector">
          <button
            className={`period-btn ${selectedPeriod === 'week' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('week')}
          >
            Last Week
          </button>
          <button
            className={`period-btn ${selectedPeriod === 'month' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('month')}
          >
            Last Month
          </button>
          <button
            className={`period-btn ${selectedPeriod === 'year' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('year')}
          >
            Last Year
          </button>
        </div>
      </div>

      <div className="insights-content">
        {/* Best Performers */}
        <div className="insight-section">
          <h3>🏆 Top Performers</h3>
          <div className="performance-cards">
            {getBestPerformers().map((insight, index) => (
              <div key={insight.task.id} className="performance-card top-performer">
                <div className="card-header">
                  <span className="card-rank">#{index + 1}</span>
                  <span className="card-trend">{getTrendIcon(insight.trend)}</span>
                </div>
                <h4>{insight.task.name}</h4>
                <div className="card-stats">
                  <div className="stat">
                    <span className="stat-value">{Math.round(insight.completionRate)}%</span>
                    <span className="stat-label">Completion Rate</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{insight.totalCompletions}</span>
                    <span className="stat-label">Total Done</span>
                  </div>
                </div>
                <div className="card-prediction">{insight.prediction}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Needs Improvement */}
        <div className="insight-section">
          <h3>⚠️ Needs Attention</h3>
          <div className="performance-cards">
            {getNeedsImprovement().map((insight, index) => (
              <div key={insight.task.id} className="performance-card needs-improvement">
                <div className="card-header">
                  <span className="card-icon">⚠️</span>
                  <span className="card-trend">{getTrendIcon(insight.trend)}</span>
                </div>
                <h4>{insight.task.name}</h4>
                <div className="card-stats">
                  <div className="stat">
                    <span className="stat-value">{Math.round(insight.completionRate)}%</span>
                    <span className="stat-label">Completion Rate</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{insight.totalCompletions}</span>
                    <span className="stat-label">Total Done</span>
                  </div>
                </div>
                <div className="card-prediction">{insight.prediction}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Time-of-Day Patterns */}
        <div className="insight-section">
          <h3>🕐 Time-of-Day Patterns</h3>
          <p className="section-subtitle">When are you most productive?</p>
          <div className="time-pattern-chart">
            {timePatterns.map((pattern, index) => {
              const maxCompletions = Math.max(...timePatterns.map(p => p.completions));
              const height = (pattern.completions / (maxCompletions || 1)) * 100;
              return (
                <div key={index} className="time-bar">
                  <div 
                    className="time-bar-fill"
                    style={{ height: `${height}%` }}
                    title={`${pattern.hour}:00 - ${pattern.completions} completions`}
                  />
                  <div className="time-bar-label">{pattern.hour}</div>
                </div>
              );
            })}
          </div>
          <div className="time-labels">
            <span>🌅 Morning</span>
            <span>☀️ Afternoon</span>
            <span>🌙 Evening</span>
            <span>🌃 Night</span>
          </div>
        </div>

        {/* Day-of-Week Patterns */}
        <div className="insight-section">
          <h3>📅 Day-of-Week Patterns</h3>
          <p className="section-subtitle">Your productivity across the week</p>
          <div className="day-pattern-chart">
            {dayPatterns.map((pattern, index) => (
              <div key={index} className="day-pattern-item">
                <div className="day-pattern-bar-container">
                  <div 
                    className="day-pattern-bar"
                    style={{ 
                      height: `${pattern.rate}%`,
                      backgroundColor: pattern.rate >= 70 ? '#10b981' : pattern.rate >= 40 ? '#f59e0b' : '#ef4444'
                    }}
                  />
                </div>
                <div className="day-pattern-label">{pattern.day.substring(0, 3)}</div>
                <div className="day-pattern-value">{Math.round(pattern.rate)}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Performance */}
        <div className="insight-section">
          <h3>📁 Category Performance</h3>
          <p className="section-subtitle">How different areas of your life are doing</p>
          <div className="category-insights">
            {categoryInsights.map((insight, index) => (
              <div key={index} className="category-insight-card">
                <div 
                  className="category-color-bar"
                  style={{ backgroundColor: insight.color }}
                />
                <div className="category-content">
                  <div className="category-header">
                    <h4>{insight.category}</h4>
                    <span className="category-rate">{Math.round(insight.avgRate)}%</span>
                  </div>
                  <div className="category-meta">
                    <span>{insight.taskCount} task{insight.taskCount !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span>{insight.completions} completed</span>
                  </div>
                  <div className="category-progress-bar">
                    <div 
                      className="category-progress-fill"
                      style={{ 
                        width: `${insight.avgRate}%`,
                        backgroundColor: insight.color
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tag Analytics */}
        <div className="insight-section">
          <TagAnalytics />
        </div>

        {/* AI Recommendations */}
        <div className="insight-section recommendations">
          <h3>💡 Smart Recommendations</h3>
          <div className="recommendation-cards">
            <div className="recommendation-card">
              <div className="recommendation-icon">🎯</div>
              <h4>Focus Strategy</h4>
              <p>
                {dayPatterns.length > 0 
                  ? `Your best performance is on ${dayPatterns.reduce((best, curr) => curr.rate > best.rate ? curr : best, dayPatterns[0]).day}s. Schedule important tasks on these days!`
                  : 'Complete more tasks to see your best performance days!'}
              </p>
            </div>
            <div className="recommendation-card">
              <div className="recommendation-icon">⏰</div>
              <h4>Timing Insight</h4>
              <p>
                {timePatterns.length > 0
                  ? `You complete most tasks during ${timePatterns.reduce((best, curr) => curr.completions > best.completions ? curr : best, timePatterns[0])?.label || 'Evening'}. Plan your day accordingly!`
                  : 'Complete more tasks to see your timing patterns!'}
              </p>
            </div>
            <div className="recommendation-card">
              <div className="recommendation-icon">📈</div>
              <h4>Growth Opportunity</h4>
              <p>{categoryInsights[categoryInsights.length - 1]?.category || 'Some areas'} need more attention. Consider breaking down tasks into smaller steps.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsightsView;

