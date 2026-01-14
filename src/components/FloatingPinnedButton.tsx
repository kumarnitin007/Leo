import React from 'react';

interface FloatingPinnedButtonProps {
  onClick: () => void;
}

const FloatingPinnedButton: React.FC<FloatingPinnedButtonProps> = ({ onClick }) => {
  return (
    <button
      className="floating-pinned-button"
      onClick={onClick}
      title="View Pinned Items"
      aria-label="View Pinned Items"
    >
      <span className="pinned-icon">📌</span>
    </button>
  );
};

export default FloatingPinnedButton;
