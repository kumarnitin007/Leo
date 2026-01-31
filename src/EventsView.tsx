/**
 * Events View Component
 * 
 * Manages special occasions like birthdays, anniversaries, and holidays.
 * Features:
 * - View all events in a list/calendar format
 * - Add new events with date, frequency, and notification settings
 * - Edit and delete existing events
 * - Import sample events
 * - Shows upcoming events
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Event, EventFrequencyType } from './types';
import { 
  getEvents, 
  addEvent, 
  updateEvent, 
  deleteEvent,
  getUpcomingEvents,
  importSampleEvents,
  getTagsForSection
} from './storage';
import { importFromICalendar, filterPersonalEvents } from './icalParser';
import { Tag } from './types';
import { ReferenceCalendarModal } from './components/ReferenceCalendarModal';
import { ReferenceCalendarTemplateModal } from './components/ReferenceCalendarTemplateModal';
import EventFilterSidebar, { EventFilter } from './components/EventFilterSidebar';
import packageJson from '../package.json';

interface EventsViewProps {
  onNavigate?: (view: string) => void;
}

const EventsView: React.FC<EventsViewProps> = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Array<{ event: Event; date: string; daysUntil: number }>>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [isReferenceCalendarModalOpen, setIsReferenceCalendarModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<string>('date-asc');
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  
  // Filter sidebar state
  const [activeFilter, setActiveFilter] = useState<EventFilter>({ type: 'all' });
  const [showMobileFilters, setShowMobileFilters] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    date: '',
    frequency: 'yearly' as EventFrequencyType,
    customFrequency: '',
    year: new Date().getFullYear(),
    notifyDaysBefore: 0,
    priority: 5,
    hideFromDashboard: false,
    color: '#667eea',
    tags: [] as string[]
  });

  useEffect(() => {
    loadEvents();
    loadTags();
  }, []);
  
  // Track window resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const counts = {
      all: events.length,
      upcoming: upcomingEvents.length,
      thisMonth: events.filter(e => {
        const [month] = e.date.split('-').map(Number);
        return (e.frequency === 'yearly' ? month - 1 : new Date(e.date).getMonth()) === currentMonth;
      }).length,
      hidden: events.filter(e => e.hideFromDashboard).length,
      byCategory: {} as Record<string, number>,
      byFrequency: {} as Record<string, number>,
      byTag: {} as Record<string, number>,
    };
    
    events.forEach(e => {
      if (e.category) {
        counts.byCategory[e.category] = (counts.byCategory[e.category] || 0) + 1;
      }
      counts.byFrequency[e.frequency] = (counts.byFrequency[e.frequency] || 0) + 1;
      (e.tags || []).forEach(tagId => {
        counts.byTag[tagId] = (counts.byTag[tagId] || 0) + 1;
      });
    });
    
    return counts;
  }, [events, upcomingEvents]);
  
  // Filter events based on active filter
  const sidebarFilteredEvents = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    
    switch (activeFilter.type) {
      case 'all':
        return events;
      case 'upcoming':
        return events.filter(e => upcomingEvents.some(ue => ue.event.id === e.id));
      case 'thisMonth':
        return events.filter(e => {
          const [month] = e.date.split('-').map(Number);
          return (e.frequency === 'yearly' ? month - 1 : new Date(e.date).getMonth()) === currentMonth;
        });
      case 'hidden':
        return events.filter(e => e.hideFromDashboard);
      case 'category':
        return events.filter(e => e.category === activeFilter.value);
      case 'frequency':
        return events.filter(e => e.frequency === activeFilter.value);
      case 'tag':
        return events.filter(e => e.tags && e.tags.includes(activeFilter.value!));
      default:
        return events;
    }
  }, [events, upcomingEvents, activeFilter]);
  
  // Helper to get filter label
  const getFilterLabel = (filter: EventFilter): string => {
    switch (filter.type) {
      case 'all': return 'All Events';
      case 'upcoming': return 'Upcoming (30 days)';
      case 'thisMonth': return 'This Month';
      case 'hidden': return 'Hidden from Dashboard';
      case 'category': return filter.value || 'Category';
      case 'frequency': return filter.value === 'yearly' ? 'Yearly' : 'One-Time';
      case 'tag': {
        const tag = tags.find(t => t.id === filter.value);
        return tag?.name || 'Tag';
      }
      default: return 'All Events';
    }
  };

  const loadTags = async () => {
    try {
      // Get tags available for events section
      const eventTags = await getTagsForSection('events');
      setTags(eventTags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const allEvents = await getEvents();
      setEvents(allEvents);
      const upcoming = await getUpcomingEvents(30); // Get events within next 30 days
      setUpcomingEvents(upcoming);
    } catch (error) {
      console.error('Error loading events:', error);
      alert('Error loading events. Please make sure you are signed in.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          ...formData,
          tags: selectedTagIds
        });
      } else {
        const newEvent: Event = {
          id: crypto.randomUUID(),
          ...formData,
          tags: selectedTagIds,
          createdAt: new Date().toISOString()
        };
        await addEvent(newEvent);
      }
      
      resetForm();
      await loadEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error saving event. Please try again.');
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setSelectedTagIds(event.tags || []);
    setFormData({
      name: event.name,
      description: event.description || '',
      category: event.category || '',
      date: event.date,
      frequency: event.frequency,
      customFrequency: event.customFrequency || '',
      year: event.year || new Date().getFullYear(),
      notifyDaysBefore: event.notifyDaysBefore || 0,
      priority: event.priority || 5,
      hideFromDashboard: event.hideFromDashboard || false,
      color: event.color || '#667eea',
      tags: event.tags || []
    });
    setIsEditing(true);
  };

  const handleDelete = (eventId: string) => {
    if (confirm('Are you sure you want to delete this event?')) {
      deleteEvent(eventId);
      loadEvents();
    }
  };

  const getDefaultDescription = (category: string): string => {
    const descriptions: { [key: string]: string } = {
      'Birthday': 'Remember to call and wish! 🎂',
      'Anniversary': 'Plan something special to celebrate 💝',
      'Wedding': 'Celebrate this beautiful union 💍',
      'Graduation': 'Congratulate and celebrate this achievement 🎓',
      'Special Event': 'Mark this special occasion ⭐',
      'Festival': 'Enjoy the festivities and celebrations 🎊',
      'Holiday': 'Enjoy the day with family and friends 🎉',
      "Mother's Day": "Celebrate and appreciate mom 🌸",
      "Father's Day": "Honor and celebrate dad 👔",
      "Valentine's Day": "Celebrate love and friendship ❤️",
      "Independence Day": "Celebrate freedom and patriotism 🗽",
      "Cultural Event": "Experience and celebrate culture 🎭",
      'Death Anniversary': 'Light a candle and remember the good times 🕯️',
      'Memorial': 'Honor their memory with love 🌹',
      'Remembrance': 'Take a moment to reflect and remember 🙏',
    };
    return descriptions[category] || '';
  };

  const getDefaultNotifyDays = (category: string): number => {
    const notifyDays: { [key: string]: number } = {
      'Birthday': 3,
      'Anniversary': 3,
      'Wedding': 3,
      'Graduation': 3,
      'Special Event': 3,
      'Festival': 3,
      'Holiday': 3,
      "Mother's Day": 3,
      "Father's Day": 3,
      "Valentine's Day": 3,
      "Independence Day": 3,
      "Cultural Event": 3,
      'Death Anniversary': 1,
      'Memorial': 1,
      'Remembrance': 1,
    };
    const days = notifyDays[category] || 0;
    return Math.min(days, 7); // Ensure max 7 days
  };

  const getDefaultColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'Birthday': '#EC4899',
      'Anniversary': '#EF4444',
      'Wedding': '#F472B6',
      'Graduation': '#3B82F6',
      'Special Event': '#3B82F6',
      'Festival': '#8B5CF6',
      'Holiday': '#8B5CF6',
      "Mother's Day": '#EC4899',
      "Father's Day": '#3B82F6',
      "Valentine's Day": '#F43F5E',
      "Independence Day": '#3B82F6',
      "Cultural Event": '#8B5CF6',
      'Death Anniversary': '#6b7280',
      'Memorial': '#4b5563',
      'Remembrance': '#6b7280',
    };
    return colors[category] || '#667eea';
  };

  const getDefaultPriority = (category: string): number => {
    const priorities: { [key: string]: number } = {
      // High Priority - Personal & Important
      'Wedding': 10,
      'Anniversary': 9,
      'Birthday': 8,
      'Graduation': 8,
      
      // Medium Priority - Special Days
      "Mother's Day": 7,
      "Father's Day": 7,
      "Valentine's Day": 6,
      'Special Event': 6,
      
      // Lower Priority - General
      'Festival': 5,
      'Holiday': 5,
      "Independence Day": 5,
      "Cultural Event": 5,
      
      // Respectful Priority - Remembrance
      'Death Anniversary': 4,
      'Memorial': 4,
      'Remembrance': 4,
    };
    return priorities[category] || 5;
  };

  const handleCategoryChange = (category: string) => {
    setFormData({
      ...formData,
      category,
      description: getDefaultDescription(category),
      notifyDaysBefore: getDefaultNotifyDays(category),
      priority: getDefaultPriority(category),
      color: getDefaultColor(category)
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      date: '',
      frequency: 'yearly',
      customFrequency: '',
      year: new Date().getFullYear(),
      notifyDaysBefore: 0,
      priority: 5,
      hideFromDashboard: false,
      color: '#667eea',
      tags: []
    });
    setSelectedTagIds([]);
    setEditingEvent(null);
    setIsEditing(false);
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleImportSample = async () => {
    try {
      await importSampleEvents();
      loadEvents();
      alert('Sample events imported successfully!');
    } catch (error) {
      alert('Failed to import sample events. Make sure sample-events.json exists.');
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ics')) {
      alert('Please select a valid iCalendar (.ics) file');
      return;
    }

    setIsImporting(true);
    setImportProgress('Reading file...');

    try {
      const fileContent = await file.text();
      setImportProgress('Parsing events...');
      
      const parsedEvents = await importFromICalendar(fileContent);
      setImportProgress('Filtering personal events...');
      
      // Filter to only personal events (birthdays, anniversaries, etc.)
      const personalEvents = filterPersonalEvents(parsedEvents);
      
      if (personalEvents.length === 0) {
        alert('No birthdays, anniversaries, or memorial events found in the calendar.');
        setIsImporting(false);
        setImportProgress('');
        return;
      }

      setImportProgress(`Importing ${personalEvents.length} events...`);
      
      // Add all events
      let importedCount = 0;
      personalEvents.forEach(event => {
        try {
          const newEvent: Event = {
            id: crypto.randomUUID(),
            ...event,
            createdAt: new Date().toISOString()
          };
          addEvent(newEvent);
          importedCount++;
        } catch (error) {
          console.error('Error adding event:', event.name, error);
        }
      });

      loadEvents();
      setImportProgress('');
      setIsImporting(false);
      
      alert(`Successfully imported ${importedCount} events!\n\nCategories found:\n- Birthdays\n- Anniversaries\n- Holidays\n- Memorials`);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error importing iCalendar:', error);
      alert('Failed to import calendar file. Please make sure it\'s a valid .ics file.');
      setIsImporting(false);
      setImportProgress('');
    }
  };

  const formatEventDate = (event: Event): string => {
    if (event.frequency === 'yearly') {
      const [month, day] = event.date.split('-');
      const date = new Date(2000, parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    } else {
      // Parse date string manually to avoid timezone issues
      // event.date is in YYYY-MM-DD format
      const [year, month, day] = event.date.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  const getYearsInfo = (event: Event): string | null => {
    if (!event.year) return null;
    const currentYear = new Date().getFullYear();
    const years = currentYear - event.year;
    if (years > 0) {
      return `(${years} ${event.category === 'Birthday' ? 'years old' : 'years'})`;
    }
    return null;
  };

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      'Birthday': '🎂',
      'Anniversary': '💝',
      'Holiday': '🎉',
      'Special Event': '⭐',
      'Death Anniversary': '🕯️',
      'Memorial': '🌹',
      'Remembrance': '🙏',
      'default': '📅'
    };
    return icons[category] || icons['default'];
  };

  const isSomberEvent = (category: string): boolean => {
    const somberCategories = ['Death Anniversary', 'Memorial', 'Remembrance'];
    return somberCategories.includes(category);
  };

  return (
    <div className="events-view">
      <div className="events-header">
        <h2>📅 Events</h2>
        <p>Manage birthdays, anniversaries, holidays, memorials, and other significant dates</p>
      </div>

      {/* Main content with sidebar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Mobile: Show filters first */}
        {isMobile && showMobileFilters && !isEditing ? (
          <EventFilterSidebar
            tags={tags}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            entryCounts={filterCounts}
            isMobile={true}
            onFilterSelected={() => setShowMobileFilters(false)}
          />
        ) : (
          <>
            {/* Desktop: Filter Sidebar */}
            {!isMobile && !isEditing && (
              <EventFilterSidebar
                tags={tags}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                entryCounts={filterCounts}
              />
            )}
            
            {/* Main Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Mobile: Back to filters button */}
              {isMobile && !isEditing && (
                <button
                  onClick={() => setShowMobileFilters(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: '#3b82f6',
                    marginBottom: '1rem',
                    width: '100%',
                  }}
                >
                  <span>‹ Back to Filters</span>
                  <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.8rem' }}>
                    {getFilterLabel(activeFilter)} ({sidebarFilteredEvents.length})
                  </span>
                </button>
              )}

      {/* Upcoming Events Section */}
      {upcomingEvents.length > 0 && (
        <div className="upcoming-events-section">
          <h3>🔔 Upcoming Dates (Next 30 Days)</h3>
          <div className="upcoming-events-list">
            {upcomingEvents.map((item, idx) => (
              <div 
                key={idx} 
                className={`upcoming-event-card ${isSomberEvent(item.event.category || '') ? 'somber-event' : ''}`}
                style={{ borderLeft: `4px solid ${item.event.color}` }}
              >
                <div className="upcoming-event-icon">{getCategoryIcon(item.event.category || '')}</div>
                <div className="upcoming-event-info">
                  <h4>{item.event.name}</h4>
                  <p className="event-date-info">
                    {formatEventDate(item.event)} {getYearsInfo(item.event)}
                  </p>
                  {item.event.description && (
                    <p className="event-description">{item.event.description}</p>
                  )}
                </div>
                <div className="upcoming-event-countdown">
                  {item.daysUntil === 0 ? (
                    <span className={isSomberEvent(item.event.category || '') ? 'today-badge-somber' : 'today-badge'}>
                      {isSomberEvent(item.event.category || '') ? 'Today' : 'TODAY! 🎊'}
                    </span>
                  ) : (
                    <span className="days-badge">in {item.daysUntil} day{item.daysUntil > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="events-actions">
        <button className="btn-primary" onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? '✕ Cancel' : '+ Add New Event'}
        </button>
        <button 
          className="btn-secondary" 
          onClick={handleFileSelect}
          disabled={isImporting}
          title="Import from Google Calendar (.ics file)"
        >
          📤 {isImporting ? importProgress : 'Import Calendar'}
        </button>
        <button className="btn-secondary" onClick={handleImportSample}>
          📥 Import Sample Events
        </button>
        <span style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          padding: '0.25rem 0.75rem',
          backgroundColor: '#f3f4f6',
          borderRadius: '4px',
          fontFamily: 'monospace',
          marginLeft: 'auto'
        }}>
          v{packageJson.version}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ics"
          style={{ display: 'none' }}
          onChange={handleFileImport}
        />
      </div>

      {/* Reference Calendars Button */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        padding: '1rem',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <div>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            color: '#1f2937',
            margin: '0 0 0.25rem 0'
          }}>Reference Calendars</h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            margin: 0
          }}>Link holidays and special occasions from global calendars</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setIsReferenceCalendarModalOpen(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
          >
            📅 Manage
          </button>
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
          >
            📋 Templates
          </button>
        </div>
      </div>

      {/* Filter Section */}
      {events.length > 0 && (
        <div className="events-filters" style={{
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ flex: '1 1 200px', minWidth: '150px' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              Search
            </label>
            <input
              type="text"
              placeholder="Search events..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            />
          </div>
          
          <div style={{ flex: '0 1 150px', minWidth: '120px' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Categories</option>
              <option value="Birthday">Birthday</option>
              <option value="Anniversary">Anniversary</option>
              <option value="Wedding">Wedding</option>
              <option value="Graduation">Graduation</option>
              <option value="Holiday">Holiday</option>
              <option value="Festival">Festival</option>
              <option value="Special Event">Special Event</option>
              <option value="Death Anniversary">Death Anniversary</option>
              <option value="Memorial">Memorial</option>
              <option value="Remembrance">Remembrance</option>
            </select>
          </div>
          
          <div style={{ flex: '0 1 150px', minWidth: '120px' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              Frequency
            </label>
            <select
              value={filterFrequency}
              onChange={(e) => setFilterFrequency(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            >
              <option value="all">All Frequencies</option>
              <option value="yearly">Yearly</option>
              <option value="monthly">Monthly</option>
              <option value="one-time">One-time</option>
            </select>
          </div>
          
          <div style={{ flex: '0 1 150px', minWidth: '120px' }}>
            <label style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '0.875rem'
              }}
            >
              <option value="date-asc">Date (Earliest First)</option>
              <option value="date-desc">Date (Latest First)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="category-asc">Category (A-Z)</option>
              <option value="priority-desc">Priority (High to Low)</option>
              <option value="priority-asc">Priority (Low to High)</option>
            </select>
          </div>
          
          {(searchText || filterCategory !== 'all' || filterFrequency !== 'all' || sortBy !== 'date-asc') && (
              <button
              onClick={() => {
                setSearchText('');
                setFilterCategory('all');
                setFilterFrequency('all');
                setSortBy('date-asc');
              }}
              style={{
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#6b7280',
                whiteSpace: 'nowrap'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {isEditing && (
        <div className="event-form-container">
          <h3>{editingEvent ? 'Edit Event' : 'Add New Event'}</h3>
          <form onSubmit={handleSubmit} className="event-form">
            <div className="form-row">
              <div className="form-group">
                <label>Event Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Mom's Birthday"
                />
              </div>
              
              <div className="form-group">
                <label>Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                >
                  <option value="">Select Category</option>
                  <optgroup label="Celebrations">
                    <option value="Birthday">🎂 Birthday</option>
                    <option value="Anniversary">💝 Anniversary</option>
                    <option value="Wedding">💍 Wedding</option>
                    <option value="Graduation">🎓 Graduation</option>
                    <option value="Special Event">⭐ Special Event</option>
                  </optgroup>
                  <optgroup label="Festivals & Holidays">
                    <option value="Festival">🎊 Festival</option>
                    <option value="Holiday">🎉 Holiday</option>
                  </optgroup>
                  <optgroup label="Special Occasions">
                    <option value="Mother's Day">🌸 Mother's Day</option>
                    <option value="Father's Day">👔 Father's Day</option>
                    <option value="Valentine's Day">❤️ Valentine's Day</option>
                    <option value="Independence Day">🗽 Independence Day</option>
                    <option value="Cultural Event">🎭 Cultural Event</option>
                  </optgroup>
                  <optgroup label="Remembrance">
                    <option value="Death Anniversary">🕯️ Death Anniversary</option>
                    <option value="Memorial">🌹 Memorial</option>
                    <option value="Remembrance">🙏 Remembrance Day</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {formData.category && (
              <div style={{ 
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                border: '1px solid #3b82f6', 
                borderRadius: '8px', 
                padding: '0.75rem', 
                marginBottom: '1rem',
                fontSize: '0.9rem',
                color: '#1e40af'
              }}>
                <strong>✨ Smart Defaults Applied:</strong> Description, notification days, priority, and color have been set based on the category. Feel free to customize!
              </div>
            )}

            <div className="form-group">
              <label>Description <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'normal' }}>(Auto-filled, edit as needed)</span></label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Select a category to get a default description, or write your own..."
                rows={2}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Frequency *</label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as EventFrequencyType })}
                >
                  <option value="yearly">Yearly (Recurring)</option>
                  <option value="one-time">One-Time Event</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  Date * 
                  {formData.frequency === 'yearly' ? ' (MM-DD)' : ' (YYYY-MM-DD)'}
                </label>
                <input
                  type={formData.frequency === 'yearly' ? 'text' : 'date'}
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  placeholder={formData.frequency === 'yearly' ? '03-15' : '2025-12-31'}
                />
              </div>
            </div>

            {formData.frequency === 'custom' && (
              <div className="form-group">
                <label>Custom Frequency</label>
                <input
                  type="text"
                  value={formData.customFrequency}
                  onChange={(e) => setFormData({ ...formData, customFrequency: e.target.value })}
                  placeholder="e.g., Every 5 years"
                />
              </div>
            )}

            <div className="form-group">
              <label>Tags <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'normal' }}>(Optional)</span></label>
              {tags.length === 0 ? (
                <div style={{ 
                  padding: '1rem', 
                  background: '#f3f4f6', 
                  borderRadius: '8px', 
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  textAlign: 'center'
                }}>
                  No tags available. Create tags in Settings → Tags Manager to organize your events.
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem',
                  padding: '0.75rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  minHeight: '60px',
                  background: 'white'
                }}>
                  {tags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '20px',
                        border: `2px solid ${selectedTagIds.includes(tag.id) ? tag.color : '#e5e7eb'}`,
                        background: selectedTagIds.includes(tag.id) 
                          ? `${tag.color}20` 
                          : 'white',
                        color: selectedTagIds.includes(tag.id) ? tag.color : '#6b7280',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: selectedTagIds.includes(tag.id) ? 600 : 500,
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedTagIds.includes(tag.id)) {
                          e.currentTarget.style.borderColor = tag.color;
                          e.currentTarget.style.background = `${tag.color}10`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedTagIds.includes(tag.id)) {
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      <span style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: tag.color 
                      }} />
                      {tag.name}
                      {selectedTagIds.includes(tag.id) && ' ✓'}
                    </button>
                  ))}
                </div>
              )}
              {selectedTagIds.length > 0 && (
                <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                  {selectedTagIds.length} tag{selectedTagIds.length > 1 ? 's' : ''} selected
                </small>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Year (Optional)</label>
                <input
                  type="number"
                  value={formData.year || ''}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || undefined })}
                  placeholder="e.g., 1990 (for age calculation)"
                />
              </div>

              <div className="form-group">
                <label>Notify Days Before <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'normal' }}>(Auto-set, max 7 days)</span></label>
                <input
                  type="number"
                  min="0"
                  max="7"
                  value={formData.notifyDaysBefore}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    const clampedValue = Math.min(Math.max(value, 0), 7); // Clamp between 0 and 7
                    setFormData({ ...formData, notifyDaysBefore: clampedValue });
                  }}
                />
              </div>

              <div className="form-group">
                <label>Priority (1-10) <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'normal' }}>(Auto-set)</span></label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 5 })}
                />
                <small style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  Controls display size on dashboard
                </small>
              </div>

              <div className="form-group">
                <label>Color <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 'normal' }}>(Auto-set)</span></label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.hideFromDashboard}
                  onChange={(e) => setFormData({ ...formData, hideFromDashboard: e.target.checked })}
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <span>🙈 Hide from Today dashboard</span>
              </label>
              <small style={{ color: '#6b7280', fontSize: '0.875rem', marginLeft: '1.75rem', display: 'block', marginTop: '0.25rem' }}>
                Event will still appear in Events tab and calendar views
              </small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingEvent ? 'Update Event' : 'Add Event'}
              </button>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events List */}
      <div className="events-list-container">
        {(() => {
          // Apply filters (starting from sidebar-filtered events)
          let filteredEvents = sidebarFilteredEvents;
          
          if (searchText) {
            filteredEvents = filteredEvents.filter(event =>
              event.name.toLowerCase().includes(searchText.toLowerCase()) ||
              (event.description && event.description.toLowerCase().includes(searchText.toLowerCase()))
            );
          }
          
          if (filterCategory !== 'all') {
            filteredEvents = filteredEvents.filter(event => event.category === filterCategory);
          }
          
          if (filterFrequency !== 'all') {
            filteredEvents = filteredEvents.filter(event => event.frequency === filterFrequency);
          }
          
          // Apply sorting
          const sortedEvents = [...filteredEvents].sort((a, b) => {
            switch (sortBy) {
              case 'date-asc':
                // Sort by date (month-day for yearly, full date for one-time)
                if (a.frequency === 'yearly' && b.frequency === 'yearly') {
                  return a.date.localeCompare(b.date);
                }
                return a.date.localeCompare(b.date);
              
              case 'date-desc':
                if (a.frequency === 'yearly' && b.frequency === 'yearly') {
                  return b.date.localeCompare(a.date);
                }
                return b.date.localeCompare(a.date);
              
              case 'name-asc':
                return a.name.localeCompare(b.name);
              
              case 'name-desc':
                return b.name.localeCompare(a.name);
              
              case 'category-asc':
                return (a.category || '').localeCompare(b.category || '');
              
              case 'priority-desc':
                return (b.priority || 5) - (a.priority || 5);
              
              case 'priority-asc':
                return (a.priority || 5) - (b.priority || 5);
              
              default:
                return 0;
            }
          });
          
          return (
            <>
              <h3>📋 {activeFilter.type === 'all' ? 'All Events' : getFilterLabel(activeFilter)} ({filteredEvents.length}{filteredEvents.length !== events.length ? ` of ${events.length}` : ''})</h3>
              {filteredEvents.length === 0 ? (
                <div className="no-events">
                  <p>{events.length === 0 ? 'No events yet. Add your first event to get started!' : 'No events match your filters.'}</p>
                </div>
              ) : (
                <div className="events-grid">
                  {sortedEvents.map((event) => (
                <div key={event.id} className="event-card" style={{ borderLeft: `6px solid ${event.color}` }}>
                  <div className="event-card-header">
                    <span className="event-icon">{getCategoryIcon(event.category || '')}</span>
                    <h4>{event.name}</h4>
                  </div>
                  
                  {event.category && (
                    <div className="event-category-badge">{event.category}</div>
                  )}
                  
                  <div className="event-date">
                    📅 {formatEventDate(event)} {getYearsInfo(event)}
                  </div>
                  
                  {event.description && (
                    <div className="event-description">{event.description}</div>
                  )}
                  
                  <div className="event-meta">
                    <span className="event-frequency-badge">
                      {event.frequency === 'yearly' ? '🔄 Yearly' : '⚡ One-Time'}
                    </span>
                    {event.notifyDaysBefore > 0 && (
                      <span className="event-notify-badge">
                        🔔 Notify {event.notifyDaysBefore}d before
                      </span>
                    )}
                    <span className="event-priority-badge">
                      ⭐ Priority: {event.priority || 5}/10
                    </span>
                    {event.hideFromDashboard && (
                      <span className="event-hidden-badge" style={{ 
                        background: '#f3f4f6', 
                        color: '#6b7280',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        🙈 Hidden from Dashboard
                      </span>
                    )}
                  </div>
                  
                  <div className="event-actions">
                    <button className="btn-edit" onClick={() => handleEdit(event)}>
                      ✏️ Edit
                    </button>
                    <button className="btn-delete" onClick={() => handleDelete(event.id)}>
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
                </div>
              )}
            </>
          );
        })()}

      {/* Reference Calendar Modal */}
      <ReferenceCalendarModal
        isOpen={isReferenceCalendarModalOpen}
        onClose={() => setIsReferenceCalendarModalOpen(false)}
        onDaysChange={loadEvents}
      />

      {/* Template Modal */}
      <ReferenceCalendarTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
      />
      </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventsView;

