/**
 * VoiceCommandHistory - View and manage past voice commands
 * 
 * Features:
 * - List all past voice commands with categories
 * - Filter by intent type/category
 * - Search through commands
 * - Retry/re-execute a command
 * - Open create screen with prefilled data
 * - Mobile-optimized design
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import dbService from '../../services/voice/VoiceCommandDatabaseService';
import { releaseGlobalSpeechRecognition } from '../../services/voice/SpeechService';
import { VoiceCommandLog, IntentType, Outcome } from '../../types/voice-command-db.types';
import VoiceCommandSuggestions from './VoiceCommandSuggestions';
import VoiceCommandAnalytics from './VoiceCommandAnalytics';

interface VoiceCommandHistoryProps {
  onBack: () => void;
  onCreateFromCommand?: (command: VoiceCommandLog) => void;
  userId?: string;
}

const INTENT_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  'CREATE_TASK': { icon: '✅', label: 'Task', color: '#10b981' },
  'CREATE_EVENT': { icon: '📅', label: 'Event', color: '#3b82f6' },
  'CREATE_JOURNAL': { icon: '📔', label: 'Journal', color: '#8b5cf6' },
  'CREATE_ROUTINE': { icon: '🔄', label: 'Routine', color: '#f59e0b' },
  'CREATE_ITEM': { icon: '📦', label: 'Item', color: '#06b6d4' },
  'CREATE_MILESTONE': { icon: '🎯', label: 'Milestone', color: '#ec4899' },
  'CREATE_TODO': { icon: '📝', label: 'List Item', color: '#22c55e' },
  'CREATE_TAG': { icon: '🏷️', label: 'Tag', color: '#6366f1' },
  'UPDATE_TASK': { icon: '✏️', label: 'Update Task', color: '#f97316' },
  'UPDATE_EVENT': { icon: '✏️', label: 'Update Event', color: '#f97316' },
  'DELETE_TASK': { icon: '🗑️', label: 'Delete Task', color: '#ef4444' },
  'DELETE_EVENT': { icon: '🗑️', label: 'Delete Event', color: '#ef4444' },
  'QUERY_TASK': { icon: '🔍', label: 'Query Task', color: '#9ca3af' },
  'QUERY_EVENT': { icon: '🔍', label: 'Query Event', color: '#9ca3af' },
  'SCAN_IMAGE_QUICK': { icon: '🆓', label: 'Quick Scan', color: '#10b981' },
  'SCAN_IMAGE_SMART': { icon: '✨', label: 'Smart Scan', color: '#8b5cf6' },
  'UNKNOWN': { icon: '❓', label: 'Unknown', color: '#6b7280' },
  'MULTIPLE': { icon: '📋', label: 'Multiple', color: '#374151' },
};

const OUTCOME_CONFIG: Record<Outcome, { icon: string; label: string; color: string }> = {
  'PENDING': { icon: '⏳', label: 'Pending', color: '#f59e0b' },
  'SUCCESS': { icon: '✓', label: 'Created', color: '#10b981' },
  'CANCELLED': { icon: '✕', label: 'Cancelled', color: '#6b7280' },
  'FAILED': { icon: '!', label: 'Failed', color: '#ef4444' },
  'UNDONE': { icon: '↩️', label: 'Undone', color: '#8b5cf6' },
};

const VoiceCommandHistory: React.FC<VoiceCommandHistoryProps> = ({
  onBack,
  onCreateFromCommand,
  userId,
}) => {
  const { theme } = useTheme();
  const [commands, setCommands] = useState<VoiceCommandLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIntent, setFilterIntent] = useState<IntentType | 'ALL'>('ALL');
  const [filterOutcome, setFilterOutcome] = useState<Outcome | 'ALL' | 'OTHER'>('ALL');
  const [selectedCommand, setSelectedCommand] = useState<VoiceCommandLog | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsCommand, setSuggestionsCommand] = useState<VoiceCommandLog | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<{ suggestion: { title: string; type: string; recurrence?: string; recurrenceLabel?: string; time?: string }; command: VoiceCommandLog } | null>(null);

  const loadCommands = useCallback(async () => {
    if (!userId) {
      setCommands([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const recentCommands = await dbService.getRecentCommands(userId, 100);
      setCommands(recentCommands);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load voice commands');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  const filteredCommands = commands.filter(cmd => {
    const matchesSearch = searchQuery === '' || 
      cmd.rawTranscript?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cmd.extractedTitle?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIntent = filterIntent === 'ALL' || cmd.intentType === filterIntent;
    const matchesOutcome = filterOutcome === 'ALL' ||
      (filterOutcome === 'SUCCESS' && cmd.outcome === 'SUCCESS') ||
      (filterOutcome === 'PENDING' && cmd.outcome === 'PENDING') ||
      (filterOutcome === 'OTHER' && cmd.outcome !== 'SUCCESS' && cmd.outcome !== 'PENDING');
    return matchesSearch && matchesIntent && matchesOutcome;
  }).sort((a, b) => {
    // Sort PENDING commands to the top
    if (a.outcome === 'PENDING' && b.outcome !== 'PENDING') return -1;
    if (a.outcome !== 'PENDING' && b.outcome === 'PENDING') return 1;
    // Then by date (newest first)
    return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
  });

  const groupedByDate = filteredCommands.reduce((groups, cmd) => {
    const date = new Date(cmd.createdAt || '').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(cmd);
    return groups;
  }, {} as Record<string, VoiceCommandLog[]>);

  const getIntentInfo = (intent: IntentType) => {
    return INTENT_CONFIG[intent] || INTENT_CONFIG['UNKNOWN'];
  };

  const getOutcomeInfo = (outcome?: Outcome) => {
    return OUTCOME_CONFIG[outcome || 'PENDING'];
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
  };

  const getFinancialSummary = (cmd: VoiceCommandLog): { source?: string; accounts: Array<{ name: string; balance: number; currency: string }> } | null => {
    const entities = cmd.entities || [];
    for (const e of entities) {
      const meta = e.meta as { source?: string; accounts?: Array<{ name: string; balance: number; currency: string }> } | undefined;
      if (meta?.accounts && Array.isArray(meta.accounts) && meta.accounts.length > 0) {
        return {
          source: meta.source,
          accounts: meta.accounts.map(a => ({
            name: a.name,
            balance: typeof a.balance === 'number' ? a.balance : Number(a.balance) || 0,
            currency: a.currency || 'USD'
          }))
        };
      }
    }
    return null;
  };

  const handleCreateFromCommand = (cmd: VoiceCommandLog) => {
    onCreateFromCommand?.(cmd);
    onBack();
  };

  const handleReviewAndCreate = async (cmd: VoiceCommandLog) => {
    // Show suggestions modal for smart options
    setSuggestionsCommand(cmd);
    setShowSuggestions(true);
  };

  const handleSuggestionSelect = (suggestion: any) => {
    if (!suggestionsCommand) return;
    setPendingCreate({ suggestion, command: suggestionsCommand });
  };

  const handleConfirmCreate = async () => {
    if (!pendingCreate) return;
    const { suggestion, command } = pendingCreate;
    setPendingCreate(null);
    try {
      const VoiceCommandService = (await import('../../services/voice/VoiceCommandService')).default;
      const service = new VoiceCommandService();
      // Shared SpeechService — release mic if recognition was still active from the voice modal
      service.releaseSpeechRecognition();
      const mapSuggestionTypeToIntent = (): IntentType => {
        switch (suggestion.type) {
          case 'event':
            return 'CREATE_EVENT';
          case 'task':
            return 'CREATE_TASK';
          case 'routine':
            return 'CREATE_ROUTINE';
          case 'journal':
            return 'CREATE_JOURNAL';
          case 'todo':
            return 'CREATE_TODO';
          default:
            return command.intentType || 'CREATE_TODO';
        }
      };

      const userEdits = {
        title: suggestion.title,
        recurrence: suggestion.recurrence,
        time: suggestion.time,
        intentType: mapSuggestionTypeToIntent(),
      };
      const result = await service.createFromPending(command.id, userId, userEdits);
      if (result.success) {
        setShowSuggestions(false);
        setSuggestionsCommand(null);
        await loadCommands();
        alert(`✅ ${suggestion.title} created successfully!`);
      } else {
        alert(`❌ Failed to create: ${(result.error as { message?: string })?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error creating from pending:', err);
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSuggestionEdit = () => {
    // TODO: Open form with prefilled data
    setShowSuggestions(false);
    alert('Edit functionality coming soon!');
  };

  const handleSuggestionDismiss = () => {
    releaseGlobalSpeechRecognition();
    setShowSuggestions(false);
    setSuggestionsCommand(null);
  };

  const handleReject = async (cmd: VoiceCommandLog) => {
    if (!confirm('Reject this entry? It will be marked as cancelled and won\'t be used.')) return;
    try {
      await dbService.updateCommand(cmd.id, { outcome: 'CANCELLED' });
      if (suggestionsCommand?.id === cmd.id) {
        setShowSuggestions(false);
        setSuggestionsCommand(null);
      }
      setPendingCreate(null);
      setSelectedCommand(null);
      await loadCommands();
    } catch (err) {
      console.error('Reject failed:', err);
      alert('Failed to reject. Please try again.');
    }
  };

  return (
    <div className="voice-history-page">
      <div className="voice-history-container">
        {/* Header */}
        <div className="voice-history-header">
          <div className="voice-history-title">
            <span className="voice-history-icon">📋</span>
            <div>
              <h2>Smart Features History</h2>
              <p>{commands.length} voice command{commands.length !== 1 ? 's' : ''} & image scan{commands.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="voice-history-analytics-btn"
              onClick={() => setShowAnalytics(true)}
              title="View Analytics"
            >
              📊
            </button>
            <button className="voice-history-close" onClick={onBack}>← Back</button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="voice-history-filters">
          <div className="voice-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search commands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="voice-filter-pills">
            <button 
              className={`filter-pill ${filterIntent === 'ALL' ? 'active' : ''}`}
              onClick={() => setFilterIntent('ALL')}
            >
              All
            </button>
            {['CREATE_TASK', 'CREATE_EVENT', 'CREATE_JOURNAL', 'CREATE_TODO', 'SCAN_IMAGE_QUICK', 'SCAN_IMAGE_SMART'].map(intent => {
              const info = getIntentInfo(intent as IntentType);
              return (
                <button
                  key={intent}
                  className={`filter-pill ${filterIntent === intent ? 'active' : ''}`}
                  onClick={() => setFilterIntent(intent as IntentType)}
                  style={{ 
                    '--pill-color': info.color,
                    borderColor: filterIntent === intent ? info.color : undefined,
                    background: filterIntent === intent ? `${info.color}15` : undefined,
                  } as React.CSSProperties}
                  title={info.label}
                >
                  {info.icon} <span className="filter-pill-label">{info.label}</span>
                </button>
              );
            })}
          </div>
          <div className="voice-filter-pills outcome-pills">
            <span style={{ fontSize: '0.75rem', color: '#6b7280', marginRight: '0.5rem' }}>Status:</span>
            {(['ALL', 'PENDING', 'SUCCESS', 'OTHER'] as const).map(out => (
              <button
                key={out}
                className={`filter-pill ${filterOutcome === out ? 'active' : ''}`}
                onClick={() => setFilterOutcome(out)}
              >
                {out === 'ALL' ? 'All' : out === 'PENDING' ? '⏳ Pending' : out === 'SUCCESS' ? '✓ Implemented' : 'Other'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="voice-history-content">
          {loading ? (
            <div className="voice-history-loading">
              <div className="loading-spinner">🎤</div>
              <p>Loading voice commands...</p>
            </div>
          ) : error ? (
            <div className="voice-history-error">
              <span>⚠️</span>
              <p>{error}</p>
              <button onClick={loadCommands}>Retry</button>
            </div>
          ) : filteredCommands.length === 0 ? (
            <div className="voice-history-empty">
              <span className="empty-icon">🎙️</span>
              <p>No voice commands yet</p>
              <p className="empty-hint">Start using voice to create tasks, events, and more!</p>
            </div>
          ) : (
            <div className="voice-history-list">
              {Object.entries(groupedByDate).map(([date, cmds]) => (
                <div key={date} className="voice-date-group">
                  <div className="voice-date-header">{date}</div>
                  {cmds.map(cmd => {
                    const intentInfo = getIntentInfo(cmd.intentType);
                    const outcomeInfo = getOutcomeInfo(cmd.outcome as Outcome);
                    const isSelected = selectedCommand?.id === cmd.id;
                    const financialSummary = getFinancialSummary(cmd);
                    
                    return (
                      <div
                        key={cmd.id}
                        className={`voice-command-card ${isSelected ? 'expanded' : ''} ${cmd.outcome === 'PENDING' ? 'pending' : ''}`}
                        onClick={() => setSelectedCommand(isSelected ? null : cmd)}
                      >
                        <div className="command-main">
                          <div 
                            className="command-intent-badge"
                            style={{ background: `${intentInfo.color}20`, color: intentInfo.color }}
                          >
                            {intentInfo.icon}
                          </div>
                          <div className="command-content">
                            <div className="command-title-row">
                              <div className="command-title">
                                {cmd.extractedTitle || cmd.rawTranscript?.substring(0, 50) || 'Voice Command'}
                              </div>
                              <span 
                                className="command-status-badge"
                                style={{ background: `${outcomeInfo.color}20`, color: outcomeInfo.color }}
                                title={`Status: ${outcomeInfo.label}`}
                              >
                                {outcomeInfo.icon} {outcomeInfo.label}
                              </span>
                            </div>
                            <div className="command-meta">
                              <span className="command-type">{intentInfo.label}</span>
                              <span className="command-time">{formatTime(cmd.createdAt)}</span>
                            </div>
                            {financialSummary && (
                              <div className="command-financial-preview" style={{ fontSize: '0.75rem', color: theme.colors.textLight, marginTop: '0.25rem' }}>
                                {financialSummary.accounts.map((a, i) => (
                                  <span key={i}>
                                    {i > 0 ? ' · ' : ''}{a.name}: {formatCurrency(Math.abs(a.balance), a.currency)}
                                    {a.balance < 0 ? ' (loan)' : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="command-chevron">
                            {isSelected ? '▲' : '▼'}
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isSelected && (
                          <div className="command-details">
                            <div className="command-transcript">
                              <label>What you said:</label>
                              <p>"{cmd.rawTranscript}"</p>
                            </div>

                            {financialSummary && (
                              <div className="command-field" style={{ marginTop: '0.75rem' }}>
                                <label>📊 Accounts (from scan):</label>
                                <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
                                  {financialSummary.accounts.map((a, i) => (
                                    <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem' }}>
                                      <span>{a.name}</span>
                                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                                        {formatCurrency(Math.abs(a.balance), a.currency)}
                                        {a.balance < 0 && <span style={{ fontSize: '0.7rem', color: theme.colors.textLight }}> (principal)</span>}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {cmd.memoDate && (
                              <div className="command-field">
                                <label>📅 Date:</label>
                                <span>{cmd.memoDate}</span>
                              </div>
                            )}

                            {cmd.memoTime && (
                              <div className="command-field">
                                <label>🕐 Time:</label>
                                <span>{cmd.memoTime}</span>
                              </div>
                            )}

                            {cmd.extractedPriority && (
                              <div className="command-field">
                                <label>⚡ Priority:</label>
                                <span>{cmd.extractedPriority}</span>
                              </div>
                            )}

                            {cmd.extractedTags && cmd.extractedTags.length > 0 && (
                              <div className="command-field">
                                <label>🏷️ Tags:</label>
                                <span>{cmd.extractedTags.join(', ')}</span>
                              </div>
                            )}

                            <div className="command-confidence">
                              <label>Confidence:</label>
                              <div className="confidence-bar">
                                <div 
                                  className="confidence-fill"
                                  style={{ 
                                    width: `${(cmd.overallConfidence || 0) * 100}%`,
                                    background: (cmd.overallConfidence || 0) >= 0.7 ? '#10b981' : 
                                               (cmd.overallConfidence || 0) >= 0.5 ? '#f59e0b' : '#ef4444'
                                  }}
                                />
                              </div>
                              <span>{Math.round((cmd.overallConfidence || 0) * 100)}%</span>
                            </div>

                            {/* Actions */}
                            <div className="command-actions">
                              {cmd.outcome === 'PENDING' && (
                                <>
                                  <button 
                                    className="action-btn primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReviewAndCreate(cmd);
                                    }}
                                  >
                                    ✨ Review & Create
                                  </button>
                                  <button 
                                    className="action-btn secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReject(cmd);
                                    }}
                                    title="Reject and mark as cancelled"
                                  >
                                    ✕ Reject
                                  </button>
                                </>
                              )}
                              {cmd.outcome !== 'SUCCESS' && cmd.outcome !== 'PENDING' && onCreateFromCommand && (
                                <button 
                                  className="action-btn primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCreateFromCommand(cmd);
                                  }}
                                >
                                  🔄 Retry
                                </button>
                              )}
                              {cmd.createdItemId && (
                                <button 
                                  className="action-btn secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Navigate to the created item
                                    onBack();
                                  }}
                                >
                                  👁️ View Item
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Suggestions Modal */}
      {showSuggestions && suggestionsCommand && (
        <VoiceCommandSuggestions
          command={suggestionsCommand}
          onSelect={handleSuggestionSelect}
          onEdit={handleSuggestionEdit}
          onDismiss={handleSuggestionDismiss}
        />
      )}

      {/* Confirmation modal before create (like Safe financial) */}
      {pendingCreate && (
        <div
          className="voice-history-confirm-overlay"
          onClick={() => setPendingCreate(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '1rem',
              maxWidth: 420,
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>Confirm & Create</h3>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
              This will add the following to your list:
            </p>
            <ul style={{ margin: '0 0 1.25rem', paddingLeft: '1.25rem', fontSize: '0.95rem', lineHeight: 1.7 }}>
              <li><strong>Type:</strong> {{
                event: 'Event',
                task: 'Task',
                routine: 'Routine',
                journal: 'Journal',
                todo: 'List item',
              }[pendingCreate.suggestion.type] || 'List item'}</li>
              <li><strong>Title:</strong> {pendingCreate.suggestion.title}</li>
              {pendingCreate.suggestion.recurrenceLabel && <li><strong>Recurrence:</strong> {pendingCreate.suggestion.recurrenceLabel}</li>}
              {pendingCreate.suggestion.time && <li><strong>Time:</strong> {pendingCreate.suggestion.time}</li>}
            </ul>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPendingCreate(null)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  background: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                style={{
                  padding: '0.5rem 1rem',
                  border: 'none',
                  borderRadius: '0.5rem',
                  background: '#10b981',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                }}
              >
                Confirm & Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      <VoiceCommandAnalytics
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
        userId={userId}
      />

      <style>{`
        .voice-history-page {
          min-height: 100vh;
          background: #f9fafb;
        }

        .voice-history-container {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 640px) {
          .voice-history-container {
            border-left: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
          }
        }

        .voice-history-header {
          padding: 1.25rem 1rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .voice-history-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .voice-history-icon {
          font-size: 1.75rem;
        }

        .voice-history-title h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .voice-history-title p {
          margin: 0;
          font-size: 0.8rem;
          opacity: 0.85;
        }

        .voice-history-analytics-btn {
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

        .voice-history-analytics-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.05);
        }

        .voice-history-close {
          background: rgba(255,255,255,0.2);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          color: white;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .voice-history-close:hover {
          background: rgba(255,255,255,0.3);
        }

        .voice-history-filters {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .voice-search-box {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #f3f4f6;
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
        }

        .voice-search-box input {
          flex: 1;
          border: none;
          background: none;
          font-size: 0.95rem;
          outline: none;
        }

        .search-icon {
          font-size: 1rem;
          opacity: 0.5;
        }

        .voice-filter-pills {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .voice-filter-pills::-webkit-scrollbar {
          display: none;
        }

        .filter-pill {
          padding: 0.5rem 0.875rem;
          border: 2px solid #e5e7eb;
          border-radius: 9999px;
          background: white;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .filter-pill-label {
          margin-left: 0.15rem;
        }
        @media (max-width: 640px) {
          .filter-pill-label { display: none; }
        }
        .outcome-pills {
          margin-top: 0.5rem;
        }
        .filter-pill.active {
          border-color: #667eea;
          background: #667eea15;
          color: #667eea;
        }

        .voice-history-content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
        }

        .voice-history-loading,
        .voice-history-error,
        .voice-history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          text-align: center;
          color: #6b7280;
        }

        .loading-spinner {
          font-size: 2.5rem;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .empty-hint {
          font-size: 0.85rem;
          opacity: 0.7;
          margin-top: 0.25rem;
        }

        .voice-date-group {
          margin-bottom: 1.5rem;
        }

        .voice-date-header {
          font-size: 0.75rem;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 0.5rem;
          padding-left: 0.25rem;
        }

        .voice-command-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 0.875rem;
          margin-bottom: 0.5rem;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        }

        .voice-command-card:hover {
          border-color: #d1d5db;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        .voice-command-card.expanded {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
        }

        .voice-command-card.pending {
          border-color: #f59e0b;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2);
        }

        .voice-command-card.pending:hover {
          border-color: #f59e0b;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .command-main {
          display: flex;
          align-items: center;
          padding: 0.875rem;
          gap: 0.75rem;
        }

        .command-intent-badge {
          width: 40px;
          height: 40px;
          border-radius: 0.625rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .command-content {
          flex: 1;
          min-width: 0;
        }

        .command-title-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .command-title {
          flex: 1;
          min-width: 0;
          font-weight: 600;
          font-size: 0.95rem;
          color: #1f2937;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .command-status-badge {
          flex-shrink: 0;
          font-size: 0.7rem;
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
        }

        .command-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.25rem;
          font-size: 0.75rem;
        }

        .command-type {
          color: #6b7280;
        }

        .command-time {
          color: #9ca3af;
        }

        .command-outcome {
          font-weight: 500;
        }

        .command-chevron {
          color: #9ca3af;
          font-size: 0.75rem;
        }

        .command-details {
          padding: 0.875rem;
          border-top: 1px solid #f3f4f6;
          background: #fafafa;
        }

        .command-transcript {
          margin-bottom: 1rem;
        }

        .command-transcript label,
        .command-field label {
          display: block;
          font-size: 0.7rem;
          font-weight: 600;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 0.25rem;
        }

        .command-transcript p {
          margin: 0;
          font-size: 0.9rem;
          color: #374151;
          font-style: italic;
          background: white;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
        }

        .command-field {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .command-field span {
          font-size: 0.9rem;
          color: #1f2937;
        }

        .command-confidence {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 1rem 0;
        }

        .command-confidence label {
          margin: 0;
          font-size: 0.75rem;
        }

        .confidence-bar {
          flex: 1;
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s;
        }

        .command-confidence > span {
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
        }

        .command-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .action-btn {
          flex: 1;
          padding: 0.75rem;
          border-radius: 0.625rem;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          border: none;
          transition: all 0.2s;
        }

        .action-btn.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .action-btn.secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .action-btn:active {
          transform: scale(0.98);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default VoiceCommandHistory;
