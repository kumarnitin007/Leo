/**
 * GroupChatHub - Chat-first interface for group messaging
 * 
 * Shows groups sidebar on left, chat area on right
 * Mobile: Full-screen chat with hamburger to show groups
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { SharingGroup, GroupMember } from '../../types';
import { FDPayload, AccountPayload, GroupMemberProfile } from '../../types/groupChat';
import * as sharingService from '../../services/sharingService';
import getSupabaseClient from '../../lib/supabase';
import { decryptData, CryptoKey } from '../../utils/encryption';
import GroupFinanceChat from './GroupFinanceChat';

interface GroupChatHubProps {
  encryptionKey: CryptoKey;
  onClose: () => void;
  onOpenGroupsManager?: () => void;
}

const MEMBER_COLORS = ['#6366F1', '#10B981', '#F97316', '#8B5CF6', '#EF4444', '#F59E0B', '#06B6D4', '#EC4899'];

const GroupChatHub: React.FC<GroupChatHubProps> = ({ encryptionKey, onClose, onOpenGroupsManager }) => {
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  
  const [groups, setGroups] = useState<SharingGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SharingGroup | null>(null);
  const [chatMembers, setChatMembers] = useState<GroupMember[]>([]);
  const [userDeposits, setUserDeposits] = useState<FDPayload[]>([]);
  const [userAccounts, setUserAccounts] = useState<AccountPayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowSidebar(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load groups
  useEffect(() => {
    async function loadGroups() {
      try {
        setLoading(true);
        const myGroups = await sharingService.getMyGroups();
        setGroups(myGroups);
        
        // Auto-select first group if any
        if (myGroups.length > 0 && !selectedGroup) {
          selectGroup(myGroups[0]);
        }
      } catch (err) {
        console.error('Failed to load groups:', err);
        setError('Failed to load groups');
      } finally {
        setLoading(false);
      }
    }
    loadGroups();
  }, []);

  // Load bank data for attachments
  useEffect(() => {
    async function loadBankData() {
      if (!user?.id || !supabase || !encryptionKey) return;
      
      try {
        const { data } = await supabase
          .from('myday_bank_records')
          .select('data')
          .eq('user_id', user.id)
          .maybeSingle();

        if (data?.data) {
          const { encrypted, iv } = JSON.parse(data.data);
          const decrypted = await decryptData(encrypted, iv, encryptionKey);
          const parsed = JSON.parse(decrypted);
          
          if (parsed.deposits) {
            setUserDeposits(parsed.deposits.map((d: Record<string, unknown>, idx: number) => ({
              id: d.depositId || `dep-${idx}`,
              bank: d.bank || '',
              type: d.type || 'FD',
              deposit: d.deposit || 0,
              maturityDate: d.maturityDate || '',
              roi: d.roi || 0,
              maturityAmt: d.maturityAmt || 0,
              currency: d.currency || 'INR',
            })));
          }
          if (parsed.accounts) {
            setUserAccounts(parsed.accounts.map((a: Record<string, unknown>, idx: number) => ({
              id: a.accountId || `acc-${idx}`,
              bank: a.bank || '',
              type: a.type || 'Saving',
              holders: a.holders || '',
              amount: a.amount || 0,
              roi: a.roi || 0,
              currency: a.currency || 'INR',
              accountNumber: a.accountNumber || '',
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load bank data:', err);
      }
    }
    loadBankData();
  }, [user?.id, supabase, encryptionKey]);

  const selectGroup = async (group: SharingGroup) => {
    setSelectedGroup(group);
    if (isMobile) setShowSidebar(false);
    
    try {
      const members = await sharingService.getGroupMembers(group.id);
      setChatMembers(members);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const mapMemberToProfile = (member: GroupMember, index: number): GroupMemberProfile => {
    const name = member.displayName || 'Member';
    return {
      id: member.userId,
      name,
      role: member.role === 'owner' ? 'owner' : member.role === 'admin' ? 'admin' : 'member',
      avatar: name.slice(0, 2).toUpperCase(),
      color: MEMBER_COLORS[index % MEMBER_COLORS.length],
    };
  };

  const userName = user?.email?.split('@')[0] || 'You';

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Groups Sidebar */}
      {(showSidebar || !isMobile) && (
        <div style={{
          width: isMobile ? '100%' : '280px',
          minWidth: isMobile ? '100%' : '280px',
          background: '#fff',
          borderRight: '1px solid #e5e7eb',
          display: 'flex',
          flexDirection: 'column',
          position: isMobile ? 'absolute' : 'relative',
          zIndex: isMobile ? 10 : 1,
          height: '100%',
        }}>
          {/* Sidebar Header */}
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1f2937' }}>
              💬 Groups
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {onOpenGroupsManager && (
                <button
                  onClick={onOpenGroupsManager}
                  style={{
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: '0.5rem',
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    color: '#6b7280',
                  }}
                  title="Manage Groups"
                >
                  ⚙️ Manage
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.4rem 0.6rem',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Groups List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                Loading groups...
              </div>
            ) : error ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                {error}
              </div>
            ) : groups.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👥</div>
                <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>No groups yet</div>
                {onOpenGroupsManager && (
                  <button
                    onClick={onOpenGroupsManager}
                    style={{
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    + Create Group
                  </button>
                )}
              </div>
            ) : (
              groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => selectGroup(group)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    background: selectedGroup?.id === group.id ? `${group.color || '#667eea'}15` : 'transparent',
                    border: selectedGroup?.id === group.id ? `2px solid ${group.color || '#667eea'}` : '2px solid transparent',
                    borderRadius: '0.75rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.5rem',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '0.75rem',
                    background: `${group.color || '#667eea'}20`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    flexShrink: 0,
                  }}>
                    {group.icon || '👥'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#1f2937',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {group.name}
                    </div>
                    {group.description && (
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#9ca3af',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {group.description}
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {selectedGroup ? (
          <>
            {/* Mobile: Show menu button when sidebar is hidden */}
            {isMobile && !showSidebar && (
              <div style={{
                position: 'absolute',
                top: '0.75rem',
                left: '0.75rem',
                zIndex: 5,
              }}>
                <button
                  onClick={() => setShowSidebar(true)}
                  style={{
                    background: 'rgba(255,255,255,0.95)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  ☰
                </button>
              </div>
            )}
            <GroupFinanceChat
              groupId={selectedGroup.id}
              groupName={selectedGroup.name}
              groupIcon={selectedGroup.icon}
              groupColor={selectedGroup.color}
              currentUser={{ id: user?.id || '', name: userName }}
              members={chatMembers.map(mapMemberToProfile)}
              userDeposits={userDeposits}
              userAccounts={userAccounts}
              onBack={() => {
                if (isMobile) {
                  setShowSidebar(true);
                } else {
                  setSelectedGroup(null);
                }
              }}
            />
          </>
        ) : (
          /* Empty State - No group selected */
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            padding: '2rem',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
              Select a group to start chatting
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              Choose a group from the sidebar
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupChatHub;
