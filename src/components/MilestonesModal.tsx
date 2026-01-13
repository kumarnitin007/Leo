/**
 * Milestones Modal Component
 * 
 * Displays all tasks and events tagged with "milestone"
 */

import React, { useState, useEffect } from 'react';
import { Task, Event, Tag } from '../types';
import { getTasks, getEvents, getTags } from '../storage';

interface MilestonesModalProps {
  onClose: () => void;
}

type MilestoneItem = {
  id: string;
  name: string;
  date: string;
  category?: string;
  type: 'task' | 'event';
  daysRemaining: number;
};

const MilestonesModal: React.FC<MilestonesModalProps> = ({ onClose }) => {
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMilestones();
  }, []);

  const loadMilestones = async () => {
    try {
      const [tasks, events, tags] = await Promise.all([
        getTasks(),
        getEvents(),
        getTags()
      ]);

      // Find the milestone tag
      const milestoneTag = tags.find(tag => 
        tag.name.toLowerCase() === 'milestone'
      );

      if (!milestoneTag) {
        setMilestones([]);
        setLoading(false);
        return;
      }

      const milestoneItems: MilestoneItem[] = [];

      // Process tasks with milestone tag
      tasks.forEach(task => {
        if (task.tags && task.tags.includes(milestoneTag.id)) {
          let dateStr = '';
          let daysRemaining = 0;

          // Determine date based on task type
          if (task.specificDate) {
            dateStr = task.specificDate;
            const date = new Date(task.specificDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          } else if (task.endDate) {
            dateStr = task.endDate;
            const date = new Date(task.endDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          } else if (task.startDate) {
            dateStr = task.startDate;
            const date = new Date(task.startDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            // For recurring tasks without specific date, skip or use today
            return;
          }

          milestoneItems.push({
            id: task.id,
            name: task.name,
            date: dateStr,
            category: task.category,
            type: 'task',
            daysRemaining
          });
        }
      });

      // Process events with milestone tag
      events.forEach(event => {
        if (event.tags && event.tags.includes(milestoneTag.id)) {
          let dateStr = '';
          let daysRemaining = 0;

          // Parse event date (MM-DD for yearly, YYYY-MM-DD for one-time)
          if (event.frequency === 'yearly') {
            // For yearly events, use this year's date
            const dateParts = event.date.split('-');
            let month: string, day: string;
            
            if (dateParts.length === 2) {
              // MM-DD format
              [month, day] = dateParts;
            } else if (dateParts.length === 3) {
              // YYYY-MM-DD format, extract MM-DD
              [, month, day] = dateParts;
            } else {
              return; // Invalid date format
            }
            
            const today = new Date();
            const currentYear = today.getFullYear();
            const eventDate = new Date(currentYear, parseInt(month) - 1, parseInt(day));
            
            // If date has passed this year, use next year
            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const eventDateStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            
            if (eventDateStart < todayStart) {
              eventDate.setFullYear(currentYear + 1);
            }
            
            dateStr = `${eventDate.getFullYear()}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            eventDate.setHours(0, 0, 0, 0);
            todayStart.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((eventDate.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            // One-time event
            dateStr = event.date;
            const date = new Date(event.date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            date.setHours(0, 0, 0, 0);
            daysRemaining = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }

          milestoneItems.push({
            id: event.id,
            name: event.name,
            date: dateStr,
            category: event.category,
            type: 'event',
            daysRemaining
          });
        }
      });

      // Sort by days remaining (ascending - closest first)
      milestoneItems.sort((a, b) => a.daysRemaining - b.daysRemaining);

      setMilestones(milestoneItems);
    } catch (error) {
      console.error('Error loading milestones:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    // Parse date string manually to avoid timezone issues
    // dateStr is in YYYY-MM-DD format
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDaysRemaining = (days: number): string => {
    if (days < 0) {
      return `${Math.abs(days)} days ago`;
    }
    if (days === 0) {
      return 'Today';
    }
    if (days === 1) {
      return '1 day to go';
    }
    return `${days} days to go`;
  };

  return (
    <div className="milestones-modal-content">
      <div className="milestones-modal-header">
        <h2>🎯 Milestones</h2>
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
          <p>Loading milestones...</p>
        </div>
      ) : milestones.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
            No milestones found. Tag tasks or events with "milestone" to see them here!
          </p>
        </div>
      ) : (
        <div className="milestones-grid">
          {milestones.map((milestone) => (
            <div 
              key={`${milestone.type}-${milestone.id}`} 
              className="milestone-item"
            >
              <div className="milestone-days-remaining">
                <div className={`days-badge ${milestone.daysRemaining < 0 ? 'past' : milestone.daysRemaining === 0 ? 'today' : 'upcoming'}`}>
                  {milestone.daysRemaining < 0 ? (
                    <span className="days-number">{Math.abs(milestone.daysRemaining)}</span>
                  ) : milestone.daysRemaining === 0 ? (
                    <span className="days-number">0</span>
                  ) : (
                    <span className="days-number">{milestone.daysRemaining}</span>
                  )}
                  <span className="days-label">
                    {milestone.daysRemaining < 0 ? 'DAYS AGO' : milestone.daysRemaining === 0 ? 'TODAY' : 'DAYS TO GO'}
                  </span>
                  <div className="milestone-name-in-badge">
                    <h3>{milestone.name}</h3>
                  </div>
                </div>
              </div>
              
              <div className="milestone-content">
                <div className="milestone-date-row">
                  <div className="milestone-date-box">
                    <div className="date-content">
                      <span className="date-icon">📅</span>
                      <span className="date-text">{formatDate(milestone.date)}</span>
                    </div>
                  </div>
                  {milestone.category && (
                    <div className="milestone-category-box">
                      <span className="category-text">{milestone.category}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MilestonesModal;

