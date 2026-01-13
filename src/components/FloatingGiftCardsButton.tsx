import React from 'react';

interface FloatingGiftCardsButtonProps {
  onClick: () => void;
}

const FloatingGiftCardsButton: React.FC<FloatingGiftCardsButtonProps> = ({ onClick }) => {
  return (
    <button
      className="floating-giftcards-button"
      onClick={onClick}
      title="View Gift Cards"
      aria-label="View Gift Cards"
    >
      <span className="giftcards-icon">🎁</span>
    </button>
  );
};

export default FloatingGiftCardsButton;

