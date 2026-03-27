/**
 * AI Personality Profile
 *
 * Collapsible section in Settings where users provide fun optional inputs
 * (favourite places, characters, shows, etc.) that AI uses to sprinkle
 * personalised references and fun quotes into responses.
 *
 * Only visible when AI is enabled and user has opted in.
 */

import React, { useState } from 'react';
import type { AIPersonality } from '../../types';

interface Props {
  personality: AIPersonality;
  onChange: (p: AIPersonality) => void;
}

const FIELDS: { key: keyof AIPersonality; icon: string; label: string; placeholder: string }[] = [
  { key: 'favoritePlace', icon: '🌍', label: 'Favourite place to visit', placeholder: 'e.g. Kyoto, Switzerland, Goa' },
  { key: 'favoriteCharacter', icon: '🎭', label: 'Favourite fictional character', placeholder: 'e.g. Sherlock Holmes, Gandalf' },
  { key: 'favoriteShow', icon: '📺', label: 'Favourite show / movie', placeholder: 'e.g. The Office, Interstellar' },
  { key: 'superhero', icon: '🦸', label: 'Favourite superhero', placeholder: 'e.g. Spider-Man, Batman, Iron Man' },
  { key: 'favoriteQuote', icon: '💬', label: 'A quote you love', placeholder: 'e.g. "Be the change you wish to see"' },
  { key: 'favoriteHobby', icon: '🎨', label: 'Favourite hobby', placeholder: 'e.g. Hiking, Cooking, Guitar' },
  { key: 'spiritAnimal', icon: '🐾', label: 'Spirit animal', placeholder: 'e.g. Wolf, Eagle, Dolphin' },
  { key: 'favoriteFood', icon: '🍕', label: 'Favourite food / cuisine', placeholder: 'e.g. Sushi, Biryani, Tacos' },
];

const AIPersonalityProfile: React.FC<Props> = ({ personality, onChange }) => {
  const [expanded, setExpanded] = useState(false);
  const filledCount = FIELDS.filter(f => personality[f.key]?.trim()).length;

  const handleChange = (key: keyof AIPersonality, value: string) => {
    onChange({ ...personality, [key]: value || undefined });
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)',
      borderRadius: '1rem',
      border: '1px solid #86EFAC',
      overflow: 'hidden',
      marginBottom: '1.5rem',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.3rem' }}>🎯</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#166534' }}>Personalise Leo</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 2 }}>
              {filledCount > 0
                ? `${filledCount} of ${FIELDS.length} filled — Leo will use these for fun references`
                : 'Tell Leo about yourself for more fun, personalised responses'}
            </div>
          </div>
        </div>
        <span style={{
          fontSize: 12, color: '#22C55E', transition: 'transform 0.2s',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>▶</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #BBF7D0' }}>
          <p style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '0.75rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            All fields are optional. Fill in whichever you like — Leo will weave these into
            briefings and reflections for a more personal touch (superhero analogies, travel-inspired
            metaphors, show references, etc.)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  <span>{f.icon}</span> {f.label}
                </label>
                <input
                  type="text"
                  value={personality[f.key] || ''}
                  onChange={e => handleChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  maxLength={80}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem', fontSize: '0.85rem',
                    borderRadius: '0.5rem', border: '1px solid #D1D5DB',
                    background: 'white', color: '#1F2937', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPersonalityProfile;
