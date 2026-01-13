/**
 * Motivational Section Component
 * 
 * Displays on Today dashboard to keep users motivated
 * Features:
 * - Daily inspirational quotes
 * - Achievements and badges
 * - Personal bests and streaks
 * - Progress highlights
 */

import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion } from '../types';
import { getTasks, getTaskHistory } from '../storage';
import { getTodayString } from '../utils';

interface MotivationalSectionProps {
  collapsed?: boolean;
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
  { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { quote: "Your limitation—it's only your imagination.", author: "Unknown" },
  { quote: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { quote: "Great things never come from comfort zones.", author: "Unknown" },
  { quote: "Dream it. Wish it. Do it.", author: "Unknown" },
  { quote: "Success doesn't just find you. You have to go out and get it.", author: "Unknown" },
  { quote: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { quote: "Don't stop when you're tired. Stop when you're done.", author: "Unknown" },
  { quote: "Wake up with determination. Go to bed with satisfaction.", author: "Unknown" },
  { quote: "Do something today that your future self will thank you for.", author: "Sean Patrick Flanery" },
  { quote: "Little things make big days.", author: "Unknown" }
];

const MotivationalSection: React.FC<MotivationalSectionProps> = ({ collapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [stats, setStats] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalCompletions: 0,
    perfectDays: 0,
    completionRate: 0,
    badges: [] as string[]
  });

  useEffect(() => {
    calculateStats();
  }, []);

  const calculateStats = async () => {
    try {
      const tasks = await getTasks();
      const completions = await getTaskHistory();
      
      if (tasks.length === 0 || completions.length === 0) {
        return;
      }

    // Calculate streaks
    const { currentStreak, longestStreak, perfectDays } = calculateStreaks(tasks, completions);
    
    // Total completions
    const totalCompletions = completions.length;
    
    // Completion rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = getTodayString(thirtyDaysAgo);
    
    const recentCompletions = completions.filter(c => c.completedAt >= thirtyDaysAgoStr);
    const expectedCompletions = tasks.length * 30; // Simple approximation
    const completionRate = expectedCompletions > 0 
      ? Math.round((recentCompletions.length / expectedCompletions) * 100)
      : 0;
    
    // Calculate badges
    const badges = calculateBadges(currentStreak, longestStreak, totalCompletions, perfectDays);
    
    setStats({
      currentStreak,
      longestStreak,
      totalCompletions,
      perfectDays,
      completionRate,
      badges
    });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  };

  const calculateStreaks = (tasks: Task[], completions: TaskCompletion[]) => {
    // Group completions by date
    const completionsByDate = new Map<string, Set<string>>();
    completions.forEach(c => {
      const date = c.completedAt;
      if (!completionsByDate.has(date)) {
        completionsByDate.set(date, new Set());
      }
      completionsByDate.get(date)!.add(c.taskId);
    });

    // Sort dates
    const dates = Array.from(completionsByDate.keys()).sort();
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let perfectDays = 0;
    
    const today = getTodayString();
    
    // Calculate streaks backwards from today
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = getTodayString(checkDate);
      
      const completedTaskIds = completionsByDate.get(dateStr);
      
      if (completedTaskIds && completedTaskIds.size > 0) {
        tempStreak++;
        
        // Check if it's a perfect day (all tasks completed)
        const tasksForDay = tasks.filter(t => {
          // Simple check - in real app, check if task was due that day
          return true;
        });
        
        if (completedTaskIds.size >= tasksForDay.length && tasksForDay.length > 0) {
          perfectDays++;
        }
        
        if (i === 0 || tempStreak === currentStreak + 1) {
          currentStreak = tempStreak;
        }
        
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (i === 0) {
          // Today has no completions yet, check yesterday
          continue;
        } else {
          // Streak broken
          tempStreak = 0;
        }
      }
    }
    
    return { currentStreak, longestStreak, perfectDays };
  };

  const calculateBadges = (
    currentStreak: number, 
    longestStreak: number, 
    totalCompletions: number,
    perfectDays: number
  ): string[] => {
    const badges: string[] = [];
    
    // Streak badges
    if (currentStreak >= 7) badges.push('🔥 Week Warrior');
    if (currentStreak >= 30) badges.push('💪 Month Master');
    if (currentStreak >= 100) badges.push('👑 Century Champion');
    if (longestStreak >= 365) badges.push('🏆 Year Legend');
    
    // Completion badges
    if (totalCompletions >= 10) badges.push('⭐ Getting Started');
    if (totalCompletions >= 50) badges.push('🌟 Task Crusher');
    if (totalCompletions >= 100) badges.push('💫 Productivity Star');
    if (totalCompletions >= 500) badges.push('🎯 Goal Master');
    if (totalCompletions >= 1000) badges.push('🚀 Ultimate Achiever');
    
    // Perfect day badges
    if (perfectDays >= 1) badges.push('✨ First Perfect Day');
    if (perfectDays >= 7) badges.push('🌈 Perfect Week');
    if (perfectDays >= 30) badges.push('🎨 Perfect Month');
    
    return badges;
  };

  const getDailyQuote = () => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const quoteIndex = dayOfYear % MOTIVATIONAL_QUOTES.length;
    return MOTIVATIONAL_QUOTES[quoteIndex];
  };

  const quote = getDailyQuote();

  if (isCollapsed) {
    return (
      <div className="motivational-section collapsed" onClick={() => setIsCollapsed(false)}>
        <span className="motivational-icon">💪</span>
        <span className="motivational-text">Your progress</span>
        <span className="expand-icon">▼</span>
      </div>
    );
  }

  return (
    <div className="motivational-section">
      <div className="motivational-header">
        <h3>💪 Your Motivation Hub</h3>
        <button className="collapse-btn" onClick={() => setIsCollapsed(true)}>
          ▲ Collapse
        </button>
      </div>

      {/* Daily Quote */}
      <div className="daily-quote">
        <div className="quote-icon">💭</div>
        <div className="quote-content">
          <p className="quote-text">"{quote.quote}"</p>
          <p className="quote-author">— {quote.author}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="motivation-stats">
        <div className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🏆</div>
          <div className="stat-value">{stats.longestStreak}</div>
          <div className="stat-label">Longest Streak</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-value">{stats.totalCompletions}</div>
          <div className="stat-label">Total Completed</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-value">{stats.perfectDays}</div>
          <div className="stat-label">Perfect Days</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-value">{stats.completionRate}%</div>
          <div className="stat-label">30-Day Rate</div>
        </div>
      </div>

      {/* Badges */}
      {stats.badges.length > 0 && (
        <div className="badges-section">
          <h4>🎖️ Your Achievements</h4>
          <div className="badges-grid">
            {stats.badges.map((badge, index) => (
              <div key={index} className="badge">
                {badge}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Motivational Message */}
      <div className="motivational-message">
        {stats.currentStreak === 0 ? (
          <p>🌱 <strong>Start your streak today!</strong> Every journey begins with a single step.</p>
        ) : stats.currentStreak < 7 ? (
          <p>🔥 <strong>Keep it up!</strong> You're building momentum. {7 - stats.currentStreak} more days to unlock Week Warrior!</p>
        ) : stats.currentStreak < 30 ? (
          <p>💪 <strong>You're on fire!</strong> {30 - stats.currentStreak} more days to become a Month Master!</p>
        ) : (
          <p>👑 <strong>Incredible!</strong> You're a true champion. Keep crushing those goals!</p>
        )}
      </div>
    </div>
  );
};

export default MotivationalSection;

