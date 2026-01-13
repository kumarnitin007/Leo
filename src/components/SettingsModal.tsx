/**
 * Settings Modal Component
 * 
 * Comprehensive settings interface with theme, avatar, and user customization.
 */

import React, { useState } from 'react';
import Portal from './Portal';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { avatars, AVATAR_CATEGORIES } from '../constants/avatars';
import { DashboardLayout } from '../types';
import { getUserSettings, saveUserSettings } from '../storage';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose }) => {
  const { theme, setTheme, availableThemes } = useTheme();
  const { username, avatar, setUsername, setAvatar, email, setEmail } = useUser();
  
  const [editingUsername, setEditingUsername] = useState(username);
  const [editingEmail, setEditingEmail] = useState(email);
  const [selectedCategory, setSelectedCategory] = useState(avatar.category);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>('uniform');
  const [location, setLocation] = useState<{ zipCode?: string; city?: string; country?: string }>({});

  // Load settings from storage
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings();
        setDashboardLayout(settings.dashboardLayout);
        setLocation(settings.location || {});
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    if (show) {
      loadSettings();
    }
  }, [show]);

  if (!show) return null;

  const handleSave = async () => {
    try {
      await setUsername(editingUsername);
      await setEmail(editingEmail);
      await saveUserSettings({ dashboardLayout, location });
      onClose();
      // Note: Layout and theme changes apply immediately via context
      // No reload needed - preserves navigation state
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please try again.');
    }
  };

  const layouts: Array<{ id: DashboardLayout; name: string; icon: string; description: string }> = [
    {
      id: 'uniform',
      name: 'Uniform Grid',
      icon: '▦',
      description: 'Compact grid with equal-sized cards'
    },
    {
      id: 'grid-spans',
      name: 'Priority Sized',
      icon: '▧',
      description: 'Card size (width & height) shows priority'
    },
    {
      id: 'masonry',
      name: 'Masonry',
      icon: '▥',
      description: 'Pinterest-style with staggered card heights'
    }
  ];

  const filteredAvatars = avatars.filter(a => a.category === selectedCategory);

  return (
    <Portal>
      <div className="settings-modal-backdrop" onClick={onClose}>
        <div className="settings-modal-content" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ padding: '1.5rem', borderBottom: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 10, borderRadius: '1rem 1rem 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '2rem' }}>{avatar.emoji}</span>
              <span style={{ fontSize: '1.5rem' }}>⚙️</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Settings</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {/* Profile */}
            <div style={{ background: 'linear-gradient(to right, #eef2ff, #f5f3ff)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #c7d2fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>👤</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Profile</h3>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Your Name</label>
                <input type="text" value={editingUsername} onChange={(e) => setEditingUsername(e.target.value)} placeholder="Enter your name" maxLength={50} style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Email (Optional)</label>
                <input type="email" value={editingEmail} onChange={(e) => setEditingEmail(e.target.value)} placeholder="your.email@example.com" style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} />
              </div>
            </div>

            {/* Avatar */}
            <div style={{ background: 'linear-gradient(to right, #fce7f3, #fce7f3)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #fbcfe8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🎭</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Avatar</h3>
              </div>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>{avatar.emoji}</div>
                <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #fbcfe8', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                  {showAvatarPicker ? '▲ Hide' : '▼ Change Avatar'}
                </button>
              </div>
              {showAvatarPicker && (
                <>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {AVATAR_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', background: selectedCategory === cat ? '#ec4899' : 'white', color: selectedCategory === cat ? 'white' : '#374151' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(50px, 1fr))', gap: '0.5rem', background: 'white', padding: '1rem', borderRadius: '0.5rem' }}>
                    {filteredAvatars.map(av => (
                      <button key={av.id} onClick={async () => { await setAvatar(av.id); setShowAvatarPicker(false); }} style={{ fontSize: '2rem', padding: '0.5rem', border: avatar.id === av.id ? '3px solid #ec4899' : '1px solid #e5e7eb', borderRadius: '0.5rem', background: avatar.id === av.id ? '#fce7f3' : 'white', cursor: 'pointer' }} title={av.name}>
                        {av.emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Themes */}
            <div style={{ background: 'linear-gradient(to right, #f5f3ff, #ede9fe)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #ddd6fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🎨</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Theme</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                {availableThemes.map(t => (
                  <button key={t.id} onClick={() => setTheme(t.id)} style={{ padding: '1rem', borderRadius: '1rem', border: theme.id === t.id ? '3px solid ' + t.colors.primary : '1px solid #e5e7eb', background: `linear-gradient(135deg, ${t.gradient.from}, ${t.gradient.via}, ${t.gradient.to})`, cursor: 'pointer', textAlign: 'center' }} title={t.description}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{t.emoji}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{t.name}</div>
                  </button>
                ))}
              </div>
              <div style={{ padding: '1rem', background: 'white', borderRadius: '0.5rem', border: '2px solid ' + theme.colors.primary, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '2rem' }}>{theme.emoji}</span>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>{theme.name}</h4>
                  <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{theme.description}</p>
                </div>
              </div>
            </div>

            {/* Location for Weather */}
            <div style={{ background: 'linear-gradient(to right, #fef3c7, #fde68a)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #fbbf24' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📍</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Location for Weather</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Enter your location to see weather forecasts on your dashboard
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Zip/Postal Code</label>
                <input 
                  type="text" 
                  value={location.zipCode || ''} 
                  onChange={(e) => setLocation({ ...location, zipCode: e.target.value })} 
                  placeholder="e.g., 10001 or SW1A 1AA" 
                  style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} 
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>City</label>
                <input 
                  type="text" 
                  value={location.city || ''} 
                  onChange={(e) => setLocation({ ...location, city: e.target.value })} 
                  placeholder="e.g., New York" 
                  style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Country Code (ISO 2-letter)</label>
                <input 
                  type="text" 
                  value={location.country || ''} 
                  onChange={(e) => setLocation({ ...location, country: e.target.value.toUpperCase().slice(0, 2) })} 
                  placeholder="e.g., US, GB, CA" 
                  maxLength={2}
                  style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem' }} 
                />
                <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  Use 2-letter ISO country code (US, GB, CA, etc.)
                </small>
              </div>
            </div>

            {/* Dashboard Layout */}
            <div style={{ background: 'linear-gradient(to right, #dbeafe, #bfdbfe)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #93c5fd' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📐</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Dashboard Layout</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                Choose how tasks are displayed on your Today dashboard
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                {layouts.map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => setDashboardLayout(layout.id)}
                    style={{
                      padding: '1rem',
                      borderRadius: '1rem',
                      border: dashboardLayout === layout.id ? '3px solid #3b82f6' : '1px solid #e5e7eb',
                      background: dashboardLayout === layout.id ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{layout.icon}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.25rem', color: '#1f2937' }}>
                      {layout.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                      {layout.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontWeight: 600, cursor: 'pointer', color: 'white', background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`, fontSize: '1rem' }}>
                💾 Save & Close
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontWeight: 600, cursor: 'pointer', background: '#e5e7eb', fontSize: '1rem' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default SettingsModal;
