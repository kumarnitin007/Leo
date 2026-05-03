/**
 * Settings Modal Component
 * 
 * Comprehensive settings interface with theme, avatar, and user customization.
 */

import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';

// Add fadeIn animation style
const fadeInStyle = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('avatar-fadein-style')) {
  const style = document.createElement('style');
  style.id = 'avatar-fadein-style';
  style.textContent = fadeInStyle;
  document.head.appendChild(style);
}
import Portal from './Portal';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { avatars, AVATAR_CATEGORIES } from '../constants/avatars';
import { DashboardLayout, TemperatureUnit, FinancialPreferences, FinancialDisplayCurrencyPref, AIPersonality } from '../types';
import { getUserSettings, saveUserSettings } from '../storage';
import { getUserLevel, UserLevelAssignment } from '../services/userLevelService';
import AIUsagePanel from './ai/AIUsagePanel';
import AIPersonalityProfile from './ai/AIPersonalityProfile';

interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  /** When true, render as in-flow content (no Portal, no backdrop, no fixed shell). Used by Settings → Profile inline. */
  inline?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ show, onClose, inline = false }) => {
  const { theme, setTheme, availableThemes } = useTheme();
  const { username, avatar, setUsername, setAvatar, email, setEmail } = useUser();
  
  const [editingUsername, setEditingUsername] = useState(username);
  const [editingEmail, setEditingEmail] = useState(email);
  const [selectedCategory, setSelectedCategory] = useState(avatar.category);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarSearch, setAvatarSearch] = useState('');
  const debouncedAvatarSearch = useDebounce(avatarSearch, 300);
  const [hoveredAvatar, setHoveredAvatar] = useState<string | null>(null);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>('uniform');
  const [location, setLocation] = useState<{ zipCode?: string; city?: string; country?: string }>({});
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit | undefined>(undefined);
  const [birthData, setBirthData] = useState<{ year?: number; month?: number; day?: number; hour?: number; minute?: number; city?: string; timeKnown?: boolean }>({});
  const [financialPreferences, setFinancialPreferences] = useState<FinancialPreferences>({
    exchangeRates: { USD: 83, EUR: 90, GBP: 105 },
  });
  const [aiOptIn, setAiOptIn] = useState(false);
  const [aiPersonality, setAiPersonality] = useState<AIPersonality>({});
  const [userLevel, setUserLevel] = useState<UserLevelAssignment | null>(null);

  // Load settings from storage
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getUserSettings();
        console.log('✅ Settings loaded:', settings);
        console.log('📍 Location data:', settings.location);
        setDashboardLayout(settings.dashboardLayout);
        setLocation(settings.location || {});
        setTemperatureUnit(settings.temperatureUnit);
        setBirthData(settings.birthData || {});
        setAiOptIn(settings.aiOptIn ?? false);
        setAiPersonality(settings.aiPersonality ?? {});
        setFinancialPreferences({
          preferredDisplayCurrency: settings.financialPreferences?.preferredDisplayCurrency,
          exchangeRates: {
            USD: settings.financialPreferences?.exchangeRates?.USD ?? 83,
            EUR: settings.financialPreferences?.exchangeRates?.EUR ?? 90,
            GBP: settings.financialPreferences?.exchangeRates?.GBP ?? 105,
          },
        });

        // Load user level
        const level = await getUserLevel();
        setUserLevel(level);
      } catch (error) {
        console.error('❌ Error loading settings:', error);
      }
    };
    if (show) {
      loadSettings();
    }
  }, [show]);

  if (!show) return null;

  const handleSave = async () => {
    try {
      console.log('💾 Saving settings...');
      console.log('📍 Location to save:', location);
      await setUsername(editingUsername);
      await setEmail(editingEmail);
      await saveUserSettings({
        dashboardLayout,
        location,
        temperatureUnit,
        theme: theme.id,
        financialPreferences,
        aiOptIn,
        aiPersonality: aiOptIn ? aiPersonality : undefined,
        birthData: birthData.year && birthData.month && birthData.day && birthData.city
          ? { year: birthData.year, month: birthData.month, day: birthData.day, hour: birthData.hour, minute: birthData.minute, city: birthData.city, timeKnown: birthData.hour != null }
          : undefined,
      });
      console.log('✅ Settings saved successfully!');
      onClose();
      // Note: Layout and theme changes apply immediately via context
      // No reload needed - preserves navigation state
    } catch (error) {
      console.error('❌ Error saving settings:', error);
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

  const filteredAvatars = useMemo(() => avatars.filter(a => {
    const matchesCategory = a.category === selectedCategory;
    const matchesSearch = debouncedAvatarSearch.trim() === '' || 
      a.name.toLowerCase().includes(debouncedAvatarSearch.toLowerCase()) ||
      a.category.toLowerCase().includes(debouncedAvatarSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  }), [selectedCategory, debouncedAvatarSearch]);

  // Outer wrappers vary depending on inline mode:
  //   - Modal mode: Portal → backdrop → fixed card
  //   - Inline mode: just a card in the normal flow (no portal, no backdrop)
  const Outer: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    inline ? <>{children}</> : (
      <Portal>
        <div className="settings-modal-backdrop" onClick={onClose}>
          {children}
        </div>
      </Portal>
    );

  return (
    <Outer>
      <div
        className="settings-modal-content"
        onClick={inline ? undefined : (e) => e.stopPropagation()}
        style={inline ? { background: 'white', borderRadius: '12px', border: '0.5px solid #e5e7eb', maxHeight: 'none', overflow: 'visible' } : undefined}
      >
          {/* Header (hidden in inline mode — page already shows a header) */}
          {!inline && (
          <div style={{ padding: '1.5rem', borderBottom: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'white', zIndex: 10, borderRadius: '1rem 1rem 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '2rem' }}>{avatar.emoji}</span>
              <span style={{ fontSize: '1.5rem' }}>⚙️</span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Settings</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>
          )}

          <div style={{ padding: '1.5rem' }}>
            {/* Profile */}
            <div style={{ background: 'linear-gradient(to right, #eef2ff, #f5f3ff)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #c7d2fe' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>👤</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Profile</h3>
              </div>
              
              {/* User Level Badge */}
              {userLevel?.level && (
                <div style={{
                  background: userLevel.level.color || '#6b7280',
                  color: 'white',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  <span style={{ fontSize: '1.5rem' }}>{userLevel.level.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{userLevel.level.displayName} Plan</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{userLevel.level.description}</div>
                  </div>
                </div>
              )}
              
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
            <div style={{ 
              background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%)', 
              borderRadius: '1rem', 
              padding: '1.5rem', 
              marginBottom: '1.5rem', 
              border: '2px solid #ec4899',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🎭</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>Choose Your Avatar</h3>
              </div>
              <div style={{ 
                textAlign: 'center', 
                marginBottom: '1rem',
                padding: '1.5rem',
                background: 'white',
                borderRadius: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}>
                <div style={{ 
                  fontSize: '5rem', 
                  marginBottom: '0.5rem',
                  transition: 'transform 0.3s ease',
                  transform: hoveredAvatar === avatar.id ? 'scale(1.2) rotate(5deg)' : 'scale(1)',
                  display: 'inline-block'
                }}>
                  {avatar.emoji}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                  {avatar.name}
                </div>
                <button 
                  onClick={() => { setShowAvatarPicker(!showAvatarPicker); setAvatarSearch(''); }}
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    background: showAvatarPicker ? 'linear-gradient(135deg, #ec4899, #be185d)' : 'linear-gradient(135deg, #f472b6, #ec4899)',
                    border: 'none',
                    borderRadius: '0.75rem', 
                    cursor: 'pointer', 
                    fontWeight: 600,
                    color: 'white',
                    fontSize: '0.95rem',
                    boxShadow: '0 2px 8px rgba(236, 72, 153, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(236, 72, 153, 0.3)';
                  }}
                >
                  {showAvatarPicker ? '▲ Hide Picker' : '✨ Change Avatar'}
                </button>
              </div>
              {showAvatarPicker && (
                <div style={{
                  background: 'white',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  animation: 'fadeIn 0.3s ease'
                }}>
                  {/* Search */}
                  <div style={{ marginBottom: '1rem' }}>
                    <input
                      type="text"
                      placeholder="🔍 Search avatars..."
                      value={avatarSearch}
                      onChange={(e) => setAvatarSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '2px solid #fbcfe8',
                        borderRadius: '0.75rem',
                        fontSize: '0.95rem',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = '#ec4899'}
                      onBlur={(e) => e.currentTarget.style.borderColor = '#fbcfe8'}
                    />
                  </div>
                  
                  {/* Category Filters */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {AVATAR_CATEGORIES.map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setSelectedCategory(cat)} 
                        style={{ 
                          padding: '0.5rem 1rem', 
                          borderRadius: '0.75rem', 
                          border: 'none', 
                          fontWeight: 600, 
                          fontSize: '0.875rem', 
                          cursor: 'pointer', 
                          background: selectedCategory === cat 
                            ? 'linear-gradient(135deg, #ec4899, #be185d)' 
                            : 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                          color: selectedCategory === cat ? 'white' : '#374151',
                          transition: 'all 0.2s ease',
                          boxShadow: selectedCategory === cat ? '0 2px 8px rgba(236, 72, 153, 0.3)' : 'none'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedCategory !== cat) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedCategory !== cat) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  
                  {/* Avatar Grid */}
                  {filteredAvatars.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      No avatars found matching "{avatarSearch}"
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', 
                      gap: '1rem',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      padding: '0.5rem'
                    }}>
                      {filteredAvatars.map(av => (
                        <button 
                          key={av.id} 
                          onClick={async () => { 
                            await setAvatar(av.id); 
                            setShowAvatarPicker(false);
                            setAvatarSearch('');
                          }}
                          onMouseEnter={() => setHoveredAvatar(av.id)}
                          onMouseLeave={() => setHoveredAvatar(null)}
                          style={{ 
                            fontSize: '3rem', 
                            padding: '1rem', 
                            border: avatar.id === av.id ? '3px solid #ec4899' : '2px solid #e5e7eb', 
                            borderRadius: '1rem', 
                            background: avatar.id === av.id 
                              ? 'linear-gradient(135deg, #fce7f3, #fbcfe8)' 
                              : hoveredAvatar === av.id
                              ? 'linear-gradient(135deg, #fef3c7, #fde68a)'
                              : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            transform: hoveredAvatar === av.id ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
                            boxShadow: avatar.id === av.id 
                              ? '0 4px 12px rgba(236, 72, 153, 0.3)' 
                              : hoveredAvatar === av.id
                              ? '0 4px 12px rgba(245, 158, 11, 0.3)'
                              : '0 2px 4px rgba(0,0,0,0.1)',
                            position: 'relative'
                          }} 
                          title={av.name}
                        >
                          {av.emoji}
                          {avatar.id === av.id && (
                            <div style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              background: '#ec4899',
                              color: 'white',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              boxShadow: '0 2px 8px rgba(236, 72, 153, 0.4)'
                            }}>
                              ✓
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: t.gradient.textColor || 'white', textShadow: t.gradient.textColor ? 'none' : '0 1px 3px rgba(0,0,0,0.3)' }}>{t.name}</div>
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
              
              {/* Temperature Unit Toggle */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #fbbf24' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Temperature Unit</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setTemperatureUnit('celsius')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: temperatureUnit === 'celsius' ? '2px solid #f59e0b' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: temperatureUnit === 'celsius' ? '#fef3c7' : 'white',
                      cursor: 'pointer',
                      fontWeight: temperatureUnit === 'celsius' ? 600 : 400,
                      fontSize: '1rem'
                    }}
                  >
                    °C Celsius
                  </button>
                  <button
                    onClick={() => setTemperatureUnit('fahrenheit')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: temperatureUnit === 'fahrenheit' ? '2px solid #f59e0b' : '1px solid #d1d5db',
                      borderRadius: '0.5rem',
                      background: temperatureUnit === 'fahrenheit' ? '#fef3c7' : 'white',
                      cursor: 'pointer',
                      fontWeight: temperatureUnit === 'fahrenheit' ? 600 : 400,
                      fontSize: '1rem'
                    }}
                  >
                    °F Fahrenheit
                  </button>
                </div>
                <small style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                  {!temperatureUnit ? 'Auto-detected from country (most countries use °C, US uses °F)' : 'Saved to your profile and synced when signed in'}
                </small>
              </div>

              {/* Birth Data for Astrology */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #fbbf24' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🔮</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e' }}>Birth Data (Astrology)</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Used for natal chart &amp; personalized daily horoscope on the home page
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Year</label>
                    <input type="number" value={birthData.year || ''} onChange={(e) => setBirthData({ ...birthData, year: e.target.value ? Number(e.target.value) : undefined })} placeholder="1990" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Month</label>
                    <input type="number" min={1} max={12} value={birthData.month || ''} onChange={(e) => setBirthData({ ...birthData, month: e.target.value ? Number(e.target.value) : undefined })} placeholder="5" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Day</label>
                    <input type="number" min={1} max={31} value={birthData.day || ''} onChange={(e) => setBirthData({ ...birthData, day: e.target.value ? Number(e.target.value) : undefined })} placeholder="15" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Hour (0-23)</label>
                    <input type="number" min={0} max={23} value={birthData.hour ?? ''} onChange={(e) => setBirthData({ ...birthData, hour: e.target.value !== '' ? Number(e.target.value) : undefined })} placeholder="14" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Minute</label>
                    <input type="number" min={0} max={59} value={birthData.minute ?? ''} onChange={(e) => setBirthData({ ...birthData, minute: e.target.value !== '' ? Number(e.target.value) : undefined })} placeholder="30" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Birth City</label>
                    <input type="text" value={birthData.city || ''} onChange={(e) => setBirthData({ ...birthData, city: e.target.value })} placeholder="New York" style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
                  </div>
                </div>
                <small style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                  Hour &amp; minute are optional — without them, houses &amp; ascendant won't be calculated.
                </small>
              </div>

              {/* Safe / Financial defaults — same units as Safe → Financial exchange modal (₹ per $, €, £) */}
              <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #fbbf24' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>🏦</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e' }}>Financial dashboard defaults</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Used for <strong>Safe → Financial</strong> when you have not saved rates in that vault yet, or on a new device. Supported display currencies match the dashboard.
                </p>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Preferred display currency</label>
                <select
                  value={financialPreferences.preferredDisplayCurrency || ''}
                  onChange={(e) =>
                    setFinancialPreferences((p) => ({
                      ...p,
                      preferredDisplayCurrency: (e.target.value || undefined) as FinancialDisplayCurrencyPref | undefined,
                    }))
                  }
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', marginBottom: '0.75rem', fontSize: '0.95rem' }}
                >
                  <option value="">— Use app default (locale) —</option>
                  <option value="ORIGINAL">Original (mixed → INR)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: '#374151' }}>Exchange rates (INR per 1 unit)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#6b7280' }}>1 USD = ₹</label>
                    <input
                      type="number"
                      min={1}
                      step={0.01}
                      value={financialPreferences.exchangeRates?.USD ?? 83}
                      onChange={(e) =>
                        setFinancialPreferences((p) => ({
                          ...p,
                          exchangeRates: {
                            USD: Number(e.target.value) || 83,
                            EUR: p.exchangeRates?.EUR ?? 90,
                            GBP: p.exchangeRates?.GBP ?? 105,
                          },
                        }))
                      }
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '0.35rem', border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#6b7280' }}>1 EUR = ₹</label>
                    <input
                      type="number"
                      min={1}
                      step={0.01}
                      value={financialPreferences.exchangeRates?.EUR ?? 90}
                      onChange={(e) =>
                        setFinancialPreferences((p) => ({
                          ...p,
                          exchangeRates: {
                            USD: p.exchangeRates?.USD ?? 83,
                            EUR: Number(e.target.value) || 90,
                            GBP: p.exchangeRates?.GBP ?? 105,
                          },
                        }))
                      }
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '0.35rem', border: '1px solid #d1d5db' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#6b7280' }}>1 GBP = ₹</label>
                    <input
                      type="number"
                      min={1}
                      step={0.01}
                      value={financialPreferences.exchangeRates?.GBP ?? 105}
                      onChange={(e) =>
                        setFinancialPreferences((p) => ({
                          ...p,
                          exchangeRates: {
                            USD: p.exchangeRates?.USD ?? 83,
                            EUR: p.exchangeRates?.EUR ?? 90,
                            GBP: Number(e.target.value) || 105,
                          },
                        }))
                      }
                      style={{ width: '100%', padding: '0.4rem', borderRadius: '0.35rem', border: '1px solid #d1d5db' }}
                    />
                  </div>
                </div>
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

            {/* AI Recommendations Opt-in */}
            <div style={{ background: 'linear-gradient(to right, #ede9fe, #ddd6fe)', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #a78bfa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>AI Recommendations</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', lineHeight: 1.5 }}>
                Enable AI-powered features like morning briefings and journal reflections.
                When enabled, your tasks, events, journal mood, and recent entries are sent to OpenAI to generate personalised insights.
                No data is stored externally — responses are saved only in your account.
              </p>
              <div
                onClick={() => setAiOptIn(!aiOptIn)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  cursor: 'pointer',
                  padding: '0.875rem 1rem',
                  borderRadius: '0.75rem',
                  border: aiOptIn ? '2px solid #7c3aed' : '2px solid #d1d5db',
                  background: aiOptIn ? '#f5f3ff' : 'white',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  background: aiOptIn ? '#7c3aed' : '#d1d5db',
                  position: 'relative',
                  transition: 'background 0.2s',
                  flexShrink: 0,
                }}>
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    background: 'white',
                    position: 'absolute',
                    top: 2,
                    left: aiOptIn ? 22 : 2,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: aiOptIn ? '#5b21b6' : '#374151' }}>
                    {aiOptIn ? 'AI features enabled' : 'AI features disabled'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                    {aiOptIn ? 'Leo will provide daily briefings and journal reflections' : 'Toggle on to get personalised AI insights'}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Personality Profile (only when opted in) */}
            {aiOptIn && (
              <AIPersonalityProfile personality={aiPersonality} onChange={setAiPersonality} />
            )}

            {/* AI Usage & Audit (only when AI is opted in) */}
            {aiOptIn && (
              <div style={{ marginBottom: '1.5rem' }}>
                <AIUsagePanel />
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleSave} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontWeight: 600, cursor: 'pointer', color: 'white', background: `linear-gradient(to right, ${theme.colors.primary}, ${theme.colors.secondary})`, fontSize: '1rem' }}>
                💾 Save
              </button>
              {!inline && (
                <button onClick={onClose} style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem', border: 'none', fontWeight: 600, cursor: 'pointer', background: '#e5e7eb', fontSize: '1rem' }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
      </div>
    </Outer>
  );
};

export default SettingsModal;
