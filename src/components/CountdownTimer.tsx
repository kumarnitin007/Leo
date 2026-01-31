/**
 * Countdown Timer Component
 * 
 * Fullscreen countdown timer for focused task completion
 * Features:
 * - Fullscreen display with task name
 * - Countdown from user-specified duration
 * - Pause/Resume functionality
 * - Visual and audio alerts when complete
 * - Auto-complete task when timer ends
 */

import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';
import TimerAnimations, { TimerTheme } from './TimerAnimations';

interface CountdownTimerProps {
  task: Task;
  onComplete: (durationMinutes?: number) => void;
  onCancel: () => void;
  initialMinutes?: number; // Optional: start with predefined duration
  startImmediately?: boolean; // Optional: skip setup screen
  mode?: 'countdown' | 'countup'; // Optional: countdown or count-up stopwatch
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ 
  task, 
  onComplete, 
  onCancel, 
  initialMinutes, 
  startImmediately = false,
  mode = 'countdown'
}) => {
  const [isSetup, setIsSetup] = useState(!startImmediately);
  const [hours, setHours] = useState(initialMinutes ? Math.floor(initialMinutes / 60) : 0);
  const [minutes, setMinutes] = useState(initialMinutes ? initialMinutes % 60 : 25); // Default: 25 min (Pomodoro)
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0); // For count-up mode
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [pausedTime, setPausedTime] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<TimerTheme>('liquid');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for completion sound
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSh+zPDaizsIHGS67emhThALTKXh8bllHAU2jdXvzIAtBSV7x+/clkILFlyw5+ytWRMLR6DY8b9nHwYqgs/u14k5CBtnu+vop1EOCK7YqqyIazRBZm57cF58f39+fn59fHh6eXd1dHBsaWRfWFFLRj84MywlHxgPBgADCA0SGSE0QVxue4mFfoiOmpGLi4mGg4B8dnJtZ2JcV1NNSE5VWGJP/v7+/vz8/Pz7+vn5+fj49/f29vX19PPz8/Ly8fDv7+7u7ezs6+rp6ejn5+Xl5OPi4eHg397d3Nva2djY19bV1NPT0tHQ0M/Pzs3MzMvLysrJyMjHx8bGxcXExMPDwsLBwcDAwMDAwL+/v76+vr69vb28vLy7u7q6uLi3t7a2tbS0s7OysrGxsLCwr6+urqysq6urqqmop6alo6KioKCfn5+enZybmpqZmJeWlpSUk5OSkpCPjo+Nj42MjIuKi4mIiIeGhYWEhIOCgYF/fn5/fn18fHt7enl5eHd3dXV0dHJycHBubm1sampoaGdnZWVkZGNiYmFhYGBf');
    
    // If startImmediately is true, start the timer automatically
    if (startImmediately && initialMinutes !== undefined) {
      const totalSecs = mode === 'countdown' ? initialMinutes * 60 : 0;
      setTotalSeconds(totalSecs);
      setRemainingSeconds(totalSecs);
      setElapsedSeconds(0);
      setIsSetup(false);
      setIsRunning(true);
      setStartTime(Date.now());
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startImmediately, initialMinutes, mode]);

  const startTimer = () => {
    const totalSecs = (hours * 3600) + (minutes * 60);
    if (totalSecs === 0) {
      alert('Please set a duration greater than 0');
      return;
    }
    
    setTotalSeconds(totalSecs);
    setRemainingSeconds(totalSecs);
    setIsSetup(false);
    setIsRunning(true);
    setStartTime(Date.now());
  };

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        if (mode === 'countdown') {
          setRemainingSeconds(prev => {
            if (prev <= 1) {
              // Countdown complete!
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }
              setIsRunning(false);
              playCompletionSound();
              
              // Auto-complete task after 3 seconds (only if task has ID)
              if (task.id !== 'standalone') {
                setTimeout(() => {
                  const actualMinutes = Math.ceil(totalSeconds / 60);
                  onComplete(actualMinutes);
                }, 3000);
              } else {
                // For standalone, just notify completion
                setTimeout(() => {
                  onComplete();
                }, 3000);
              }
              
              return 0;
            }
            return prev - 1;
          });
        } else {
          // Count-up mode
          setElapsedSeconds(prev => prev + 1);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, totalSeconds, onComplete, mode, task.id]);

  const togglePause = () => {
    if (isPaused) {
      setStartTime(Date.now() - pausedTime);
    } else {
      setPausedTime(Date.now() - (startTime || Date.now()));
    }
    setIsPaused(!isPaused);
  };

  const playCompletionSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (totalSeconds === 0) return 0;
    return ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  };

  const getTimeColor = (): string => {
    const percentage = (remainingSeconds / totalSeconds) * 100;
    if (percentage > 50) return '#10b981'; // Green
    if (percentage > 20) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  if (isSetup) {
    // Setup screen
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏱️ Set Timer</h1>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '2rem', opacity: 0.9 }}>
            {task.name}
          </h2>

          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '2rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Hours</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                  style={{
                    width: '80px',
                    padding: '0.75rem',
                    fontSize: '2rem',
                    textAlign: 'center',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#1f2937'
                  }}
                />
              </div>
              <div style={{ fontSize: '2rem', marginTop: '1.5rem' }}>:</div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  style={{
                    width: '80px',
                    padding: '0.75rem',
                    fontSize: '2rem',
                    textAlign: 'center',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'white',
                    color: '#1f2937'
                  }}
                />
              </div>
            </div>

            {/* Quick presets */}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => { setHours(0); setMinutes(15); }} style={presetButtonStyle}>15m</button>
              <button onClick={() => { setHours(0); setMinutes(25); }} style={presetButtonStyle}>25m</button>
              <button onClick={() => { setHours(0); setMinutes(30); }} style={presetButtonStyle}>30m</button>
              <button onClick={() => { setHours(0); setMinutes(45); }} style={presetButtonStyle}>45m</button>
              <button onClick={() => { setHours(1); setMinutes(0); }} style={presetButtonStyle}>1h</button>
              <button onClick={() => { setHours(2); setMinutes(0); }} style={presetButtonStyle}>2h</button>
            </div>

            {/* Animation Theme Selector */}
            <div style={{ 
              marginTop: '2rem', 
              padding: '1.5rem', 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '1rem', 
                fontSize: '1rem', 
                fontWeight: 600 
              }}>
                🎨 Choose Animation Theme
              </label>
              <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                flexWrap: 'wrap', 
                justifyContent: 'center' 
              }}>
                {(['liquid', 'runner'] as TimerTheme[]).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setSelectedTheme(theme)}
                    style={{
                      padding: '0.75rem 1.25rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      background: selectedTheme === theme 
                        ? 'white' 
                        : 'rgba(255, 255, 255, 0.2)',
                      color: selectedTheme === theme 
                        ? '#667eea' 
                        : 'white',
                      border: '2px solid white',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s',
                      boxShadow: selectedTheme === theme 
                        ? '0 4px 12px rgba(0, 0, 0, 0.2)' 
                        : 'none'
                    }}
                  >
                    {theme === 'liquid' && '💧'}
                    {theme === 'runner' && '🏃'}
                    {' '}
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              onClick={startTimer}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.25rem',
                fontWeight: 600,
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
              }}
            >
              ▶️ Start Timer
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '1rem 2rem',
                fontSize: '1.25rem',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                border: '2px solid white',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Timer running screen
  const isComplete = mode === 'countdown' && remainingSeconds === 0;
  const displayTime = mode === 'countdown' ? remainingSeconds : elapsedSeconds;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: isComplete 
        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
        : mode === 'countup' 
          ? 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
          : 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      padding: '2rem'
    }}>
      {/* Task name at top */}
      <h2 style={{
        fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
        marginBottom: '3rem',
        textAlign: 'center',
        opacity: 0.9
      }}>
        {task.name}
      </h2>

      {/* Main timer display */}
      <div style={{
        fontSize: 'clamp(4rem, 15vw, 12rem)',
        fontWeight: 700,
        fontFamily: 'monospace',
        marginBottom: '2rem',
        color: isComplete ? 'white' : mode === 'countup' ? '#fff' : getTimeColor(),
        textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        animation: isComplete ? 'pulse 1s infinite' : (mode === 'countdown' && remainingSeconds < 60 && remainingSeconds % 2 === 0) ? 'blink 1s' : 'none'
      }}>
        {isComplete ? '🎉' : formatTime(displayTime)}
      </div>

      {isComplete && (
        <div style={{ fontSize: '2rem', marginBottom: '2rem', animation: 'fadeIn 0.5s' }}>
          🎊 Task Complete! 🎊
        </div>
      )}

      {/* Animated Progress (only for countdown mode) */}
      {!isComplete && mode === 'countdown' && (
        <div style={{ marginBottom: '3rem' }}>
          <TimerAnimations
            theme={selectedTheme}
            progress={getProgressPercentage()}
            remainingSeconds={remainingSeconds}
            totalSeconds={totalSeconds}
            isComplete={false}
          />
        </div>
      )}

      {/* Count-up indicator */}
      {!isComplete && mode === 'countup' && (
        <div style={{
          fontSize: '1.25rem',
          marginBottom: '3rem',
          opacity: 0.8
        }}>
          ⏱️ Counting up...
        </div>
      )}

      {/* Controls */}
      {!isComplete && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={togglePause}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.25rem',
              fontWeight: 600,
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '2px solid white',
              borderRadius: '12px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)'
            }}
          >
            {isPaused ? '▶️ Resume' : '⏸️ Pause'}
          </button>
          <button
            onClick={() => {
              if (confirm('End timer and complete task now?')) {
                const elapsedMinutes = mode === 'countdown'
                  ? Math.ceil((totalSeconds - remainingSeconds) / 60)
                  : Math.ceil(elapsedSeconds / 60);
                
                // Only pass duration if it's a real task
                if (task.id !== 'standalone') {
                  onComplete(elapsedMinutes);
                } else {
                  onComplete();
                }
              }
            }}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.25rem',
              fontWeight: 600,
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer'
            }}
          >
            ✓ {mode === 'countup' ? 'Stop Timer' : 'Complete Now'}
          </button>
        </div>
      )}

      {/* Cancel button */}
      {!isComplete && (
        <button
          onClick={() => {
            if (confirm('Cancel timer without completing task?')) {
              onCancel();
            }
          }}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

const presetButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'rgba(255, 255, 255, 0.3)',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600
};

export default CountdownTimer;

