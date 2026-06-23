/**
 * Upcoming Contact Dates Widget
 *
 * Dashboard reminder card for contact birthdays & anniversaries pulled from
 * Google Contacts (myday_contacts.birthday / .anniversary). Favourites are
 * pinned to the top. Renders nothing when there are no upcoming dates.
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUpcomingContactDates,
  type UpcomingContactDate,
} from '../integrations/google/services/ContactsService';

const WINDOW_DAYS = 30;

function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  return `in ${daysUntil}d`;
}

const UpcomingContactDatesWidget: React.FC = () => {
  const { user } = useAuth();
  const [dates, setDates] = useState<UpcomingContactDate[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    getUpcomingContactDates(user.id, WINDOW_DAYS)
      .then(setDates)
      .catch(() => setDates([]))
      .finally(() => setLoaded(true));
  }, [user?.id]);

  if (!loaded || dates.length === 0) return null;

  return (
    <div style={{
      background: 'var(--ck-white, #fff)',
      border: '1px solid var(--ck-border2, #e6e1d8)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        background: 'var(--ck-purple-light, #ede9ff)',
        borderBottom: '1px solid var(--ck-border2, #e6e1d8)',
      }}>
        <span style={{ fontSize: 18 }}>🎉</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ck-ink, #2b2733)' }}>
          Upcoming Contact Dates
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ck-ink2, #6b6577)' }}>
          next {WINDOW_DAYS} days
        </span>
      </div>

      <div>
        {dates.map((d, i) => (
          <div
            key={`${d.contactId}-${d.type}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              borderTop: i === 0 ? 'none' : '1px solid var(--ck-cream, #f4f0e8)',
            }}
          >
            <span style={{ fontSize: 18, flexShrink: 0 }}>
              {d.type === 'birthday' ? '🎂' : '💝'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ck-ink, #2b2733)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {d.isFavorite && <span style={{ color: '#f5b400', marginRight: 4 }}>★</span>}
                {d.name || 'Unnamed'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ck-ink2, #6b6577)' }}>
                {d.type === 'birthday' ? 'Birthday' : 'Anniversary'}
                {d.age != null && d.age > 0 ? ` · turns ${d.age}` : ''}
                {' · '}{d.nextDate}
              </div>
            </div>
            <span style={{
              flexShrink: 0,
              fontSize: 11, fontWeight: 700,
              padding: '3px 9px', borderRadius: 999,
              background: d.daysUntil === 0 ? 'var(--ck-purple, #6b5de8)' : 'var(--ck-cream, #f4f0e8)',
              color: d.daysUntil === 0 ? '#fff' : 'var(--ck-ink2, #6b6577)',
            }}>
              {whenLabel(d.daysUntil)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingContactDatesWidget;
