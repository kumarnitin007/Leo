/**
 * Gift Cards Modal Component
 * 
 * Displays all gift cards in a popup modal
 */

import React, { useState, useEffect } from 'react';
import { Item } from '../types';
import { getItems, updateItem } from '../storage';

interface GiftCardsModalProps {
  onClose: () => void;
  onNavigate?: (view: string) => void;
}

const GiftCardsModal: React.FC<GiftCardsModalProps> = ({ onClose, onNavigate }) => {
  const [giftCards, setGiftCards] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGiftCards();
  }, []);

  const loadGiftCards = async () => {
    try {
      const allItems = await getItems();
      // Filter: only gift cards that are NOT closed
      const giftCardsOnly = allItems.filter(item => 
        item.category === 'Gift Card' && !item.isClosed
      );
      setGiftCards(giftCardsOnly);
    } catch (error) {
      console.error('Error loading gift cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkClosed = async (cardId: string) => {
    if (!confirm('Mark this gift card as used/closed? It will be hidden from this view.')) {
      return;
    }
    
    try {
      await updateItem(cardId, { isClosed: true });
      await loadGiftCards(); // Reload to refresh the list
    } catch (error) {
      console.error('Error marking gift card as closed:', error);
      alert('Error updating gift card. Please try again.');
    }
  };

  const formatValue = (value?: number, currency?: string): string => {
    if (!value) return 'No balance';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(value);
  };

  const formatExpirationDate = (dateStr?: string): string => {
    if (!dateStr) return 'No expiration';
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `Expired ${Math.abs(diffDays)} days ago`;
    if (diffDays === 0) return 'Expires today!';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays <= 7) return `Expires in ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="giftcards-modal-content">
      <div className="giftcards-modal-header">
        <h2>🎁 Gift Cards</h2>
        <button 
          className="modal-close-button" 
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading gift cards...</p>
        </div>
      ) : giftCards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
          <p style={{ color: '#6b7280', fontSize: '1rem', lineHeight: 1.6, marginBottom: 16 }}>
            No gift cards yet. To add one, go to <strong>Items</strong> and create an item with category <strong>"Gift Card"</strong>. You can set the balance, merchant, expiration, and card number.
          </p>
          {onNavigate && (
            <button
              onClick={() => { onClose(); onNavigate('items'); }}
              style={{
                background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              + Create in Items
            </button>
          )}
        </div>
      ) : (
        <div className="giftcards-grid">
          <div style={{ padding: '8px 12px', marginBottom: 8, background: '#f9f9f6', borderRadius: 8, border: '1px dashed #d5d3cc', fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span>Add items with category <strong>"Gift Card"</strong> in the Items section.</span>
            {onNavigate && (
              <button onClick={() => { onClose(); onNavigate('items'); }} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: '#555' }}>+ Add</button>
            )}
          </div>
          {giftCards.map((card) => (
            <div 
              key={card.id} 
              className="giftcard-item"
              style={{ borderLeft: `6px solid ${card.color || '#667eea'}` }}
            >
              <div className="giftcard-header">
                <div className="giftcard-icon">🎁</div>
                <div className="giftcard-info">
                  <h3>{card.name}</h3>
                  {card.merchant && (
                    <p className="giftcard-merchant">🏪 {card.merchant}</p>
                  )}
                </div>
              </div>
              
              {card.description && (
                <p className="giftcard-description">{card.description}</p>
              )}
              
              <div className="giftcard-details">
                <div className="giftcard-detail-item">
                  <span className="detail-label">Balance:</span>
                  <span className="detail-value balance">
                    {formatValue(card.value, card.currency)}
                  </span>
                </div>
                
                {card.expirationDate && (
                  <div className="giftcard-detail-item">
                    <span className="detail-label">Expires:</span>
                    <span className={`detail-value ${new Date(card.expirationDate) < new Date() ? 'expired' : ''}`}>
                      {formatExpirationDate(card.expirationDate)}
                    </span>
                  </div>
                )}
                
                {card.accountNumber && (
                  <div className="giftcard-detail-item">
                    <span className="detail-label">Card #:</span>
                    <span className="detail-value">{card.accountNumber}</span>
                  </div>
                )}
              </div>
              
              <div className="giftcard-actions">
                <button 
                  className="btn-mark-closed"
                  onClick={() => handleMarkClosed(card.id)}
                  title="Mark as used/closed"
                >
                  ✓ Mark as Used
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GiftCardsModal;

