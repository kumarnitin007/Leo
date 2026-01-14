/**
 * Today View Component
 * 
 * Displays today's tasks with:
 * - Drag-and-drop reordering
 * - Up/down arrow buttons
 * - Overall completion streak (global)
 * - Per-task completion streaks (shown in each card)
 * - Per-task missed count (shown in each card)
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task, Event, AppData } from './types';
import { getTodayString, getTasksForToday, formatDate, getWeekBounds, getMonthBounds, shouldTaskShowToday } from './utils';
import { loadData, completeTask, isTaskCompletedToday, getTaskSpilloversForDate, moveTaskToNextDay, getCompletionCountForPeriod, saveTaskOrder, loadTaskOrder, getUpcomingEvents, acknowledgeEvent, isEventAcknowledged } from './storage';
import TaskActionModal from './TaskActionModal';
import CountdownTimer from './components/CountdownTimer';
import ProgressAndReviewModal from './components/ProgressAndReviewModal';
import SmartCoachSection from './components/SmartCoachSection';
import { getUnderperformingTasks, isInsightDismissed, TaskInsight } from './services/aiInsights';
import LayoutSelector from './components/LayoutSelector';
import { DashboardLayout } from './types';
import { getDashboardLayout, setDashboardLayout, bulkHoldTasks, bulkUnholdTasks, getUserSettings } from './storage';
import { useAuth } from './contexts/AuthContext';
import MonthlyView from './MonthlyView';
import WeatherWidget from './components/WeatherWidget';

type DashboardItem = {
  type: 'task' | 'event';
  task?: Task;
  event?: Event;
  id: string;
  name: string;
  description?: string;
  category?: string;
  isCompleted: boolean;
  weightage: number;
  color?: string;
  daysUntil?: number;
  eventDate?: string; // Formatted event date for display
};

interface TodayViewProps {
  onNavigate: (view: string) => void;
}

const TodayView: React.FC<TodayViewProps> = ({ onNavigate }) => {
  const { user, loading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<'dashboard' | 'monthly'>('dashboard');
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DashboardItem | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [showProgressAndReview, setShowProgressAndReview] = useState(false);
  const [showOpenAIPrompt, setShowOpenAIPrompt] = useState(false);
  const [openAIPromptText, setOpenAIPromptText] = useState('');
  const [showSmartCoachModal, setShowSmartCoachModal] = useState(false);
  const [showBulkHoldModal, setShowBulkHoldModal] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [timerTask, setTimerTask] = useState<Task | null>(null);
  const [aiInsight, setAiInsight] = useState<TaskInsight | null>(null);
  const [dashboardLayout, setDashboardLayoutState] = useState<DashboardLayout>(getDashboardLayout());
  const [isLoading, setIsLoading] = useState(true);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const today = getTodayString();

  const handleLayoutChange = async (layout: DashboardLayout) => {
    try {
      await setDashboardLayout(layout);
      setDashboardLayoutState(layout);
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
    }
  };

  /**
   * Helper function to check if a date matches an interval-based task schedule
   */
  const isIntervalMatch = (task: Task, dateStr: string): boolean => {
    if (!task.intervalValue || !task.intervalUnit || !task.intervalStartDate) {
      return false;
    }
    
    const startDate = new Date(task.intervalStartDate);
    const checkDate = new Date(dateStr);
    
    const diffInMs = checkDate.getTime() - startDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays < 0) return false; // Before start date
    
    switch (task.intervalUnit) {
      case 'days':
        return diffInDays % task.intervalValue === 0;
        
      case 'weeks':
        const diffInWeeks = Math.floor(diffInDays / 7);
        return diffInWeeks % task.intervalValue === 0 && (diffInDays % 7 === 0);
        
      case 'months':
        const startMonth = startDate.getMonth();
        const startYear = startDate.getFullYear();
        const checkMonth = checkDate.getMonth();
        const checkYear = checkDate.getFullYear();
        const monthsDiff = (checkYear - startYear) * 12 + (checkMonth - startMonth);
        
        return checkDate.getDate() === startDate.getDate() && 
               monthsDiff % task.intervalValue === 0;
        
      case 'years':
        const yearsDiff = checkDate.getFullYear() - startDate.getFullYear();
        
        return checkDate.getDate() === startDate.getDate() &&
               checkDate.getMonth() === startDate.getMonth() &&
               yearsDiff % task.intervalValue === 0;
        
      default:
        return false;
    }
  };

  // Track previous selectedDate to prevent unnecessary reloads
  const prevSelectedDateRef = useRef<string>('');
  const hasLoadedRef = useRef<boolean>(false);
  
  useEffect(() => {
    // Skip if selectedDate hasn't actually changed AND we've already loaded data
    // Always load on first run or when auth state changes
    if (prevSelectedDateRef.current === selectedDate && hasLoadedRef.current && !authLoading) {
      return;
    }
    
    prevSelectedDateRef.current = selectedDate;
    
    const init = async () => {
      // Only load data if user is authenticated
      if (!authLoading && user) {
        await loadItems();
        await calculateStreak();
        await loadAIInsights();
        hasLoadedRef.current = true;
      } else if (!authLoading && !user) {
        // User is not authenticated, set loading to false
        setIsLoading(false);
        hasLoadedRef.current = false; // Reset when user logs out
      }
    };
    init();
  }, [authLoading, user, selectedDate]);

  // Helper function to check if task should show on a specific date
  const shouldTaskShowOnDate = (task: Task, dateStr: string): boolean => {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();

    // Check if task is on hold
    if (task.onHold && task.holdStartDate) {
      if (dateStr >= task.holdStartDate) {
        if (!task.holdEndDate || dateStr <= task.holdEndDate) {
          return false;
        }
      }
    }

    // Check start date
    if (task.startDate && dateStr < task.startDate) {
      return false;
    }

    // Check end date
    if (task.endDate && dateStr > task.endDate) {
      return false;
    }

    // Check specific date
    if (task.specificDate) {
      return dateStr === task.specificDate;
    }

    // Check frequency
    switch (task.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        return task.daysOfWeek?.includes(dayOfWeek) || false;
      case 'monthly':
        return task.dayOfMonth === dayOfMonth;
      case 'count-based':
        return true;
      case 'interval':
        return isIntervalMatch(task, dateStr);
      default:
        return false;
    }
  };

  const loadItems = async () => {
    try {
      setIsLoading(true);
      const data = await loadData();
      setAppData(data); // Store data in state
      
      // Get tasks for selected date (not just today)
      let dateTasks = data.tasks.filter(task => shouldTaskShowOnDate(task, selectedDate));
      
      // Filter out count-based tasks that have already been completed the required number of times
      const selectedDateObj = new Date(selectedDate + 'T00:00:00');
      dateTasks = dateTasks.filter(task => {
        if (task.frequency === 'count-based' && task.frequencyCount && task.frequencyPeriod) {
          // Get period bounds
          let periodBounds;
          if (task.frequencyPeriod === 'week') {
            periodBounds = getWeekBounds(selectedDateObj);
          } else {
            periodBounds = getMonthBounds(selectedDateObj);
          }
          
          // Count completions in this period
          const completionsInPeriod = data.completions.filter(
            c => c.taskId === task.id && 
                 c.date >= periodBounds.start && 
                 c.date <= periodBounds.end
          ).length;
          
          // Only show if not yet completed the required number of times
          return completionsInPeriod < task.frequencyCount;
        }
        return true; // Show all non-count-based tasks
      });
      
      // Get spillover tasks
      const spillovers = await getTaskSpilloversForDate(selectedDate);
      const spilloverTaskIds = spillovers.map(s => s.taskId);
      const spilloverTasks = data.tasks.filter(t => spilloverTaskIds.includes(t.id));
      
      // Combine tasks
      const allTaskIds = new Set([...dateTasks.map(t => t.id), ...spilloverTasks.map(t => t.id)]);
      let combinedTasks = data.tasks.filter(t => allTaskIds.has(t.id));
      
      // Get events for selected date (show events on that specific date)
      const upcomingEvents = (await getUpcomingEvents(0, selectedDate)).filter(({ event }) => !event.hideFromDashboard);
      
      // Convert tasks to dashboard items
      const taskItems: DashboardItem[] = combinedTasks.map(task => ({
        type: 'task',
        task,
        id: task.id,
        name: task.name,
        description: task.description,
        category: task.category,
        isCompleted: isTaskCompletedToday(task.id, selectedDate, data.completions),
        weightage: task.weightage,
        color: task.color
      }));
    
    // Helper function to format event date for display
    const formatEventDateForCard = (event: Event): string => {
      if (event.frequency === 'yearly') {
        const [month, day] = event.date.split('-');
        const date = new Date(2000, parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        return new Date(event.date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        });
      }
    };
    
    // Convert events to dashboard items (same as tasks, no special treatment)
    const eventItems: DashboardItem[] = upcomingEvents.map(({ event, daysUntil }) => ({
      type: 'event',
      event,
      id: event.id,
      name: event.name,
      description: event.description,
      category: event.category,
      isCompleted: isEventAcknowledged(event.id, selectedDate),
      weightage: event.priority || 5,
      color: event.color,
      daysUntil,
      eventDate: formatEventDateForCard(event) // Add formatted event date
    }));
    
    // Now ensure pinned items stay visible until completed
    const pinnedTag = data.tags.find(t => t.name && t.name.toLowerCase() === 'pinned');
    if (pinnedTag) {
      // Pinned tasks: include tasks with pinned tag that have no completions yet
      const pinnedTasks = data.tasks.filter(t => t.tags && t.tags.includes(pinnedTag.id));
      const uncompletedPinnedTasks = pinnedTasks.filter(t => !data.completions.some(c => c.taskId === t.id));
      // Add any pinned tasks that are not already in combinedTasks
      for (const pt of uncompletedPinnedTasks) {
        if (!combinedTasks.find(ct => ct.id === pt.id)) {
          combinedTasks.push(pt);
        }
      }

      // Pinned events: include events with pinned tag that are not acknowledged for selectedDate
      const pinnedEvents = data.events.filter(e => e.tags && e.tags.includes(pinnedTag.id));
      for (const pe of pinnedEvents) {
        // If not already in upcomingEvents (by id) and not acknowledged, include it
        const already = upcomingEvents.some(u => u.event.id === pe.id);
        const acknowledged = isEventAcknowledged(pe.id, selectedDate);
        if (!already && !acknowledged) {
          eventItems.push({
            type: 'event',
            event: pe,
            id: pe.id,
            name: pe.name,
            description: pe.description,
            category: pe.category,
            isCompleted: false,
            weightage: pe.priority || 5,
            color: pe.color,
            daysUntil: undefined,
            eventDate: pe.frequency === 'yearly' ? pe.date : pe.date
          });
        }
      }
    }

    // Combine tasks and events into main dashboard items
    let allItems = [...taskItems, ...eventItems];
    
    // Apply custom order if exists (only for tasks)
    const savedOrder = loadTaskOrder();
    if (savedOrder.length > 0) {
      allItems = applyCustomOrderToItems(allItems, savedOrder);
    }
    
    setItems(allItems);
    } catch (error: any) {
      // Silently ignore authentication errors (user not signed in yet)
      if (!error?.message?.includes('User must be signed in')) {
        console.error('Error loading data:', error);
        alert('Error loading data. Please make sure you are signed in and have internet connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

    // Build OpenAI prompt text based on user data and tasks/events
    const buildOpenAIPrompt = async (): Promise<string> => {
      // Gather user settings and app data
      const settings = await getUserSettings().catch(() => ({} as any));
      const dateNow = new Date();
      const last7: { date: string; tasks: { name: string; status: string }[] }[] = [];
      const next7: { date: string; tasks: { name: string }[] }[] = [];

      // Ensure appData is loaded
      const data = appData || (await loadData());

      // Helper to map tag ids to names
      const tagMap = (data.tags || []).reduce((acc: any, t: any) => { acc[t.id] = t.name; return acc; }, {} as Record<string,string>);

      // Helper: ordinal for day numbers (1 -> 1st)
      const ordinal = (n: number) => {
        const s = ["th","st","nd","rd"], v = n%100;
        return n + (s[(v-20)%10] || s[v] || s[0]);
      };

      const todayDayName = dateNow.toLocaleDateString('en-US', { weekday: 'long' });
      const todayDayIndex = dateNow.getDay() + 1; // Sunday=1, Monday=2, ...

      // Last 7 days tasks with status (include category, tags, frequency info)
      for (let i = 7; i >= 1; i--) {
        const d = new Date(dateNow);
        d.setDate(d.getDate() - i);
        const dateStr = formatDate(d);
        const tasksForDay = data.tasks.filter((t: Task) => shouldTaskShowOnDate(t, dateStr));
        const tasksStatus = tasksForDay.map((t: Task) => {
          const completed = data.completions.some((c: any) => c.taskId === t.id && c.date === dateStr);
          const tagNames = (t.tags || []).map(id => tagMap[id] || id);
          const frequencyDesc = (() => {
            if (t.frequency === 'count-based' && t.frequencyCount) {
              return `${t.frequencyCount} times per ${t.frequencyPeriod || 'period'}`;
            }
            if (t.frequency === 'weekly' && t.daysOfWeek && t.daysOfWeek.length > 0) {
              const days = t.daysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ');
              return `Weekly on ${days}`;
            }
            if (t.frequency === 'monthly' && t.dayOfMonth) return `Monthly on day ${t.dayOfMonth}`;
            if (t.frequency === 'interval' && t.intervalValue && t.intervalUnit) return `Every ${t.intervalValue} ${t.intervalUnit}`;
            return t.frequency;
          })();

          return { name: t.name, status: completed ? 'Completed' : 'Missed', category: t.category || 'N/A', tags: tagNames, frequency: frequencyDesc, createdAt: t.createdAt || 'N/A' };
        });
        last7.push({ date: dateStr, tasks: tasksStatus });
      }

      // Next 7 days active tasks (include metadata)
      for (let i = 0; i < 7; i++) {
        const d = new Date(dateNow);
        d.setDate(d.getDate() + i);
        const dateStr = formatDate(d);
        const tasksForDay = data.tasks.filter((t: Task) => shouldTaskShowOnDate(t, dateStr));
        const taskDetails = tasksForDay.map((t: Task) => ({ name: t.name, category: t.category || 'N/A', tags: (t.tags || []).map(id => tagMap[id] || id), frequency: (t.frequency === 'count-based' && t.frequencyCount) ? `${t.frequencyCount} times per ${t.frequencyPeriod || 'period'}` : t.frequency, createdAt: t.createdAt || 'N/A' }));
        next7.push({ date: dateStr, tasks: taskDetails });
      }

      const location = settings.location ? `${settings.location.zipCode || 'N/A'} ${settings.location.city || ''}`.trim() : 'N/A';
      const age = 'N/A';
      const gender = 'N/A';

      // Weather hint: include zip if available
      const weatherHint = settings.location && settings.location.zipCode ? `Please consider weather for ZIP ${settings.location.zipCode} when advising.` : 'Weather: N/A';

      const promptObj: any = {
        role: 'time-management-expert',
        user: {
          location: location || 'N/A',
          age,
          gender,
        },
        last7days: last7,
        upcoming7days: next7,
        weatherHint,
        instructions: `You are a time management expert. Start your response with 2-3 short appreciations/comments celebrating recent progress (these should appear first and be brief). Then analyze the user's recent activity and upcoming schedule. Provide a concise assessment of how the user is doing, any bottlenecks or overloaded days, and concrete suggestions to improve time allocation. Also include health-based habit recommendations (sleep, exercise, hydration, breaks). Consider weather at the user's location when relevant. IMPORTANT: If a task was created on the system date shown in this prompt, do NOT mark it as "Missed" for prior days — treat it as newly added. Respond ONLY in JSON with the following keys: { summary: string, appreciations: string[], observations: string[], recommendations: {taskChanges: Array<{task: string, suggestion: string}>, habitSuggestions: string[]}, priorityActions: string[] }`
      };

  // Build a human-readable prompt combining context and JSON instruction
  const promptText = `You are an expert time-management coach.

Today is ${todayDayName}, the ${ordinal(todayDayIndex)} day of the week.

User info:
- Location: ${promptObj.user.location}
- Age: ${age}
- Gender: ${gender}

${weatherHint}

Tasks - Last 7 days:
${last7.map(d => `Date: ${d.date}
${d.tasks.map((t: any) => `- ${t.name} — ${t.status} (Category: ${t.category}; Tags: ${t.tags.join(', ') || 'None'}; Frequency: ${t.frequency}; CreatedAt: ${t.createdAt || 'N/A'})`).join('\n')}`).join('\n\n')}

Active tasks for coming 7 days:
${next7.map(d => `Date: ${d.date}
${d.tasks.map((t: any) => `- ${t.name} (Category: ${t.category}; Tags: ${t.tags.join(', ') || 'None'}; Frequency: ${t.frequency}; CreatedAt: ${t.createdAt || 'N/A'})`).join('\n')}`).join('\n\n')}

Instructions: ${promptObj.instructions}

Return only JSON as described.`;

      return promptText;
    };

  const applyCustomOrderToItems = (itemList: DashboardItem[], order: string[]): DashboardItem[] => {
    const orderedTasks: DashboardItem[] = [];
    const remainingItems = [...itemList];
    
    // Add tasks in saved order
    order.forEach(taskId => {
      const index = remainingItems.findIndex(item => item.type === 'task' && item.id === taskId);
      if (index !== -1) {
        orderedTasks.push(remainingItems[index]);
        remainingItems.splice(index, 1);
      }
    });
    
    // Events and remaining tasks go at the end
    return [...remainingItems.filter(i => i.type === 'event'), ...orderedTasks, ...remainingItems.filter(i => i.type === 'task')];
  };


  const calculateStreak = async () => {
    try {
      const data = await loadData();
      const allTasks = data.tasks;
      const allCompletions = data.completions;
    
    let streak = 0;
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1);
    
    for (let i = 0; i < 30; i++) {
      const dateStr = formatDate(checkDate);
      
      const scheduledTasks = allTasks.filter(task => {
        const dayOfWeek = checkDate.getDay();
        const dayOfMonth = checkDate.getDate();
        
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
      
      if (scheduledTasks.length === 0) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      
      const completedCount = scheduledTasks.filter(task =>
        allCompletions.some(c => c.taskId === task.id && c.date === dateStr)
      ).length;
      
      if (completedCount === scheduledTasks.length) {
        streak++;
      } else {
        break;
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    setCurrentStreak(streak);
    } catch (error: any) {
      // Silently ignore authentication errors (user not signed in yet)
      if (!error?.message?.includes('User must be signed in')) {
        console.error('Error calculating streak:', error);
      }
      setCurrentStreak(0);
    }
  };

  /**
   * Load AI insights for underperforming tasks
   */
  const loadAIInsights = async () => {
    try {
      const insights = await getUnderperformingTasks();
      
      // Filter out dismissed insights
      const activeInsights = insights.filter(insight => !isInsightDismissed(insight.taskId));
      
      // Show only the most severe insight (lowest completion rate)
      if (activeInsights.length > 0) {
        setAiInsight(activeInsights[0]);
      } else {
        setAiInsight(null);
      }
    } catch (error: any) {
      // Silently ignore authentication errors (user not signed in yet)
      if (!error?.message?.includes('User must be signed in')) {
        console.error('Error loading AI insights:', error);
      }
      setAiInsight(null);
    }
  };

  /**
   * Calculate completion streak for a specific task
   */
  const getTaskStreak = (taskId: string): number => {
    if (!appData) return 0;
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return 0;
    
    const allCompletions = appData.completions;
    let streak = 0;
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1); // Start from yesterday
    
    // Get task creation date
    const taskCreatedDate = task.createdAt ? new Date(task.createdAt) : null;
    const taskCreatedDateStr = taskCreatedDate ? formatDate(taskCreatedDate) : null;
    
    for (let i = 0; i < 30; i++) {
      const dateStr = formatDate(checkDate);
      const dayOfWeek = checkDate.getDay();
      const dayOfMonth = checkDate.getDate();
      
      // Stop if we've gone before task was created
      if (taskCreatedDateStr && dateStr < taskCreatedDateStr) {
        break;
      }
      
      // Stop if before task's start date
      if (task.startDate && dateStr < task.startDate) {
        break;
      }
      
      // Skip if after task's end date
      if (task.endDate && dateStr > task.endDate) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      
      // Skip days when task was on hold (hold days don't break streak)
      if (task.onHold && task.holdStartDate) {
        if (dateStr >= task.holdStartDate) {
          if (!task.holdEndDate || dateStr <= task.holdEndDate) {
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
      }
      
      let shouldHaveBeenDone = false;
      
      switch (task.frequency) {
        case 'daily':
          shouldHaveBeenDone = true;
          break;
        case 'weekly':
          shouldHaveBeenDone = task.daysOfWeek?.includes(dayOfWeek) || false;
          break;
        case 'monthly':
          shouldHaveBeenDone = task.dayOfMonth === dayOfMonth;
          break;
        case 'count-based':
          shouldHaveBeenDone = true; // Count-based tasks are always active
          break;
        case 'interval':
          shouldHaveBeenDone = isIntervalMatch(task, dateStr);
          break;
      }
      
      // Skip if task wasn't scheduled
      if (!shouldHaveBeenDone) {
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      }
      
      const wasCompleted = allCompletions.some(c => c.taskId === taskId && c.date === dateStr);
      
      if (wasCompleted) {
        streak++;
      } else {
        break; // Streak broken
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    return streak;
  };

  /**
   * Calculate missed count for a specific task (last 7 days)
   */
  const getTaskMissedCount = (taskId: string): number => {
    if (!appData) return 0;
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return 0;
    
    const allCompletions = appData.completions;
    const allSpillovers = appData.spillovers;
    let missedCount = 0;
    
    // Get task creation date (only check days after task was created)
    const taskCreatedDate = task.createdAt ? new Date(task.createdAt) : null;
    const taskCreatedDateStr = taskCreatedDate ? formatDate(taskCreatedDate) : null;
    
    for (let i = 1; i <= 7; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = formatDate(checkDate);
      const dayOfWeek = checkDate.getDay();
      const dayOfMonth = checkDate.getDate();
      
      // Skip if date is before task was created
      if (taskCreatedDateStr && dateStr < taskCreatedDateStr) {
        continue;
      }
      
      // Skip if date is before task's start date
      if (task.startDate && dateStr < task.startDate) {
        continue;
      }
      
      // Skip if date is after task's end date
      if (task.endDate && dateStr > task.endDate) {
        continue;
      }
      
      // Skip if task was on hold on this date
      if (task.onHold && task.holdStartDate) {
        if (dateStr >= task.holdStartDate) {
          // If no holdEndDate or date is before holdEndDate, task was on hold
          if (!task.holdEndDate || dateStr <= task.holdEndDate) {
            continue;
          }
        }
      }
      
      let shouldHaveBeenDone = false;
      
      switch (task.frequency) {
        case 'daily':
          shouldHaveBeenDone = true;
          break;
        case 'weekly':
          shouldHaveBeenDone = task.daysOfWeek?.includes(dayOfWeek) || false;
          break;
        case 'monthly':
          shouldHaveBeenDone = task.dayOfMonth === dayOfMonth;
          break;
        case 'count-based':
          shouldHaveBeenDone = true; // Check all days for count-based
          break;
        case 'interval':
          shouldHaveBeenDone = isIntervalMatch(task, dateStr);
          break;
      }
      
      if (shouldHaveBeenDone) {
        const wasCompleted = allCompletions.some(c => c.taskId === taskId && c.date === dateStr);
        const wasSpilledOver = allSpillovers.some(s => s.taskId === taskId && s.fromDate === dateStr);
        
        if (!wasCompleted && !wasSpilledOver) {
          missedCount++;
        }
      }
    }
    
    return missedCount;
  };

  const findMissedTasks = () => {
    // This function is kept for backward compatibility but no longer displays separate alerts
    // Individual task stats are now shown on each card
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    
    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(dropIndex, 0, draggedItem);
    
    setItems(newItems);
    // Only save order for tasks
    const taskOrder = newItems.filter(i => i.type === 'task').map(i => i.id);
    saveTaskOrder(taskOrder);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Arrow button handlers
  const moveItemUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setItems(newItems);
    const taskOrder = newItems.filter(i => i.type === 'task').map(i => i.id);
    saveTaskOrder(taskOrder);
  };

  const moveItemDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setItems(newItems);
    const taskOrder = newItems.filter(i => i.type === 'task').map(i => i.id);
    saveTaskOrder(taskOrder);
  };

  const handleItemClick = (item: DashboardItem) => {
    if (isReorderMode) return; // Don't open modal in reorder mode
    if (item.isCompleted) return;
    setSelectedItem(item);
  };

  const handleComplete = async (durationMinutes?: number) => {
    if (!selectedItem) return;
    
    if (selectedItem.type === 'task' && selectedItem.task) {
      const completedTaskId = selectedItem.task.id;
      await completeTask(completedTaskId, today, durationMinutes);
      
      // Check for dependent tasks and auto-complete them
      if (appData) {
        const dependentTasks = appData.tasks.filter(t => 
          t.dependentTaskIds && t.dependentTaskIds.includes(completedTaskId)
        );
      
        for (const depTask of dependentTasks) {
          // Only auto-complete if the dependent task shows today
          if (shouldTaskShowToday(depTask)) {
            await completeTask(depTask.id, today);
          }
        }
      }
      
    } else if (selectedItem.type === 'event' && selectedItem.event) {
      acknowledgeEvent(selectedItem.event.id, today);
    }
    
    setSelectedItem(null);
    await loadItems();
    await calculateStreak();
  };

  const handleStartTimer = () => {
    if (selectedItem && selectedItem.type === 'task' && selectedItem.task) {
      setTimerTask(selectedItem.task);
      setSelectedItem(null);
      setShowTimer(true);
    }
  };

  const handleTimerComplete = async (durationMinutes: number) => {
    if (timerTask) {
      await completeTask(timerTask.id, today, durationMinutes);
      
      // Check for dependent tasks
      if (appData) {
        const dependentTasks = appData.tasks.filter(t => 
          t.dependentTaskIds && t.dependentTaskIds.includes(timerTask.id)
        );
        
        for (const depTask of dependentTasks) {
          if (shouldTaskShowToday(depTask)) {
            await completeTask(depTask.id, today);
          }
        }
      }
    }
    
    setShowTimer(false);
    setTimerTask(null);
    await loadItems();
    await calculateStreak();
  };

  const handleTimerCancel = () => {
    setShowTimer(false);
    setTimerTask(null);
  };

  const handleMoveToNextDay = () => {
    if (!selectedItem) return;
    
    // Only tasks can be moved to next day
    if (selectedItem.type === 'task' && selectedItem.task) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow);
      moveTaskToNextDay(selectedItem.task.id, today, tomorrowStr);
      setSelectedItem(null);
      loadItems();
    }
  };

  const handleCancel = () => {
    setSelectedItem(null);
  };

  const getTaskProgress = (task: Task): { current: number; target: number; label: string } | null => {
    if (task.frequency !== 'count-based' || !task.frequencyCount || !task.frequencyPeriod) {
      return null;
    }
    // TODO: Load completion count asynchronously
    // For now, return null to avoid sync/async issues
    return null;
  };


  const calculateProgress = () => {
    const totalItems = items.length;
    if (totalItems === 0) return 0;
    const completedItems = items.filter(i => i.isCompleted).length;
    return Math.round((completedItems / totalItems) * 100);
  };

  const getPriorityLevel = (weightage: number): 'critical' | 'high' | 'medium' | 'low' => {
    if (weightage >= 9) return 'critical';
    if (weightage >= 7) return 'high';
    if (weightage >= 4) return 'medium';
    return 'low';
  };

  const getPriorityStyle = (weightage: number) => {
    const level = getPriorityLevel(weightage);
    const styles = {
      critical: {
        borderColor: '#ef4444',
        borderWidth: '4px',
        boxShadow: '0 8px 16px rgba(239, 68, 68, 0.25), 0 4px 8px rgba(0, 0, 0, 0.1)',
        badge: '🔥',
        badgeColor: '#ef4444',
        badgeText: 'Critical'
      },
      high: {
        borderColor: '#f97316',
        borderWidth: '3px',
        boxShadow: '0 6px 12px rgba(249, 115, 22, 0.2), 0 3px 6px rgba(0, 0, 0, 0.08)',
        badge: '⚡',
        badgeColor: '#f97316',
        badgeText: 'High'
      },
      medium: {
        borderColor: '#3b82f6',
        borderWidth: '2px',
        boxShadow: '0 4px 8px rgba(59, 130, 246, 0.15), 0 2px 4px rgba(0, 0, 0, 0.06)',
        badge: '📌',
        badgeColor: '#3b82f6',
        badgeText: 'Medium'
      },
      low: {
        borderColor: '#9ca3af',
        borderWidth: '2px',
        boxShadow: '0 2px 4px rgba(156, 163, 175, 0.1), 0 1px 2px rgba(0, 0, 0, 0.05)',
        badge: '📋',
        badgeColor: '#9ca3af',
        badgeText: 'Low'
      }
    };
    return styles[level];
  };

  const getGridSpanClass = (weightage: number): string => {
    if (weightage >= 9) return 'priority-critical';
    if (weightage >= 7) return 'priority-high';
    if (weightage >= 4) return 'priority-medium';
    return 'priority-low';
  };

  const getItemStyle = (item: DashboardItem) => {
    const priorityStyle = getPriorityStyle(item.weightage);
    const baseStyle = {
      borderLeft: `${priorityStyle.borderWidth} solid ${priorityStyle.borderColor}`,
      boxShadow: priorityStyle.boxShadow,
      '--task-color': item.color || '#667eea'
    } as React.CSSProperties;

    return baseStyle;
  };

  const formatDateLong = () => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  // Show loading screen while data is being fetched
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.5rem'
      }}>
        <div style={{
          fontSize: '4rem',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          🦁
        </div>
        <h2 style={{ color: 'white', fontSize: '1.5rem' }}>Loading your tasks...</h2>
        <p style={{ color: 'rgba(255,255,255,0.8)' }}>Getting everything ready for your productive day!</p>
      </div>
    );
  }

  // If monthly view is selected, show MonthlyView component
  if (viewMode === 'monthly') {
    return <MonthlyView onNavigate={onNavigate} onBackToDashboard={() => setViewMode('dashboard')} />;
  }

  return (
    <div className="today-view">
      <div className="date-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2>{selectedDate === today ? "Today's Goals" : "Goals"}</h2>
                <p>{selectedDate === today ? formatDateLong() : new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {/* Day Navigation Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    const date = new Date(selectedDate + 'T00:00:00');
                    date.setDate(date.getDate() - 1);
                    setSelectedDate(formatDate(date));
                    loadItems();
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.5rem', minWidth: '40px' }}
                  title="Previous Day"
                >
                  ←
                </button>
                {selectedDate !== today && (
                  <button
                    onClick={() => {
                      setSelectedDate(today);
                      loadItems();
                    }}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem' }}
                    title="Go to Today"
                  >
                    Today
                  </button>
                )}
                <button
                  onClick={() => {
                    const date = new Date(selectedDate + 'T00:00:00');
                    date.setDate(date.getDate() + 1);
                    setSelectedDate(formatDate(date));
                    loadItems();
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.5rem', minWidth: '40px' }}
                  title="Next Day"
                >
                  →
                </button>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* View Toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'dashboard' ? 'monthly' : 'dashboard')}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>{viewMode === 'dashboard' ? '📅' : '🏠'}</span>
              <span>{viewMode === 'dashboard' ? 'Monthly View' : 'Dashboard'}</span>
            </button>
            <button 
              onClick={() => setShowProgressAndReview(true)}
              className="btn-secondary"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>📊</span>
              <span>Progress & Review</span>
            </button>
            <button
              onClick={async () => {
                const prompt = await buildOpenAIPrompt();
                setOpenAIPromptText(prompt);
                setShowOpenAIPrompt(true);
              }}
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span>🤖</span>
              <span>Ask AI</span>
            </button>
            {aiInsight && (
              <button 
                onClick={() => setShowSmartCoachModal(true)}
                className="btn-secondary smart-coach-btn"
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none'
                }}
              >
                <span>🤖</span>
                <span>Smart Coach</span>
              </button>
            )}
            <button 
              onClick={() => setIsReorderMode(!isReorderMode)}
              className="btn-secondary"
              style={{ 
                background: isReorderMode ? '#667eea' : 'white',
                color: isReorderMode ? 'white' : '#667eea',
                border: '2px solid #667eea',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>{isReorderMode ? '✓' : '↕️'}</span>
              <span>{isReorderMode ? 'Done Reordering' : 'Reorder Tasks'}</span>
            </button>
            <button 
              onClick={() => setShowBulkHoldModal(true)}
              className="btn-secondary"
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'white',
                color: '#f97316',
                border: '2px solid #f97316'
              }}
            >
              <span>⏸️</span>
              <span>Hold Tasks</span>
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
            Progress: {calculateProgress()}% ({items.filter(i => i.isCompleted).length}/{items.length} completed)
          </div>
          {currentStreak > 0 && (
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔥</span>
              <span>{currentStreak} Day Streak!</span>
            </div>
          )}
        </div>
      </div>

      {isReorderMode && (
        <div className="reorder-instructions" style={{ background: '#eff6ff', border: '2px solid #3b82f6', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          <p style={{ margin: 0, color: '#1e40af', fontWeight: 600 }}>
            💡 Drag cards to reorder, or use ↑↓ arrows. Click "Done Reordering" when finished.
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <div className="no-tasks">
          <h3>No tasks or events scheduled for today</h3>
          <p>Start by adding some tasks to track your daily goals</p>
          <button className="btn-primary" onClick={() => onNavigate('configure')}>
            Add Tasks
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="no-tasks">
          <h3>No tasks scheduled for today</h3>
          <p>All items are events - check the Important Dates section above</p>
        </div>
      ) : (
        <>

          <div className={`tasks-grid layout-${dashboardLayout}`}>
          {items
            .slice()
            .sort((a, b) => {
              // Sort completed items to the end
              const aProgress = a.type === 'task' && a.task ? getTaskProgress(a.task) : null;
              const bProgress = b.type === 'task' && b.task ? getTaskProgress(b.task) : null;
              const aCompleted = a.isCompleted || (aProgress && aProgress.current >= aProgress.target) || false;
              const bCompleted = b.isCompleted || (bProgress && bProgress.current >= bProgress.target) || false;
              
              if (aCompleted && !bCompleted) return 1;  // a goes to end
              if (!aCompleted && bCompleted) return -1; // b goes to end
              return 0; // keep original order for items with same completion status
            })
            .map((item, index) => {
            const progress = item.type === 'task' && item.task ? getTaskProgress(item.task) : null;
            const isCountBasedComplete = progress && progress.current >= progress.target;
            const taskStreak = item.type === 'task' ? getTaskStreak(item.id) : 0;
            const missedCount = item.type === 'task' ? getTaskMissedCount(item.id) : 0;
            
            // Get category icon for both tasks and events
            const getCategoryIcon = () => {
              const eventIcons: { [key: string]: string } = {
                'Birthday': '🎂',
                'Anniversary': '💝',
                'Holiday': '🎊',
                'Special Event': '⭐',
                'Death Anniversary': '🕯️',
                'Memorial': '🌹',
                'Remembrance': '🙏',
                'Wedding': '💍',
                'Graduation': '🎓'
              };
              
              const taskIcons: { [key: string]: string } = {
                'Exercise': '🏃',
                'Study': '📚',
                'Work': '💼',
                'Health': '💊',
                'Self Care': '🧘',
                'Household': '🏠',
                'Social': '👥',
                'Hobby': '🎨',
                'Finance': '💰',
                'Travel': '✈️',
                'Shopping': '🛒',
                'Cooking': '👨‍🍳',
                'Reading': '📖',
                'Writing': '✍️',
                'Music': '🎵',
                'Sports': '⚽',
                'Gaming': '🎮',
                'Learning': '🎓',
                'Meditation': '🧘',
                'Yoga': '🧘‍♀️'
              };
              
              if (item.type === 'event') {
                return eventIcons[item.category || ''] || '📅';
              } else if (item.type === 'task') {
                return taskIcons[item.category || ''] || '📋';
              }
              return '';
            };
            
            const priorityClass = (dashboardLayout === 'grid-spans' || dashboardLayout === 'masonry') 
              ? getGridSpanClass(item.weightage) 
              : '';
            const extraClasses = [
              taskStreak > 0 ? 'has-streak' : '',
              progress ? 'has-progress' : ''
            ].filter(Boolean).join(' ');
            
            return (
              <div
                key={item.id}
                className={`task-card ${item.isCompleted || isCountBasedComplete ? 'completed' : ''} ${isReorderMode ? 'reorder-mode' : ''} ${priorityClass} ${extraClasses}`}
                style={{
                  ...getItemStyle(item),
                  cursor: isReorderMode ? 'move' : 'pointer',
                  opacity: draggedIndex === index ? 0.5 : 1,
                  ...(item.task?.customBackgroundColor && { 
                    background: item.task.customBackgroundColor,
                    backdropFilter: 'blur(10px)'
                  })
                }}
                draggable={isReorderMode}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => handleItemClick(item)}
              >
                {isReorderMode && (
                  <div className="reorder-controls" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.25rem', zIndex: 10 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveItemUp(index); }}
                      disabled={index === 0}
                      className="reorder-btn"
                      style={{ 
                        background: 'white',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        padding: '0.25rem 0.5rem',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        opacity: index === 0 ? 0.3 : 1,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: '#3b82f6'
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveItemDown(index); }}
                      disabled={index === items.length - 1}
                      className="reorder-btn"
                      style={{ 
                        background: 'white',
                        border: '2px solid #3b82f6',
                        borderRadius: '6px',
                        padding: '0.25rem 0.5rem',
                        cursor: index === items.length - 1 ? 'not-allowed' : 'pointer',
                        opacity: index === items.length - 1 ? 0.3 : 1,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        color: '#3b82f6'
                      }}
                    >
                      ↓
                    </button>
                  </div>
                )}
                <div>
                  {/* Source Badge (Event/Task) - Top Left */}
                  {!isReorderMode && (
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      left: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: item.type === 'event' ? '#ec489915' : '#3b82f615',
                      border: `1.5px solid ${item.type === 'event' ? '#ec4899' : '#3b82f6'}`,
                      borderRadius: '12px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: item.type === 'event' ? '#ec4899' : '#3b82f6',
                      zIndex: 5
                    }}>
                      <span>{item.type === 'event' ? '📅' : '✓'}</span>
                      <span>{item.type === 'event' ? 'Event' : 'Task'}</span>
                      {/* Recurring indicator */}
                      {((item.type === 'event' && item.event && 
                         (item.event.frequency === 'yearly' || item.event.frequency === 'custom')) ||
                        (item.type === 'task' && item.task && 
                         (['daily', 'weekly', 'monthly', 'count-based', 'interval'].includes(item.task.frequency) ||
                          (item.task.frequency === 'custom' && !item.task.specificDate)))) && (
                        <span style={{ fontSize: '0.7rem', marginLeft: '0.15rem' }} title="Recurring">🔄</span>
                      )}
                    </div>
                  )}

                  {/* Priority Badge - Top Right */}
                  {!isReorderMode && item.weightage >= 7 && !item.task?.onHold && (
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: `${getPriorityStyle(item.weightage).badgeColor}15`,
                      border: `1.5px solid ${getPriorityStyle(item.weightage).badgeColor}`,
                      borderRadius: '12px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: getPriorityStyle(item.weightage).badgeColor,
                      zIndex: 5
                    }}>
                      <span>{getPriorityStyle(item.weightage).badge}</span>
                      <span>{getPriorityStyle(item.weightage).badgeText}</span>
                    </div>
                  )}

                  {/* Hold Badge */}
                  {item.task?.onHold && (
                    <div style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: '#f9731615',
                      border: '1.5px solid #f97316',
                      borderRadius: '12px',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#f97316'
                    }}>
                      <span>⏸️</span>
                      <span>On Hold</span>
                      {item.task.holdEndDate && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                          (until {new Date(item.task.holdEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Category icon for both tasks and events */}
                  <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                    {getCategoryIcon()}
                  </div>
                  
                  <div className="task-name">
                    {item.name}
                    {item.type === 'event' && item.eventDate && (
                      <span style={{ fontSize: '0.85em', color: '#6b7280', fontWeight: 'normal', marginLeft: '0.5rem' }}>
                        ({item.eventDate})
                      </span>
                    )}
                  </div>
                  
                  {item.category && (
                    <div className="task-category">
                      {item.category}
                    </div>
                  )}
                  {progress && (
                    <div className="task-progress">
                      <span className={isCountBasedComplete ? 'progress-complete' : 'progress-pending'}>
                        {progress.label} {item.task?.frequencyPeriod === 'week' ? 'this week' : 'this month'}
                      </span>
                    </div>
                  )}
                  
                  {/* Stats Badges (for both tasks and events) */}
                  <div className="task-stats">
                    {/* Task stats */}
                    {item.type === 'task' && taskStreak > 0 && (
                      <div className="task-stat-badge streak-badge">
                        <span className="badge-icon">🔥</span>
                        <span className="badge-text">{taskStreak} day{taskStreak > 1 ? 's' : ''} streak</span>
                      </div>
                    )}
                    {item.type === 'task' && missedCount > 0 && (
                      <div className="task-stat-badge missed-badge">
                        <span className="badge-icon">❌</span>
                        <span className="badge-text">{missedCount} missed in last 7 days</span>
                      </div>
                    )}
                    {/* Event days until badge */}
                    {item.type === 'event' && item.daysUntil !== undefined && (
                      <div className={`task-stat-badge ${item.daysUntil === 0 ? 'event-today-badge' : 'event-upcoming-badge'}`}>
                        <span className="badge-icon">{item.daysUntil === 0 ? '🎊' : '📅'}</span>
                        <span className="badge-text">
                          {item.daysUntil === 0 ? 'Today' : `in ${item.daysUntil} day${item.daysUntil > 1 ? 's' : ''}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="task-weightage">
                  Priority: {item.weightage}/10
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {selectedItem && (
        <TaskActionModal
          task={selectedItem.type === 'task' ? selectedItem.task! : null}
          event={selectedItem.type === 'event' ? selectedItem.event! : null}
          itemType={selectedItem.type}
          onComplete={handleComplete}
          onMoveToNextDay={handleMoveToNextDay}
          onCancel={handleCancel}
          onStartTimer={selectedItem.type === 'task' ? handleStartTimer : undefined}
        />
      )}

      {/* Countdown Timer */}
      {showTimer && timerTask && (
        <CountdownTimer
          task={timerTask}
          onComplete={handleTimerComplete}
          onCancel={handleTimerCancel}
        />
      )}

      {/* Progress & Review Modal */}
      <ProgressAndReviewModal
        isOpen={showProgressAndReview}
        onClose={() => setShowProgressAndReview(false)}
      />

      {/* Smart Coach Modal */}
      {showSmartCoachModal && aiInsight && (
        <div className="modal-overlay" onClick={() => setShowSmartCoachModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <h2>🤖 Smart Coach Insights</h2>
              <button className="modal-close" onClick={() => setShowSmartCoachModal(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div style={{ 
              padding: '1.5rem',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }}>
              <SmartCoachSection
                insight={aiInsight}
                onApply={() => {
                  loadItems();
                  loadAIInsights();
                  setShowSmartCoachModal(false);
                }}
                onDismiss={() => {
                  setAiInsight(null);
                  setShowSmartCoachModal(false);
                }}
                collapsed={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bulk Hold/Unhold Modal */}
      {showBulkHoldModal && (
        <div className="modal-overlay" onClick={() => setShowBulkHoldModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', color: 'white' }}>
              <h2>⏸️ Bulk Hold/Unhold Tasks</h2>
              <button className="modal-close" onClick={() => setShowBulkHoldModal(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ marginBottom: '1.5rem', color: '#6b7280' }}>
                Quickly pause all tasks or resume them. Held tasks won't show up and won't count as missed days.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Hold All Tasks Section */}
                <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#92400e' }}>
                    ⏸️ Hold All Tasks
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#78350f', marginBottom: '1rem' }}>
                    Put all tasks on hold (e.g., vacation, break)
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <input
                      type="date"
                      id="bulk-hold-end-date"
                      placeholder="Resume date (optional)"
                      style={{ padding: '0.5rem', border: '1px solid #fbbf24', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      id="bulk-hold-reason"
                      placeholder="Reason (optional, e.g., Vacation)"
                      style={{ padding: '0.5rem', border: '1px solid #fbbf24', borderRadius: '4px' }}
                    />
                    <button
                      onClick={() => {
                        const endDateInput = document.getElementById('bulk-hold-end-date') as HTMLInputElement;
                        const reasonInput = document.getElementById('bulk-hold-reason') as HTMLInputElement;
                        bulkHoldTasks(endDateInput?.value || undefined, reasonInput?.value || undefined);
                        setShowBulkHoldModal(false);
                        loadItems();
                      }}
                      style={{ 
                        padding: '0.75rem', 
                        background: '#f97316', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '6px', 
                        fontWeight: 600, 
                        cursor: 'pointer' 
                      }}
                    >
                      ⏸️ Hold All Tasks
                    </button>
                  </div>
                </div>

                {/* Unhold All Tasks Section */}
                <div style={{ padding: '1rem', background: '#d1fae5', borderRadius: '8px', border: '1px solid #10b981' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#065f46' }}>
                    ▶️ Resume All Tasks
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#047857', marginBottom: '1rem' }}>
                    Remove hold from all tasks and resume tracking
                  </p>
                  <button
                    onClick={() => {
                      if (confirm('Resume all held tasks?')) {
                        bulkUnholdTasks();
                        setShowBulkHoldModal(false);
                        loadItems();
                      }
                    }}
                    style={{ 
                      padding: '0.75rem', 
                      background: '#10b981', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '6px', 
                      fontWeight: 600, 
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    ▶️ Resume All Tasks
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weather Widget - Bottom of Dashboard */}
      {/* OpenAI Prompt Modal */}
      {showOpenAIPrompt && (
        <div className="modal-overlay" onClick={() => setShowOpenAIPrompt(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header" style={{ background: '#111827', color: 'white' }}>
              <h2>🧭 Generated OpenAI Prompt</h2>
              <button className="modal-close" onClick={() => setShowOpenAIPrompt(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div style={{ padding: '1rem' }}>
              <p style={{ marginBottom: '0.5rem' }}>This prompt is ready to send to OpenAI. It includes your recent tasks and upcoming schedule. (We do not call OpenAI from the app yet.)</p>
              <textarea readOnly value={openAIPromptText} style={{ width: '100%', height: '320px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', fontFamily: 'monospace' }} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button onClick={() => { navigator.clipboard?.writeText(openAIPromptText); alert('Prompt copied to clipboard'); }} style={{ padding: '0.5rem 0.75rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px' }}>Copy Prompt</button>
                <button onClick={() => { const blob = new Blob([openAIPromptText], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'openai-prompt.txt'; a.click(); URL.revokeObjectURL(url); }} style={{ padding: '0.5rem 0.75rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px' }}>Download</button>
                <button onClick={() => setShowOpenAIPrompt(false)} style={{ padding: '0.5rem 0.75rem', background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px' }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <WeatherWidget />

    </div>
  );
};

export default TodayView;
