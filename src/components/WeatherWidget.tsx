/**
 * Weather Widget Component
 * 
 * Displays weather forecast using OpenWeatherMap API
 * Shows hourly forecast for today and 7-day forecast
 * Collapsible - only loads data when expanded
 */

import React, { useState, useEffect } from 'react';
import { getUserSettings } from '../storage';

interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    humidity: number;
    description: string;
    icon: string;
  };
  hourly: Array<{
    time: string;
    temp: number;
    icon: string;
    description: string;
  }>;
  daily: Array<{
    date: string;
    day: string;
    high: number;
    low: number;
    icon: string;
    description: string;
  }>;
}

const WeatherWidget: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ zipCode?: string; city?: string; country?: string } | null>(null);

  // Load location from settings (only if user is signed in)
  useEffect(() => {
    const loadLocation = async () => {
      try {
        const settings = await getUserSettings();
        if (settings.location && (settings.location.zipCode || settings.location.city)) {
          setLocation(settings.location);
        }
      } catch (error: any) {
        // Silently ignore auth errors (user not signed in yet)
        if (!error?.message?.includes('User must be signed in')) {
          console.error('Error loading location:', error);
        }
      }
    };
    loadLocation();
  }, []);

  // Fetch weather data when expanded
  useEffect(() => {
    if (isExpanded && location && !weatherData && !isLoading) {
      fetchWeatherData();
    }
  }, [isExpanded, location]);

  const fetchWeatherData = async () => {
    if (!location || (!location.zipCode && !location.city)) {
      setError('Please set your location in Settings');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query string for OpenWeatherMap
      // Free tier: https://api.openweathermap.org/data/2.5/forecast?q={city},{country}&appid={API_KEY}
      // For zip: https://api.openweathermap.org/data/2.5/forecast?zip={zip},{country}&appid={API_KEY}
      
      const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
      if (!API_KEY) {
        setError('Weather API key not configured. Please add VITE_OPENWEATHER_API_KEY to your .env file.');
        setIsLoading(false);
        return;
      }

      let query = '';
      if (location.zipCode) {
        query = `zip=${location.zipCode}${location.country ? ',' + location.country : ''}`;
      } else {
        query = `q=${location.city}${location.country ? ',' + location.country : ''}`;
      }

      // Fetch 5-day forecast (3-hour intervals) - free tier
      const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?${query}&appid=${API_KEY}&units=imperial`;
      const forecastResponse = await fetch(forecastUrl);
      
      if (!forecastResponse.ok) {
        if (forecastResponse.status === 401) {
          throw new Error('Invalid API key or API key not activated yet. Please check your API key in .env file. New API keys can take 10-60 minutes to activate after signup.');
        }
        const errorData = await forecastResponse.json().catch(() => ({}));
        throw new Error(`Weather API error (${forecastResponse.status}): ${errorData.message || forecastResponse.statusText}`);
      }

      const forecastData = await forecastResponse.json();

      // Process hourly data (next 24 hours from forecast)
      const hourly: WeatherData['hourly'] = forecastData.list.slice(0, 8).map((item: any) => {
        const date = new Date(item.dt * 1000);
        return {
          time: date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          temp: Math.round(item.main.temp),
          icon: `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`,
          description: item.weather[0].description
        };
      });

      // Process daily data (group by day, get high/low)
      const dailyMap = new Map<string, { temps: number[]; icon: string; description: string }>();
      
      forecastData.list.forEach((item: any) => {
        const date = new Date(item.dt * 1000);
        const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, {
            temps: [],
            icon: item.weather[0].icon,
            description: item.weather[0].description
          });
        }
        
        const dayData = dailyMap.get(dateKey)!;
        dayData.temps.push(item.main.temp);
        dayData.icon = item.weather[0].icon; // Use latest icon
      });

      const daily: WeatherData['daily'] = Array.from(dailyMap.entries()).slice(0, 7).map(([dateKey, data]) => {
        const date = new Date(dateKey + ', ' + new Date().getFullYear());
        return {
          date: dateKey,
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          high: Math.round(Math.max(...data.temps)),
          low: Math.round(Math.min(...data.temps)),
          icon: `https://openweathermap.org/img/wn/${data.icon}@2x.png`,
          description: data.description
        };
      });

      // Get current weather (first item in forecast)
      const current = {
        temp: Math.round(forecastData.list[0].main.temp),
        feelsLike: Math.round(forecastData.list[0].main.feels_like),
        humidity: forecastData.list[0].main.humidity,
        description: forecastData.list[0].weather[0].description,
        icon: `https://openweathermap.org/img/wn/${forecastData.list[0].weather[0].icon}@2x.png`
      };

      setWeatherData({ current, hourly, daily });
    } catch (err: any) {
      console.error('Error fetching weather:', err);
      setError(err.message || 'Failed to load weather data. Please check your location settings.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!location || (!location.zipCode && !location.city)) {
    return (
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        textAlign: 'center',
        color: 'white'
      }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          📍 Set your location in Settings to see weather forecasts
        </p>
      </div>
    );
  }

  return (
    <div style={{
      marginTop: '2rem',
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '12px',
      border: '1px solid rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    }}>
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '1rem 1.5rem',
          background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '1rem',
          fontWeight: 600
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🌤️</span>
          <span>Weather Forecast</span>
        </div>
        <span style={{ fontSize: '1.25rem' }}>{isExpanded ? '▲' : '▼'}</span>
      </button>

      {/* Content - Only shown when expanded */}
      {isExpanded && (
        <div style={{ padding: '1.5rem' }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
              <p>Loading weather data...</p>
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              background: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              color: '#dc2626',
              marginBottom: '1rem'
            }}>
              <strong>⚠️ Error:</strong> {error}
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>
                {error.includes('401') || error.includes('Unauthorized') || error.includes('Invalid API key') ? (
                  <>
                    Your API key may not be activated yet. New OpenWeatherMap API keys can take <strong>10-60 minutes</strong> to activate after signup.
                    <br />
                    <br />
                    If you just created your account, please wait a bit and try again. Otherwise, verify your API key is correct in your .env file.
                    <br />
                    <br />
                    Get help at <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626', textDecoration: 'underline' }}>openweathermap.org</a>
                  </>
                ) : (
                  <>
                    Make sure you have set <code>VITE_OPENWEATHER_API_KEY</code> in your .env file.
                    <br />
                    Get a free API key at <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" style={{ color: '#dc2626', textDecoration: 'underline' }}>openweathermap.org</a>
                  </>
                )}
              </p>
            </div>
          )}

          {weatherData && !isLoading && (
            <>
              {/* Current Weather */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
                borderRadius: '8px'
              }}>
                <img src={weatherData.current.icon} alt={weatherData.current.description} style={{ width: '64px', height: '64px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{weatherData.current.temp}°F</div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Feels like {weatherData.current.feelsLike}°F • {weatherData.current.humidity}% humidity
                  </div>
                  <div style={{ fontSize: '0.9rem', textTransform: 'capitalize', marginTop: '0.25rem' }}>
                    {weatherData.current.description}
                  </div>
                </div>
              </div>

              {/* Hourly Forecast - Horizontal Scroll */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Today's Hourly Forecast</h4>
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  overflowX: 'auto',
                  paddingBottom: '0.5rem',
                  scrollbarWidth: 'thin'
                }}>
                  {weatherData.hourly.map((hour, idx) => (
                    <div
                      key={idx}
                      style={{
                        minWidth: '80px',
                        padding: '0.75rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem' }}>{hour.time}</div>
                      <img src={hour.icon} alt={hour.description} style={{ width: '40px', height: '40px', margin: '0 auto 0.5rem' }} />
                      <div style={{ fontSize: '1rem', fontWeight: 600 }}>{hour.temp}°</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 7-Day Forecast - Horizontal Scroll */}
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>7-Day Forecast</h4>
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  overflowX: 'auto',
                  paddingBottom: '0.5rem',
                  scrollbarWidth: 'thin'
                }}>
                  {weatherData.daily.map((day, idx) => (
                    <div
                      key={idx}
                      style={{
                        minWidth: '100px',
                        padding: '0.75rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        textAlign: 'center',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 600 }}>
                        {idx === 0 ? 'Today' : day.day}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.5rem' }}>{day.date}</div>
                      <img src={day.icon} alt={day.description} style={{ width: '40px', height: '40px', margin: '0 auto 0.5rem' }} />
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{day.high}°</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{day.low}°</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;

