/**
 * Contacts Viewer Modal
 *
 * Browsable list of Google Contacts synced into myday_contacts. Shows the full
 * detail captured from the People API (all emails, phones, addresses, orgs,
 * urls, relations, events, etc.), supports search, and lets the user mark
 * favourites (persisted to myday_contacts.is_favorite).
 */

import React, { useEffect, useMemo, useState } from 'react';
import Portal from './Portal';
import { useAuth } from '../contexts/AuthContext';
import {
  loadAllContacts,
  updateContactFavorite,
} from '../integrations/google/services/ContactsService';
import { getSupabaseClient } from '../lib/supabase';
import type { GoogleContact } from '../integrations/google/types/contacts.types';

interface ContactsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ViewerContact extends GoogleContact {
  rowId: string;
}

/** loadAllContacts() drops the row id; re-query so favourites can be toggled. */
async function loadViewerContacts(userId: string): Promise<ViewerContact[]> {
  const base = await loadAllContacts(userId);
  const client = getSupabaseClient();
  if (!client) return base.map(c => ({ ...c, rowId: '' }));

  const { data } = await client
    .from('myday_contacts')
    .select('id, google_resource_name')
    .eq('user_id', userId);

  const idByResource = new Map<string, string>();
  (data || []).forEach((r: { id: string; google_resource_name: string }) =>
    idByResource.set(r.google_resource_name, r.id),
  );

  return base.map(c => ({ ...c, rowId: idByResource.get(c.resourceName) || '' }));
}

