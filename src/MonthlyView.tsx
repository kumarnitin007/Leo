import React, { useState, useEffect } from 'react';
import { Task, TaskCompletion, Event } from './types';
import { loadData, completeTask, isTaskCompletedToday } from './storage';
import { formatDate, shouldTaskShowToday, getWeekBounds, getMonthBounds } from './utils';
import DayDetailsModal from './components/DayDetailsModal';

interface MonthlyViewProps {
  onNavigate?: (view: string) => void;
  onBackToDashboard?: () => void;
}

const MonthlyView: React.FC<MonthlyViewProps> = ({ onNavigate, onBackToDashboard }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadMonthData();
  }, [currentDate]);

  const loadMonthData = async () => {
    try {
      const data = await loadData();
      setTasks(data.tasks);
      setCompletions(data.completions);
      setEvents(data.events);
    } catch (error) {
      console.error('Error loading monthly data:', error);
      setTasks([]);
      setCompletions([]);
      setEvents([]);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: Date[] = [];
    
    // Add days from previous month to fill the week
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = new Date(year, month, -i);
      days.push(day);
    }
    
    // Add all days in current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  const getTasksForDate = (date: Date): Task[] => {
    const dateStr = formatDate(date);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    
    return tasks.filter(task => {
      if (task.frequency === 'daily') {
        return true;
      } else if (task.frequency === 'weekly') {
        return task.daysOfWeek?.includes(dayOfWeek) || false;
      } else if (task.frequency === 'monthly') {
        return task.dayOfMonth === dayOfMonth;
      } else if (task.frequency === 'count-based') {
        // For count-based tasks, only show if not yet completed the required number of times in the period
        if (task.frequencyCount && task.frequencyPeriod) {
          // Get period bounds
          let periodBounds;
          if (task.frequencyPeriod === 'week') {
            periodBounds = getWeekBounds(date);
          } else {
            periodBounds = getMonthBounds(date);
          }
          
          // Count completions in this period
          const completionsInPeriod = completions.filter(
            c => c.taskId === task.id && 
                 c.date >= periodBounds.start && 
                 c.date <= periodBounds.end
          ).length;
          
          // Only show if not yet completed the required number of times
          return completionsInPeriod < task.frequencyCount;
        }
        return true; // Fallback: show if frequencyCount/frequencyPeriod not set
      } else if (task.frequency === 'custom') {
        if (task.customFrequency) {
          const monthMatch = task.customFrequency.match(/(\d+)(st|nd|rd|th)\s+of\s+every\s+month/i);
          if (monthMatch) {
            const day = parseInt(monthMatch[1]);
            return dayOfMonth === day;
          }
        }
      }
      return false;
    });
  };

  const getCompletionsForDate = (date: Date): TaskCompletion[] => {
    const dateStr = formatDate(date);
    return completions.filter(c => c.date === dateStr);
  };

  const getEventsForDate = (date: Date): Event[] => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const mmdd = `${month}-${day}`;
    const fullDate = formatDate(date);
    
    return events.filter(event => {
      if (event.hideFromDashboard) return false;
      
      // Yearly events (birthdays, anniversaries)
      if (event.frequency === 'yearly') {
        return event.date === mmdd;
      }
      
      // One-time events
      if (event.frequency === 'one-time') {
        return event.date === fullDate;
      }
      
      return false;
    });
  };

  const getCompletionRate = (date: Date): number => {
    const tasksForDay = getTasksForDate(date);
    if (tasksForDay.length === 0) return 0;
    
    // Only count completions for tasks that should appear on this date
    const tasksForDayIds = new Set(tasksForDay.map(t => t.id));
    const dateStr = formatDate(date);
    const completedCount = completions.filter(
      c => c.date === dateStr && tasksForDayIds.has(c.taskId)
    ).length;
    
    return Math.round((completedCount / tasksForDay.length) * 100);
  };

  const getColorForRate = (rate: number): string => {
    if (rate === 0) return '#ef4444'; // red
    if (rate < 50) return '#f59e0b'; // orange
    if (rate < 100) return '#3b82f6'; // blue
    return '#10b981'; // green
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth();
  };

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = getDaysInMonth();

  return (
    <div className="monthly-view">
      <div className="view-header">
        <h2>Monthly View</h2>
      </div>

      <div className="calendar-container">
        <div className="calendar-header">
          <button className="btn-secondary" onClick={previousMonth}>
            ← Previous
          </button>
          <h3>{monthName}</h3>
          <button className="btn-secondary" onClick={nextMonth}>
            Next →
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {onBackToDashboard && (
            <button className="btn-secondary" onClick={onBackToDashboard}>
              🏠 Back to Dashboard
            </button>
          )}
          <button className="btn-primary" onClick={goToToday}>
            📅 Go to Today
          </button>
        </div>

        <div className="calendar-legend">
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Task Completion:</div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#10b981' }}></span>
            <span>100% Complete</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#3b82f6' }}></span>
            <span>50-99% Complete</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#f59e0b' }}></span>
            <span>1-49% Complete</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: '#ef4444' }}></span>
            <span>0% Complete</span>
          </div>
          
          <div style={{ marginTop: '1rem', marginBottom: '0.5rem', fontWeight: 600 }}>Events:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.875rem' }}>
            <span>🎂 Birthday</span>
            <span>💍 Anniversary</span>
            <span>🎉 Holiday</span>
            <span>🎊 Festival</span>
            <span>🕯️ Memorial</span>
            <span>📅 Other</span>
          </div>
        </div>

        <div className="calendar-grid">
          {weekdays.map(day => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}
          
          {days.map((day, index) => {
            const tasksForDay = getTasksForDate(day);
            const completionRate = getCompletionRate(day);
            const hasAnyTasks = tasksForDay.length > 0;
            const eventsForDay = getEventsForDate(day);
            const hasEvents = eventsForDay.length > 0;
            const monthAbbr = day.toLocaleString('en-US', { month: 'short' });
            
            return (
              <div
                key={index}
                className={`calendar-day ${!isCurrentMonth(day) ? 'other-month' : ''} ${isToday(day) ? 'today' : ''}`}
                onClick={() => setSelectedDate(formatDate(day))}
                style={{ cursor: 'pointer' }}
              >
                <div className="day-number">{monthAbbr} {day.getDate()}</div>
                
                {hasAnyTasks && (
                  <div className="day-tasks">
                    <div 
                      className="task-indicator"
                      style={{ 
                        background: getColorForRate(completionRate),
                        width: '100%',
                        height: '4px',
                        borderRadius: '2px',
                        marginTop: '4px'
                      }}
                      title={`${completionRate}% complete`}
                    />
                    <div className="task-count">
                      {(() => {
                        // Only count completions for tasks that should appear on this date
                        const tasksForDayIds = new Set(tasksForDay.map(t => t.id));
                        const relevantCompletions = getCompletionsForDate(day).filter(
                          c => tasksForDayIds.has(c.taskId)
                        );
                        return `${relevantCompletions.length}/${tasksForDay.length} tasks`;
                      })()}
                    </div>
                  </div>
                )}
                
                {hasEvents && (
                  <div className="day-events" style={{ marginTop: hasAnyTasks ? '4px' : '8px' }}>
                    {eventsForDay.map(event => {
                      const eventEmoji = 
                        event.category === 'Birthday' ? '🎂' :
                        event.category === 'Anniversary' ? '💍' :
                        event.category === 'Wedding' ? '💒' :
                        event.category === 'Death Anniversary' ? '🕯️' :
                        event.category === 'Memorial' ? '🌹' :
                        event.category === 'Holiday' ? '🎉' :
                        event.category === 'Festival' ? '🎊' :
                        event.category === 'Special Day' ? '⭐' :
                        '📅';
                      
                      return (
                        <div 
                          key={event.id}
                          className="event-indicator"
                          style={{
                            display: 'inline-block',
                            fontSize: '14px',
                            margin: '2px',
                            cursor: 'pointer'
                          }}
                          title={`${event.name}${event.description ? ': ' + event.description : ''}`}
                        >
                          {eventEmoji}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDate && (() => {
        // Get actual completions for the selected date from the database
        const selectedDateObj = new Date(selectedDate + 'T00:00:00');
        const actualCompletionsForDate = getCompletionsForDate(selectedDateObj);
        const actualCompletedTaskIds = new Set(actualCompletionsForDate.map(c => c.taskId));
        
        // Merge with any in-memory completions (from modal interactions)
        const mergedCompletedTaskIds = new Set([...actualCompletedTaskIds, ...completedTaskIds]);
        
        return (
          <DayDetailsModal
            date={selectedDate}
            tasks={getTasksForDate(selectedDateObj)}
            events={events}
            completedTaskIds={mergedCompletedTaskIds}
            onClose={() => {
              setSelectedDate(null);
              setCompletedTaskIds(new Set()); // Reset in-memory completions when modal closes
            }}
            onCompleteTask={async (taskId) => {
              await completeTask(taskId, selectedDate);
              setCompletedTaskIds(prev => new Set(prev).add(taskId));
              await loadMonthData();
            }}
          />
        );
      })()}
    </div>
  );
};

export default MonthlyView;

