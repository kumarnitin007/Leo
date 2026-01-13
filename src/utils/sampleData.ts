/**
 * Sample Data Loader
 * 
 * Provides sample tasks for new users to get started quickly
 */

import { Task } from '../types';

// Helper to get today's date in YYYY-MM-DD format
const getTodayString = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export const loadSampleTasks = (): Task[] => {
  const today = getTodayString();
  
  return [
    // Exercise & Fitness
    {
      id: 'sample-1',
      name: '🏃 Morning Run (30 minutes)',
      description: 'Start your day with a refreshing morning run',
      category: 'Exercise',
      weightage: 7,
      frequency: 'daily',
      color: '#ef4444',
      createdAt: today
    },
    {
      id: 'sample-2',
      name: '🧘 Yoga or Stretching',
      description: 'Flexibility and mindfulness practice',
      category: 'Exercise',
      weightage: 6,
      frequency: 'daily',
      color: '#f59e0b',
      createdAt: today
    },
    {
      id: 'sample-3',
      name: '🏋️ Gym Workout',
      description: 'Strength training session',
      category: 'Exercise',
      weightage: 8,
      frequency: 'weekly',
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      color: '#dc2626',
      createdAt: today
    },

    // Health & Self-Care
    {
      id: 'sample-4',
      name: '💧 Drink 8 Glasses of Water',
      description: 'Stay hydrated throughout the day',
      category: 'Health',
      weightage: 5,
      frequency: 'daily',
      color: '#3b82f6',
      createdAt: today
    },
    {
      id: 'sample-5',
      name: '😴 Sleep by 10:30 PM',
      description: 'Get quality rest for tomorrow',
      category: 'Self Care',
      weightage: 6,
      frequency: 'daily',
      color: '#6366f1',
      createdAt: today
    },
    {
      id: 'sample-6',
      name: '🍎 Eat Healthy Meals',
      description: 'Balanced nutrition with fruits and vegetables',
      category: 'Health',
      weightage: 6,
      frequency: 'daily',
      color: '#10b981',
      createdAt: today
    },

    // Learning & Reading
    {
      id: 'sample-7',
      name: '📚 Read for 30 Minutes',
      description: 'Read a book or learn something new',
      category: 'Learning',
      weightage: 7,
      frequency: 'daily',
      color: '#8b5cf6',
      createdAt: today
    },
    {
      id: 'sample-8',
      name: '🎓 Online Course Lesson',
      description: 'Complete one lesson from your course',
      category: 'Learning',
      weightage: 7,
      frequency: 'weekly',
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      color: '#7c3aed',
      createdAt: today
    },

    // Productivity & Work
    {
      id: 'sample-9',
      name: '📝 Plan Tomorrow',
      description: 'Review goals and plan next day',
      category: 'Planning',
      weightage: 5,
      frequency: 'daily',
      color: '#ec4899',
      createdAt: today
    },
    {
      id: 'sample-10',
      name: '📧 Inbox Zero',
      description: 'Clear and organize your email inbox',
      category: 'Productivity',
      weightage: 6,
      frequency: 'daily',
      color: '#06b6d4',
      createdAt: today
    },

    // Mindfulness & Mental Health
    {
      id: 'sample-11',
      name: '🧘 Meditation (15 minutes)',
      description: 'Practice mindfulness and breathwork',
      category: 'Mindfulness',
      weightage: 7,
      frequency: 'daily',
      color: '#14b8a6',
      createdAt: today
    },
    {
      id: 'sample-12',
      name: '📔 Gratitude Journal',
      description: 'Write 3 things you are grateful for',
      category: 'Self Care',
      weightage: 5,
      frequency: 'daily',
      color: '#f59e0b',
      createdAt: today
    },

    // Social & Relationships
    {
      id: 'sample-13',
      name: '📞 Call Family/Friends',
      description: 'Stay connected with loved ones',
      category: 'Social',
      weightage: 5,
      frequency: 'weekly',
      daysOfWeek: [0, 3], // Sun, Wed
      color: '#ec4899',
      createdAt: today
    },

    // Hobbies & Creative
    {
      id: 'sample-14',
      name: '🎨 Creative Time',
      description: 'Work on a hobby or creative project',
      category: 'Hobby',
      weightage: 6,
      frequency: 'weekly',
      daysOfWeek: [6], // Saturday
      color: '#a855f7',
      createdAt: today
    },

    // Weekly Tasks
    {
      id: 'sample-15',
      name: '🧹 Clean Living Space',
      description: 'Tidy up and organize your environment',
      category: 'Chores',
      weightage: 6,
      frequency: 'weekly',
      daysOfWeek: [0], // Sunday
      color: '#84cc16',
      createdAt: today
    },
    {
      id: 'sample-16',
      name: '📊 Weekly Review',
      description: 'Review progress and adjust goals',
      category: 'Planning',
      weightage: 7,
      frequency: 'weekly',
      daysOfWeek: [0], // Sunday
      color: '#06b6d4',
      createdAt: today
    }
  ];
};

