import React from 'react';

interface FloatingMilestonesButtonProps {
  onClick: () => void;
}

const FloatingMilestonesButton: React.FC<FloatingMilestonesButtonProps> = ({ onClick }) => {
  return (
    <button
      className="floating-milestones-button"
      onClick={onClick}
      title="View Milestones"
      aria-label="View Milestones"
    >
      <span className="milestones-icon">🎯</span>
    </button>
  );
};

export default FloatingMilestonesButton;