const ContactsViewerModal: React.FC<ContactsViewerModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<ViewerContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    setLoading(true);
    loadViewerContacts(user.id)
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [isOpen, user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter(c => {
      if (favOnly && !c.isFavorite) return false;
      if (!q) return true;
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.organization || '').toLowerCase().includes(q)
      );
    });
  }, [contacts, query, favOnly]);

  const favCount = useMemo(() => contacts.filter(c => c.isFavorite).length, [contacts]);

  const toggleFavorite = async (c: ViewerContact) => {
    if (!user?.id || !c.rowId) return;
    const next = !c.isFavorite;
    setContacts(prev => prev.map(p => (p.rowId === c.rowId ? { ...p, isFavorite: next } : p)));
    try {
      await updateContactFavorite(user.id, c.rowId, next);
    } catch {
      setContacts(prev => prev.map(p => (p.rowId === c.rowId ? { ...p, isFavorite: !next } : p)));
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(30,27,46,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 640, maxHeight: '88vh',
            display: 'flex', flexDirection: 'column',
            background: 'var(--ck-white, #fff)',
            border: '1px solid var(--ck-border2, #e6e1d8)',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 16px',
            background: 'var(--ck-purple-light, #ede9ff)',
            borderBottom: '1px solid var(--ck-border2, #e6e1d8)',
          }}>
            <span style={{ fontSize: 22 }}>👥</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ck-ink, #2b2733)' }}>
                Google Contacts
              </div>
              <div style={{ fontSize: 12, color: 'var(--ck-ink2, #6b6577)' }}>
                {contacts.length} contacts · {favCount} favourite{favCount === 1 ? '' : 's'}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                border: '1px solid var(--ck-border2, #e6e1d8)', background: '#fff',
                borderRadius: 8, width: 30, height: 30, cursor: 'pointer',
                fontSize: 16, color: 'var(--ck-ink2, #6b6577)',
              }}
              aria-label="Close"
            >×</button>
          </div>

          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--ck-border2, #e6e1d8)' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name, email, phone, org…"
              style={{
                flex: 1, padding: '8px 12px', fontSize: 13,
                border: '1px solid var(--ck-border2, #e6e1d8)', borderRadius: 10,
                outline: 'none', color: 'var(--ck-ink, #2b2733)',
              }}
            />
            <button
              onClick={() => setFavOnly(v => !v)}
              style={{
                padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                borderRadius: 10, whiteSpace: 'nowrap',
                border: `1px solid ${favOnly ? 'var(--ck-purple, #6b5de8)' : 'var(--ck-border2, #e6e1d8)'}`,
                background: favOnly ? 'var(--ck-purple-light, #ede9ff)' : '#fff',
                color: favOnly ? 'var(--ck-purple-dark, #534ab7)' : 'var(--ck-ink2, #6b6577)',
              }}
            >★ Favourites</button>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', padding: '8px 0' }}>
            {loading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ck-ink2, #6b6577)', fontSize: 13 }}>
                Loading contacts…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--ck-ink2, #6b6577)', fontSize: 13 }}>
                {contacts.length === 0
                  ? 'No contacts cached yet. Use "Sync Now" in Integrations first.'
                  : 'No contacts match your search.'}
              </div>
            )}
            {!loading && filtered.map(c => {
              const key = c.rowId || c.resourceName;
              const open = expandedId === key;
              return (
                <div key={key} style={{ borderBottom: '1px solid var(--ck-cream, #f4f0e8)' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(open ? null : key)}
                  >
                    {c.photoUrl
                      ? <img src={c.photoUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <span style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: 'var(--ck-purple-light, #ede9ff)', color: 'var(--ck-purple-dark, #534ab7)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
                        }}>{(c.name || '?').charAt(0).toUpperCase()}</span>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ck-ink, #2b2733)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name || 'Unnamed'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ck-ink2, #6b6577)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.email || c.phone || c.organization || '—'}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); toggleFavorite(c); }}
                      title={c.isFavorite ? 'Remove favourite' : 'Mark favourite'}
                      style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        fontSize: 20, lineHeight: 1, flexShrink: 0,
                        color: c.isFavorite ? '#f5b400' : 'var(--ck-border2, #cfc8bb)',
                      }}
                    >{c.isFavorite ? '★' : '☆'}</button>
                  </div>
                  {open && <ContactDetailBlock contact={c} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
    <span style={{ minWidth: 92, color: 'var(--ck-ink2, #6b6577)', fontWeight: 600 }}>{label}</span>
    <span style={{ flex: 1, color: 'var(--ck-ink, #2b2733)', wordBreak: 'break-word' }}>{children}</span>
  </div>
);

const ContactDetailBlock: React.FC<{ contact: GoogleContact }> = ({ contact }) => {
  const d = contact.details || {};
  const fmt = (v: { value: string; type?: string | null }) => v.type ? `${v.value} (${v.type})` : v.value;
  return (
    <div style={{
      padding: '4px 16px 14px 62px',
      display: 'flex', flexDirection: 'column', gap: 6,
      background: 'var(--ck-cream, #faf7f1)',
    }}>
      {d.nicknames?.length ? <Row label="Nickname">{d.nicknames.join(', ')}</Row> : null}
      {d.emails?.length ? <Row label="Emails">{d.emails.map(fmt).join(', ')}</Row> : (contact.email ? <Row label="Email">{contact.email}</Row> : null)}
      {d.phones?.length ? <Row label="Phones">{d.phones.map(fmt).join(', ')}</Row> : (contact.phone ? <Row label="Phone">{contact.phone}</Row> : null)}
      {d.addresses?.length ? (
        <Row label="Addresses">
          {d.addresses.map((a, i) => (
            <div key={i}>{a.formatted || [a.street, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(', ')}{a.type ? ` (${a.type})` : ''}</div>
          ))}
        </Row>
      ) : null}
      {d.organizations?.length ? (
        <Row label="Work">
          {d.organizations.map((o, i) => (
            <div key={i}>{[o.title, o.name, o.department].filter(Boolean).join(' · ')}</div>
          ))}
        </Row>
      ) : (contact.organization ? <Row label="Work">{contact.organization}</Row> : null)}
      {d.occupations?.length ? <Row label="Occupation">{d.occupations.join(', ')}</Row> : null}
      {contact.birthday ? <Row label="Birthday">{contact.birthday}</Row> : null}
      {contact.anniversary ? <Row label="Anniversary">{contact.anniversary}</Row> : null}
      {d.events?.length ? <Row label="Dates">{d.events.map(e => `${e.type || 'event'}: ${e.date}`).join(', ')}</Row> : null}
      {d.urls?.length ? (
        <Row label="Websites">
          {d.urls.map((u, i) => (
            <div key={i}><a href={u.value} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ck-purple, #6b5de8)' }}>{u.value}</a>{u.type ? ` (${u.type})` : ''}</div>
          ))}
        </Row>
      ) : null}
      {d.relations?.length ? <Row label="Relations">{d.relations.map(r => r.type ? `${r.person} (${r.type})` : r.person).join(', ')}</Row> : null}
      {d.ims?.length ? <Row label="IM">{d.ims.map(i => i.protocol ? `${i.username} (${i.protocol})` : i.username).join(', ')}</Row> : null}
      {d.userDefined?.length ? <Row label="Custom">{d.userDefined.map(u => `${u.key}: ${u.value}`).join(', ')}</Row> : null}
      {contact.notes ? <Row label="Notes">{contact.notes}</Row> : null}
    </div>
  );
};

export default ContactsViewerModal;
