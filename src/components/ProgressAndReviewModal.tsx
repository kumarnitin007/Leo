/**
 * Combined Progress & Review Modal Component
 * 
 * Merges motivational progress tracking with detailed analytics
 * Features:
 * - Quick View: Motivational quotes, streaks, achievements
 * - Detailed Review: Weekly/Monthly analytics, patterns, insights
 */

import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion } from '../types';
import { getTasks, getTaskHistory } from '../storage';
import { getTodayString } from '../utils';

interface ProgressAndReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
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

const MOTIVATIONAL_QUOTES = [
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { quote: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { quote: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" }
];

const ProgressAndReviewModal: React.FC<ProgressAndReviewModalProps> = ({ isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState<'quick' | 'detailed'>('quick');
  const [reviewPeriod, setReviewPeriod] = useState<'week' | 'month'>('week');
  const [stats, setStats] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalCompletions: 0,
    perfectDays: 0,
    last7Days: 0,
    last30Days: 0
  });
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [dailyQuote] = useState(() => {
    const index = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    return MOTIVATIONAL_QUOTES[index];
  });

  useEffect(() => {
    if (isOpen) {
      loadStats();
      if (viewMode === 'detailed') {
        calculateReviewData();
      }
    }
  }, [isOpen, viewMode, reviewPeriod]);

  const loadStats = async () => {
    try {
      const completions = await getTaskHistory();
      
      // Calculate current streak
      const sortedDates = [...new Set(completions.map(c => c.date))].sort().reverse();
      let streak = 0;
      const today = getTodayString();
      
      for (let i = 0; i < sortedDates.length; i++) {
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedDateStr = getTodayString(expectedDate);
        
        if (sortedDates[i] === expectedDateStr) {
          streak++;
        } else {
          break;
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let tempStreak = 0;
      let prevDate: Date | null = null;
      
      sortedDates.forEach(dateStr => {
        const currentDate = new Date(dateStr);
        if (prevDate) {
          const diffDays = Math.floor((prevDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        } else {
          tempStreak = 1;
        }
        prevDate = currentDate;
      });
      longestStreak = Math.max(longestStreak, tempStreak);

      // Calculate perfect days (all tasks completed)
      const tasks = await getTasks();
      const completionsByDate = new Map<string, Set<string>>();
      completions.forEach(c => {
        if (!completionsByDate.has(c.date)) {
          completionsByDate.set(c.date, new Set());
        }
        completionsByDate.get(c.date)!.add(c.taskId);
      });

      let perfectDays = 0;
      completionsByDate.forEach((taskIds, date) => {
        if (taskIds.size >= tasks.length && tasks.length > 0) {
          perfectDays++;
        }
      });

      // Calculate last 7 and 30 days
      const today_date = new Date();
      const last7Date = new Date();
      last7Date.setDate(today_date.getDate() - 7);
      const last30Date = new Date();
      last30Date.setDate(today_date.getDate() - 30);

      const last7DaysCompletions = completions.filter(c => new Date(c.date) >= last7Date).length;
      const last30DaysCompletions = completions.filter(c => new Date(c.date) >= last30Date).length;

      setStats({
        currentStreak: streak,
        longestStreak,
        totalCompletions: completions.length,
        perfectDays,
        last7Days: last7DaysCompletions,
        last30Days: last30DaysCompletions
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const calculateReviewData = async () => {
    try {
      const tasks = await getTasks();
      const completions = await getTaskHistory();
      
      if (tasks.length === 0) {
        return;
      }

      const today = new Date();
      const startDate = new Date();
      if (reviewPeriod === 'week') {
        startDate.setDate(today.getDate() - 7);
      } else {
        startDate.setDate(today.getDate() - 30);
      }

      const startDateStr = getTodayString(startDate);
      const todayStr = getTodayString();

      const periodCompletions = completions.filter(c => 
        c.date >= startDateStr && c.date <= todayStr
      );

      const daysInPeriod = reviewPeriod === 'week' ? 7 : 30;
      const totalTasks = tasks.length * daysInPeriod;
      const completedTasks = periodCompletions.length;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

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
        if (taskIds.size >= tasks.length) {
          perfectDays++;
        }
      });

      // Category breakdown
      const categoryMap = new Map<string, { completed: number; total: number }>();
      tasks.forEach(task => {
        const category = task.category || 'Uncategorized';
        if (!categoryMap.has(category)) {
          categoryMap.set(category, { completed: 0, total: daysInPeriod });
        }
        const completionsForTask = periodCompletions.filter(c => c.taskId === task.id);
        categoryMap.get(category)!.completed += completionsForTask.length;
      });

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        ...data
      }));

      // Top performers and needs attention
      const taskPerformance = tasks.map(task => {
        const taskCompletions = periodCompletions.filter(c => c.taskId === task.id).length;
        const completionRate = (taskCompletions / daysInPeriod) * 100;
        return { task, completionRate };
      });

      const topPerformers = taskPerformance
        .filter(t => t.completionRate >= 70)
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, 5);

      const needsAttention = taskPerformance
        .filter(t => t.completionRate < 50)
        .sort((a, b) => a.completionRate - b.completionRate)
        .slice(0, 5);

      setReviewData({
        totalTasks,
        completedTasks,
        completionRate,
        perfectDays,
        activeDays,
        categoryBreakdown,
        dailyPattern: [],
        topPerformers,
        needsAttention
      });
    } catch (error) {
      console.error('Error calculating review data:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay active" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <h2>{viewMode === 'quick' ? '💪 Your Progress' : '📊 Detailed Review'}</h2>
          <button className="modal-close" onClick={onClose} style={{ color: 'white' }}>×</button>
        </div>

        {/* View Mode Toggle */}
        <div style={{ 
          padding: '1rem', 
          background: '#f9fafb', 
          display: 'flex', 
          gap: '0.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setViewMode('quick')}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'quick' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
              color: viewMode === 'quick' ? 'white' : '#6b7280',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: viewMode === 'quick' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}
          >
            💪 Quick View
          </button>
          <button
            onClick={() => setViewMode('detailed')}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: viewMode === 'detailed' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
              color: viewMode === 'detailed' ? 'white' : '#6b7280',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: viewMode === 'detailed' ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}
          >
            📊 Detailed Analytics
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {viewMode === 'quick' ? (
            /* Quick View - Motivational */
            <div>
              {/* Daily Quote */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                padding: '2rem',
                marginBottom: '2rem',
                color: 'white',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>💫</div>
                <p style={{ fontSize: '1.25rem', fontStyle: 'italic', marginBottom: '1rem', lineHeight: '1.6' }}>
                  "{dailyQuote.quote}"
                </p>
                <p style={{ opacity: 0.9, fontSize: '0.95rem' }}>— {dailyQuote.author}</p>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔥</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{stats.currentStreak}</div>
                  <div style={{ opacity: 0.9 }}>Day Streak</div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{stats.totalCompletions}</div>
                  <div style={{ opacity: 0.9 }}>Total Completions</div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏆</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{stats.longestStreak}</div>
                  <div style={{ opacity: 0.9 }}>Longest Streak</div>
                </div>

                <div style={{
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  color: 'white',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💯</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{stats.perfectDays}</div>
                  <div style={{ opacity: 0.9 }}>Perfect Days</div>
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#1f2937' }}>
                  📈 Recent Activity
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{
                    background: '#f9fafb',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '2px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Last 7 Days</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1f2937' }}>{stats.last7Days}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>tasks completed</div>
                  </div>
                  <div style={{
                    background: '#f9fafb',
                    borderRadius: '8px',
                    padding: '1rem',
                    border: '2px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>Last 30 Days</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1f2937' }}>{stats.last30Days}</div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>tasks completed</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Detailed View - Analytics */
            <div>
              {/* Period Toggle */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setReviewPeriod('week')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: reviewPeriod === 'week' ? '#667eea' : '#f3f4f6',
                    color: reviewPeriod === 'week' ? 'white' : '#6b7280',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setReviewPeriod('month')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: reviewPeriod === 'month' ? '#667eea' : '#f3f4f6',
                    color: reviewPeriod === 'month' ? 'white' : '#6b7280',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Last 30 Days
                </button>
              </div>

              {reviewData && (
                <>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '1rem', border: '2px solid #86efac' }}>
                      <div style={{ fontSize: '0.875rem', color: '#166534', marginBottom: '0.5rem' }}>Completion Rate</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#15803d' }}>
                        {reviewData.completionRate.toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '1rem', border: '2px solid #93c5fd' }}>
                      <div style={{ fontSize: '0.875rem', color: '#1e40af', marginBottom: '0.5rem' }}>Active Days</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e3a8a' }}>
                        {reviewData.activeDays}/{reviewPeriod === 'week' ? 7 : 30}
                      </div>
                    </div>
                    <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '1rem', border: '2px solid #fcd34d' }}>
                      <div style={{ fontSize: '0.875rem', color: '#92400e', marginBottom: '0.5rem' }}>Perfect Days</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#78350f' }}>
                        {reviewData.perfectDays}
                      </div>
                    </div>
                  </div>

                  {/* Top Performers */}
                  {reviewData.topPerformers.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#1f2937' }}>
                        🌟 Top Performers
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reviewData.topPerformers.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
                              borderRadius: '8px',
                              padding: '1rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              border: '2px solid #10b981'
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#1f2937' }}>{item.task.name}</span>
                            <span style={{
                              background: '#10b981',
                              color: 'white',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.875rem',
                              fontWeight: 700
                            }}>
                              {item.completionRate.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Needs Attention */}
                  {reviewData.needsAttention.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: '#1f2937' }}>
                        ⚠️ Needs Attention
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {reviewData.needsAttention.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                              borderRadius: '8px',
                              padding: '1rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              border: '2px solid #f87171'
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#1f2937' }}>{item.task.name}</span>
                            <span style={{
                              background: '#ef4444',
                              color: 'white',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.875rem',
                              fontWeight: 700
                            }}>
                              {item.completionRate.toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressAndReviewModal;

