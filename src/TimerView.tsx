/**
 * Timer View - Standalone timer access
 * 
 * Four modes:
 * 1. Task-based timer with end time (countdown to task's scheduled end)
 * 2. Task-based timer with custom duration
 * 3. Standalone timer (no task) - countdown or count-up
 * 4. Schedule Timer - Multi-activity timer with configurable schedule
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task } from './types';
import { loadData, completeTask } from './storage';
import { getTodayString } from './utils';
import CountdownTimer from './components/CountdownTimer';
import getSupabaseClient from './lib/supabase';

type TimerMode = 'select' | 'task-endtime' | 'task-duration' | 'standalone' | 'schedule' | 'schedule-running';

// Schedule Timer Types
interface ScheduleActivity {
  id: string;
  name: string;
  durationMinutes: number;
}

interface SavedSchedule {
  id: string;
  name: string;
  activities: ScheduleActivity[];
  createdAt: string;
}

// LocalStorage key for schedules (fallback when not logged in)
const SCHEDULES_STORAGE_KEY = 'leo-timer-schedules';

interface TimerViewProps {
  onClose?: () => void;
}

const TimerView: React.FC<TimerViewProps> = ({ onClose }) => {
  const [mode, setMode] = useState<TimerMode>('select');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [customDuration, setCustomDuration] = useState({ hours: 0, minutes: 25 });
  const [showTimer, setShowTimer] = useState(false);
  const [timerConfig, setTimerConfig] = useState<any>(null);

  // Schedule Timer State
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<SavedSchedule | null>(null);
  const [newScheduleName, setNewScheduleName] = useState('My Schedule');
  const [scheduleActivities, setScheduleActivities] = useState<ScheduleActivity[]>([
    { id: '1', name: '', durationMinutes: 25 }
  ]);
  const [isScheduleFormExpanded, setIsScheduleFormExpanded] = useState(false);
  
  // Running Schedule State
  const [runningSchedule, setRunningSchedule] = useState<SavedSchedule | null>(null);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [activitySecondsRemaining, setActivitySecondsRemaining] = useState(0);
  const [isSchedulePaused, setIsSchedulePaused] = useState(false);
  const scheduleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadTasks();
    loadSchedules();
  }, []);

  // Load saved schedules from Supabase (or localStorage fallback)
  const loadSchedules = async () => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from('myday_timer_schedules')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
          
          if (!error && data) {
            const schedules: SavedSchedule[] = data.map(row => ({
              id: row.id,
              name: row.name,
              activities: row.activities || [],
              createdAt: row.created_at
            }));
            setSavedSchedules(schedules);
            // Also cache to localStorage
            localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
            return;
          }
        }
      }
      // Fallback to localStorage
      const saved = localStorage.getItem(SCHEDULES_STORAGE_KEY);
      if (saved) {
        setSavedSchedules(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading schedules:', e);
      // Fallback to localStorage on error
      try {
        const saved = localStorage.getItem(SCHEDULES_STORAGE_KEY);
        if (saved) {
          setSavedSchedules(JSON.parse(saved));
        }
      } catch {}
    }
  };

  // Save a single schedule to Supabase (or localStorage fallback)
  const saveScheduleToDb = async (schedule: SavedSchedule, isUpdate: boolean): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          if (isUpdate) {
            const { error } = await supabase
              .from('myday_timer_schedules')
              .update({
                name: schedule.name,
                activities: schedule.activities,
                updated_at: new Date().toISOString()
              })
              .eq('id', schedule.id)
              .eq('user_id', user.id);
            
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('myday_timer_schedules')
              .insert({
                id: schedule.id,
                user_id: user.id,
                name: schedule.name,
                activities: schedule.activities,
                created_at: schedule.createdAt,
                updated_at: schedule.createdAt
              });
            
            if (error) throw error;
          }
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Error saving schedule to DB:', e);
      return false;
    }
  };

  // Delete a schedule from Supabase
  const deleteScheduleFromDb = async (id: string): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { error } = await supabase
            .from('myday_timer_schedules')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
          
          if (error) throw error;
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Error deleting schedule from DB:', e);
      return false;
    }
  };

  // Save schedules to localStorage (as cache/fallback)
  const saveSchedulesToStorage = (schedules: SavedSchedule[]) => {
    try {
      localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
      setSavedSchedules(schedules);
    } catch (e) {
      console.error('Error saving schedules to localStorage:', e);
    }
  };

  // Add a new activity row
  const addActivityRow = () => {
    setScheduleActivities(prev => [
      ...prev,
      { id: Date.now().toString(), name: '', durationMinutes: 25 }
    ]);
  };

  // Remove an activity row
  const removeActivityRow = (id: string) => {
    if (scheduleActivities.length <= 1) return;
    setScheduleActivities(prev => prev.filter(a => a.id !== id));
  };

  // Update an activity
  const updateActivity = (id: string, field: 'name' | 'durationMinutes', value: string | number) => {
    setScheduleActivities(prev => prev.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    ));
  };

  // Save the current schedule
  const saveSchedule = async () => {
    const validActivities = scheduleActivities.filter(a => a.name.trim() && a.durationMinutes > 0);
    if (validActivities.length === 0) {
      alert('Please add at least one activity with a name and duration');
      return;
    }

    const isUpdate = !!editingSchedule;
    const schedule: SavedSchedule = {
      id: editingSchedule?.id || Date.now().toString(),
      name: newScheduleName.trim() || 'My Schedule',
      activities: validActivities,
      createdAt: editingSchedule?.createdAt || new Date().toISOString()
    };

    // Save to DB
    await saveScheduleToDb(schedule, isUpdate);

    // Update local state and localStorage cache
    let updated: SavedSchedule[];
    if (isUpdate) {
      updated = savedSchedules.map(s => s.id === schedule.id ? schedule : s);
    } else {
      updated = [...savedSchedules, schedule];
    }

    saveSchedulesToStorage(updated);
    resetScheduleEditor();
    alert('Schedule saved!');
  };

  // Delete a schedule
  const deleteSchedule = async (id: string) => {
    if (confirm('Delete this schedule?')) {
      await deleteScheduleFromDb(id);
      saveSchedulesToStorage(savedSchedules.filter(s => s.id !== id));
    }
  };

  // Edit an existing schedule
  const editSchedule = (schedule: SavedSchedule) => {
    setEditingSchedule(schedule);
    setNewScheduleName(schedule.name);
    setScheduleActivities([...schedule.activities]);
  };

  // Reset editor
  const resetScheduleEditor = () => {
    setEditingSchedule(null);
    setNewScheduleName('My Schedule');
    setScheduleActivities([{ id: '1', name: '', durationMinutes: 25 }]);
  };

  // Start running a schedule
  const startSchedule = (schedule: SavedSchedule) => {
    setRunningSchedule(schedule);
    setCurrentActivityIndex(0);
    setActivitySecondsRemaining(schedule.activities[0].durationMinutes * 60);
    setIsSchedulePaused(false);
    setMode('schedule-running');
  };

  // Schedule timer tick
  useEffect(() => {
    if (mode === 'schedule-running' && runningSchedule && !isSchedulePaused) {
      scheduleIntervalRef.current = setInterval(() => {
        setActivitySecondsRemaining(prev => {
          if (prev <= 1) {
            // Move to next activity
            const nextIndex = currentActivityIndex + 1;
            if (nextIndex >= runningSchedule.activities.length) {
              // Schedule complete
              clearInterval(scheduleIntervalRef.current!);
              playCompletionSound();
              alert('🎉 Schedule completed! Great job!');
              setMode('schedule');
              setRunningSchedule(null);
              return 0;
            } else {
              // Start next activity
              playActivityChangeSound();
              setCurrentActivityIndex(nextIndex);
              return runningSchedule.activities[nextIndex].durationMinutes * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (scheduleIntervalRef.current) {
        clearInterval(scheduleIntervalRef.current);
      }
    };
  }, [mode, runningSchedule, isSchedulePaused, currentActivityIndex]);

  // Play completion sound
  const playCompletionSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {}
  };

  // Play activity change sound
  const playActivityChangeSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 660;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {}
  };

  // Format seconds to MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate total remaining time for schedule
  const getTotalRemainingTime = (): number => {
    if (!runningSchedule) return 0;
    let total = activitySecondsRemaining;
    for (let i = currentActivityIndex + 1; i < runningSchedule.activities.length; i++) {
      total += runningSchedule.activities[i].durationMinutes * 60;
    }
    return total;
  };

  // Stop running schedule
  const stopSchedule = () => {
    if (confirm('Stop the schedule? Progress will be lost.')) {
      if (scheduleIntervalRef.current) {
        clearInterval(scheduleIntervalRef.current);
      }
      setMode('schedule');
      setRunningSchedule(null);
      setCurrentActivityIndex(0);
      setActivitySecondsRemaining(0);
      setIsSchedulePaused(false);
    }
  };

  // Parse duration from task name (e.g., "Study 30 mins" -> 30, "Yoga 10 minutes" -> 10, "Meeting 1 hour" -> 60)
  const parseDurationFromTaskName = (taskName: string): { hours: number; minutes: number } => {
    const name = taskName.toLowerCase();
    
    // Match patterns like "30 mins", "30 minutes", "30min", "30m"
    const minuteMatch = name.match(/(\d+)\s*(min|mins|minute|minutes|m)(?!\w)/);
    if (minuteMatch) {
      const mins = parseInt(minuteMatch[1]);
      return { hours: 0, minutes: mins };
    }
    
    // Match patterns like "1 hour", "2 hours", "1hr", "2hrs", "1h"
    const hourMatch = name.match(/(\d+)\s*(hour|hours|hr|hrs|h)(?!\w)/);
    if (hourMatch) {
      const hrs = parseInt(hourMatch[1]);
      return { hours: hrs, minutes: 0 };
    }
    
    // Match patterns like "1h 30m", "1 hour 30 minutes"
    const combinedMatch = name.match(/(\d+)\s*(h|hour|hours|hr|hrs)\s*(\d+)\s*(m|min|mins|minute|minutes)/);
    if (combinedMatch) {
      const hrs = parseInt(combinedMatch[1]);
      const mins = parseInt(combinedMatch[3]);
      return { hours: hrs, minutes: mins };
    }
    
    // Default to 25 minutes (Pomodoro technique)
    return { hours: 0, minutes: 25 };
  };

  const loadTasks = async () => {
    try {
      const data = await loadData();
      setTasks(data.tasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  };

  const getTasksWithEndTime = (): Task[] => {
    return tasks.filter(t => t.endTime); // Assuming tasks can have an endTime field
  };

  const startTaskEndTimeTimer = (task: Task) => {
    if (!task.endTime) {
      alert('This task does not have an end time set.');
      return;
    }

    const now = new Date();
    const [hours, minutes] = task.endTime.split(':').map(Number);
    const endTime = new Date(now);
    endTime.setHours(hours, minutes, 0, 0);

    // If end time is in the past today, assume it's tomorrow
    if (endTime <= now) {
      endTime.setDate(endTime.getDate() + 1);
    }

    const diffMs = endTime.getTime() - now.getTime();
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));

    if (diffMinutes <= 0) {
      alert('Task end time has already passed!');
      return;
    }

    setTimerConfig({
      task,
      mode: 'countdown',
      durationMinutes: diffMinutes,
      startNow: true
    });
    setShowTimer(true);
  };

  const startTaskDurationTimer = (task: Task, hours: number, minutes: number) => {
    const totalMinutes = (hours * 60) + minutes;
    if (totalMinutes === 0) {
      alert('Please set a duration greater than 0');
      return;
    }

    setTimerConfig({
      task,
      mode: 'countdown',
      durationMinutes: totalMinutes,
      startNow: false
    });
    setShowTimer(true);
  };

  const startStandaloneTimer = (hours: number, minutes: number, isCountUp: boolean) => {
    const totalMinutes = (hours * 60) + minutes;
    
    if (!isCountUp && totalMinutes === 0) {
      alert('Please set a duration greater than 0 for countdown');
      return;
    }

    setTimerConfig({
      task: null,
      mode: isCountUp ? 'countup' : 'countdown',
      durationMinutes: totalMinutes,
      startNow: false
    });
    setShowTimer(true);
  };

  const handleTimerComplete = async (durationMinutes?: number) => {
    // Mark task as complete if it's a real task (not standalone)
    if (timerConfig?.task && timerConfig.task.id !== 'standalone') {
      try {
        const today = getTodayString();
        await completeTask(timerConfig.task.id, today, durationMinutes);
        
        // Check for dependent tasks and auto-complete them
        const data = await loadData();
        const dependentTasks = data.tasks.filter(t => 
          t.dependentTaskIds && t.dependentTaskIds.includes(timerConfig.task!.id)
        );
        
        for (const depTask of dependentTasks) {
          await completeTask(depTask.id, today);
        }
        
        alert(`✅ Task completed! ${durationMinutes ? `Time: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m` : ''}`);
      } catch (error) {
        console.error('Error completing task:', error);
        alert('Failed to complete task. Please try again.');
      }
    }
    
    setShowTimer(false);
    setTimerConfig(null);
    setMode('select');
    setSelectedTask(null);
  };

  const handleTimerCancel = () => {
    setShowTimer(false);
    setTimerConfig(null);
    setMode('select');
  };

  if (showTimer && timerConfig) {
    return (
      <CountdownTimer
        task={timerConfig.task || { id: 'standalone', name: 'Focus Timer', category: 'other', frequency: 'daily', color: '#667eea', createdAt: getTodayString() }}
        onComplete={handleTimerComplete}
        onCancel={handleTimerCancel}
        initialMinutes={timerConfig.durationMinutes}
        startImmediately={timerConfig.startNow}
        mode={timerConfig.mode}
      />
    );
  }

  return (
    <div className="timer-view" style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem 1rem',
      position: 'relative'
    }}>
      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: 'white',
            fontSize: '1.5rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ×
        </button>
      )}
      
      <div className="timer-header" style={{
        textAlign: 'center',
        marginBottom: '2rem'
      }}>
        <h2 style={{ color: 'white', fontSize: '2rem', marginBottom: '0.5rem' }}>⏱️ Focus Timer</h2>
        <p style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
          Choose your timer mode and stay focused
        </p>
      </div>

      {mode === 'select' && (
        <div className="timer-modes" style={{
          display: 'grid',
          gap: '1.5rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))'
        }}>
          {/* Mode 1: Task with End Time */}
          <div
            onClick={() => setMode('task-endtime')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '2rem',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Task → End Time</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Countdown to your task's scheduled completion time
            </p>
          </div>

          {/* Mode 2: Task with Custom Duration */}
          <div
            onClick={() => setMode('task-duration')}
            style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              padding: '2rem',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Task + Duration</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Pick a task and set a custom timer duration
            </p>
          </div>

          {/* Mode 3: Standalone Timer */}
          <div
            onClick={() => setMode('standalone')}
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              padding: '2rem',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏲️</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Standalone Timer</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Simple countdown or count-up timer
            </p>
          </div>

          {/* Mode 4: Schedule Timer */}
          <div
            onClick={() => setMode('schedule')}
            style={{
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              padding: '2rem',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Schedule Timer</h3>
            <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              Plan multiple activities with set durations
            </p>
          </div>
        </div>
      )}

      {/* Task End Time Mode */}
      {mode === 'task-endtime' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <button
            onClick={() => setMode('select')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '1.5rem'
            }}
          >
            ← Back
          </button>

          <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>
            🎯 Countdown to Task End Time
          </h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>
            Select a task and timer will count down to its scheduled end time
          </p>

          {/* Info message about requirement */}
          <div style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '0.875rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>ℹ️</span>
              <strong>Requirement:</strong>
            </div>
            <div style={{ paddingLeft: '1.75rem' }}>
              Only tasks with an <strong>End Time</strong> field populated are shown here. 
              To add an end time to a task, go to <strong>Task</strong> tab → Edit task → Set "End Time" field.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(() => {
              const tasksWithEndTime = tasks.filter(t => t.endTime);
              
              if (tasks.length === 0) {
                return (
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', padding: '2rem' }}>
                    No tasks available. Create some tasks first!
                  </p>
                );
              }
              
              if (tasksWithEndTime.length === 0) {
                return (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
                    <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                      No tasks with end times found
                    </p>
                    <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                      Add an end time to your tasks to use this feature.<br/>
                      Go to <strong>Task</strong> tab → Edit a task → Set "End Time"
                    </p>
                  </div>
                );
              }
              
              return tasksWithEndTime.map(task => (
                <div
                  key={task.id}
                  onClick={() => startTaskEndTimeTimer(task)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    padding: '1rem',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '2px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    color: 'white'
                  }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{task.name}</span>
                    {task.endTime && (
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}>
                        Until {task.endTime}
                      </span>
                    )}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Task Duration Mode */}
      {mode === 'task-duration' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <button
            onClick={() => setMode('select')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '1.5rem'
            }}
          >
            ← Back
          </button>

          <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>
            ⏰ Task + Custom Duration
          </h3>

          {!selectedTask ? (
            <>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem' }}>
                Select a task to work on:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tasks.length === 0 ? (
                  <p style={{ color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', padding: '2rem' }}>
                    No tasks available. Create some tasks first!
                  </p>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        // Parse duration from task name and set as default
                        const parsedDuration = parseDurationFromTaskName(task.name);
                        setCustomDuration(parsedDuration);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        padding: '1rem',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        color: 'white',
                        fontWeight: 600,
                        border: '2px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      {task.name}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                color: 'white'
              }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.25rem' }}>Selected Task:</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{selectedTask.name}</div>
              </div>

              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1rem' }}>
                Set timer duration:
              </p>

              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <label style={{ display: 'block', color: 'white', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={customDuration.hours}
                    onChange={(e) => setCustomDuration(prev => ({ ...prev, hours: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{
                      width: '80px',
                      padding: '0.75rem',
                      fontSize: '1.5rem',
                      textAlign: 'center',
                      border: 'none',
                      borderRadius: '8px'
                    }}
                  />
                </div>
                <div style={{ fontSize: '2rem', color: 'white', marginTop: '1.5rem' }}>:</div>
                <div>
                  <label style={{ display: 'block', color: 'white', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={customDuration.minutes}
                    onChange={(e) => setCustomDuration(prev => ({ ...prev, minutes: Math.max(0, parseInt(e.target.value) || 0) }))}
                    style={{
                      width: '80px',
                      padding: '0.75rem',
                      fontSize: '1.5rem',
                      textAlign: 'center',
                      border: 'none',
                      borderRadius: '8px'
                    }}
                  />
                </div>
              </div>

              {/* Quick presets */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <button onClick={() => setCustomDuration({ hours: 0, minutes: 15 })} style={presetBtnStyle}>15m</button>
                <button onClick={() => setCustomDuration({ hours: 0, minutes: 25 })} style={presetBtnStyle}>25m</button>
                <button onClick={() => setCustomDuration({ hours: 0, minutes: 30 })} style={presetBtnStyle}>30m</button>
                <button onClick={() => setCustomDuration({ hours: 0, minutes: 45 })} style={presetBtnStyle}>45m</button>
                <button onClick={() => setCustomDuration({ hours: 1, minutes: 0 })} style={presetBtnStyle}>1h</button>
                <button onClick={() => setCustomDuration({ hours: 2, minutes: 0 })} style={presetBtnStyle}>2h</button>
              </div>

              <button
                onClick={() => startTaskDurationTimer(selectedTask, customDuration.hours, customDuration.minutes)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  background: 'white',
                  color: '#f5576c',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                }}
              >
                ▶️ Start Timer
              </button>
            </>
          )}
        </div>
      )}

      {/* Standalone Mode */}
      {mode === 'standalone' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <button
            onClick={() => setMode('select')}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '1.5rem'
            }}
          >
            ← Back
          </button>

          <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>
            ⏲️ Standalone Timer
          </h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem' }}>
            Focus timer not linked to any task
          </p>

          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <div>
              <label style={{ display: 'block', color: 'white', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Hours
              </label>
              <input
                type="number"
                min="0"
                max="23"
                value={customDuration.hours}
                onChange={(e) => setCustomDuration(prev => ({ ...prev, hours: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{
                  width: '80px',
                  padding: '0.75rem',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  border: 'none',
                  borderRadius: '8px'
                }}
              />
            </div>
            <div style={{ fontSize: '2rem', color: 'white', marginTop: '1.5rem' }}>:</div>
            <div>
              <label style={{ display: 'block', color: 'white', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Minutes
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={customDuration.minutes}
                onChange={(e) => setCustomDuration(prev => ({ ...prev, minutes: Math.max(0, parseInt(e.target.value) || 0) }))}
                style={{
                  width: '80px',
                  padding: '0.75rem',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  border: 'none',
                  borderRadius: '8px'
                }}
              />
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2rem' }}>
            <button onClick={() => setCustomDuration({ hours: 0, minutes: 5 })} style={presetBtnStyle}>5m</button>
            <button onClick={() => setCustomDuration({ hours: 0, minutes: 10 })} style={presetBtnStyle}>10m</button>
            <button onClick={() => setCustomDuration({ hours: 0, minutes: 15 })} style={presetBtnStyle}>15m</button>
            <button onClick={() => setCustomDuration({ hours: 0, minutes: 25 })} style={presetBtnStyle}>25m</button>
            <button onClick={() => setCustomDuration({ hours: 0, minutes: 30 })} style={presetBtnStyle}>30m</button>
            <button onClick={() => setCustomDuration({ hours: 1, minutes: 0 })} style={presetBtnStyle}>1h</button>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => startStandaloneTimer(customDuration.hours, customDuration.minutes, false)}
              style={{
                flex: 1,
                padding: '1rem',
                fontSize: '1.25rem',
                fontWeight: 600,
                background: 'white',
                color: '#4facfe',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
              }}
            >
              ⏱️ Countdown
            </button>
            <button
              onClick={() => startStandaloneTimer(customDuration.hours, customDuration.minutes, true)}
              style={{
                flex: 1,
                padding: '1rem',
                fontSize: '1.25rem',
                fontWeight: 600,
                background: 'white',
                color: '#00f2fe',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
              }}
            >
              ⏲️ Count Up
            </button>
          </div>
        </div>
      )}

      {/* Schedule Timer Configuration Mode */}
      {mode === 'schedule' && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '2rem'
        }}>
          <button
            onClick={() => { setMode('select'); resetScheduleEditor(); }}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '1.5rem'
            }}
          >
            ← Back
          </button>

          <h3 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '1rem' }}>
            📋 Schedule Timer
          </h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem' }}>
            Create a schedule with multiple activities and run them in sequence
          </p>

          {/* Saved Schedules */}
          {savedSchedules.length > 0 && (
            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ color: 'white', fontSize: '1rem', marginBottom: '1rem' }}>
                📁 Saved Schedules
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {savedSchedules.map(schedule => {
                  const totalMins = schedule.activities.reduce((sum, a) => sum + a.durationMinutes, 0);
                  const hours = Math.floor(totalMins / 60);
                  const mins = totalMins % 60;
                  return (
                    <div
                      key={schedule.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        padding: '1rem',
                        borderRadius: '12px',
                        color: 'white'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{schedule.name}</span>
                        <span style={{ opacity: 0.8, fontSize: '0.875rem' }}>
                          {schedule.activities.length} activities • {hours > 0 ? `${hours}h ` : ''}{mins}m
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.7, marginBottom: '0.75rem' }}>
                        {schedule.activities.map(a => `${a.name} (${a.durationMinutes}m)`).join(' → ')}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => startSchedule(schedule)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: '#38ef7d',
                            color: '#1a1a2e',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.875rem'
                          }}
                        >
                          ▶️ Start
                        </button>
                        <button
                          onClick={() => editSchedule(schedule)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(255, 255, 255, 0.2)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteSchedule(schedule.id)}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: 'rgba(239, 68, 68, 0.3)',
                            color: '#fca5a5',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Schedule Editor */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            <button
              onClick={() => setIsScheduleFormExpanded(!isScheduleFormExpanded)}
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: 'white'
              }}
            >
              <h4 style={{ margin: 0, fontSize: '1rem' }}>
                {editingSchedule ? '✏️ Edit Schedule' : '➕ Create New Schedule'}
              </h4>
              <span style={{
                transform: isScheduleFormExpanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
                fontSize: '1.25rem'
              }}>
                ▼
              </span>
            </button>

            {isScheduleFormExpanded && (
              <div style={{ padding: '1.5rem' }}>

            {/* Schedule Name */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Schedule Name
              </label>
              <input
                type="text"
                value={newScheduleName}
                onChange={(e) => setNewScheduleName(e.target.value)}
                placeholder="e.g., Morning Study Session"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Activities */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: 'rgba(255, 255, 255, 0.8)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                Activities
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scheduleActivities.map((activity, idx) => (
                  <div key={activity.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', width: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={activity.name}
                      onChange={(e) => updateActivity(activity.id, 'name', e.target.value)}
                      placeholder="Activity name (e.g., Study English)"
                      style={{
                        flex: 1,
                        padding: '0.6rem',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem'
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={activity.durationMinutes}
                      onChange={(e) => updateActivity(activity.id, 'durationMinutes', Math.max(1, parseInt(e.target.value) || 1))}
                      style={{
                        width: '70px',
                        padding: '0.6rem',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem', width: '2rem' }}>min</span>
                    <button
                      onClick={() => removeActivityRow(activity.id)}
                      disabled={scheduleActivities.length <= 1}
                      style={{
                        padding: '0.5rem',
                        background: scheduleActivities.length <= 1 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(239, 68, 68, 0.3)',
                        color: scheduleActivities.length <= 1 ? 'rgba(255, 255, 255, 0.3)' : '#fca5a5',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: scheduleActivities.length <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addActivityRow}
                style={{
                  marginTop: '0.75rem',
                  padding: '0.5rem 1rem',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                + Add Activity
              </button>
            </div>

            {/* Total Time Preview */}
            {(() => {
              const validActivities = scheduleActivities.filter(a => a.name.trim() && a.durationMinutes > 0);
              const totalMins = validActivities.reduce((sum, a) => sum + a.durationMinutes, 0);
              const hours = Math.floor(totalMins / 60);
              const mins = totalMins % 60;
              return validActivities.length > 0 ? (
                <div style={{
                  background: 'rgba(56, 239, 125, 0.2)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  marginBottom: '1rem',
                  color: '#38ef7d',
                  fontSize: '0.9rem'
                }}>
                  📊 Total: {validActivities.length} activities • {hours > 0 ? `${hours}h ` : ''}{mins}m
                </div>
              ) : null;
            })()}

            {/* Save Button */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={saveSchedule}
                style={{
                  flex: 1,
                  padding: '0.875rem',
                  background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem'
                }}
              >
                💾 {editingSchedule ? 'Update Schedule' : 'Save Schedule'}
              </button>
              {editingSchedule && (
                <button
                  onClick={resetScheduleEditor}
                  style={{
                    padding: '0.875rem 1rem',
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Timer Running Mode */}
      {mode === 'schedule-running' && runningSchedule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 9999
        }}>
          {/* Top Section - Current Activity */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
            background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
          }}>
            <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '1rem', marginBottom: '0.5rem' }}>
              CURRENT ACTIVITY ({currentActivityIndex + 1}/{runningSchedule.activities.length})
            </div>
            <div style={{ color: 'white', fontSize: '2.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '1rem' }}>
              {runningSchedule.activities[currentActivityIndex].name}
            </div>
            <div style={{ 
              color: 'white', 
              fontSize: '5rem', 
              fontWeight: 700, 
              fontFamily: 'monospace',
              textShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              {formatTime(activitySecondsRemaining)}
            </div>
            
            {/* Progress bar for current activity */}
            <div style={{
              width: '80%',
              maxWidth: '400px',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              marginTop: '1.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                background: 'white',
                borderRadius: '4px',
                width: `${(1 - activitySecondsRemaining / (runningSchedule.activities[currentActivityIndex].durationMinutes * 60)) * 100}%`,
                transition: 'width 1s linear'
              }} />
            </div>
          </div>

          {/* Bottom Section - Next Activity & Stats */}
          <div style={{
            padding: '1.5rem 2rem',
            background: 'rgba(0, 0, 0, 0.3)'
          }}>
            {/* Next Activity */}
            {currentActivityIndex < runningSchedule.activities.length - 1 && (
              <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  UP NEXT
                </div>
                <div style={{ color: 'white', fontSize: '1.25rem', fontWeight: 600 }}>
                  {runningSchedule.activities[currentActivityIndex + 1].name}
                  <span style={{ opacity: 0.7, marginLeft: '0.5rem', fontSize: '1rem' }}>
                    ({runningSchedule.activities[currentActivityIndex + 1].durationMinutes} min)
                  </span>
                </div>
              </div>
            )}

            {/* Stats */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '2rem',
              marginBottom: '1.5rem',
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  REMAINING ACTIVITIES
                </div>
                <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>
                  {runningSchedule.activities.length - currentActivityIndex - 1}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  TOTAL TIME LEFT
                </div>
                <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>
                  {formatTime(getTotalRemainingTime())}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => setIsSchedulePaused(!isSchedulePaused)}
                style={{
                  padding: '1rem 2rem',
                  background: isSchedulePaused ? '#38ef7d' : '#fbbf24',
                  color: '#1a1a2e',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  minWidth: '140px'
                }}
              >
                {isSchedulePaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
              <button
                onClick={stopSchedule}
                style={{
                  padding: '1rem 2rem',
                  background: 'rgba(239, 68, 68, 0.8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '1.1rem'
                }}
              >
                ⏹️ Stop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const presetBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'rgba(255, 255, 255, 0.3)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600
};

export default TimerView;

