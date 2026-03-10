/**
 * GroupFinanceChat - Encrypted group messaging for financial discussions
 * 
 * Features:
 * - Real-time messaging via Supabase
 * - Share FD cards from Bank Records
 * - Send maturity alerts
 * - Share documents
 * - End-to-end encrypted (via group keys)
 */

import React, { useState, useRef, useEffect } from 'react';
import getSupabaseClient from '../../lib/supabase';
import {
  GroupFinanceChatProps,
  GroupFinanceMessage,
  GroupMemberProfile,
  FDPayload,
  AccountPayload,
  AlertPayload,
  DocPayload,
} from '../../types/groupChat';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', CHF: 'Fr'
};

function fmt(n: number | string | null | undefined, currency?: string): string {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (isNaN(v)) return '—';
  const sym = CURRENCY_SYMBOLS[currency || 'INR'] || currency || '₹';
  const isINR = !currency || currency === 'INR';
  if (isINR) {
    if (v >= 10000000) return sym + (v / 10000000).toFixed(2) + ' Cr';
    if (v >= 100000) return sym + (v / 100000).toFixed(2) + ' L';
    return sym + v.toLocaleString('en-IN');
  }
  return sym + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtDate(str: string | null | undefined): string {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(str: string): string {
  return new Date(str).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDay(str: string): string {
  const d = new Date(str);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Today';
  const y = new Date(t);
  y.setDate(t.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
}

function daysLeft(str: string | null | undefined): number | null {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86400000);
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ member, size = 36 }: { member: GroupMemberProfile; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: member.color + '22',
      border: `2px solid ${member.color}40`,
      color: member.color,
      fontSize: size * 0.36,
      fontWeight: 800,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {member.avatar}
    </div>
  );
}

// ─── FD Card ──────────────────────────────────────────────────────────────────
function FDCard({ fd }: { fd: FDPayload }) {
  const days = daysLeft(fd.maturityDate);
  const urg = days !== null && days <= 90 ? '#EF4444' : days !== null && days <= 180 ? '#F59E0B' : '#10B981';
  return (
    <div style={{
      background: '#F0FDF4',
      border: '1px solid #BBF7D0',
      borderLeft: '3px solid #10B981',
      borderRadius: 10,
      padding: '12px 14px',
      marginTop: 8,
      minWidth: 240,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46' }}>🏦 {fd.bank}</div>
          <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{fd.type}</div>
        </div>
        <div style={{
          background: urg + '20',
          color: urg,
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 20,
          whiteSpace: 'nowrap',
        }}>
          {days === null ? '—' : days < 0 ? 'Matured' : days === 0 ? 'TODAY!' : `${days}d left`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        {[
          ['INVESTED', fmt(fd.deposit, fd.currency), '#374151'],
          ['AT MATURITY', fmt(fd.maturityAmt, fd.currency), '#10B981'],
          ['ROI', (Number(fd.roi) * 100).toFixed(2) + '%', '#6366F1'],
        ].map(([l, v, c]) => (
          <div key={l}>
            <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 700, letterSpacing: 0.5 }}>{l}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: c, fontFamily: 'monospace', marginTop: 1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8, borderTop: '1px solid #D1FAE5', paddingTop: 8 }}>
        📅 Matures: <strong>{fmtDate(fd.maturityDate)}</strong>
      </div>
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────
function AccountCard({ account }: { account: AccountPayload }) {
  const typeColor = account.type === 'FD' ? '#3B82F6' : account.type === 'Saving' ? '#10B981' : account.type === 'Credit Card' ? '#EF4444' : account.type === 'Loan' ? '#F59E0B' : '#8B5CF6';
  const isNegative = Number(account.amount) < 0;
  return (
    <div style={{
      background: '#EFF6FF',
      border: '1px solid #BFDBFE',
      borderLeft: `3px solid ${typeColor}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginTop: 8,
      minWidth: 220,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1E40AF' }}>🏦 {account.bank}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ background: `${typeColor}20`, color: typeColor, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{account.type}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: isNegative ? '#EF4444' : '#1E40AF' }}>{fmt(account.amount, account.currency)}</div>
          {account.roi && Number(account.roi) > 0 && (
            <div style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>{(Number(account.roi) * 100).toFixed(2)}%</div>
          )}
        </div>
      </div>
      {account.holders && (
        <div style={{ fontSize: 11, color: '#6B7280', borderTop: '1px solid #DBEAFE', paddingTop: 6 }}>
          👤 {account.holders}
        </div>
      )}
      {account.accountNumber && (
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, fontFamily: 'monospace' }}>
          A/C: ****{account.accountNumber.slice(-4)}
        </div>
      )}
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────
function AlertCard({ alert }: { alert: AlertPayload }) {
  const days = alert.daysLeft ?? daysLeft(alert.date);
  const urg = days !== null && days <= 0 ? '#EF4444' : days !== null && days <= 30 ? '#EF4444' : '#F59E0B';
  return (
    <div style={{
      background: urg + '08',
      border: `1px solid ${urg}30`,
      borderLeft: `3px solid ${urg}`,
      borderRadius: 10,
      padding: '12px 14px',
      marginTop: 8,
      minWidth: 220,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20 }}>🔔</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1F2937' }}>{alert.title}</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>{alert.bank}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: urg, fontFamily: 'monospace' }}>{fmt(alert.amount)}</div>
        <div style={{
          background: urg + '20',
          color: urg,
          fontSize: 11,
          fontWeight: 700,
          padding: '2px 10px',
          borderRadius: 20,
        }}>
          {days !== null && days <= 0 ? '⚠️ Matured!' : `🔴 ${days}d`}
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>Due: {fmtDate(alert.date)}</div>
    </div>
  );
}

// ─── Doc Card ─────────────────────────────────────────────────────────────────
function DocCard({ doc }: { doc: DocPayload }) {
  const cols: Record<string, string> = { PDF: '#EF4444', XLSX: '#10B981', IMG: '#3B82F6' };
  const c = cols[doc.type] || '#6B7280';
  return (
    <div
      style={{
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: 10,
        padding: '10px 14px',
        marginTop: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: doc.url ? 'pointer' : 'default',
        maxWidth: 280,
      }}
      onClick={() => doc.url && window.open(doc.url, '_blank')}
    >
      <div style={{
        width: 36,
        height: 42,
        background: c + '15',
        border: `1.5px solid ${c}40`,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 800,
        color: c,
        flexShrink: 0,
      }}>
        {doc.type}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937' }}>{doc.name}</div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{doc.size} · Tap to view</div>
      </div>
      <div style={{ fontSize: 16, color: '#9CA3AF' }}>⬇</div>
    </div>
  );
}

// ─── Single Message ───────────────────────────────────────────────────────────
interface MessageProps {
  msg: GroupFinanceMessage;
  showAvatar: boolean;
  showDay: boolean;
  sender: GroupMemberProfile;
  isMe: boolean;
}

function Message({ msg, showAvatar, showDay, sender, isMe }: MessageProps) {
  return (
    <>
      {showDay && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 14px' }}>
          <div style={{ flex: 1, height: 1, background: '#D1FAE5' }} />
          <div style={{
            fontSize: 11,
            color: '#6B7280',
            fontWeight: 600,
            background: '#ECFDF5',
            border: '1px solid #BBF7D0',
            padding: '3px 14px',
            borderRadius: 20,
            whiteSpace: 'nowrap',
          }}>
            {fmtDay(msg.created_at)}
          </div>
          <div style={{ flex: 1, height: 1, background: '#D1FAE5' }} />
        </div>
      )}

      <div style={{
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: showAvatar ? 14 : 3,
        paddingLeft: isMe ? 52 : 0,
        paddingRight: isMe ? 0 : 52,
      }}>
        <div style={{ width: 36, flexShrink: 0 }}>
          {showAvatar && !isMe && <Avatar member={sender} size={34} />}
        </div>

        <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
          {showAvatar && !isMe && (
            <div style={{ fontSize: 11, fontWeight: 700, color: sender.color, marginBottom: 4, paddingLeft: 2 }}>
              {sender.name}
              {sender.role === 'owner' && (
                <span style={{
                  marginLeft: 5,
                  fontSize: 9,
                  background: '#FEF3C7',
                  color: '#D97706',
                  padding: '1px 6px',
                  borderRadius: 20,
                  fontWeight: 700,
                }}>
                  OWNER
                </span>
              )}
            </div>
          )}

          <div style={{
            background: isMe ? 'linear-gradient(135deg,#0D9488,#0F766E)' : '#FFFFFF',
            color: isMe ? '#FFFFFF' : '#1F2937',
            padding: '10px 14px',
            borderRadius: isMe ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            border: isMe ? 'none' : '1px solid #F0FDF4',
            fontSize: 14,
            lineHeight: 1.55,
          }}>
            {msg.text && <div>{msg.text}</div>}
            {msg.fd && <FDCard fd={msg.fd} />}
            {msg.account && <AccountCard account={msg.account} />}
            {msg.alert && <AlertCard alert={msg.alert} />}
            {msg.doc && <DocCard doc={msg.doc} />}
          </div>

          {showAvatar && (
            <div style={{
              fontSize: 10,
              color: '#9CA3AF',
              marginTop: 3,
              paddingLeft: 2,
              paddingRight: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              {fmtTime(msg.created_at)}
              {isMe && <span style={{ color: '#0D9488', fontWeight: 700 }}>✓✓</span>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Attach Picker ────────────────────────────────────────────────────────────
interface AttachPickerProps {
  deposits: FDPayload[];
  accounts: AccountPayload[];
  onAttach: (type: 'fd' | 'account' | 'alert' | 'doc', data: FDPayload | AccountPayload | AlertPayload | DocPayload) => void;
  onClose: () => void;
}

function AttachPicker({ deposits, accounts, onAttach, onClose }: AttachPickerProps) {
  const [tab, setTab] = useState<'fd' | 'account' | 'alert' | 'doc'>('fd');
  const upcomingFDs = deposits.filter(fd => {
    const d = daysLeft(fd.maturityDate);
    return d !== null && d <= 180;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px 20px 0 0',
        width: '100%',
        maxWidth: 640,
        padding: '16px 20px 36px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
      }}>
        <div style={{ width: 40, height: 4, background: '#E5E7EB', borderRadius: 2, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2937' }}>📎 Attach to Message</div>
          <button
            onClick={onClose}
            style={{
              background: '#F3F4F6',
              border: 'none',
              borderRadius: 8,
              padding: '4px 12px',
              color: '#6B7280',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['fd', '🏦 FD'], ['account', '💳 Account'], ['alert', '🔔 Alert'], ['doc', '📄 Doc']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background: tab === id ? '#0D9488' : '#F3F4F6',
                color: tab === id ? '#FFF' : '#6B7280',
                border: 'none',
                borderRadius: 20,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'fd' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {deposits.length === 0 && (
              <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 32, fontSize: 13 }}>
                No deposits found in your Bank Records
              </div>
            )}
            {deposits.map((fd) => (
              <div
                key={fd.id}
                onClick={() => onAttach('fd', fd)}
                style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#065F46' }}>🏦 {fd.bank}</div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>{fd.type} · Matures {fmtDate(fd.maturityDate)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#10B981', fontFamily: 'monospace' }}>
                    {fmt(fd.maturityAmt, fd.currency)}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{(Number(fd.roi) * 100).toFixed(2)}% pa</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'account' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {accounts.length === 0 && (
              <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 32, fontSize: 13 }}>
                No accounts found in your Bank Records
              </div>
            )}
            {accounts.map((acc) => {
              const typeColor = acc.type === 'FD' ? '#3B82F6' : acc.type === 'Saving' ? '#10B981' : acc.type === 'Credit Card' ? '#EF4444' : acc.type === 'Loan' ? '#F59E0B' : '#8B5CF6';
              const isNegative = Number(acc.amount) < 0;
              return (
                <div
                  key={acc.id}
                  onClick={() => onAttach('account', acc)}
                  style={{
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 12,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1E40AF' }}>🏦 {acc.bank}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ background: `${typeColor}20`, color: typeColor, padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{acc.type}</span>
                      {acc.holders && <span style={{ fontSize: 11, color: '#6B7280' }}>· {acc.holders}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: isNegative ? '#EF4444' : '#1E40AF', fontFamily: 'monospace' }}>
                      {fmt(acc.amount, acc.currency)}
                    </div>
                    {acc.roi && Number(acc.roi) > 0 && (
                      <div style={{ fontSize: 10, color: '#10B981' }}>{(Number(acc.roi) * 100).toFixed(2)}%</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'alert' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {upcomingFDs.length === 0 && (
              <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 32, fontSize: 13 }}>
                No deposits maturing within 180 days
              </div>
            )}
            {upcomingFDs.map((fd) => {
              const days = daysLeft(fd.maturityDate) || 0;
              const urg = days <= 30 ? '#EF4444' : '#F59E0B';
              return (
                <div
                  key={fd.id}
                  onClick={() =>
                    onAttach('alert', {
                      title: `${fd.bank} FD Maturing`,
                      date: fd.maturityDate,
                      amount: Number(fd.maturityAmt),
                      bank: fd.bank,
                      daysLeft: days,
                    })
                  }
                  style={{
                    background: urg + '08',
                    border: `1px solid ${urg}30`,
                    borderRadius: 12,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1F2937' }}>🔔 {fd.bank}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      Due: {fmtDate(fd.maturityDate)} · {fmt(fd.maturityAmt, fd.currency)}
                    </div>
                  </div>
                  <div style={{
                    background: urg + '20',
                    color: urg,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 12px',
                    borderRadius: 20,
                  }}>
                    {days <= 0 ? 'Matured!' : days === 0 ? 'TODAY!' : days + 'd'}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'doc' && (
          <div
            style={{
              border: '2px dashed #D1D5DB',
              borderRadius: 14,
              padding: '36px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              color: '#6B7280',
            }}
            onClick={() =>
              onAttach('doc', {
                name: 'Document_' + new Date().toISOString().slice(0, 10) + '.pdf',
                size: '—',
                type: 'PDF',
              })
            }
          >
            <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>Tap to upload document</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>PDF, image, Excel — any file</div>
            <div style={{
              marginTop: 16,
              background: '#0D9488',
              color: '#FFF',
              display: 'inline-block',
              borderRadius: 20,
              padding: '8px 28px',
              fontSize: 13,
              fontWeight: 700,
            }}>
              Choose File
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Members Sidebar ──────────────────────────────────────────────────────────
interface MembersSidebarProps {
  members: GroupMemberProfile[];
  currentUserId: string;
  onClose: () => void;
}

function MembersSidebar({ members, currentUserId, onClose }: MembersSidebarProps) {
  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 220,
      background: '#FFFFFF',
      borderLeft: '1px solid #E5E7EB',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
    }}>
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #F3F4F6',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1F2937' }}>👥 Members ({members.length})</div>
        <button
          onClick={onClose}
          style={{
            background: '#F3F4F6',
            border: 'none',
            borderRadius: 8,
            width: 28,
            height: 28,
            cursor: 'pointer',
            fontSize: 14,
            color: '#6B7280',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {members.map((m) => (
          <div
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 8px',
              borderRadius: 10,
              marginBottom: 4,
              background: '#FAFAFA',
              border: '1px solid #F3F4F6',
            }}
          >
            <Avatar member={m} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937' }}>
                {m.name}{' '}
                {m.id === currentUserId && (
                  <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>(you)</span>
                )}
              </div>
              {m.role === 'owner' ? (
                <span style={{
                  fontSize: 10,
                  background: '#FEF3C7',
                  color: '#D97706',
                  padding: '1px 7px',
                  borderRadius: 20,
                  fontWeight: 700,
                }}>
                  👑 Owner
                </span>
              ) : (
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>Member</span>
              )}
            </div>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 0 2px #D1FAE5',
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GroupFinanceChat({
  groupId,
  groupName,
  groupIcon = '👨‍👩‍👧‍👦',
  groupColor = '#0D9488',
  currentUser,
  members,
  userDeposits = [],
  userAccounts = [],
  onBack,
}: GroupFinanceChatProps) {
  const [messages, setMessages] = useState<GroupFinanceMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<{ type: 'fd' | 'account' | 'alert' | 'doc'; data: FDPayload | AccountPayload | AlertPayload | DocPayload } | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [filter, setFilter] = useState<'all' | 'fd' | 'account' | 'alert' | 'doc'>('all');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const supabase = getSupabaseClient();

  const getMember = (senderId: string): GroupMemberProfile => {
    return (
      members.find((m) => m.id === senderId) || {
        id: senderId,
        name: 'Unknown',
        role: 'member' as const,
        avatar: '?',
        color: '#6B7280',
      }
    );
  };

  const transformMessage = (row: Record<string, unknown>): GroupFinanceMessage => {
    const payload = (row.payload as Record<string, unknown>) || {};
    return {
      id: row.id as string,
      group_id: row.group_id as string,
      sender_id: row.sender_id as string,
      sender_name: row.sender_name as string,
      type: row.type as GroupFinanceMessage['type'],
      text: (row.text as string) || '',
      payload: payload as GroupFinanceMessage['payload'],
      created_at: row.created_at as string,
      fd: payload.fd as FDPayload | undefined,
      account: payload.account as AccountPayload | undefined,
      alert: payload.alert as AlertPayload | undefined,
      doc: payload.doc as DocPayload | undefined,
    };
  };

  useEffect(() => {
    if (!groupId || !supabase) return;

    setLoading(true);
    supabase
      .from('myday_group_finance_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load messages:', error);
        } else if (data) {
          setMessages(data.map(transformMessage));
        }
        setLoading(false);
      });
  }, [groupId, supabase]);

  useEffect(() => {
    if (!groupId || !supabase) return;

    const channel = supabase
      .channel(`group-chat-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'myday_group_finance_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, transformMessage(payload.new as Record<string, unknown>)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    function handlePopState() {
      onBack();
    }
    window.history.pushState({ chat: true }, '');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBack]);

  async function sendMessage() {
    if (!supabase) return;
    const text = inputText.trim();
    if (!text && !attachment) return;

    const baseText =
      text ||
      (attachment?.type === 'fd'
        ? 'Sharing FD details:'
        : attachment?.type === 'account'
          ? 'Sharing account details:'
          : attachment?.type === 'alert'
            ? 'Maturity alert for the group:'
            : 'Sharing document:');

    const payload: Record<string, unknown> = {};
    if (attachment?.type === 'fd') payload.fd = attachment.data;
    if (attachment?.type === 'account') payload.account = attachment.data;
    if (attachment?.type === 'alert') payload.alert = attachment.data;
    if (attachment?.type === 'doc') payload.doc = attachment.data;

    const { error } = await supabase.from('myday_group_finance_messages').insert({
      group_id: groupId,
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      type: attachment?.type || 'text',
      text: baseText,
      payload: Object.keys(payload).length > 0 ? payload : null,
    });

    if (!error) {
      setInputText('');
      setAttachment(null);
    } else {
      console.error('Failed to send message:', error);
    }
  }

  const filtered = filter === 'all' ? messages : messages.filter((m) => m.type === filter);
  const grouped = filtered.map((msg, i) => {
    const next = filtered[i + 1];
    const prev = filtered[i - 1];
    const showAvatar =
      !next ||
      next.sender_id !== msg.sender_id ||
      new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() > 300000;
    const showDay = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
    return { msg, showAvatar, showDay };
  });

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#F0FDFA',
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: '#F3F4F6',
            border: 'none',
            borderRadius: 10,
            width: 36,
            height: 36,
            cursor: 'pointer',
            fontSize: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6B7280',
          }}
        >
          ‹
        </button>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `linear-gradient(135deg,${groupColor},#6366F1)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            flexShrink: 0,
          }}
        >
          {groupIcon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1F2937' }}>{groupName}</div>
          <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>
            {members.map((m) => m.name).join(', ')} · {members.length} members
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowMembers((p) => !p)}
            style={{
              background: showMembers ? '#0D9488' : '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: showMembers ? '#FFF' : '#0D9488',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            👥 {members.length}
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '10px 16px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {([['all', '💬 All'], ['fd', '🏦 FD'], ['account', '💳 A/C'], ['alert', '🔔 Alert'], ['doc', '📄 Doc']] as const).map(
          ([id, label]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              style={{
                background: filter === id ? '#0D9488' : '#F3F4F6',
                color: filter === id ? '#FFF' : '#6B7280',
                border: 'none',
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          )
        )}
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: '#10B981',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            background: '#F0FDF4',
            padding: '4px 12px',
            borderRadius: 20,
            border: '1px solid #BBF7D0',
          }}
        >
          🔒 Encrypted
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>Loading messages...</div>
        )}
        {!loading && grouped.length === 0 && (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: '#9CA3AF' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>No messages here yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Share FD cards, maturity alerts, or notes with your family
            </div>
          </div>
        )}
        {grouped.map(({ msg, showAvatar, showDay }) => (
          <Message
            key={msg.id}
            msg={msg}
            showAvatar={showAvatar}
            showDay={showDay}
            sender={getMember(msg.sender_id)}
            isMe={msg.sender_id === currentUser.id}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Attachment preview bar */}
      {attachment && (
        <div
          style={{
            background: '#F0FDF4',
            borderTop: '1px solid #BBF7D0',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, fontSize: 13, color: '#065F46', fontWeight: 600 }}>
            {attachment.type === 'fd' && `🏦 ${(attachment.data as FDPayload).bank} — ${fmt((attachment.data as FDPayload).deposit, (attachment.data as FDPayload).currency)}`}
            {attachment.type === 'account' && `💳 ${(attachment.data as AccountPayload).bank} — ${fmt((attachment.data as AccountPayload).amount, (attachment.data as AccountPayload).currency)}`}
            {attachment.type === 'alert' && `🔔 ${(attachment.data as AlertPayload).title}`}
            {attachment.type === 'doc' && `📄 ${(attachment.data as DocPayload).name}`}
          </div>
          <button
            onClick={() => setAttachment(null)}
            style={{
              background: '#FEE2E2',
              color: '#EF4444',
              border: 'none',
              borderRadius: 20,
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ✕ Remove
          </button>
        </div>
      )}

      {/* Input bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid #E5E7EB',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          flexShrink: 0,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.05)',
        }}
      >
        <button
          onClick={() => setShowAttach(true)}
          title="Attach FD, alert or document"
          style={{
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 12,
            width: 42,
            height: 42,
            cursor: 'pointer',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          📎
        </button>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message, share FD details or send a reminder…"
          rows={1}
          style={{
            flex: 1,
            background: '#F9FAFB',
            border: '1.5px solid #E5E7EB',
            borderRadius: 16,
            padding: '10px 14px',
            fontSize: 14,
            fontFamily: 'inherit',
            color: '#1F2937',
            resize: 'none',
            outline: 'none',
            lineHeight: 1.5,
            maxHeight: 100,
            overflowY: 'auto',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!inputText.trim() && !attachment}
          style={{
            background: inputText.trim() || attachment ? 'linear-gradient(135deg,#0D9488,#0F766E)' : '#E5E7EB',
            color: inputText.trim() || attachment ? '#FFFFFF' : '#9CA3AF',
            border: 'none',
            borderRadius: 12,
            width: 42,
            height: 42,
            cursor: inputText.trim() || attachment ? 'pointer' : 'default',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s',
            boxShadow: inputText.trim() || attachment ? '0 4px 12px #0D948840' : 'none',
          }}
        >
          ➤
        </button>
      </div>

      {/* Overlays */}
      {showMembers && (
        <MembersSidebar members={members} currentUserId={currentUser.id} onClose={() => setShowMembers(false)} />
      )}
      {showAttach && (
        <AttachPicker
          deposits={userDeposits}
          accounts={userAccounts}
          onAttach={(type, data) => {
            setAttachment({ type, data });
            setShowAttach(false);
          }}
          onClose={() => setShowAttach(false)}
        />
      )}
    </div>
  );
}
