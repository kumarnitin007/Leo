/**
 * ContactTypeahead
 *
 * Reusable dropdown component for searching and selecting Google Contacts.
 * Can be embedded in Task forms, Event forms, Group invites, etc.
 *
 * Usage:
 *   <ContactTypeahead
 *     onSelect={(contact) => setAssignee(contact.name)}
 *     placeholder="Search contacts..."
 *   />
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGoogleContacts } from '../integrations/google/hooks/useGoogleContacts';
import { useGoogleAuth } from '../integrations/google/hooks/useGoogleAuth';
import type { GoogleContact } from '../integrations/google/types/contacts.types';

interface ContactTypeaheadProps {
  onSelect: (contact: GoogleContact) => void;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const ContactTypeahead: React.FC<ContactTypeaheadProps> = ({
  onSelect,
  placeholder = 'Search contacts...',
  value = '',
  disabled = false,
  style,
}) => {
  const { isContactsConnected } = useGoogleAuth();
  const { searchContacts } = useGoogleContacts();
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GoogleContact[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    setHighlightIdx(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      const matches = await searchContacts(text);
      setResults(matches);
      setOpen(matches.length > 0);
    }, 250);
  }, [searchContacts]);

  const handleSelect = (contact: GoogleContact) => {
    setQuery(contact.name || contact.email || '');
    setOpen(false);
    onSelect(contact);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  if (!isContactsConnected) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%', padding: '6px 10px', fontSize: 13,
          border: '1px solid #D1D5DB', borderRadius: 8,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
          marginTop: 4,
        }}>
          {results.map((c, i) => (
            <button
              key={c.resourceName}
              onClick={() => handleSelect(c)}
              onMouseEnter={() => setHighlightIdx(i)}
              style={{
                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
                background: highlightIdx === i ? '#F3F4F6' : 'transparent',
                fontSize: 13,
              }}
            >
              {c.photoUrl ? (
                <img src={c.photoUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#6B7280', flexShrink: 0 }}>
                  {(c.name || '?')[0].toUpperCase()}
                </span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name || '(no name)'}
                </div>
                {(c.email || c.phone) && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.email || c.phone}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactTypeahead;
