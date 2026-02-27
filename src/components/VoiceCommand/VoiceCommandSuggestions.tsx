/**
 * VoiceCommandSuggestions - Smart suggestions for pending voice commands
 * 
 * Shows multiple interpretation options for ambiguous commands
 * Especially useful for birthdays/anniversaries (yearly vs one-time)
 */

import React, { useState } from 'react';
import { VoiceCommandLog } from '../../types/voice-command-db.types';
import VoiceCommandClarification from './VoiceCommandClarification';

interface Suggestion {
  type: 'event' | 'task' | 'routine';
  title: string;
  description: string;
  recurrence?: string;
  recurrenceLabel?: string;
  time?: string;
  confidence: number;
  reasoning: string;
  isRecommended?: boolean;
}

interface VoiceCommandSuggestionsProps {
  command: VoiceCommandLog;
  onSelect: (suggestion: Suggestion) => void;
  onEdit: () => void;
  onDismiss: () => void;
}

const VoiceCommandSuggestions: React.FC<VoiceCommandSuggestionsProps> = ({
  command,
  onSelect,
  onEdit,
  onDismiss,
}) => {
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<any[]>([]);

  const generateSuggestions = (): Suggestion[] => {
    const suggestions: Suggestion[] = [];
    const transcript = (command.rawTranscript || '').toLowerCase();
    const title = command.extractedTitle || command.rawTranscript || 'Untitled';
    
    // Check for birthday/anniversary keywords
    const isBirthday = /\bbirthday\b/.test(transcript);
    const isAnniversary = /\banniversary\b/.test(transcript);
    
    // Check for social event keywords
    const isSocialEvent = /\b(party|dinner|lunch|breakfast|gathering|celebration|get-together|hangout)\b/.test(transcript);
    
    if (isBirthday || isAnniversary) {
      // Suggestion 1: Yearly recurring event (RECOMMENDED)
      suggestions.push({
        type: 'event',
        title: title,
        description: `${title} - Repeats every year`,
        recurrence: 'FREQ=YEARLY',
        recurrenceLabel: 'Yearly',
        confidence: 0.95,
        reasoning: `Detected "${isBirthday ? 'birthday' : 'anniversary'}" keyword → yearly recurrence`,
        isRecommended: true,
      });
      
      // Suggestion 2: One-time event
      suggestions.push({
        type: 'event',
        title: title,
        description: `${title} - Today only`,
        recurrence: undefined,
        recurrenceLabel: 'One-time',
        confidence: 0.7,
        reasoning: 'Literal interpretation of "today is"',
        isRecommended: false,
      });
    } else if (isSocialEvent) {
      // Social event detected - suggest with default time
      const eventType = transcript.match(/\b(party|dinner|lunch|breakfast|gathering|celebration|get-together|hangout)\b/)?.[1];
      
      // Determine default time based on event type
      let defaultTime = '18:00'; // 6 PM default
      let timeLabel = '6:00 PM';
      
      if (eventType === 'breakfast') {
        defaultTime = '09:00';
        timeLabel = '9:00 AM';
      } else if (eventType === 'lunch') {
        defaultTime = '12:00';
        timeLabel = '12:00 PM';
      } else if (eventType === 'dinner') {
        defaultTime = '19:00';
        timeLabel = '7:00 PM';
      }
      
      suggestions.push({
        type: 'event',
        title: title,
        description: `${title} - ${timeLabel}`,
        time: defaultTime,
        recurrence: command.extractedRecurrence || undefined,
        recurrenceLabel: command.extractedRecurrenceHuman || 'One-time',
        confidence: 0.85,
        reasoning: `Detected social event "${eventType}" → suggested time ${timeLabel}`,
        isRecommended: true,
      });
      
      // Alternative without time
      suggestions.push({
        type: 'event',
        title: title,
        description: `${title} - No specific time`,
        recurrence: command.extractedRecurrence || undefined,
        recurrenceLabel: 'One-time',
        confidence: 0.7,
        reasoning: 'Social event without specific time',
        isRecommended: false,
      });
    } else if (command.intentType === 'CREATE_EVENT') {
      // Regular event - just one option
      suggestions.push({
        type: 'event',
        title: title,
        description: title,
        recurrence: command.extractedRecurrence || undefined,
        recurrenceLabel: command.extractedRecurrenceHuman || 'One-time',
        confidence: command.overallConfidence || 0.8,
        reasoning: 'Standard event creation',
        isRecommended: true,
      });
    } else if (command.intentType === 'CREATE_TASK') {
      suggestions.push({
        type: 'task',
        title: title,
        description: title,
        confidence: command.overallConfidence || 0.8,
        reasoning: 'Task creation',
        isRecommended: true,
      });
    } else {
      // Fallback - generic suggestion
      suggestions.push({
        type: 'event',
        title: title,
        description: title,
        confidence: command.overallConfidence || 0.7,
        reasoning: 'Based on voice command',
        isRecommended: true,
      });
    }
    
    return suggestions;
  };

  const checkForAmbiguity = (): any[] => {
    const questions: any[] = [];
    const transcript = (command.rawTranscript || '').toLowerCase();

    // Missing date but has time-sensitive keywords
    if (!command.memoDate && /\b(meeting|appointment|call|interview)\b/.test(transcript)) {
      questions.push({
        field: 'date',
        question: 'When should this happen?',
        required: true,
        options: [
          { label: 'Today', value: new Date().toISOString().split('T')[0], icon: '📅' },
          { label: 'Tomorrow', value: new Date(Date.now() + 86400000).toISOString().split('T')[0], icon: '📅' },
          { label: 'This Friday', value: 'this-friday', icon: '📅' },
          { label: 'Next Week', value: 'next-week', icon: '📅' },
        ],
      });
    }

    // Low confidence on intent
    if ((command.overallConfidence || 0) < 0.5) {
      questions.push({
        field: 'intent',
        question: 'What type of item should I create?',
        required: true,
        options: [
          { label: 'Event', value: 'CREATE_EVENT', icon: '📅' },
          { label: 'Task', value: 'CREATE_TASK', icon: '✅' },
          { label: 'List Item', value: 'CREATE_TODO', icon: '📝' },
          { label: 'Journal Entry', value: 'CREATE_JOURNAL', icon: '📔' },
        ],
      });
    }

    return questions;
  };

  const handleClarificationSubmit = (answers: Record<string, any>) => {
    // Apply clarification answers and create
    const suggestion = suggestions[0]; // Use first suggestion
    onSelect({ ...suggestion, ...answers });
    setShowClarification(false);
  };

  const suggestions = generateSuggestions();
  const ambiguityQuestions = checkForAmbiguity();

  // Show clarification if needed
  React.useEffect(() => {
    if (ambiguityQuestions.length > 0 && (command.overallConfidence || 0) < 0.5) {
      setClarificationQuestions(ambiguityQuestions);
      setShowClarification(true);
    }
  }, []);

  if (showClarification && clarificationQuestions.length > 0) {
    return (
      <VoiceCommandClarification
        command={command}
        questions={clarificationQuestions}
        onSubmit={handleClarificationSubmit}
        onSkip={() => setShowClarification(false)}
      />
    );
  }

  return (
    <div className="suggestions-overlay" onClick={(e) => e.target === e.currentTarget && onDismiss()}>
      <div className="suggestions-modal">
        {/* Header */}
        <div className="suggestions-header">
          <div>
            <h2>What should I create?</h2>
            <p>"{command.rawTranscript || 'No transcript available'}"</p>
          </div>
          <button className="close-btn" onClick={onDismiss}>✕</button>
        </div>

        {/* Suggestions List */}
        <div className="suggestions-content">
          {suggestions.map((suggestion, idx) => (
            <div
              key={idx}
              className={`suggestion-card ${suggestion.isRecommended ? 'recommended' : ''}`}
              onClick={() => onSelect(suggestion)}
            >
              {suggestion.isRecommended && (
                <div className="recommended-badge">⭐ Recommended</div>
              )}
              
              <div className="suggestion-icon">
                {suggestion.type === 'event' ? '📅' : suggestion.type === 'task' ? '✅' : '🔄'}
              </div>
              
              <div className="suggestion-content">
                <h3>{suggestion.title}</h3>
                <p className="suggestion-desc">{suggestion.description}</p>
                
                <div className="suggestion-meta">
                  {suggestion.recurrenceLabel && (
                    <span className="meta-badge">🔄 {suggestion.recurrenceLabel}</span>
                  )}
                  {suggestion.time && (
                    <span className="meta-badge">🕐 {suggestion.time}</span>
                  )}
                </div>
                
                <p className="suggestion-reasoning">
                  💡 {suggestion.reasoning}
                </p>
                
                <div className="confidence-bar">
                  <div 
                    className="confidence-fill"
                    style={{ 
                      width: `${suggestion.confidence * 100}%`,
                      background: suggestion.confidence >= 0.8 ? '#10b981' : '#f59e0b'
                    }}
                  />
                  <span>{Math.round(suggestion.confidence * 100)}% confident</span>
                </div>
              </div>
              
              <button className="create-btn">
                Create This →
              </button>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="suggestions-footer">
          <button className="footer-btn secondary" onClick={onEdit}>
            ✏️ Edit Manually
          </button>
          <button className="footer-btn secondary" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>

      <style>{`
        .suggestions-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10001;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        .suggestions-modal {
          background: white;
          border-radius: 1.5rem;
          width: 100%;
          max-width: 600px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }

        .suggestions-header {
          padding: 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .suggestions-header h2 {
          margin: 0 0 0.5rem;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .suggestions-header p {
          margin: 0;
          font-size: 0.9rem;
          opacity: 0.9;
          font-style: italic;
        }

        .close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .suggestions-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .suggestion-card {
          border: 2px solid #e5e7eb;
          border-radius: 1rem;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          display: flex;
          gap: 1rem;
          align-items: flex-start;
        }

        .suggestion-card:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
          transform: translateY(-2px);
        }

        .suggestion-card.recommended {
          border-color: #10b981;
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        }

        .suggestion-card.recommended:hover {
          border-color: #10b981;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        .recommended-badge {
          position: absolute;
          top: -10px;
          right: 1rem;
          background: #10b981;
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 1rem;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .suggestion-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }

        .suggestion-content {
          flex: 1;
          min-width: 0;
        }

        .suggestion-content h3 {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .suggestion-desc {
          margin: 0 0 0.75rem;
          font-size: 0.9rem;
          color: #6b7280;
        }

        .suggestion-meta {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .meta-badge {
          background: #f3f4f6;
          color: #374151;
          padding: 0.25rem 0.625rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .suggestion-reasoning {
          margin: 0 0 0.75rem;
          font-size: 0.8rem;
          color: #9ca3af;
          font-style: italic;
        }

        .confidence-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          position: relative;
        }

        .confidence-bar::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
        }

        .confidence-fill {
          position: absolute;
          left: 0;
          height: 4px;
          border-radius: 2px;
          transition: width 0.3s;
        }

        .confidence-bar span {
          margin-left: auto;
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          background: white;
          padding-left: 0.5rem;
          position: relative;
          z-index: 1;
        }

        .create-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 0.75rem 1.25rem;
          border-radius: 0.75rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          transition: all 0.2s;
        }

        .create-btn:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .suggestions-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 0.75rem;
          justify-content: center;
        }

        .footer-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .footer-btn.secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .footer-btn.secondary:hover {
          background: #e5e7eb;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(50px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .suggestions-modal {
            max-width: 100%;
            border-radius: 1.5rem 1.5rem 0 0;
          }

          .suggestion-card {
            flex-direction: column;
          }

          .create-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceCommandSuggestions;
