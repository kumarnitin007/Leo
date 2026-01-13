/**
 * Family View Component
 * 
 * Main interface for managing family accounts, members, and invitations
 */

import React, { useState, useEffect } from 'react';
import {
  createFamily,
  getMyFamilies,
  inviteFamilyMember,
  leaveFamily,
  deleteFamily
} from './services/familyService';
import { FamilyData } from './types/family';

interface FamilyViewProps {
  onNavigate: (view: string) => void;
}

const FamilyView: React.FC<FamilyViewProps> = ({ onNavigate }) => {
  const [families, setFamilies] = useState<FamilyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<FamilyData | null>(null);
  
  // Create family form
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyDesc, setNewFamilyDesc] = useState('');
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');

  useEffect(() => {
    loadFamilies();
  }, []);

  const loadFamilies = async () => {
    try {
      setLoading(true);
      const data = await getMyFamilies();
      setFamilies(data);
    } catch (error) {
      console.error('Error loading families:', error);
      alert('Failed to load families');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFamily(newFamilyName, newFamilyDesc);
      setShowCreateModal(false);
      setNewFamilyName('');
      setNewFamilyDesc('');
      loadFamilies();
    } catch (error) {
      console.error('Error creating family:', error);
      alert('Failed to create family');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamily) return;

    try {
      await inviteFamilyMember(selectedFamily.family.id, inviteEmail, inviteMessage);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteMessage('');
      alert('Invitation sent successfully!');
    } catch (error) {
      console.error('Error inviting member:', error);
      alert('Failed to send invitation');
    }
  };

  const handleLeaveFamily = async (familyId: string, familyName: string) => {
    if (!confirm(`Are you sure you want to leave "${familyName}"?`)) return;

    try {
      await leaveFamily(familyId);
      loadFamilies();
    } catch (error) {
      console.error('Error leaving family:', error);
      alert('Failed to leave family');
    }
  };

  const handleDeleteFamily = async (familyId: string, familyName: string) => {
    if (!confirm(`Are you sure you want to delete "${familyName}"? This cannot be undone.`)) return;

    try {
      await deleteFamily(familyId);
      loadFamilies();
    } catch (error) {
      console.error('Error deleting family:', error);
      alert('Failed to delete family');
    }
  };

  if (loading) {
    return (
      <div className="family-view" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading families...</p>
      </div>
    );
  }

  return (
    <div className="family-view">
      <div className="family-header">
        <div>
          <h2>👨‍👩‍👧‍👦 Family Accounts</h2>
          <p>Manage your family members and share tasks</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          ➕ Create Family
        </button>
      </div>

      {families.length === 0 ? (
        <div className="no-families" style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'white',
          borderRadius: '16px',
          marginTop: '2rem'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>👨‍👩‍👧‍👦</div>
          <h3>No Family Accounts Yet</h3>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Create a family account to share tasks and collaborate with loved ones
          </p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Your First Family
          </button>
        </div>
      ) : (
        <div className="families-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '1.5rem',
          marginTop: '2rem'
        }}>
          {families.map(familyData => (
            <div key={familyData.family.id} className="family-card" style={{
              background: 'white',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
                    {familyData.family.name}
                  </h3>
                  {familyData.family.description && (
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                      {familyData.family.description}
                    </p>
                  )}
                </div>
                <span style={{
                  background: familyData.myRole === 'admin' ? '#dbeafe' : '#f3f4f6',
                  color: familyData.myRole === 'admin' ? '#1e40af' : '#374151',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  {familyData.myRole === 'admin' ? '👑 Admin' : '👤 Member'}
                </span>
              </div>

              <div style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.75rem' }}>
                  Members ({familyData.members.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {familyData.members.slice(0, 3).map(member => (
                    <div key={member.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}>
                        {member.email?.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.9rem' }}>
                        {member.displayName || member.email}
                        {member.role === 'admin' && ' 👑'}
                      </span>
                    </div>
                  ))}
                  {familyData.members.length > 3 && (
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0.5rem 0 0 0' }}>
                      +{familyData.members.length - 3} more members
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setSelectedFamily(familyData);
                    setShowInviteModal(true);
                  }}
                  className="btn-secondary"
                  style={{ flex: 1, fontSize: '0.9rem', padding: '0.5rem' }}
                >
                  ✉️ Invite
                </button>
                {familyData.myRole === 'admin' ? (
                  <button
                    onClick={() => handleDeleteFamily(familyData.family.id, familyData.family.name)}
                    className="btn-secondary"
                    style={{
                      flex: 1,
                      fontSize: '0.9rem',
                      padding: '0.5rem',
                      background: '#fee2e2',
                      color: '#dc2626'
                    }}
                  >
                    🗑️ Delete
                  </button>
                ) : (
                  <button
                    onClick={() => handleLeaveFamily(familyData.family.id, familyData.family.name)}
                    className="btn-secondary"
                    style={{
                      flex: 1,
                      fontSize: '0.9rem',
                      padding: '0.5rem',
                      background: '#fef3c7',
                      color: '#92400e'
                    }}
                  >
                    🚪 Leave
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Family Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Create Family Account</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateFamily} style={{ padding: '1.5rem' }}>
              <div className="form-group">
                <label htmlFor="familyName">Family Name *</label>
                <input
                  id="familyName"
                  type="text"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                  required
                  placeholder="e.g., The Smiths"
                />
              </div>
              <div className="form-group">
                <label htmlFor="familyDesc">Description (Optional)</label>
                <textarea
                  id="familyDesc"
                  value={newFamilyDesc}
                  onChange={(e) => setNewFamilyDesc(e.target.value)}
                  placeholder="Brief description of your family..."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  Create Family
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && selectedFamily && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Invite to {selectedFamily.family.name}</h2>
              <button className="modal-close" onClick={() => setShowInviteModal(false)}>×</button>
            </div>
            <form onSubmit={handleInviteMember} style={{ padding: '1.5rem' }}>
              <div className="form-group">
                <label htmlFor="inviteEmail">Email Address *</label>
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  placeholder="person@example.com"
                />
                <small style={{ color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>
                  They'll receive an invitation to join your family
                </small>
              </div>
              <div className="form-group">
                <label htmlFor="inviteMessage">Personal Message (Optional)</label>
                <textarea
                  id="inviteMessage"
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  placeholder="Add a personal note..."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FamilyView;


