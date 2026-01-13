/**
 * Timer Animation Components
 * 
 * Provides 2 animated timer display options:
 * 1. Liquid Fill - Smooth liquid progress bar
 * 2. Runner - Character running along a track
 */

import React from 'react';

export type TimerTheme = 
  | 'liquid' 
  | 'runner';

interface TimerAnimationProps {
  progress: number; // 0-100
  remainingSeconds: number;
  totalSeconds: number;
  isComplete: boolean;
  theme: TimerTheme;
}

export const TimerAnimation: React.FC<TimerAnimationProps> = ({
  progress,
  remainingSeconds,
  totalSeconds,
  isComplete,
  theme
}) => {
  switch (theme) {
    case 'liquid':
      return <LiquidFillAnimation progress={progress} isComplete={isComplete} />;
    case 'runner':
      return <RunnerAnimation progress={progress} isComplete={isComplete} />;
    default:
      return <LiquidFillAnimation progress={progress} isComplete={isComplete} />;
  }
};

// 1. Pacman Animation
const PacmanAnimation: React.FC<{ progress: number; remainingSeconds: number; totalSeconds: number; isComplete: boolean }> = ({ progress, remainingSeconds, totalSeconds, isComplete }) => {
  const dotsCount = 20;
  const eatenDots = Math.floor((progress / 100) * dotsCount);
  const angle = (progress / 100) * 360;
  const pacmanAngle = isComplete ? 360 : (angle % 360);
  const mouthOpen = remainingSeconds % 2 < 1; // Blink mouth
  
  return (
    <div style={{ position: 'relative', width: '400px', height: '400px', margin: '0 auto' }}>
      <svg viewBox="0 0 400 400" style={{ width: '100%', height: '100%' }}>
        {/* Circular track */}
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="4"
        />
        
        {/* Dots on track */}
        {Array.from({ length: dotsCount }).map((_, i) => {
          const dotAngle = (i / dotsCount) * 360;
          const x = 200 + 150 * Math.cos((dotAngle - 90) * Math.PI / 180);
          const y = 200 + 150 * Math.sin((dotAngle - 90) * Math.PI / 180);
          const isEaten = i < eatenDots;
          
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={isEaten ? 0 : 4}
              fill={isEaten ? 'transparent' : '#ffd700'}
              opacity={isEaten ? 0 : 1}
              style={{ transition: 'all 0.3s' }}
            />
          );
        })}
        
        {/* Power pellets at quarters */}
        {[0, 90, 180, 270].map((quarter, i) => {
          const x = 200 + 150 * Math.cos((quarter - 90) * Math.PI / 180);
          const y = 200 + 150 * Math.sin((quarter - 90) * Math.PI / 180);
          const isEaten = progress > (i * 25);
          
          return (
            <circle
              key={`pellet-${i}`}
              cx={x}
              cy={y}
              r={isEaten ? 0 : 8}
              fill={isEaten ? 'transparent' : '#ff6b6b'}
              opacity={isEaten ? 0 : 1}
              style={{ transition: 'all 0.3s' }}
            />
          );
        })}
        
        {/* Pacman */}
        <g transform={`translate(200, 200) rotate(${pacmanAngle})`}>
          <path
            d={mouthOpen 
              ? `M 0,0 L 40,0 A 40,40 0 0,1 ${40 * Math.cos(45 * Math.PI / 180)},${-40 * Math.sin(45 * Math.PI / 180)} Z`
              : `M 0,0 A 40,40 0 1,1 0,-0.1 Z`
            }
            fill="#ffd700"
            transform="translate(-40, 0)"
          />
        </g>
        
        {/* Ghosts when time is low */}
        {remainingSeconds < 60 && remainingSeconds > 0 && (
          <g transform={`translate(200, 200) rotate(${angle + 180})`}>
            <circle cx="0" cy="-150" r="15" fill="#ff6b6b" opacity={0.8}>
              <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );
};

// 2. Liquid Fill Animation
const LiquidFillAnimation: React.FC<{ progress: number; isComplete: boolean }> = ({ progress, isComplete }) => {
  const waveOffset = Date.now() % 2000 / 2000;
  
  return (
    <div style={{ position: 'relative', width: '300px', height: '300px', margin: '0 auto' }}>
      <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
        {/* Container */}
        <rect x="50" y="50" width="200" height="200" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4" rx="20" />
        
        {/* Liquid fill with wave effect */}
        <defs>
          <linearGradient id="liquidGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4facfe" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00f2fe" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        
        <clipPath id="liquidClip">
          <rect x="50" y={250 - (progress / 100) * 200} width="200" height={(progress / 100) * 200} rx="20" />
        </clipPath>
        
        <g clipPath="url(#liquidClip)">
          <rect x="50" y="50" width="200" height="200" fill="url(#liquidGrad)" />
          {/* Wave effect */}
          <path
            d={`M 50,${250 - (progress / 100) * 200} Q 100,${250 - (progress / 100) * 200 - 10 + Math.sin(waveOffset * Math.PI * 2) * 5} 150,${250 - (progress / 100) * 200} T 250,${250 - (progress / 100) * 200}`}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="3"
          />
        </g>
        
        {/* Bubbles */}
        {Array.from({ length: 5 }).map((_, i) => {
          const bubbleY = 250 - (progress / 100) * 200 - (i * 30);
          const bubbleX = 100 + (i * 20);
          return (
            <circle
              key={i}
              cx={bubbleX}
              cy={bubbleY}
              r={3 + Math.sin(Date.now() / 1000 + i) * 2}
              fill="rgba(255,255,255,0.6)"
              opacity={bubbleY > 250 - (progress / 100) * 200 ? 0 : 0.8}
            >
              <animate attributeName="cy" values={`${bubbleY};${bubbleY - 50}`} dur="2s" repeatCount="indefinite" />
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

// 3. Plant Growth Animation
const PlantGrowthAnimation: React.FC<{ progress: number; isComplete: boolean }> = ({ progress, isComplete }) => {
  const plantHeight = (progress / 100) * 200;
  const leafCount = Math.floor(progress / 20);
  
  return (
    <div style={{ position: 'relative', width: '300px', height: '300px', margin: '0 auto' }}>
      <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
        {/* Pot */}
        <path
          d="M 100 280 L 100 250 L 80 250 L 80 280 L 100 280 M 220 280 L 220 250 L 200 250 L 200 280 L 220 280 M 100 250 L 220 250 L 220 280 L 100 280 Z"
          fill="#8b4513"
        />
        <ellipse cx="160" cy="250" rx="60" ry="10" fill="#654321" />
        
        {/* Stem */}
        <line
          x1="160"
          y1="250"
          x2="160"
          y2={250 - plantHeight}
          stroke="#228b22"
          strokeWidth="8"
          strokeLinecap="round"
        />
        
        {/* Leaves */}
        {Array.from({ length: leafCount }).map((_, i) => {
          const leafY = 250 - (i * (plantHeight / Math.max(leafCount, 1)));
          const side = i % 2 === 0 ? 1 : -1;
          return (
            <ellipse
              key={i}
              cx={160 + side * 30}
              cy={leafY}
              rx="20"
              ry="15"
              fill="#32cd32"
              transform={`rotate(${side * 30} ${160 + side * 30} ${leafY})`}
            />
          );
        })}
        
        {/* Flower when complete */}
        {isComplete && (
          <g>
            <circle cx="160" cy={250 - plantHeight} r="15" fill="#ffd700" />
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <ellipse
                key={i}
                cx={160 + 20 * Math.cos((angle - 90) * Math.PI / 180)}
                cy={250 - plantHeight + 20 * Math.sin((angle - 90) * Math.PI / 180)}
                rx="8"
                ry="12"
                fill="#ff69b4"
                transform={`rotate(${angle} ${160} ${250 - plantHeight})`}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};

// 4. Pulsing Circle with Particles
const PulseParticlesAnimation: React.FC<{ progress: number; isComplete: boolean }> = ({ progress, isComplete }) => {
  const pulseScale = 1 + Math.sin(Date.now() / 500) * 0.1;
  const particleCount = 20;
  
  return (
    <div style={{ position: 'relative', width: '300px', height: '300px', margin: '0 auto' }}>
      <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%' }}>
        {/* Outer pulsing circle */}
        <circle
          cx="150"
          cy="150"
          r={120 * pulseScale}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="3"
          opacity={0.5}
        />
        
        {/* Progress circle */}
        <circle
          cx="150"
          cy="150"
          r="100"
          fill="none"
          stroke="url(#progressGrad)"
          strokeWidth="8"
          strokeDasharray={`${2 * Math.PI * 100}`}
          strokeDashoffset={`${2 * Math.PI * 100 * (1 - progress / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 150 150)"
        />
        
        <defs>
          <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4facfe" />
            <stop offset="100%" stopColor="#00f2fe" />
          </linearGradient>
        </defs>
        
        {/* Particles */}
        {Array.from({ length: particleCount }).map((_, i) => {
          const angle = (i / particleCount) * 360 + (progress / 100) * 360;
          const radius = 80 + Math.sin(Date.now() / 1000 + i) * 10;
          const x = 150 + radius * Math.cos((angle - 90) * Math.PI / 180);
          const y = 150 + radius * Math.sin((angle - 90) * Math.PI / 180);
          
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2 + Math.sin(Date.now() / 500 + i) * 1}
              fill="#fff"
              opacity={0.6 + Math.sin(Date.now() / 1000 + i) * 0.4}
            >
              <animate attributeName="opacity" values="0.3;1;0.3" dur={`${1 + i * 0.1}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </svg>
    </div>
  );
};

// 5. Running Character Animation
const RunnerAnimation: React.FC<{ progress: number; isComplete: boolean }> = ({ progress, isComplete }) => {
  const trackLength = 400;
  const runnerPosition = (progress / 100) * trackLength;
  const legCycle = (Date.now() / 200) % 1;
  
  return (
    <div style={{ position: 'relative', width: '500px', height: '200px', margin: '0 auto' }}>
      <svg viewBox="0 0 500 200" style={{ width: '100%', height: '100%' }}>
        {/* Track */}
        <line x1="50" y1="150" x2="450" y2="150" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
        <line x1="50" y1="160" x2="450" y2="160" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5,5" />
        
        {/* Finish line */}
        <line x1="450" y1="100" x2="450" y2="200" stroke="#ffd700" strokeWidth="6" />
        <text x="455" y="140" fill="#ffd700" fontSize="16" fontWeight="bold">FINISH</text>
        
        {/* Runner */}
        <g transform={`translate(${50 + runnerPosition}, 100)`}>
          {/* Body */}
          <circle cx="0" cy="-20" r="12" fill="#fff" />
          <rect x="-8" y="-10" width="16" height="30" fill="#4facfe" rx="4" />
          
          {/* Legs (animated) */}
          <line
            x1="0"
            y1="20"
            x2={Math.sin(legCycle * Math.PI * 2) * 15}
            y2="40"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1="20"
            x2={-Math.sin(legCycle * Math.PI * 2) * 15}
            y2="40"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
          />
          
          {/* Arms */}
          <line
            x1="0"
            y1="0"
            x2={Math.cos(legCycle * Math.PI * 2) * 12}
            y2="10"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1="0"
            x2={-Math.cos(legCycle * Math.PI * 2) * 12}
            y2="10"
            stroke="#fff"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
        
        {/* Progress markers */}
        {[0, 25, 50, 75, 100].map((p, i) => {
          const x = 50 + (p / 100) * trackLength;
          return (
            <g key={i}>
              <line x1={x} y1="145" x2={x} y2="155" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
              <text x={x} y="170" fill="rgba(255,255,255,0.7)" fontSize="12" textAnchor="middle">{p}%</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Default export with plural name for consistency
export default TimerAnimation;

