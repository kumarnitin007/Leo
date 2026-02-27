/**
 * VoiceCommandClarification - Ask user to clarify ambiguous commands
 * 
 * Shows when confidence is low or critical info is missing
 */

import React, { useState } from 'react';
import { VoiceCommandLog } from '../../types/voice-command-db.types';

interface ClarificationQuestion {
  field: string;
  question: string;
  options: Array<{ label: string; value: any; icon?: string }>;
  required: boolean;
}

interface VoiceCommandClarificationProps {
  command: VoiceCommandLog;
  questions: ClarificationQuestion[];
  onSubmit: (answers: Record<string, any>) => void;
  onSkip: () => void;
}

const VoiceCommandClarification: React.FC<VoiceCommandClarificationProps> = ({
  command,
  questions,
  onSubmit,
  onSkip,
}) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const canProceed = !currentQuestion.required || answers[currentQuestion.field];

  const handleSelectOption = (value: any) => {
    setAnswers({ ...answers, [currentQuestion.field]: value });
  };

  const handleNext = () => {
    if (isLastQuestion) {
      onSubmit(answers);
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  return (
    <div className="clarification-overlay" onClick={(e) => e.target === e.currentTarget && onSkip()}>
      <div className="clarification-modal">
        {/* Header */}
        <div className="clarification-header">
          <div>
            <h2>Need a bit more info</h2>
            <p>"{command.rawTranscript}"</p>
          </div>
          <button className="close-btn" onClick={onSkip}>✕</button>
        </div>

        {/* Progress */}
        <div className="clarification-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          <p className="progress-text">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="clarification-content">
          <div className="question-icon">❓</div>
          <h3 className="question-text">{currentQuestion.question}</h3>
          {currentQuestion.required && (
            <p className="required-badge">* Required</p>
          )}

          {/* Options */}
          <div className="options-list">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                className={`option-card ${answers[currentQuestion.field] === option.value ? 'selected' : ''}`}
                onClick={() => handleSelectOption(option.value)}
              >
                {option.icon && <span className="option-icon">{option.icon}</span>}
                <span className="option-label">{option.label}</span>
                {answers[currentQuestion.field] === option.value && (
                  <span className="check-icon">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="clarification-footer">
          <button 
            className="footer-btn secondary" 
            onClick={handleBack}
            disabled={currentQuestionIndex === 0}
          >
            ← Back
          </button>
          <button 
            className="footer-btn secondary" 
            onClick={onSkip}
          >
            Skip
          </button>
          <button 
            className="footer-btn primary" 
            onClick={handleNext}
            disabled={!canProceed}
          >
            {isLastQuestion ? 'Create' : 'Next'} →
          </button>
        </div>
      </div>

      <style>{`
        .clarification-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10002;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        .clarification-modal {
          background: white;
          border-radius: 1.5rem;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }

        .clarification-header {
          padding: 1.5rem;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .clarification-header h2 {
          margin: 0 0 0.5rem;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .clarification-header p {
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
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .clarification-progress {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .progress-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
          transition: width 0.3s ease;
        }

        .progress-text {
          margin: 0;
          font-size: 0.75rem;
          color: #6b7280;
          text-align: center;
        }

        .clarification-content {
          flex: 1;
          overflow-y: auto;
          padding: 2rem 1.5rem;
          text-align: center;
        }

        .question-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .question-text {
          margin: 0 0 0.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .required-badge {
          margin: 0 0 1.5rem;
          font-size: 0.75rem;
          color: #ef4444;
          font-weight: 500;
        }

        .options-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .option-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          font-size: 0.95rem;
          font-weight: 500;
          color: #374151;
        }

        .option-card:hover {
          border-color: #f59e0b;
          background: #fffbeb;
          transform: translateX(4px);
        }

        .option-card.selected {
          border-color: #f59e0b;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
        }

        .option-icon {
          font-size: 1.5rem;
        }

        .option-label {
          flex: 1;
        }

        .check-icon {
          font-size: 1.25rem;
          color: #f59e0b;
          font-weight: 700;
        }

        .clarification-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .footer-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .footer-btn.primary {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          flex: 1;
        }

        .footer-btn.primary:hover:not(:disabled) {
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
          transform: translateY(-2px);
        }

        .footer-btn.primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .footer-btn.secondary {
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .footer-btn.secondary:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .footer-btn.secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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
          .clarification-modal {
            max-width: 100%;
            border-radius: 1.5rem 1.5rem 0 0;
          }

          .clarification-footer {
            flex-wrap: wrap;
          }

          .footer-btn.primary {
            order: -1;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default VoiceCommandClarification;
