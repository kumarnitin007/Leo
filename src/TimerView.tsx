/**
 * Timer View - Standalone timer access
 * 
 * Three modes:
 * 1. Task-based timer with end time (countdown to task's scheduled end)
 * 2. Task-based timer with custom duration
 * 3. Standalone timer (no task) - countdown or count-up
 */

import React, { useState, useEffect } from 'react';
import { Task } from './types';
import { loadData, completeTask } from './storage';
import { getTodayString } from './utils';
import CountdownTimer from './components/CountdownTimer';

type TimerMode = 'select' | 'task-endtime' | 'task-duration' | 'standalone';

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

  useEffect(() => {
    loadTasks();
  }, []);

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

