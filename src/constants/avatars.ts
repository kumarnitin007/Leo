/**
 * Avatar Constants
 * 
 * Defines available avatar options for user personalization.
 * Avatars are emoji-based for simplicity and universal support.
 * 
 * Users can select an avatar in the Settings menu to personalize
 * their experience.
 */

export interface Avatar {
  id: string;
  emoji: string;
  name: string;
  category: string;
}

/**
 * Available avatar categories
 */
export const AVATAR_CATEGORIES = [
  'Animals',
  'People',
  'Objects',
  'Nature',
  'Food',
  'Sports',
] as const;

/**
 * All available avatars organized by category
 */
export const avatars: Avatar[] = [
  // Animals
  { id: 'cat', emoji: '🐱', name: 'Cat', category: 'Animals' },
  { id: 'dog', emoji: '🐶', name: 'Dog', category: 'Animals' },
  { id: 'fox', emoji: '🦊', name: 'Fox', category: 'Animals' },
  { id: 'panda', emoji: '🐼', name: 'Panda', category: 'Animals' },
  { id: 'koala', emoji: '🐨', name: 'Koala', category: 'Animals' },
  { id: 'lion', emoji: '🦁', name: 'Lion', category: 'Animals' },
  { id: 'tiger', emoji: '🐯', name: 'Tiger', category: 'Animals' },
  { id: 'bear', emoji: '🐻', name: 'Bear', category: 'Animals' },
  { id: 'penguin', emoji: '🐧', name: 'Penguin', category: 'Animals' },
  { id: 'owl', emoji: '🦉', name: 'Owl', category: 'Animals' },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorn', category: 'Animals' },
  { id: 'dragon', emoji: '🐉', name: 'Dragon', category: 'Animals' },

  // People
  { id: 'person', emoji: '😊', name: 'Smiling', category: 'People' },
  { id: 'cool', emoji: '😎', name: 'Cool', category: 'People' },
  { id: 'nerd', emoji: '🤓', name: 'Nerd', category: 'People' },
  { id: 'star-eyes', emoji: '🤩', name: 'Star Eyes', category: 'People' },
  { id: 'thinking', emoji: '🤔', name: 'Thinking', category: 'People' },
  { id: 'party', emoji: '🥳', name: 'Party', category: 'People' },
  { id: 'ninja', emoji: '🥷', name: 'Ninja', category: 'People' },
  { id: 'astronaut', emoji: '👨‍🚀', name: 'Astronaut', category: 'People' },
  
  // Objects
  { id: 'target', emoji: '🎯', name: 'Target', category: 'Objects' },
  { id: 'trophy', emoji: '🏆', name: 'Trophy', category: 'Objects' },
  { id: 'medal', emoji: '🏅', name: 'Medal', category: 'Objects' },
  { id: 'crown', emoji: '👑', name: 'Crown', category: 'Objects' },
  { id: 'gem', emoji: '💎', name: 'Gem', category: 'Objects' },
  { id: 'rocket', emoji: '🚀', name: 'Rocket', category: 'Objects' },
  { id: 'bulb', emoji: '💡', name: 'Lightbulb', category: 'Objects' },
  { id: 'fire', emoji: '🔥', name: 'Fire', category: 'Objects' },
  
  // Nature
  { id: 'sun', emoji: '☀️', name: 'Sun', category: 'Nature' },
  { id: 'moon', emoji: '🌙', name: 'Moon', category: 'Nature' },
  { id: 'star', emoji: '⭐', name: 'Star', category: 'Nature' },
  { id: 'rainbow', emoji: '🌈', name: 'Rainbow', category: 'Nature' },
  { id: 'flower', emoji: '🌸', name: 'Flower', category: 'Nature' },
  { id: 'tree', emoji: '🌲', name: 'Tree', category: 'Nature' },
  { id: 'leaf', emoji: '🍃', name: 'Leaf', category: 'Nature' },
  { id: 'mountain', emoji: '⛰️', name: 'Mountain', category: 'Nature' },
  
  // Food
  { id: 'coffee', emoji: '☕', name: 'Coffee', category: 'Food' },
  { id: 'pizza', emoji: '🍕', name: 'Pizza', category: 'Food' },
  { id: 'burger', emoji: '🍔', name: 'Burger', category: 'Food' },
  { id: 'donut', emoji: '🍩', name: 'Donut', category: 'Food' },
  { id: 'cake', emoji: '🍰', name: 'Cake', category: 'Food' },
  { id: 'apple', emoji: '🍎', name: 'Apple', category: 'Food' },
  
  // Sports
  { id: 'soccer', emoji: '⚽', name: 'Soccer', category: 'Sports' },
  { id: 'basketball', emoji: '🏀', name: 'Basketball', category: 'Sports' },
  { id: 'tennis', emoji: '🎾', name: 'Tennis', category: 'Sports' },
  { id: 'swimming', emoji: '🏊', name: 'Swimming', category: 'Sports' },
  { id: 'cycling', emoji: '🚴', name: 'Cycling', category: 'Sports' },
  { id: 'running', emoji: '🏃', name: 'Running', category: 'Sports' },
];

/**
 * Get avatar by ID
 * Returns default avatar if not found
 */
export const getAvatarById = (id: string): Avatar => {
  return avatars.find(avatar => avatar.id === id) || avatars[0];
};

/**
 * Get avatars by category
 */
export const getAvatarsByCategory = (category: string): Avatar[] => {
  return avatars.filter(avatar => avatar.category === category);
};

/**
 * Default avatar ID
 */
export const DEFAULT_AVATAR_ID = 'person';

