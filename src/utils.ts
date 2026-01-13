import { Task } from './types';

export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayString = (date?: Date): string => {
  return formatDate(date || new Date());
};

export const shouldTaskShowToday = (task: Task): boolean => {
  const today = new Date();
  const todayStr = getTodayString();
  const dayOfWeek = today.getDay(); // 0-6
  const dayOfMonth = today.getDate(); // 1-31

  // Check if task is on hold
  if (task.onHold) {
    // Check if hold should automatically end
    if (task.holdEndDate && todayStr > task.holdEndDate) {
      // Hold period has ended, task should show (need to update task status)
      return true;
    }
    // Task is on hold and hold hasn't ended
    return false;
  }

  // Check start date - task shouldn't appear before this date
  if (task.startDate && todayStr < task.startDate) {
    return false;
  }

  // Check end date - task shouldn't appear after this date
  if (task.endDate && todayStr > task.endDate) {
    return false;
  }

  // Check specific date - for one-time tasks
  if (task.specificDate) {
    return todayStr === task.specificDate;
  }

  // Now check frequency-based logic
  switch (task.frequency) {
    case 'daily':
      return true;
    
    case 'weekly':
      if (task.daysOfWeek && task.daysOfWeek.length > 0) {
        return task.daysOfWeek.includes(dayOfWeek);
      }
      return false;
    
    case 'monthly':
      if (task.dayOfMonth) {
        return dayOfMonth === task.dayOfMonth;
      }
      return false;
    
    case 'count-based':
      // Count-based tasks always show until the count is met for the period
      return true;
    
    case 'custom':
      // For custom frequency, we'll check if it matches today
      if (task.customFrequency) {
        // Simple parsing for "1st of every month", "15th of every month", etc.
        const monthMatch = task.customFrequency.match(/(\d+)(st|nd|rd|th)\s+of\s+every\s+month/i);
        if (monthMatch) {
          const day = parseInt(monthMatch[1]);
          return dayOfMonth === day;
        }
        // Add more custom frequency patterns as needed
      }
      return false;
    
    case 'interval':
      // Check if task should show based on interval
      if (!task.intervalValue || !task.intervalUnit || !task.intervalStartDate) {
        return false;
      }
      
      const startDate = new Date(task.intervalStartDate);
      const currentDate = new Date(todayStr);
      
      // Calculate the difference in the appropriate unit
      const diffInMs = currentDate.getTime() - startDate.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      
      let shouldShow = false;
      
      switch (task.intervalUnit) {
        case 'days':
          shouldShow = diffInDays >= 0 && diffInDays % task.intervalValue === 0;
          break;
          
        case 'weeks':
          const diffInWeeks = Math.floor(diffInDays / 7);
          shouldShow = diffInDays >= 0 && diffInWeeks % task.intervalValue === 0 && (diffInDays % 7 === 0);
          break;
          
        case 'months':
          // Calculate month difference
          const startMonth = startDate.getMonth();
          const startYear = startDate.getFullYear();
          const currentMonth = currentDate.getMonth();
          const currentYear = currentDate.getFullYear();
          const monthsDiff = (currentYear - startYear) * 12 + (currentMonth - startMonth);
          
          // Check if it's the same day of month and the month interval matches
          shouldShow = currentDate.getDate() === startDate.getDate() && 
                       monthsDiff >= 0 && 
                       monthsDiff % task.intervalValue === 0;
          break;
          
        case 'years':
          // Calculate year difference
          const yearsDiff = currentDate.getFullYear() - startDate.getFullYear();
          
          // Check if it's the same day and month, and the year interval matches
          shouldShow = currentDate.getDate() === startDate.getDate() &&
                       currentDate.getMonth() === startDate.getMonth() &&
                       yearsDiff >= 0 &&
                       yearsDiff % task.intervalValue === 0;
          break;
      }
      
      return shouldShow;
    
    default:
      return false;
  }
};

export const getWeekBounds = (date: Date): { start: string; end: string } => {
  const day = date.getDay();
  const diff = date.getDate() - day; // Sunday as start of week
  
  const sunday = new Date(date);
  sunday.setDate(diff);
  sunday.setHours(0, 0, 0, 0);
  
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);
  
  return {
    start: formatDate(sunday),
    end: formatDate(saturday)
  };
};

export const getMonthBounds = (date: Date): { start: string; end: string } => {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  
  return {
    start: formatDate(firstDay),
    end: formatDate(lastDay)
  };
};

export const isDateInRange = (date: string, start: string, end: string): boolean => {
  return date >= start && date <= end;
};

export const getTasksForToday = (tasks: Task[]): Task[] => {
  return tasks.filter(shouldTaskShowToday);
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const getColorForTask = (index: number): string => {
  const colors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];
  return colors[index % colors.length];
};

