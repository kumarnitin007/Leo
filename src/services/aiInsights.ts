/**
 * AI Insights Service
 * 
 * Analyzes task completion patterns and generates smart recommendations
 * for improving user success rates and preventing burnout.
 */

import { Task, TaskCompletion } from '../types';
import { loadData } from '../storage';
import { formatDate } from '../utils';

export interface TaskInsight {
  taskId: string;
  taskName: string;
  issue: 'low_completion' | 'high_spillover' | 'time_mismatch';
  currentMetrics: {
    completionRate: number;
    weeksAnalyzed: number;
    attemptedCount: number;
    completedCount: number;
    targetFrequency: number; // Expected completions per week
  };
  recommendations: Recommendation[];
}

export interface Recommendation {
  type: 'reduce_frequency' | 'change_time' | 'change_days' | 'pause';
  confidence: number; // 0-100
  reason: string;
  suggestedValue: any;
  expectedImprovement: string;
  actionLabel: string; // Button text
}

/**
 * Get tasks that are underperforming and need attention
 */
export const getUnderperformingTasks = async (): Promise<TaskInsight[]> => {
  try {
    const data = await loadData();
    const insights: TaskInsight[] = [];
    
    // Analyze each task
    for (const task of data.tasks) {
      const insight = analyzeTaskPerformance(task, data.completions);
      if (insight) {
        insights.push(insight);
      }
    }
    
    // Sort by severity (lowest completion rate first)
    return insights.sort((a, b) => a.currentMetrics.completionRate - b.currentMetrics.completionRate);
  } catch (error: any) {
    // Silently ignore authentication errors (user not signed in yet)
    if (!error?.message?.includes('User must be signed in')) {
      console.error('Error getting underperforming tasks:', error);
    }
    return [];
  }
};

/**
 * Analyze a specific task's performance over the last 3+ weeks
 */
const analyzeTaskPerformance = (task: Task, allCompletions: TaskCompletion[]): TaskInsight | null => {
  const weeksToAnalyze = 3;
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeksToAnalyze * 7));
  
  // Get completions for this task in the analysis period
  const taskCompletions = allCompletions.filter(c => {
    return c.taskId === task.id && c.date >= formatDate(startDate);
  });
  
  // Calculate expected completions based on frequency
  const targetFrequency = calculateWeeklyFrequency(task);
  const expectedCompletions = targetFrequency * weeksToAnalyze;
  
  // Need at least 1 week of data and some expected completions
  if (expectedCompletions < 1) {
    return null;
  }
  
  const completedCount = taskCompletions.length;
  const completionRate = Math.round((completedCount / expectedCompletions) * 100);
  
  // Only flag tasks with low completion (<40%) as underperforming
  if (completionRate >= 40) {
    return null;
  }
  
  // Generate recommendations
  const recommendations = generateRecommendations(task, completionRate, completedCount, expectedCompletions);
  
  if (recommendations.length === 0) {
    return null;
  }
  
  return {
    taskId: task.id,
    taskName: task.name,
    issue: 'low_completion',
    currentMetrics: {
      completionRate,
      weeksAnalyzed: weeksToAnalyze,
      attemptedCount: expectedCompletions,
      completedCount,
      targetFrequency
    },
    recommendations
  };
};

/**
 * Calculate how many times per week a task should be completed
 */
const calculateWeeklyFrequency = (task: Task): number => {
  switch (task.frequency) {
    case 'daily':
      return 7;
    case 'weekly':
      return task.daysOfWeek?.length || 1;
    case 'monthly':
      return 0.25; // ~1 per month
    case 'count-based':
      if (task.frequencyPeriod === 'week') {
        return task.frequencyCount || 1;
      } else {
        return (task.frequencyCount || 1) / 4; // Monthly spread over weeks
      }
    case 'custom':
      // Try to parse custom frequency
      if (task.customFrequency?.includes('month')) {
        return 0.25;
      }
      return 1; // Default weekly
    default:
      return 1;
  }
};

/**
 * Generate recommendations based on task performance
 */
