/**
 * Entry Comments Component
 * 
 * Displays and manages comments on shared entries
 * Phase 1: Basic comments with add/view/delete/resolve
 */

import React, { useState, useEffect } from 'react';
import { EntryComment } from '../types';
import * as commentService from '../services/commentService';
import type { CommentReaction } from '../services/commentService';

interface EntryCommentsProps {
  entryId: string;
  entryType: 'safe_entry' | 'document' | 'bank_list' | 'todo';
  currentUserId: string;
  isReadOnly?: boolean; // If true, user cannot add comments (for non-shared entries)
}

const EntryComments: React.FC<EntryCommentsProps> = ({
  entryId,
  entryType,
  currentUserId,
  isReadOnly = false,
}) => {
  const [comments, setComments] = useState<EntryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  
  // Phase 2: Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [actionDate, setActionDate] = useState('');
  const [actionType, setActionType] = useState<'reminder' | 'deadline' | 'expiry' | 'follow_up' | ''>('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent' | ''>('');
  const [showOnDashboard, setShowOnDashboard] = useState(false);
  
  // Phase 4: Reactions
  const [reactions, setReactions] = useState<Record<string, CommentReaction[]>>({});

  useEffect(() => {
    loadComments();
  }, [entryId, entryType]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await commentService.getCommentsForEntry(entryId, entryType);
      setComments(data);
      
      // Load reactions for each comment
      const reactionsMap: Record<string, CommentReaction[]> = {};
      for (const comment of data) {
        try {
          const commentReactions = await commentService.getReactionsForComment(comment.id);
          reactionsMap[comment.id] = commentReactions;
        } catch (err) {
          // Ignore errors (table might not exist yet)
        }
      }
      setReactions(reactionsMap);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || submitting) return;

    try {
      setSubmitting(true);
      const comment = await commentService.addComment(entryId, entryType, newMessage, {
        actionDate: actionDate || undefined,
        actionType: actionType || undefined,
        priority: priority || undefined,
        showOnDashboard,
      });
      
      // Create mentions if any @username in message
      if (newMessage.includes('@')) {
        try {
          await commentService.createMentionsFromComment(comment.id, newMessage, currentUserId);
        } catch (err) {
          console.warn('Failed to create mentions:', err);
        }
      }
      
      setNewMessage('');
      setActionDate('');
      setActionType('');
      setPriority('');
      setShowOnDashboard(false);
      setShowAdvanced(false);
      await loadComments();
    } catch (err) {
      console.error('Failed to add comment:', err);
      alert('Failed to add comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    
    try {
      await commentService.deleteComment(commentId);
      await loadComments();
    } catch (err) {
      console.error('Failed to delete comment:', err);
      alert('Failed to delete comment.');
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await commentService.resolveComment(commentId);
      await loadComments();
    } catch (err) {
      console.error('Failed to resolve comment:', err);
      alert('Failed to resolve comment.');
    }
  };

  const handleUnresolve = async (commentId: string) => {
    try {
      await commentService.unresolveComment(commentId);
      await loadComments();
    } catch (err) {
      console.error('Failed to unresolve comment:', err);
      alert('Failed to unresolve comment.');
    }
  };
  
  const handleReaction = async (commentId: string, reactionType: 'like' | 'helpful' | 'resolved' | 'urgent') => {
    try {
      const commentReactions = reactions[commentId] || [];
      const existingReaction = commentReactions.find(r => r.userId === currentUserId && r.reactionType === reactionType);
      
      if (existingReaction) {
        // Remove reaction
        await commentService.removeReaction(commentId, currentUserId, reactionType);
      } else {
        // Add reaction
        await commentService.addReaction(commentId, currentUserId, reactionType);
      }
      
      await loadComments();
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const formatTimeAgo = (isoTimestamp: string): string => {
    const now = new Date();
    const then = new Date(isoTimestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks === 1) return '1 week ago';
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return '1 month ago';
    return `${diffMonths} months ago`;
  };

  const activeComments = comments.filter(c => !c.isResolved);
  const resolvedComments = comments.filter(c => c.isResolved);

  if (loading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>
        Loading comments...
      </div>
    );
  }

  return (
    <div style={{
      borderTop: '1px solid #e5e7eb',
      paddingTop: '1rem',
      marginTop: '1rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
      }}>
        <h4 style={{
          margin: 0,
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          💬 Comments
          {activeComments.length > 0 && (
            <span style={{
              background: '#3b82f6',
              color: 'white',
              fontSize: '0.7rem',
              padding: '2px 6px',
              borderRadius: '10px',
            }}>
              {activeComments.length}
            </span>
          )}
        </h4>
        
        {resolvedComments.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            style={{
              background: 'none',
              border: 'none',
              color: '#6b7280',
              fontSize: '0.75rem',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showResolved ? 'Hide' : 'Show'} resolved ({resolvedComments.length})
          </button>
        )}
      </div>

      {/* Comments List */}
      {activeComments.length === 0 && !showResolved && (
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.85rem',
          background: '#f9fafb',
          borderRadius: '0.5rem',
        }}>
          No comments yet. Be the first to comment!
        </div>
      )}

      {/* Active Comments */}
      {activeComments.map(comment => (
        <div
          key={comment.id}
          style={{
            background: '#f9fafb',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            marginBottom: '0.75rem',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'start',
            marginBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  color: comment.userId === currentUserId ? '#3b82f6' : '#374151',
                }}>
                  {comment.userId === currentUserId ? 'You' : comment.userDisplayName}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                  {formatTimeAgo(comment.createdAt)}
                </span>
              </div>
              {/* Metadata badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                {comment.actionDate && (
                  <span style={{
                    fontSize: '0.65rem',
                    background: '#dbeafe',
                    color: '#1e40af',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 500,
                  }}>
                    📅 {new Date(comment.actionDate).toLocaleDateString()}
                  </span>
                )}
                {comment.actionType && (
                  <span style={{
                    fontSize: '0.65rem',
                    background: '#f3e8ff',
                    color: '#6b21a8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 500,
                  }}>
                    {comment.actionType}
                  </span>
                )}
                {comment.priority && comment.priority !== 'normal' && (
                  <span style={{
                    fontSize: '0.65rem',
                    background: comment.priority === 'urgent' || comment.priority === 'high' ? '#fee2e2' : '#f3f4f6',
                    color: comment.priority === 'urgent' || comment.priority === 'high' ? '#991b1b' : '#6b7280',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 500,
                  }}>
                    {comment.priority === 'urgent' ? '🔴🔴' : comment.priority === 'high' ? '🔴' : '🟢'} {comment.priority}
                  </span>
                )}
                {comment.showOnDashboard && (
                  <span style={{
                    fontSize: '0.65rem',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 500,
                  }}>
                    📌 Dashboard
                  </span>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleResolve(comment.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: '#10b981',
                  padding: '0.25rem 0.5rem',
                }}
                title="Mark as resolved"
              >
                ✓
              </button>
              {comment.userId === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: '#ef4444',
                    padding: '0.25rem 0.5rem',
                  }}
                  title="Delete comment"
                >
                  🗑
                </button>
              )}
            </div>
          </div>

          {/* Message */}
          <div style={{
            fontSize: '0.85rem',
            color: '#374151',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            marginBottom: '0.5rem',
          }}>
            {comment.message}
          </div>
          
          {/* Reactions */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {(['like', 'helpful', 'resolved', 'urgent'] as const).map(reactionType => {
              const commentReactions = reactions[comment.id] || [];
              const count = commentReactions.filter(r => r.reactionType === reactionType).length;
              const userReacted = commentReactions.some(r => r.userId === currentUserId && r.reactionType === reactionType);
              
              const emoji = {
                like: '👍',
                helpful: '💡',
                resolved: '✅',
                urgent: '🔥',
              }[reactionType];
              
              return (
                <button
                  key={reactionType}
                  onClick={() => handleReaction(comment.id, reactionType)}
                  style={{
                    background: userReacted ? '#e0e7ff' : '#f3f4f6',
                    border: userReacted ? '1px solid #6366f1' : '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  title={reactionType}
                >
                  <span>{emoji}</span>
                  {count > 0 && <span style={{ fontWeight: 500 }}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Resolved Comments */}
      {showResolved && resolvedComments.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '0.5rem',
          }}>
            ✓ Resolved
          </div>
          {resolvedComments.map(comment => (
            <div
              key={comment.id}
              style={{
                background: '#f9fafb',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                border: '1px solid #e5e7eb',
                opacity: 0.7,
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'start',
                marginBottom: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: '#6b7280' }}>
                    {comment.userId === currentUserId ? 'You' : comment.userDisplayName}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                    {formatTimeAgo(comment.createdAt)}
                  </span>
                  <span style={{
                    fontSize: '0.7rem',
                    color: '#10b981',
                    background: '#10b98120',
                    padding: '2px 6px',
                    borderRadius: '3px',
                  }}>
                    ✓ Resolved
                  </span>
                </div>
                
                <button
                  onClick={() => handleUnresolve(comment.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    color: '#6b7280',
                    textDecoration: 'underline',
                  }}
                  title="Mark as unresolved"
                >
                  Reopen
                </button>
              </div>
              
              <div style={{
                fontSize: '0.85rem',
                color: '#6b7280',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {comment.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Comment Form */}
      {!isReadOnly && (
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Add a comment... (e.g., 'Password doesn't work' or 'Call me when updated')"
            maxLength={500}
            style={{
              width: '100%',
              minHeight: '60px',
              padding: '0.5rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          
          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              marginTop: '0.5rem',
              padding: '0.25rem 0.5rem',
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            {showAdvanced ? '▼' : '▶'} Advanced Options
          </button>
          
          {/* Advanced Options Panel */}
          {showAdvanced && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '4px',
              marginTop: '0.5rem',
              border: '1px solid #e5e7eb',
            }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Action Date
                </label>
                <input
                  type="date"
                  value={actionDate}
                  onChange={(e) => setActionDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.375rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                  }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Action Type
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.375rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  <option value="">None</option>
                  <option value="reminder">Reminder</option>
                  <option value="deadline">Deadline</option>
                  <option value="expiry">Expiry</option>
                  <option value="follow_up">Follow Up</option>
                </select>
              </div>
              
              <div>
                <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginBottom: '0.25rem' }}>
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.375rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  <option value="">Normal</option>
                  <option value="low">🟢 Low</option>
                  <option value="high">🔴 High</option>
                  <option value="urgent">🔴🔴 Urgent</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={showOnDashboard}
                  onChange={(e) => setShowOnDashboard(e.target.checked)}
                  id="show-on-dashboard"
                />
                <label htmlFor="show-on-dashboard" style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  📌 Show on Dashboard
                </label>
              </div>
            </div>
          )}
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '0.5rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
              {newMessage.length}/500 characters
            </span>
            <button
              type="submit"
              disabled={!newMessage.trim() || submitting}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: newMessage.trim() && !submitting ? '#3b82f6' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: newMessage.trim() && !submitting ? 'pointer' : 'not-allowed',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default EntryComments;
