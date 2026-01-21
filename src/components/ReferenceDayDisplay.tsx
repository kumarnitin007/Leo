import React, { useState, useEffect } from 'react';
import { getUserVisibleDaysByRange } from '../services/referenceCalendarStorage';
import { UserVisibleDay } from '../types';

interface ReferenceDayDisplayProps {
  startDate?: string;
  endDate?: string;
  layout?: 'list' | 'grid' | 'timeline';
}

export const ReferenceDayDisplay: React.FC<ReferenceDayDisplayProps> = ({
  startDate,
  endDate,
  layout = 'list'
}) => {
  const [visibleDays, setVisibleDays] = useState<UserVisibleDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVisibleDays();
  }, [startDate, endDate]);

  const loadVisibleDays = async () => {
    try {
      setLoading(true);
      setError(null);

      // Default to next 30 days if not specified
      let start = startDate;
      let end = endDate;

      if (!start) {
        const today = new Date();
        start = today.toISOString().split('T')[0];
      }

      if (!end) {
        const endDate = new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000);
        end = endDate.toISOString().split('T')[0];
      }

      const days = await getUserVisibleDaysByRange(start, end);
      setVisibleDays(days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load days');
      console.error('Error loading visible days:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-600 dark:text-gray-400">Loading reference days...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (visibleDays.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        No reference days in the selected date range
      </div>
    );
  }

  const renderListView = () => (
    <div className="space-y-3">
      {visibleDays.map(day => (
        <div
          key={day.id}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
          style={{ borderLeftColor: day.primaryColor || '#6366F1', borderLeftWidth: '4px' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {day.icon && <span className="text-xl">{day.icon}</span>}
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  {day.eventName}
                </h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {new Date(day.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
              {day.significance && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  {day.significance}
                </p>
              )}
              {day.calendarNames && day.calendarNames.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {day.calendarNames.map(calName => (
                    <span
                      key={calName}
                      className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full"
                    >
                      {calName}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="text-right ml-4">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {day.importanceLevel}%
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                in {day.calendarCount} calendar
                {day.calendarCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {visibleDays.map(day => (
        <div
          key={day.id}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
          style={{ borderTopColor: day.primaryColor || '#6366F1', borderTopWidth: '3px' }}
        >
          <div className="mb-2">
            {day.icon && <span className="text-3xl block mb-2">{day.icon}</span>}
            <h4 className="font-semibold text-gray-900 dark:text-white line-clamp-2">
              {day.eventName}
            </h4>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            {new Date(day.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
          {day.significance && (
            <p className="text-xs text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
              {day.significance}
            </p>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {day.calendarCount} calendar{day.calendarCount !== 1 ? 's' : ''}
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {day.importanceLevel}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTimelineView = () => {
    const grouped = visibleDays.reduce(
      (acc, day) => {
        const month = new Date(day.date).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
        if (!acc[month]) acc[month] = [];
        acc[month].push(day);
        return acc;
      },
      {} as Record<string, UserVisibleDay[]>
    );

    return (
      <div className="space-y-8">
        {Object.entries(grouped).map(([month, days]) => (
          <div key={month}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sticky top-0 bg-white dark:bg-gray-900 py-2">
              {month}
            </h3>
            <div className="space-y-3 pl-4 border-l-2 border-gray-300 dark:border-gray-700">
              {days.map(day => (
                <div key={day.id} className="relative">
                  <div
                    className="absolute w-4 h-4 rounded-full -left-6 top-2 border-2 border-gray-300 dark:border-gray-700"
                    style={{ backgroundColor: day.primaryColor || '#6366F1' }}
                  />
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:shadow-md transition">
                    <div className="flex items-start gap-2 mb-1">
                      {day.icon && <span className="text-lg">{day.icon}</span>}
                      <div className="flex-1">
                        <h5 className="font-semibold text-gray-900 dark:text-white text-sm">
                          {day.eventName}
                        </h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(day.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {layout === 'list' && renderListView()}
      {layout === 'grid' && renderGridView()}
      {layout === 'timeline' && renderTimelineView()}
    </div>
  );
};
