/**
 * QuickShare Component
 * 
 * Streamlined sharing interface that reduces clicks from 7-8 to 2-3.
 * Uses BottomSheet on mobile for better UX.
 * 
 * Usage:
 * ```tsx
 * <QuickShare
 *   isOpen={showShare}
 *   onClose={() => setShowShare(false)}
 *   itemName="My Password"
 *   itemType="entry"
 *   groups={availableGroups}
 *   onShare={(groupId, permissions) => handleShare(groupId, permissions)}
 * />
 * 
 * // With recent shares for 1-tap sharing
 * <QuickShare
 *   isOpen={show}
 *   onClose={close}
 *   itemName="Bank Login"
 *   itemType="entry"
 *   groups={groups}
 *   recentShares={recentGroups}
 *   onShare={handleShare}
 * />
 * ```
 */

import React, { useState, CSSProperties } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { RADIUS, SPACING, SHADOW } from '../../constants/design-tokens';
import { Button } from './Button';
import { Modal } from './Modal';
import { haptic } from '../../utils/haptic';

export interface ShareGroup {
  id: string;
  name: string;
  emoji?: string;
  memberCount?: number;
}

export interface SharePermissions {
  canView: boolean;
  canEdit: boolean;
  canShare: boolean;
}

export interface QuickShareProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  itemType: 'entry' | 'document' | 'folder';
  groups: ShareGroup[];
  recentShares?: ShareGroup[];
  onShare: (groupId: string, permissions: SharePermissions) => void;
  defaultPermissions?: Partial<SharePermissions>;
  showPermissions?: boolean;
  isLoading?: boolean;
}

const DEFAULT_PERMISSIONS: SharePermissions = {
  canView: true,
  canEdit: false,
  canShare: false,
};

