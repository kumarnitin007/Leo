import React, { useState } from 'react';
import HistoryView from './HistoryView';
import MonthlyView from './MonthlyView';
import InsightsView from './InsightsView';

type AnalyticsTab = 'history' | 'monthly' | 'insights';

const AnalyticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('insights');

  return (
    <div className="analytics-view">
      <div className="view-header">
        <h2>📊 Analytics & Reports</h2>
      </div>

      <div className="sub-tabs">
        <button
          className={`sub-tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => setActiveTab('insights')}
        >
          📈 Insights & Trends
        </button>
        <button
          className={`sub-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 Daily History
        </button>
        <button
          className={`sub-tab ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          📅 Monthly Calendar
        </button>
      </div>

      <div className="sub-tab-content">
        {activeTab === 'insights' && <InsightsView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'monthly' && <MonthlyView />}
      </div>
    </div>
  );
};

export default AnalyticsView;

