/**
 * Tag Analytics Component
 * 
 * Shows tracking statistics for trackable tags
 * - Monthly counts for each trackable tag
 * - Visual bar charts
 * - Trend indicators
 * - Useful for tracking habits and patterns
 */

import React, { useState, useEffect } from 'react';
import { Tag, JournalEntry } from '../types';
import { getTags, getJournalEntries } from '../storage';

interface TagCount {
  tag: Tag;
  counts: { [month: string]: number }; // Format: "YYYY-MM"
  total: number;
}

interface MonthData {
  month: string;
  displayMonth: string;
  tags: { [tagId: string]: number };
}

const TagAnalytics: React.FC = () => {
  const [tagCounts, setTagCounts] = useState<TagCount[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('6m');

  useEffect(() => {
    calculateTagAnalytics();
  }, [selectedPeriod]);

  const calculateTagAnalytics = async () => {
    try {
      const allTags = await getTags();
      const trackableTags = allTags.filter(tag => tag.trackable);
      
      if (trackableTags.length === 0) {
        setTagCounts([]);
        setMonthlyData([]);
        return;
      }

      const journalEntries = await getJournalEntries();
    
    // Determine how many months back to analyze
    const monthsBack = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12;
    const today = new Date();
    const months: MonthData[] = [];
    
    // Generate month list
    for (let i = 0; i < monthsBack; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const displayMonth = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      months.unshift({
        month: monthKey,
        displayMonth,
        tags: {}
      });
    }

    // Count tags per month
    const tagCountsMap: { [tagId: string]: { [month: string]: number } } = {};
    
    trackableTags.forEach(tag => {
      tagCountsMap[tag.id] = {};
      months.forEach(m => {
        tagCountsMap[tag.id][m.month] = 0;
      });
    });

    journalEntries.forEach(entry => {
      if (!entry.tags || entry.tags.length === 0) return;
      
      const entryDate = new Date(entry.date);
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
      
      entry.tags.forEach(tagId => {
        if (trackableTags.find(t => t.id === tagId)) {
          if (tagCountsMap[tagId] && tagCountsMap[tagId][monthKey] !== undefined) {
            tagCountsMap[tagId][monthKey]++;
          }
        }
      });
    });

    // Populate monthly data
    months.forEach(monthData => {
      trackableTags.forEach(tag => {
        monthData.tags[tag.id] = tagCountsMap[tag.id][monthData.month] || 0;
      });
    });

    // Create tag counts array
    const counts: TagCount[] = trackableTags.map(tag => {
      const counts = tagCountsMap[tag.id];
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      return {
        tag,
        counts,
        total
      };
    });

    setTagCounts(counts);
    setMonthlyData(months);
    } catch (error) {
      console.error('Error calculating tag analytics:', error);
      setTagCounts([]);
      setMonthlyData([]);
    }
  };

  const getMaxCount = () => {
    let max = 0;
    monthlyData.forEach(month => {
      Object.values(month.tags).forEach(count => {
        if (count > max) max = count;
      });
    });
    return max || 1; // Prevent division by zero
  };

  if (tagCounts.length === 0) {
    return (
      <div className="tag-analytics">
        <h3>📊 Tag Analytics</h3>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          color: '#9ca3af'
        }}>
          <p>No trackable tags yet.</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Create tags and mark them as "Trackable" in the Tags Manager to see analytics here.
          </p>
        </div>
      </div>
    );
  }

  const maxCount = getMaxCount();

  return (
    <div className="tag-analytics">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h3 style={{ margin: 0, color: 'white', fontSize: '1.5rem' }}>📊 Tag Analytics</h3>
          <p style={{ margin: '0.25rem 0 0 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
            Track your habits and patterns over time
          </p>
        </div>
        <div className="period-selector">
          <button
            className={`period-btn ${selectedPeriod === '3m' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('3m')}
          >
            3 Months
          </button>
          <button
            className={`period-btn ${selectedPeriod === '6m' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('6m')}
          >
            6 Months
          </button>
          <button
            className={`period-btn ${selectedPeriod === '12m' ? 'active' : ''}`}
            onClick={() => setSelectedPeriod('12m')}
          >
            12 Months
          </button>
        </div>
      </div>

      {/* Tag Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {tagCounts.map(({ tag, counts, total }) => {
          const monthCounts = Object.values(counts);
          const avgPerMonth = total / monthlyData.length;
          const lastMonth = monthCounts[monthCounts.length - 1] || 0;
          const prevMonth = monthCounts[monthCounts.length - 2] || 0;
          const trend = lastMonth > prevMonth ? 'up' : lastMonth < prevMonth ? 'down' : 'stable';

          return (
            <div
              key={tag.id}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                borderLeft: `4px solid ${tag.color}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    color: '#1f2937',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        background: tag.color,
                        display: 'inline-block'
                      }}
                    />
                    {tag.name}
                  </h4>
                  {tag.description && (
                    <p style={{
                      margin: '0.25rem 0 0 1.25rem',
                      fontSize: '0.85rem',
                      color: '#6b7280',
                      fontStyle: 'italic'
                    }}>
                      {tag.description}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: tag.color
                }}>
                  {total}
                </span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.85rem',
                  color: '#6b7280',
                  marginBottom: '0.5rem'
                }}>
                  <span>Avg: {avgPerMonth.toFixed(1)}/month</span>
                  <span>
                    {trend === 'up' && '📈 Increasing'}
                    {trend === 'down' && '📉 Decreasing'}
                    {trend === 'stable' && '➡️ Stable'}
                  </span>
                </div>

                {/* Mini bar chart */}
                <div style={{
                  display: 'flex',
                  gap: '2px',
                  height: '40px',
                  alignItems: 'flex-end'
                }}>
                  {Object.entries(counts).map(([month, count]) => (
                    <div
                      key={month}
                      style={{
                        flex: 1,
                        background: tag.color,
                        height: `${(count / maxCount) * 100}%`,
                        minHeight: count > 0 ? '4px' : '0',
                        borderRadius: '2px 2px 0 0',
                        opacity: 0.7,
                        transition: 'all 0.3s'
                      }}
                      title={`${month}: ${count}`}
                    />
                  ))}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
                gap: '0.5rem',
                fontSize: '0.75rem',
                color: '#9ca3af'
              }}>
                {monthlyData.slice(-3).map(monthData => (
                  <div key={monthData.month} style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: tag.color }}>
                      {monthData.tags[tag.id] || 0}
                    </div>
                    <div>{monthData.displayMonth.split(' ')[0]}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Timeline */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h4 style={{ margin: '0 0 1.5rem 0', color: '#1f2937' }}>Monthly Timeline</h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{
                  textAlign: 'left',
                  padding: '0.75rem',
                  color: '#6b7280',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>
                  Tag
                </th>
                {monthlyData.map(month => (
                  <th
                    key={month.month}
                    style={{
                      padding: '0.75rem',
                      color: '#6b7280',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      textAlign: 'center'
                    }}
                  >
                    {month.displayMonth}
                  </th>
                ))}
                <th style={{
                  textAlign: 'center',
                  padding: '0.75rem',
                  color: '#6b7280',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {tagCounts.map(({ tag, counts, total }) => (
                <tr key={tag.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          background: tag.color,
                          display: 'inline-block'
                        }}
                      />
                      <span style={{ fontSize: '0.875rem', color: '#1f2937' }}>{tag.name}</span>
                    </div>
                  </td>
                  {monthlyData.map(month => {
                    const count = month.tags[tag.id] || 0;
                    return (
                      <td
                        key={month.month}
                        style={{
                          padding: '0.75rem',
                          textAlign: 'center',
                          fontSize: '0.875rem',
                          fontWeight: count > 0 ? 600 : 400,
                          color: count > 0 ? tag.color : '#d1d5db'
                        }}
                      >
                        {count || '-'}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '0.75rem',
                    textAlign: 'center',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: tag.color
                  }}>
                    {total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TagAnalytics;