const generateRecommendations = (
  task: Task,
  completionRate: number,
  completedCount: number,
  expectedCompletions: number
): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  
  // Recommendation 1: Reduce Frequency
  // If completing <40%, suggest reducing frequency
  if (completionRate < 40 && task.frequency !== 'monthly') {
    const currentFrequency = calculateWeeklyFrequency(task);
    const suggestedFrequency = Math.max(1, Math.ceil(currentFrequency * 0.5)); // 50% reduction
    
    // Calculate what their completion rate would be at lower frequency
    const projectedRate = Math.min(95, Math.round((completedCount / (suggestedFrequency * 3)) * 100));
    
    recommendations.push({
      type: 'reduce_frequency',
      confidence: 85,
      reason: `You completed ${completedCount} of ${expectedCompletions} times (${completionRate}%). A lower frequency may help you maintain consistency.`,
      suggestedValue: getSuggestedFrequencyValue(task, suggestedFrequency),
      expectedImprovement: `${projectedRate}% completion rate at reduced frequency`,
      actionLabel: getFrequencyLabel(task, suggestedFrequency)
    });
  }
  
  // Recommendation 2: Change Days (for weekly tasks)
  if (task.frequency === 'weekly' && completionRate < 40) {
    recommendations.push({
      type: 'change_days',
      confidence: 70,
      reason: `Current schedule may not align with your routine. Try different days.`,
      suggestedValue: getBestDaysForUser(), // Will implement pattern detection later
      expectedImprovement: `Better alignment with your schedule`,
      actionLabel: 'Try suggested days'
    });
  }
  
  // Recommendation 3: Pause Task (if really struggling)
  if (completionRate < 20 && completedCount < 2) {
    recommendations.push({
      type: 'pause',
      confidence: 60,
      reason: `You've completed this very rarely. Consider pausing to reduce overwhelm.`,
      suggestedValue: true,
      expectedImprovement: `Reduce stress and focus on tasks you can complete`,
      actionLabel: 'Pause for 2 weeks'
    });
  }
  
  return recommendations;
};

/**
 * Get suggested frequency value based on task type
 */
const getSuggestedFrequencyValue = (task: Task, targetWeeklyFrequency: number): any => {
  if (task.frequency === 'daily' && targetWeeklyFrequency < 7) {
    // Convert daily to weekly with specific days
    return {
      frequency: 'weekly',
      daysOfWeek: getDefaultDays(targetWeeklyFrequency)
    };
  }
  
  if (task.frequency === 'weekly') {
    // Reduce number of days
    return {
      frequency: 'weekly',
      daysOfWeek: getDefaultDays(targetWeeklyFrequency)
    };
  }
  
  if (task.frequency === 'count-based') {
    return {
      frequency: 'count-based',
      frequencyCount: Math.max(1, targetWeeklyFrequency),
      frequencyPeriod: 'week'
    };
  }
  
  return null;
};

/**
 * Get default days for a given frequency
 */
const getDefaultDays = (count: number): number[] => {
  // Common patterns
  const patterns: { [key: number]: number[] } = {
    1: [1], // Monday
    2: [1, 4], // Mon, Thu
    3: [1, 3, 5], // Mon, Wed, Fri
    4: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    5: [1, 2, 3, 4, 5], // Weekdays
    6: [1, 2, 3, 4, 5, 6] // All except Sunday
  };
  
  return patterns[count] || [1];
};

/**
 * Get best days for user (placeholder for future pattern detection)
 */
const getBestDaysForUser = (): number[] => {
  // TODO: Analyze user's completion history to find their best days
  // For now, return common productive days
  return [2, 4]; // Tuesday, Thursday
};

/**
 * Get human-readable frequency label
 */
const getFrequencyLabel = (task: Task, weeklyFrequency: number): string => {
  if (weeklyFrequency >= 7) {
    return 'Keep Daily';
  } else if (weeklyFrequency >= 5) {
    return 'Reduce to Weekdays';
  } else if (weeklyFrequency === 3) {
    return 'Reduce to 3x/week';
  } else if (weeklyFrequency === 2) {
    return 'Reduce to 2x/week';
  } else {
    return 'Reduce to 1x/week';
  }
};

/**
 * Apply a recommendation to a task
 */
export const applyRecommendation = async (taskId: string, recommendation: Recommendation): Promise<boolean> => {
  try {
    const data = await loadData();
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      return false;
    }
    
    const task = data.tasks[taskIndex];
    
    // Apply the recommendation based on type
    switch (recommendation.type) {
      case 'reduce_frequency':
        if (recommendation.suggestedValue) {
          Object.assign(task, recommendation.suggestedValue);
        }
        break;
        
      case 'change_days':
        if (recommendation.suggestedValue) {
          task.frequency = 'weekly';
          task.daysOfWeek = recommendation.suggestedValue;
        }
        break;
        
      case 'pause':
        // Mark task as paused (we can add a paused field later)
        // For now, we'll just set end date to 2 weeks from now
        const pauseEnd = new Date();
        pauseEnd.setDate(pauseEnd.getDate() + 14);
        task.endDate = formatDate(pauseEnd);
        break;
    }
    
    // Save changes
    localStorage.setItem('myDayApp', JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error applying recommendation:', error);
    return false;
  }
};

/**
 * Dismiss an insight (user doesn't want to see it again for a while)
 */
export const dismissInsight = (taskId: string): void => {
  const dismissedKey = 'myDayApp_dismissedInsights';
  const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '{}');
  
  // Store dismissal with timestamp
  dismissed[taskId] = new Date().toISOString();
  
  localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
};

/**
 * Check if an insight was recently dismissed (within 7 days)
 */
export const isInsightDismissed = (taskId: string): boolean => {
  const dismissedKey = 'myDayApp_dismissedInsights';
  const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '{}');
  
  if (!dismissed[taskId]) {
    return false;
  }
  
  const dismissedDate = new Date(dismissed[taskId]);
  const daysSinceDismissal = Math.floor((Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysSinceDismissal < 7;
};

