/**
 * GroupsManager - Component for managing sharing groups and invitations
 * 
 * Features:
 * - View/create/edit groups
 * - Manage group members
 * - Send invitations (by email)
 * - Accept/reject received invitations
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  SharingGroup,
  GroupMember,
  GroupInvitation,
} from '../types';
import * as sharingService from '../services/sharingService';

interface GroupsManagerProps {
  onClose: () => void;
}

const GROUP_ICONS = ['👥', '👨‍👩‍👧‍👦', '🏠', '💼', '🎯', '💪', '🎨', '📚', '🎮', '✈️', '🌟', '❤️'];
const GROUP_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#f59e0b', '#10b981', '#14b8a6', '#06b6d4', '#3b82f6'];

const GroupsManager: React.FC<GroupsManagerProps> = ({ onClose }) => {
  const { theme } = useTheme();
  
  // Data state
  const [groups, setGroups] = useState<SharingGroup[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SharingGroup | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'groups' | 'invitations'>('groups');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Form state
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupIcon, setGroupIcon] = useState('👥');
  const [groupColor, setGroupColor] = useState('#6366f1');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [editingGroup, setEditingGroup] = useState<SharingGroup | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  // Load members when group selected
  useEffect(() => {
    if (selectedGroup) {
      loadMembers(selectedGroup.id);
    }
  }, [selectedGroup]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsData, invitationsData] = await Promise.all([
        sharingService.getMyGroups(),
        sharingService.getMyInvitations(),
      ]);
      setGroups(groupsData);
      setInvitations(invitationsData);
      
      // Get current user's display name from first group
      if (groupsData.length > 0) {
        const membersData = await sharingService.getGroupMembers(groupsData[0].id);
        const ownerMember = membersData.find(m => m.role === 'owner');
        if (ownerMember?.displayName) {
          setMyDisplayName(ownerMember.displayName);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (groupId: string) => {
    try {
      const membersData = await sharingService.getGroupMembers(groupId);
      setMembers(membersData);
      
      // Find current user's display name (owner has role 'owner')
      const ownerMember = membersData.find(m => m.role === 'owner');
      if (ownerMember?.displayName && !myDisplayName) {
        setMyDisplayName(ownerMember.displayName);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    setError(null);
    try {
      const newGroup = await sharingService.createGroup({
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        icon: groupIcon,
        color: groupColor,
      });
      setGroups(prev => [newGroup, ...prev]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !groupName.trim()) return;
    setError(null);
    try {
      const updated = await sharingService.updateGroup(editingGroup.id, {
        name: groupName.trim(),
        description: groupDescription.trim() || undefined,
        icon: groupIcon,
        color: groupColor,
      });
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
      if (selectedGroup?.id === updated.id) {
        setSelectedGroup(updated);
      }
      setShowCreateModal(false);
      setEditingGroup(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group? All members will be removed and shared entries will be unshared.')) return;
    setError(null);
    try {
      await sharingService.deleteGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        setMembers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!confirm('Leave this group? You will no longer have access to shared entries.')) return;
    setError(null);
    try {
      await sharingService.leaveGroup(groupId);
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        setMembers([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave group');
    }
  };

  const handleSendInvitation = async () => {
    if (!selectedGroup || !inviteEmail.trim()) return;
    setError(null);
    try {
      await sharingService.sendInvitation(
        selectedGroup.id,
        { email: inviteEmail.trim() },
        inviteMessage.trim() || undefined
      );
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteMessage('');
      alert('Invitation sent! They will see it when they log in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    }
  };

  const handleRespondInvitation = async (invitationId: string, accept: boolean) => {
    setError(null);
    try {
      await sharingService.respondToInvitation(invitationId, accept);
      setInvitations(prev => prev.filter(i => i.id !== invitationId));
      if (accept) {
        loadData(); // Refresh groups
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to respond to invitation');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedGroup) return;
    if (!confirm('Remove this member from the group?')) return;
    setError(null);
    try {
      await sharingService.removeMember(selectedGroup.id, userId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const resetForm = () => {
    setGroupName('');
    setGroupDescription('');
    setGroupIcon('👥');
    setGroupColor('#6366f1');
  };

  const handleUpdateDisplayName = async () => {
    if (!editDisplayName.trim()) return;
    setError(null);
    try {
      await sharingService.updateMyDisplayName(editDisplayName.trim());
      setMyDisplayName(editDisplayName.trim());
      setShowProfileModal(false);
      setEditDisplayName('');
      // Refresh members if a group is selected
      if (selectedGroup) {
        loadMembers(selectedGroup.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update display name');
    }
  };

  const openEditModal = (group: SharingGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setGroupIcon(group.icon || '👥');
    setGroupColor(group.color || '#6366f1');
    setShowCreateModal(true);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👥</div>
        <p style={{ color: '#6b7280' }}>Loading groups...</p>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1.25rem',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s ease-out'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          background: `linear-gradient(135deg, ${theme.colors.primary}15 0%, ${theme.colors.secondary}10 100%)`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>👥</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1f2937' }}>
                My Groups
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {myDisplayName ? (
                  <>
                    Hi {myDisplayName}!
                    <button
                      onClick={() => {
                        setEditDisplayName(myDisplayName);
                        setShowProfileModal(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        color: theme.colors.primary,
                        padding: 0,
                      }}
                      title="Edit display name"
                    >
                      ✏️
                    </button>
                  </>
                ) : 'Share passwords & tasks with family'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '0.25rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <button
            onClick={() => setActiveTab('groups')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'groups' ? 'white' : 'transparent',
              borderBottom: activeTab === 'groups' ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'groups' ? 600 : 400,
              color: activeTab === 'groups' ? theme.colors.primary : '#6b7280',
              transition: 'all 0.2s'
            }}
          >
            👥 Groups ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            style={{
              flex: 1,
              padding: '1rem',
              border: 'none',
              background: activeTab === 'invitations' ? 'white' : 'transparent',
              borderBottom: activeTab === 'invitations' ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'invitations' ? 600 : 400,
              color: activeTab === 'invitations' ? theme.colors.primary : '#6b7280',
              transition: 'all 0.2s',
              position: 'relative'
            }}
          >
            📬 Invitations
            {invitations.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '8px',
                right: '30%',
                background: '#ef4444',
                color: 'white',
                borderRadius: '9999px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 700
              }}>
                {invitations.length}
              </span>
            )}
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            padding: '0.75rem 1rem',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem 1.5rem' }}>
          {/* GROUPS TAB */}
          {activeTab === 'groups' && (
            <div>
              {/* Create button */}
              <button
                onClick={() => {
                  setEditingGroup(null);
                  resetForm();
                  setShowCreateModal(true);
                }}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '1rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                ➕ Create New Group
              </button>

              {/* Groups list */}
              {groups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
                  <p>No groups yet. Create one to start sharing!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {groups.map(group => (
                    <div
                      key={group.id}
                      onClick={() => setSelectedGroup(selectedGroup?.id === group.id ? null : group)}
                      style={{
                        padding: '1rem',
                        border: `2px solid ${selectedGroup?.id === group.id ? group.color : '#e5e7eb'}`,
                        borderRadius: '0.75rem',
                        background: selectedGroup?.id === group.id ? `${group.color}08` : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            background: `${group.color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.5rem'
                          }}>
                            {group.icon}
                          </span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                              {group.name}
                            </h3>
                            {group.description && (
                              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
                                {group.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                          {selectedGroup?.id === group.id ? '▲' : '▼'}
                        </span>
                      </div>

                      {/* Expanded details */}
                      {selectedGroup?.id === group.id && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                          {/* Members */}
                          <div style={{ marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6b7280' }}>
                                Members ({members.length}/{group.maxMembers})
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowInviteModal(true);
                                }}
                                style={{
                                  padding: '0.375rem 0.75rem',
                                  background: group.color,
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: 500
                                }}
                              >
                                + Invite
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {members.map(member => (
                                <div
                                  key={member.id}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.5rem 0.75rem',
                                    background: '#f9fafb',
                                    borderRadius: '0.5rem'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.25rem' }}>
                                      {member.role === 'owner' ? '👑' : member.role === 'admin' ? '⭐' : '👤'}
                                    </span>
                                    <span style={{ fontSize: '0.9rem', color: '#374151' }}>
                                      {member.displayName || 'Member'}
                                    </span>
                                    <span style={{
                                      fontSize: '0.7rem',
                                      padding: '2px 6px',
                                      background: member.role === 'owner' ? '#fef3c7' : '#e5e7eb',
                                      color: member.role === 'owner' ? '#92400e' : '#6b7280',
                                      borderRadius: '4px'
                                    }}>
                                      {member.role}
                                    </span>
                                  </div>
                                  {member.role !== 'owner' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveMember(member.userId);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: '#9ca3af',
                                        fontSize: '0.8rem'
                                      }}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(group);
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#f3f4f6',
                                color: '#374151',
                                border: 'none',
                                borderRadius: '0.5rem',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                              }}
                            >
                              ✏️ Edit
                            </button>
                            {members.find(m => m.role === 'owner') ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteGroup(group.id);
                                }}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: 'none',
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                🗑️ Delete
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLeaveGroup(group.id);
                                }}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: 'none',
                                  borderRadius: '0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem'
                                }}
                              >
                                🚪 Leave
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INVITATIONS TAB */}
          {activeTab === 'invitations' && (
            <div>
              {invitations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📬</div>
                  <p>No pending invitations</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {invitations.map(inv => (
                    <div
                      key={inv.id}
                      style={{
                        padding: '1rem',
                        border: '2px solid #e5e7eb',
                        borderRadius: '0.75rem',
                        background: 'white'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
                            {inv.groupName || 'Group Invitation'}
                          </h3>
                          <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#4b5563' }}>
                            Invited by <strong>{inv.inviterName || 'a group member'}</strong>
                          </p>
                          {inv.message && (
                            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#6b7280', fontStyle: 'italic' }}>
                              "{inv.message}"
                            </p>
                          )}
                          <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                            Received {new Date(inv.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                          onClick={() => handleRespondInvitation(inv.id, true)}
                          style={{
                            flex: 1,
                            padding: '0.625rem',
                            background: theme.colors.primary,
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          ✓ Accept
                        </button>
                        <button
                          onClick={() => handleRespondInvitation(inv.id, false)}
                          style={{
                            flex: 1,
                            padding: '0.625rem',
                            background: '#f3f4f6',
                            color: '#374151',
                            border: 'none',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          ✕ Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Group Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '420px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                {editingGroup ? 'Edit Group' : 'Create New Group'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingGroup(null);
                  resetForm();
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Group Name *
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g., Family, Work Team, Friends"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Optional description"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Icon
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {GROUP_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setGroupIcon(icon)}
                      style={{
                        width: '40px',
                        height: '40px',
                        border: `2px solid ${groupIcon === icon ? groupColor : '#e5e7eb'}`,
                        borderRadius: '0.5rem',
                        background: groupIcon === icon ? `${groupColor}20` : 'white',
                        cursor: 'pointer',
                        fontSize: '1.25rem'
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Color
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {GROUP_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setGroupColor(color)}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        border: `3px solid ${groupColor === color ? '#1f2937' : 'transparent'}`,
                        background: color,
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingGroup(null);
                    resetForm();
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                  disabled={!groupName.trim()}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: groupName.trim() ? groupColor : '#e5e7eb',
                    color: groupName.trim() ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: groupName.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500
                  }}
                >
                  {editingGroup ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && selectedGroup && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '400px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                Invite to {selectedGroup.name}
              </h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteEmail('');
                  setInviteMessage('');
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  If they're not on Leo yet, they'll see the invitation when they sign up.
                </p>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Message (optional)
                </label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Add a personal message..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                    setInviteMessage('');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendInvitation}
                  disabled={!inviteEmail.trim()}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: inviteEmail.trim() ? selectedGroup.color : '#e5e7eb',
                    color: inviteEmail.trim() ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: inviteEmail.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500
                  }}
                >
                  Send Invitation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Display Name Modal */}
      {showProfileModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            width: '100%',
            maxWidth: '360px',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                Edit Display Name
              </h3>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setEditDisplayName('');
                }}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#9ca3af' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  Your Name
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="e.g., Nitin, Dad, Mom"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  This name will be shown to other group members.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setEditDisplayName('');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateDisplayName}
                  disabled={!editDisplayName.trim()}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: editDisplayName.trim() ? theme.colors.primary : '#e5e7eb',
                    color: editDisplayName.trim() ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: editDisplayName.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 500
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default GroupsManager;