export const QuickShare: React.FC<QuickShareProps> = ({
  isOpen,
  onClose,
  itemName,
  itemType,
  groups,
  recentShares,
  onShare,
  defaultPermissions = {},
  showPermissions = false,
  isLoading = false,
}) => {
  const { theme } = useTheme();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<SharePermissions>({
    ...DEFAULT_PERMISSIONS,
    ...defaultPermissions,
  });
  const [step, setStep] = useState<'select' | 'permissions'>('select');

  const handleGroupSelect = (groupId: string) => {
    haptic.light();
    setSelectedGroup(groupId);
    
    if (showPermissions) {
      setStep('permissions');
    } else {
      onShare(groupId, permissions);
      handleClose();
    }
  };

  const handleConfirmShare = () => {
    if (selectedGroup) {
      haptic.success();
      onShare(selectedGroup, permissions);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedGroup(null);
    setStep('select');
    setPermissions({ ...DEFAULT_PERMISSIONS, ...defaultPermissions });
    onClose();
  };

  const GroupItem: React.FC<{ group: ShareGroup; isRecent?: boolean }> = ({ group, isRecent }) => (
    <button
      onClick={() => handleGroupSelect(group.id)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING[3],
        width: '100%',
        padding: SPACING[3],
        background: selectedGroup === group.id ? theme.colors.background : 'transparent',
        border: `1px solid ${selectedGroup === group.id ? theme.colors.primary : 'transparent'}`,
        borderRadius: RADIUS.lg,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (selectedGroup !== group.id) {
          e.currentTarget.style.background = theme.colors.background;
        }
      }}
      onMouseLeave={(e) => {
        if (selectedGroup !== group.id) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span
        style={{
          width: '40px',
          height: '40px',
          borderRadius: RADIUS.md,
          background: theme.gradient.textColor
            ? theme.colors.primary
            : `linear-gradient(135deg, ${theme.gradient.from}, ${theme.gradient.to})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
        }}
      >
        {group.emoji || '👥'}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, color: theme.colors.text }}>
          {group.name}
        </div>
        {group.memberCount !== undefined && (
          <div style={{ fontSize: '0.875rem', color: theme.colors.textLight }}>
            {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      {isRecent && (
        <span
          style={{
            padding: `${SPACING[0.5]} ${SPACING[2]}`,
            background: theme.colors.success,
            color: 'white',
            borderRadius: RADIUS.full,
            fontSize: '0.75rem',
            fontWeight: 500,
          }}
        >
          Recent
        </span>
      )}
    </button>
  );

  const PermissionToggle: React.FC<{
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }> = ({ label, description, checked, onChange }) => (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING[3],
        background: checked ? theme.colors.background : 'transparent',
        borderRadius: RADIUS.md,
        cursor: 'pointer',
      }}
    >
      <div>
        <div style={{ fontWeight: 500, color: theme.colors.text }}>{label}</div>
        <div style={{ fontSize: '0.875rem', color: theme.colors.textLight }}>{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: '20px',
          height: '20px',
          accentColor: theme.colors.primary,
          cursor: 'pointer',
        }}
      />
    </label>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm">
      <div style={{ padding: SPACING[4] }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: SPACING[4] }}>
          <span style={{ fontSize: '2rem' }}>
            {itemType === 'entry' ? '🔐' : itemType === 'document' ? '📄' : '📁'}
          </span>
          <h3 style={{ margin: `${SPACING[2]} 0 0`, color: theme.colors.text }}>
            Share "{itemName}"
          </h3>
        </div>

        {step === 'select' && (
          <>
            {/* Recent Shares */}
            {recentShares && recentShares.length > 0 && (
              <div style={{ marginBottom: SPACING[4] }}>
                <h4
                  style={{
                    margin: 0,
                    marginBottom: SPACING[2],
                    fontSize: '0.875rem',
                    color: theme.colors.textLight,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Quick Share
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING[1] }}>
                  {recentShares.map((group) => (
                    <GroupItem key={group.id} group={group} isRecent />
                  ))}
                </div>
              </div>
            )}

            {/* All Groups */}
            <div>
              <h4
                style={{
                  margin: 0,
                  marginBottom: SPACING[2],
                  fontSize: '0.875rem',
                  color: theme.colors.textLight,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                All Groups
              </h4>
              {groups.length === 0 ? (
                <div
                  style={{
                    padding: SPACING[6],
                    textAlign: 'center',
                    color: theme.colors.textLight,
                  }}
                >
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: SPACING[2] }}>
                    👥
                  </span>
                  No groups available. Create a group first to share.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACING[1],
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}
                >
                  {groups.map((group) => (
                    <GroupItem key={group.id} group={group} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step === 'permissions' && selectedGroup && (
          <>
            <div style={{ marginBottom: SPACING[4] }}>
              <h4
                style={{
                  margin: 0,
                  marginBottom: SPACING[2],
                  fontSize: '0.875rem',
                  color: theme.colors.textLight,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Permissions
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING[2] }}>
                <PermissionToggle
                  label="Can View"
                  description="Members can see this item"
                  checked={permissions.canView}
                  onChange={(checked) => setPermissions((p) => ({ ...p, canView: checked }))}
                />
                <PermissionToggle
                  label="Can Edit"
                  description="Members can modify this item"
                  checked={permissions.canEdit}
                  onChange={(checked) => setPermissions((p) => ({ ...p, canEdit: checked }))}
                />
                <PermissionToggle
                  label="Can Share"
                  description="Members can share with others"
                  checked={permissions.canShare}
                  onChange={(checked) => setPermissions((p) => ({ ...p, canShare: checked }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: SPACING[3] }}>
              <Button variant="secondary" onClick={() => setStep('select')} fullWidth>
                Back
              </Button>
              <Button variant="primary" onClick={handleConfirmShare} loading={isLoading} fullWidth>
                Share
              </Button>
            </div>
          </>
        )}

        {step === 'select' && (
          <div style={{ marginTop: SPACING[4] }}>
            <Button variant="secondary" onClick={handleClose} fullWidth>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default QuickShare;
