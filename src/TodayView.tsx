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
import { Task, Event, AppData, UserVisibleDay } from './types';
import { getTodayString, getTasksForToday, formatDate, getWeekBounds, getMonthBounds, shouldTaskShowToday } from './utils';
import { loadData, completeTask, isTaskCompletedToday, getTaskSpilloversForDate, moveTaskToNextDay, getCompletionCountForPeriod, saveTaskOrder, loadTaskOrder, getUpcomingEvents, acknowledgeEvent, isEventAcknowledged } from './storage';
import { getUserVisibleDaysByRange } from './services/referenceCalendarStorage';
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
import ResolutionProgressWidget from './components/ResolutionProgressWidget';
import { getDashboardTodos, getTodoGroups, toggleTodoItem } from './services/todoService';
import { TodoItem, TodoGroup } from './types';

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerDate, setDatePickerDate] = useState<string>(getTodayString());
  const [referenceCalendarDays, setReferenceCalendarDays] = useState<UserVisibleDay[]>([]);
  const [isObservancesExpanded, setIsObservancesExpanded] = useState(false);
  const [isLoadingObservances, setIsLoadingObservances] = useState(false);
  const [observancesLoaded, setObservancesLoaded] = useState(false);
  const [selectedObservance, setSelectedObservance] = useState<UserVisibleDay | null>(null);
  const [upcomingTodos, setUpcomingTodos] = useState<TodoItem[]>([]);
  const [isTodosExpanded, setIsTodosExpanded] = useState(false);
  const [isLoadingTodos, setIsLoadingTodos] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [todoGroups, setTodoGroups] = useState<Record<string, string>>({});
  const today = getTodayString();

  const handleLayoutChange = async (layout: DashboardLayout) => {
    try {
      await setDashboardLayout(layout);
      setDashboardLayoutState(layout);
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
    }
  };

  // Load observances only when expanded (lazy loading for faster initial page load)
  const loadObservances = async () => {
    if (observancesLoaded || isLoadingObservances) return;
    setIsLoadingObservances(true);
    try {
      const endDateForRef = new Date(selectedDate);
      endDateForRef.setDate(endDateForRef.getDate() + 7);
      const refDays = await getUserVisibleDaysByRange(selectedDate, endDateForRef.toISOString().split('T')[0]);
      setReferenceCalendarDays(refDays);
      setObservancesLoaded(true);
    } catch (err) {
      console.warn('Could not load reference calendar days:', err);
      setReferenceCalendarDays([]);
      setObservancesLoaded(true);
    } finally {
      setIsLoadingObservances(false);
    }
  };

  // Load upcoming TODOs (next 7 days)
  const loadUpcomingTodos = async () => {
    if (isLoadingTodos) return;
    setIsLoadingTodos(true);
    try {
      const [todos, groups] = await Promise.all([getDashboardTodos(), getTodoGroups()]);
      const today = new Date(selectedDate + 'T00:00:00');
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const upcoming = todos.filter(todo => {
        if (!todo.dueDate) return false;
        const dueDate = new Date(todo.dueDate + 'T00:00:00');
        return dueDate >= today && dueDate <= nextWeek;
      });
      
      setUpcomingTodos(upcoming);
      
      // Build group name map
      const groupMap: Record<string, string> = {};
      groups.forEach(g => {
        groupMap[g.id] = g.name;
      });
      setTodoGroups(groupMap);
    } catch (err) {
      console.warn('Could not load upcoming TODOs:', err);
      setUpcomingTodos([]);
    } finally {
      setIsLoadingTodos(false);
    }
  };

  // Load TODOs when section is expanded OR on initial load if there might be todos
  useEffect(() => {
    if (isTodosExpanded && upcomingTodos.length === 0 && !isLoadingTodos) {
      loadUpcomingTodos();
    }
  }, [isTodosExpanded]);

  // Also try to load todos on mount to check if section should be visible
  useEffect(() => {
    if (!isLoadingTodos && upcomingTodos.length === 0) {
      loadUpcomingTodos();
    }
  }, []);

  // Load observances when section is expanded
  useEffect(() => {
    if (isObservancesExpanded && !observancesLoaded) {
      loadObservances();
    }
  }, [isObservancesExpanded, observancesLoaded, selectedDate]);

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
      
      // Reset observances when date changes (will reload when expanded)
      setObservancesLoaded(false);
      setReferenceCalendarDays([]);
      
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

          return { id: t.id, name: t.name, status: completed ? 'Completed' : 'Missed', category: t.category || 'N/A', tags: tagNames, frequency: frequencyDesc, createdAt: t.createdAt || 'N/A' };
        });
        last7.push({ date: dateStr, tasks: tasksStatus });
      }

      // Next 7 days active tasks (include metadata)
      for (let i = 0; i < 7; i++) {
        const d = new Date(dateNow);
        d.setDate(d.getDate() + i);
        const dateStr = formatDate(d);
        const tasksForDay = data.tasks.filter((t: Task) => shouldTaskShowOnDate(t, dateStr));
        const taskDetails = tasksForDay.map((t: Task) => ({ id: t.id, name: t.name, category: t.category || 'N/A', tags: (t.tags || []).map(id => tagMap[id] || id), frequency: (t.frequency === 'count-based' && t.frequencyCount) ? `${t.frequencyCount} times per ${t.frequencyPeriod || 'period'}` : t.frequency, createdAt: t.createdAt || 'N/A' }));
        next7.push({ date: dateStr, tasks: taskDetails });
      }

      const location = settings.location ? `${settings.location.zipCode || 'N/A'} ${settings.location.city || ''}`.trim() : 'N/A';
      const age = 'N/A';
      const gender = 'N/A';

      // Weather hint: include zip if available
      const weatherHint = settings.location && settings.location.zipCode ? `Please consider weather for ZIP ${settings.location.zipCode} when advising.` : 'Weather: N/A';

      // Collect unique task IDs referenced in history/upcoming
      const referencedTaskIds = new Set<string>();
      last7.forEach(d => d.tasks.forEach((t: any) => { if (t && t.id) referencedTaskIds.add(t.id); }));
      next7.forEach(d => d.tasks.forEach((t: any) => { if (t && t.id) referencedTaskIds.add(t.id); }));

      // Build task metadata block (one entry per referenced task)
      const taskMetadataLines: string[] = [];
      // Create a stable mapping from real IDs to simple labels: Task #01, Task #02, ...
      const referencedArray = Array.from(referencedTaskIds);
      const simpleIdMap: Record<string,string> = {};
      referencedArray.forEach((tid, idx) => {
        const label = `Task #${String(idx+1).padStart(2,'0')}`;
        simpleIdMap[tid] = label;
      });

      referencedArray.forEach(tid => {
        const task = data.tasks.find((x: Task) => x.id === tid);
        if (task) {
          const tagNames = (task.tags || []).map(id => tagMap[id] || id).join(', ') || 'None';
          const freqDesc = (() => {
            if (task.frequency === 'count-based' && task.frequencyCount) return `${task.frequencyCount} times per ${task.frequencyPeriod || 'period'}`;
            if (task.frequency === 'weekly' && task.daysOfWeek && task.daysOfWeek.length) return `Weekly on ${task.daysOfWeek.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}`;
            if (task.frequency === 'monthly' && task.dayOfMonth) return `Monthly on day ${task.dayOfMonth}`;
            if (task.frequency === 'interval' && task.intervalValue && task.intervalUnit) return `Every ${task.intervalValue} ${task.intervalUnit}`;
            return task.frequency;
          })();
          const simpleId = simpleIdMap[tid] || tid;
          taskMetadataLines.push(`${simpleId}: Name: ${task.name}; Category: ${task.category || 'N/A'}; Tags: ${tagNames}; Frequency: ${freqDesc}; CreatedAt: ${task.createdAt || 'N/A'}`);
        }
      });

      // Build history and upcoming blocks (use task IDs to avoid repeating metadata)
  const historyLines = last7.map(d => `Date: ${d.date}\n${d.tasks.map((t: any) => `- ${simpleIdMap[t.id] || t.id}: ${t.status}`).join('\n')}`).join('\n\n');
  const upcomingLines = next7.map(d => `Date: ${d.date}\n${d.tasks.map((t: any) => `- ${simpleIdMap[t.id] || t.id}`).join('\n')}`).join('\n\n');

      // Build a compact, human-friendly data block as requested
      // TASKS block: list all referenced tasks with their simple IDs and metadata
      const taskListLines = referencedArray.map((tid, idx) => {
        const task = data.tasks.find((x: Task) => x.id === tid);
        const simpleId = simpleIdMap[tid];
        if (!task) return '';
  // short frequency
  let freqShort: string = String(task.frequency);
        if (task.frequency === 'count-based' && task.frequencyCount && task.frequencyPeriod === 'week') {
          freqShort = `${task.frequencyCount}x/week`;
        } else if (task.frequency === 'count-based' && task.frequencyCount) {
          freqShort = `${task.frequencyCount}x/${task.frequencyPeriod || 'period'}`;
        } else if (task.frequency === 'weekly' && task.frequencyCount) {
          freqShort = `${task.frequencyCount}x/week`;
        }
        const created = task.createdAt ? task.createdAt.split('T')[0] : 'N/A';
        return `${simpleId} ${task.name} | ${task.category || 'N/A'} | ${freqShort} | Created ${created}`;
      }).filter(Boolean);

      // HISTORY (Last 7 days, valid tasks only): include only tasks whose CreatedAt <= date
      const historyDateLines: string[] = [];
      last7.forEach(d => {
        const lines: string[] = [];
        const dateStr = d.date;
        d.tasks.forEach((t: any) => {
          const task = data.tasks.find((x: Task) => x.id === t.id);
          if (!task) return;
          const created = task.createdAt ? task.createdAt.split('T')[0] : null;
          if (created && created > dateStr) return; // skip mentions before CreatedAt
          const simple = simpleIdMap[t.id] || t.id;
          const statusShort = (t.status || '').toString().toUpperCase().startsWith('C') ? 'C' : 'M';
          lines.push(`${simple} ${task.name}: ${statusShort}`);
        });
        if (lines.length > 0) {
          historyDateLines.push(`${dateStr}:\n${lines.join('\n')}`);
        }
      });

      // TASK SUMMARY: for each referenced task, count C and M across last7 where CreatedAt <= date
      const summaryLines: string[] = [];
      referencedArray.forEach(tid => {
        const task = data.tasks.find((x: Task) => x.id === tid);
        if (!task) return;
        let c = 0, m = 0;
        last7.forEach(d => {
          d.tasks.forEach((t: any) => {
            if (t.id !== tid) return;
            const created = task.createdAt ? task.createdAt.split('T')[0] : null;
            if (created && created > d.date) return; // ignore before created
            const isCompleted = (t.status || '').toString().toLowerCase().startsWith('c');
            if (isCompleted) c++; else m++;
          });
        });
        const simple = simpleIdMap[tid] || tid;
        summaryLines.push(`${simple} ${task.name} → C:${c} | M:${m}`);
      });

      const dataBlock = [`NOTE: Tasks evaluated only on/after CreatedAt.`, ``, `TASKS:`, ...taskListLines, ``, `HISTORY (Last 7 days, valid tasks only):`, ...historyDateLines, ``, `TASK SUMMARY:`, ...summaryLines].join('\n');

      // Determine timezone: prefer stored timezone, fall back to ZIP-derived, then browser timezone
      const zip = settings.location?.zipCode || null;

      const getTimezoneFromZip = (z?: string | null) => {
        if (!z) return null;
        const clean = z.toString().trim();
        // If user provided a 3-digit prefix like '995' we still handle it
        const asNum3 = parseInt(clean.slice(0, 3), 10);
        if (!isNaN(asNum3)) {
          // Alaska ZIPs: 995-999
          if (asNum3 >= 995 && asNum3 <= 999) return 'America/Anchorage';
          // Hawaii ZIPs: 967-968
          if (asNum3 >= 967 && asNum3 <= 968) return 'Pacific/Honolulu';
        }
        const first = clean.charAt(0);
        switch (first) {
          case '0':
          case '1':
          case '2':
          case '3':
            return 'America/New_York'; // Eastern
          case '4':
          case '5':
          case '6':
          case '7':
            return 'America/Chicago'; // Central (approx)
          case '8':
            return 'America/Denver'; // Mountain (approx)
          case '9':
            return 'America/Los_Angeles'; // Pacific (incl. CA; AK/HI handled above)
          default:
            return null;
        }
      };

      const tzFromZip = getTimezoneFromZip(zip);
      const detectedTZ = (settings.location && (settings.location.timezone as string)) || tzFromZip || Intl.DateTimeFormat().resolvedOptions().timeZone || 'N/A';
      const timezoneLine = zip ? `Timezone: ${detectedTZ} (derived from ZIP ${zip} → ${tzFromZip || detectedTZ})` : `Timezone: ${detectedTZ}`;

  const promptText = `You are a senior productivity consultant and behavioral systems coach with expertise in Time management, Habit formation (behavioral science–based), Energy management, and Work–life balance for working professionals.\n\nYour role is to analyze my real task data and behavior patterns, not just give generic advice.\n\nContext:\n- Assume standard Mon–Fri workweek unless noted.\n- Today's date is ${formatDate(dateNow)} (${todayDayName}).\n- ${timezoneLine}.\n- Location: ${location || 'N/A'}. ${weatherHint}\n- Legend: C = Completed, M = Missed\n\nPlease respond following the previously specified JSON schema.\n\nData Begins Below:\n\n${dataBlock}\n`;

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
   * Get count-based task progress (e.g., "1 out of 3 done")
   * Returns null if task is not count-based
   */
  const getCountBasedProgress = (taskId: string): { current: number; target: number; period: string } | null => {
    if (!appData) return null;
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task || task.frequency !== 'count-based' || !task.frequencyCount || !task.frequencyPeriod) {
      return null;
    }

    const today = new Date(selectedDate + 'T00:00:00');
    let periodBounds;
    if (task.frequencyPeriod === 'week') {
      periodBounds = getWeekBounds(today);
    } else {
      periodBounds = getMonthBounds(today);
    }

    const completionsInPeriod = appData.completions.filter(
      c => c.taskId === taskId && 
           c.date >= periodBounds.start && 
           c.date <= periodBounds.end
    ).length;

    return {
      current: completionsInPeriod,
      target: task.frequencyCount,
      period: task.frequencyPeriod === 'week' ? 'week' : 'month'
    };
  };

  /**
   * Calculate missed count for a specific task (last 7 days)
   * For count-based tasks, this should not be used - use getCountBasedProgress instead
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

  const handleTodoComplete = async () => {
    if (!selectedTodo) return;
    try {
      await toggleTodoItem(selectedTodo.id);
      setUpcomingTodos(prev => prev.filter(t => t.id !== selectedTodo.id));
      setSelectedTodo(null);
      await loadUpcomingTodos(); // Reload to refresh list
    } catch (err) {
      console.error('Error completing todo:', err);
      alert('Failed to complete todo. Please try again.');
    }
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
                    setDatePickerDate(selectedDate);
                    setShowDatePicker(true);
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  title="Pick a Date"
                >
                  📅
                </button>
              </div>
            </div>
          </div>
          <div className="desktop-action-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
              <span>{viewMode === 'dashboard' ? 'Monthly' : 'Dashboard'}</span>
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
              <span>Progress</span>
            </button>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                onClick={async () => {
                  const prompt = await buildOpenAIPrompt();
                  setOpenAIPromptText(prompt);
                  setShowOpenAIPrompt(true);
                }}
                className="btn-secondary"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  paddingRight: aiInsight ? '2.75rem' : undefined
                }}
              >
                <span>🤖</span>
                <span>AI Assistant</span>
              </button>
              {aiInsight && (
                <button 
                  onClick={() => setShowSmartCoachModal(true)}
                  title="View Coach Insights"
                  style={{ 
                    position: 'absolute',
                    right: '0.35rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255,255,255,0.25)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '1.75rem',
                    height: '1.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: 'white'
                  }}
                >
                  💡
                </button>
              )}
            </div>
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
              <span>{isReorderMode ? 'Done Reordering' : 'Reorder'}</span>
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
              <span>Hold</span>
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
            const countProgress = item.type === 'task' ? getCountBasedProgress(item.id) : null;
            
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
                        {progress.label}
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
                    {/* Count-based task progress */}
                    {item.type === 'task' && item.task && (() => {
                      const countProgress = getCountBasedProgress(item.id);
                      if (countProgress) {
                        const isComplete = countProgress.current >= countProgress.target;
                        if (isComplete) {
                          return null; // Don't show badge if completed
                        }
                        return (
                          <div className="task-stat-badge" style={{ 
                            background: countProgress.current > 0 ? '#dbeafe' : '#fee2e2',
                            color: countProgress.current > 0 ? '#1e40af' : '#991b1b'
                          }}>
                            <span className="badge-icon">{countProgress.current > 0 ? '📊' : '⏳'}</span>
                            <span className="badge-text">
                              {countProgress.current} out of {countProgress.target} done ({countProgress.period})
                            </span>
                          </div>
                        );
                      }
                      // For non-count-based tasks, show missed count
                      if (missedCount > 0) {
                        return (
                          <div className="task-stat-badge missed-badge">
                            <span className="badge-icon">❌</span>
                            <span className="badge-text">{missedCount} missed in last 7 days</span>
                          </div>
                        );
                      }
                      return null;
                    })()}
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

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div className="modal-overlay" onClick={() => setShowDatePicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <h2>📅 Select Date</h2>
              <button className="modal-close" onClick={() => setShowDatePicker(false)} style={{ color: 'white' }}>×</button>
            </div>
            <div style={{ padding: '2rem' }}>
              {/* Today's Date Display - Takes up at least 50% */}
              <div style={{
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                borderRadius: '16px',
                padding: '3rem 2rem',
                marginBottom: '2rem',
                textAlign: 'center',
                border: '2px solid #d1d5db',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1f2937', marginBottom: '0.5rem' }}>
                  {new Date(datePickerDate + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                <div style={{ fontSize: '1.25rem', color: '#6b7280', fontWeight: 500 }}>
                  {datePickerDate === today ? 'Today' : datePickerDate < today ? 'Past Date' : 'Future Date'}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    const date = new Date(datePickerDate + 'T00:00:00');
                    date.setDate(date.getDate() - 1);
                    setDatePickerDate(formatDate(date));
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.75rem 1.5rem', flex: 1 }}
                  title="Previous Day"
                >
                  ← Back
                </button>
                <button
                  onClick={() => {
                    setDatePickerDate(today);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.5rem', flex: 1 }}
                  title="Go to Today"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const date = new Date(datePickerDate + 'T00:00:00');
                    date.setDate(date.getDate() + 1);
                    setDatePickerDate(formatDate(date));
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.75rem 1.5rem', flex: 1 }}
                  title="Next Day"
                >
                  Front →
                </button>
              </div>

              {/* Date Input */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600, color: '#1f2937' }}>
                  Change Date
                </label>
                <input
                  type="date"
                  value={datePickerDate}
                  onChange={(e) => setDatePickerDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '1rem',
                    borderRadius: '8px',
                    border: '2px solid #d1d5db',
                    cursor: 'pointer'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowDatePicker(false)}
                  className="btn-secondary"
                  style={{ padding: '0.75rem 1.5rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setSelectedDate(datePickerDate);
                    setShowDatePicker(false);
                    loadItems();
                  }}
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.5rem' }}
                >
                  Reload
                </button>
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

      {/* Upcoming TODOs Section - Collapsible, above Observances */}
      {upcomingTodos.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          borderRadius: '1rem',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)',
          border: '1px solid #f59e0b',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)'
        }}>
          <button
            onClick={() => setIsTodosExpanded(!isTodosExpanded)}
            style={{
              width: '100%',
              padding: '1rem 1.25rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>📝</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, color: '#92400e', fontSize: '1rem' }}>
                  Upcoming TO-DOs
                </div>
                <div style={{ fontSize: '0.8rem', color: '#b45309' }}>
                  {isTodosExpanded 
                    ? `${upcomingTodos.length} in next 7 days`
                    : 'Tap to view upcoming TO-DOs'}
                </div>
              </div>
            </div>
            <span style={{
              transform: isTodosExpanded ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s',
              color: '#b45309',
              fontSize: '1.25rem'
            }}>
              ▼
            </span>
          </button>

          {isTodosExpanded && (
            <div style={{ 
              padding: '0 1.25rem 1.25rem', 
              borderTop: '1px solid #fcd34d',
              background: 'rgba(255,255,255,0.7)'
            }}>
              {isLoadingTodos ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#b45309' }}>
                  Loading TO-DOs...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                  {upcomingTodos.map(todo => {
                    const dueDate = todo.dueDate ? new Date(todo.dueDate + 'T00:00:00') : null;
                    const todayDate = new Date(selectedDate + 'T00:00:00');
                    const daysUntil = dueDate ? Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    
                    return (
                      <div
                        key={todo.id}
                        onClick={() => setSelectedTodo(todo)}
                        style={{
                          padding: '1rem',
                          borderRadius: '0.75rem',
                          background: 'white',
                          border: '2px solid #f59e0b',
                          borderLeftWidth: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            {todo.groupId && todoGroups[todo.groupId] && (
                              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: 500 }}>
                                {todoGroups[todo.groupId]}
                              </div>
                            )}
                            <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '0.25rem' }}>
                              {todo.text}
                            </div>
                            {todo.notes && (
                              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                                {todo.notes}
                              </p>
                            )}
                            {todo.priority && (
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '0.125rem 0.5rem',
                                background: todo.priority === 'HIGH' ? '#fee2e2' : todo.priority === 'MEDIUM' ? '#fef3c7' : '#dbeafe',
                                color: todo.priority === 'HIGH' ? '#991b1b' : todo.priority === 'MEDIUM' ? '#92400e' : '#1e40af',
                                borderRadius: '0.25rem',
                                marginTop: '0.5rem',
                                display: 'inline-block'
                              }}>
                                {todo.priority}
                              </span>
                            )}
                          </div>
                          {dueDate && (
                            <div style={{ textAlign: 'right', marginLeft: '1rem', flexShrink: 0 }}>
                              <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                {dueDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                              {daysUntil !== null && daysUntil >= 0 && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: daysUntil === 0 ? '#dc2626' : '#b45309',
                                  fontWeight: 500,
                                  marginTop: '0.25rem'
                                }}>
                                  {daysUntil === 0 ? 'Today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reference Calendar Days Section - Collapsible, loads on expand */}
      <div style={{
        marginTop: '1.5rem',
        borderRadius: '1rem',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
        border: '1px solid #818cf8',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.1)'
      }}>
        {/* Collapsible Header */}
        <button
          onClick={() => setIsObservancesExpanded(!isObservancesExpanded)}
          style={{
            width: '100%',
            padding: '1rem 1.25rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📅</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, color: '#3730a3', fontSize: '1rem' }}>
                Upcoming Observances
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4f46e5' }}>
                {isObservancesExpanded 
                  ? (observancesLoaded 
                      ? (referenceCalendarDays.length > 0 
                          ? `${referenceCalendarDays.length} in next 7 days` 
                          : 'None in next 7 days')
                      : 'Loading...')
                  : 'Tap to view holidays & special days'}
              </div>
            </div>
          </div>
          <span style={{
            transform: isObservancesExpanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            color: '#4f46e5',
            fontSize: '1.25rem'
          }}>
            ▼
          </span>
        </button>

        {/* Expanded Content */}
        {isObservancesExpanded && (
          <div style={{ 
            padding: '0 1.25rem 1.25rem', 
            borderTop: '1px solid #a5b4fc',
            background: 'rgba(255,255,255,0.7)'
          }}>
            {/* Loading state */}
            {isLoadingObservances && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#4f46e5' }}>
                Loading observances...
              </div>
            )}

            {/* Empty state - no upcoming observances */}
            {!isLoadingObservances && observancesLoaded && referenceCalendarDays.length === 0 && (
              <div style={{
                padding: '1.5rem',
                textAlign: 'center',
                background: '#f9fafb',
                borderRadius: '0.75rem',
                border: '1px dashed #d1d5db',
                marginTop: '1rem'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                  No upcoming observances in the next 7 days
                </p>
                <p style={{ margin: '0.5rem 0 0', color: '#9ca3af', fontSize: '0.8rem' }}>
                  Enable reference calendars in Events → 📅 Reference Calendars to see holidays & special days
                </p>
              </div>
            )}

            {/* Observances list */}
            {!isLoadingObservances && referenceCalendarDays.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                {referenceCalendarDays.slice(0, 5).map(day => {
                  const isToday = day.date === selectedDate;
                  const dayDate = new Date(day.date + 'T00:00:00');
                  const daysUntil = Math.ceil((dayDate.getTime() - new Date(selectedDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div
                      key={day.id}
                      onClick={() => setSelectedObservance(day)}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        background: isToday ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 'white',
                        border: `2px solid ${isToday ? '#f59e0b' : day.primaryColor || '#e5e7eb'}`,
                        borderLeftWidth: '4px',
                        borderLeftColor: day.primaryColor || '#6366f1',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            {day.icon && <span style={{ fontSize: '1.25rem' }}>{day.icon}</span>}
                            <span style={{ fontWeight: 600, color: '#1f2937' }}>{day.eventName}</span>
                            {isToday && (
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '0.125rem 0.5rem',
                                background: '#f59e0b',
                                color: 'white',
                                borderRadius: '9999px',
                                fontWeight: 600
                              }}>
                                TODAY
                              </span>
                            )}
                          </div>
                          {day.significance && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                              {day.significance}
                            </p>
                          )}
                          {day.calendarNames && day.calendarNames.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                              {day.calendarNames.map(name => (
                                <span
                                  key={name}
                                  style={{
                                    fontSize: '0.7rem',
                                    padding: '0.125rem 0.5rem',
                                    background: '#f3f4f6',
                                    color: '#6b7280',
                                    borderRadius: '0.25rem'
                                  }}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', marginLeft: '1rem', flexShrink: 0 }}>
                          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                            {dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          {daysUntil > 0 && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#6366f1',
                              fontWeight: 500,
                              marginTop: '0.25rem'
                            }}>
                              in {daysUntil} day{daysUntil > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {referenceCalendarDays.length > 5 && (
                  <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0 0' }}>
                    +{referenceCalendarDays.length - 5} more observances in the next 7 days
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ResolutionProgressWidget />

      <WeatherWidget />

      {/* Mobile Action Buttons - shown only on mobile after weather */}
      <div className="mobile-action-buttons" style={{
        display: 'none', // Hidden by default, shown via CSS on mobile
        flexWrap: 'nowrap',
        gap: '0.5rem',
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(255,255,255,0.9)',
        borderRadius: '0.75rem',
        justifyContent: 'flex-start',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => setViewMode(viewMode === 'dashboard' ? 'monthly' : 'dashboard')}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', flexShrink: 0 }}
        >
          <span>{viewMode === 'dashboard' ? '📅' : '🏠'}</span>
          <span>{viewMode === 'dashboard' ? 'Monthly' : 'Dashboard'}</span>
        </button>
        <button 
          onClick={() => setShowProgressAndReview(true)}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem', flexShrink: 0 }}
        >
          <span>📊</span>
          <span>Progress</span>
        </button>
        <button
          onClick={async () => {
            const prompt = await buildOpenAIPrompt();
            setOpenAIPromptText(prompt);
            setShowOpenAIPrompt(true);
          }}
          className="btn-secondary"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            flexShrink: 0
          }}
        >
          <span>🤖</span>
          <span>AI</span>
          {aiInsight && <span>💡</span>}
        </button>
        <button 
          onClick={() => setIsReorderMode(!isReorderMode)}
          className="btn-secondary"
          style={{ 
            background: isReorderMode ? '#667eea' : 'white',
            color: isReorderMode ? 'white' : '#667eea',
            border: '2px solid #667eea',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            flexShrink: 0
          }}
        >
          <span>{isReorderMode ? '✓' : '↕️'}</span>
          <span>Reorder</span>
        </button>
        <button 
          onClick={() => setShowBulkHoldModal(true)}
          className="btn-secondary"
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            background: 'white',
            color: '#f97316',
            border: '2px solid #f97316',
            flexShrink: 0
          }}
        >
          <span>⏸️</span>
          <span>Hold</span>
        </button>
      </div>

      {/* Observance Details Modal */}
      {selectedObservance && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1rem'
          }}
          onClick={() => setSelectedObservance(null)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '1rem',
              padding: '1.5rem',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                {selectedObservance.icon && <span style={{ fontSize: '2rem' }}>{selectedObservance.icon}</span>}
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: '#1f2937' }}>
                    {selectedObservance.eventName}
                  </h2>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>
                    {new Date(selectedObservance.date + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedObservance(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                  padding: '0.25rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Event Category and Type */}
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selectedObservance.eventCategory && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  borderRadius: '0.5rem',
                  fontWeight: 500
                }}>
                  {selectedObservance.eventCategory}
                </span>
              )}
              {selectedObservance.eventType && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  borderRadius: '0.5rem',
                  fontWeight: 500
                }}>
                  {selectedObservance.eventType}
                </span>
              )}
              {selectedObservance.importanceLevel && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: '0.5rem',
                  fontWeight: 600
                }}>
                  {selectedObservance.importanceLevel}% Important
                </span>
              )}
            </div>

            {selectedObservance.significance && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>About</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280', lineHeight: '1.6' }}>
                  {selectedObservance.significance}
                </p>
              </div>
            )}

            {selectedObservance.eventDescription && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Description</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280', lineHeight: '1.6' }}>
                  {selectedObservance.eventDescription}
                </p>
              </div>
            )}

            {/* Observance Rules */}
            {selectedObservance.observanceRule && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #fcd34d' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>📋 Observance Rule</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f', lineHeight: '1.5' }}>
                  {selectedObservance.observanceRule}
                </p>
              </div>
            )}

            {/* Holiday Status */}
            {(selectedObservance.isPublicHoliday || selectedObservance.isBankHoliday || selectedObservance.isSchoolHoliday) && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Holiday Status</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedObservance.isPublicHoliday && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      <span>🏛️</span>
                      <span>Public Holiday</span>
                    </div>
                  )}
                  {selectedObservance.isBankHoliday && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      <span>🏦</span>
                      <span>Bank Holiday</span>
                    </div>
                  )}
                  {selectedObservance.isSchoolHoliday && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      <span>🎓</span>
                      <span>School Holiday</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Local Customs */}
            {selectedObservance.localCustoms && selectedObservance.localCustoms.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Local Customs</h3>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#6b7280', lineHeight: '1.8' }}>
                  {selectedObservance.localCustoms.map((custom, idx) => (
                    <li key={idx}>{custom}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedObservance.urls && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Learn More</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedObservance.urls.wikipedia && (
                    <a 
                      href={selectedObservance.urls.wikipedia} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        color: '#3b82f6',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <span>📚</span>
                      <span>Wikipedia</span>
                    </a>
                  )}
                  {selectedObservance.urls.youtube && (
                    <a 
                      href={selectedObservance.urls.youtube} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        color: '#ef4444',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <span>▶️</span>
                      <span>YouTube</span>
                    </a>
                  )}
                  {selectedObservance.urls.official && (
                    <a 
                      href={selectedObservance.urls.official} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{
                        color: '#10b981',
                        textDecoration: 'none',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <span>🌐</span>
                      <span>Official Website</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {selectedObservance.calendarNames && selectedObservance.calendarNames.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Calendars</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedObservance.calendarNames.map(name => (
                    <span
                      key={name}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.25rem 0.75rem',
                        background: '#f3f4f6',
                        color: '#6b7280',
                        borderRadius: '0.5rem'
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedObservance.mythology && selectedObservance.mythology.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Mythology & Stories</h3>
                <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', color: '#6b7280', lineHeight: '1.6' }}>
                  {selectedObservance.mythology.map((story, idx) => (
                    <li key={idx} style={{ marginBottom: '0.5rem' }}>{story}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Regional Variations */}
            {selectedObservance.regionalVariations && selectedObservance.regionalVariations.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Regional Variations</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedObservance.regionalVariations.map((variation, idx) => (
                    <div key={idx} style={{ 
                      padding: '0.75rem', 
                      background: '#f9fafb', 
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb'
                    }}>
                      {(variation.region || variation.state || variation.country) && (
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.25rem' }}>
                          {variation.region || variation.state || variation.country}
                        </div>
                      )}
                      {variation.custom && (
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: '1.5' }}>
                          {variation.custom}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mood */}
            {selectedObservance.mood && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Mood</h3>
                <span style={{
                  fontSize: '0.9rem',
                  padding: '0.5rem 1rem',
                  background: selectedObservance.mood === 'celebratory' ? '#fef3c7' : 
                             selectedObservance.mood === 'solemn' ? '#f3f4f6' : '#e0e7ff',
                  color: selectedObservance.mood === 'celebratory' ? '#92400e' : 
                         selectedObservance.mood === 'solemn' ? '#374151' : '#3730a3',
                  borderRadius: '0.5rem',
                  fontWeight: 500,
                  textTransform: 'capitalize'
                }}>
                  {selectedObservance.mood}
                </span>
              </div>
            )}

            {/* Tags */}
            {selectedObservance.tags && selectedObservance.tags.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Tags</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {selectedObservance.tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.25rem 0.75rem',
                        background: '#e0e7ff',
                        color: '#3730a3',
                        borderRadius: '0.5rem'
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TO-DO Action Modal */}
      {selectedTodo && (
        <div className="modal-overlay" onClick={() => setSelectedTodo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedTodo.text}</h3>
              {selectedTodo.groupId && todoGroups[selectedTodo.groupId] && (
                <p className="modal-description" style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  📁 {todoGroups[selectedTodo.groupId]}
                </p>
              )}
              {selectedTodo.notes && <p className="modal-description">{selectedTodo.notes}</p>}
              {selectedTodo.dueDate && (
                <p className="modal-description" style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  📅 Due: {new Date(selectedTodo.dueDate + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              )}
              {selectedTodo.priority && (
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  background: selectedTodo.priority === 'HIGH' ? '#fee2e2' : selectedTodo.priority === 'MEDIUM' ? '#fef3c7' : '#dbeafe',
                  color: selectedTodo.priority === 'HIGH' ? '#991b1b' : selectedTodo.priority === 'MEDIUM' ? '#92400e' : '#1e40af',
                  borderRadius: '0.5rem',
                  marginTop: '0.5rem',
                  display: 'inline-block'
                }}>
                  {selectedTodo.priority} Priority
                </span>
              )}
            </div>
            
            <div className="modal-body">
              <p className="modal-question">What would you like to do?</p>
              
              <div className="modal-actions">
                <button 
                  className="modal-btn modal-btn-complete"
                  onClick={handleTodoComplete}
                >
                  <span className="btn-icon-large">✓</span>
                  <span className="btn-text">
                    <strong>Mark as Complete</strong>
                    <small>I finished this task</small>
                  </span>
                </button>
                
                <button 
                  className="modal-btn modal-btn-cancel"
                  onClick={() => setSelectedTodo(null)}
                >
                  <span className="btn-icon-large">✕</span>
                  <span className="btn-text">
                    <strong>Cancel</strong>
                    <small>Go back</small>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TodayView;
