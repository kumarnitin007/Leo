import React from 'react';

interface FloatingTimerButtonProps {
  onClick: () => void;
}

const FloatingTimerButton: React.FC<FloatingTimerButtonProps> = ({ onClick }) => {
  return (
    <button
      className="floating-timer-button"
      onClick={onClick}
      title="Open Timer"
      aria-label="Open Timer"
    >
      <span className="timer-icon">⏱️</span>
    </button>
  );
};

export default FloatingTimerButton;

