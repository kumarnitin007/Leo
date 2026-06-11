import React, { useState, lazy, Suspense } from 'react';
import HistoryView from './HistoryView';
import MonthlyView from './MonthlyView';
import InsightsView from './InsightsView';

const AIHistoryView = lazy(() => import('./components/ai/AIHistoryView'));
const FitnessAnalyticsPanel = lazy(() => import('./components/FitnessAnalyticsPanel'));

type AnalyticsTab = 'history' | 'monthly' | 'insights' | 'ai' | 'fitness';

const ANALYTICS_TAB_KEY = 'myday_analytics_tab';

const AnalyticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(() => {
    const saved = localStorage.getItem(ANALYTICS_TAB_KEY) as AnalyticsTab | null;
    return saved && ['history', 'monthly', 'insights', 'ai', 'fitness'].includes(saved) ? saved : 'insights';
  });

  const selectTab = (tab: AnalyticsTab) => {
    setActiveTab(tab);
    localStorage.setItem(ANALYTICS_TAB_KEY, tab);
  };

  return (
    <div className="ck-screen analytics-view">
      <div className="ck-page-head">
        <div>
          <h2 className="ck-page-title">Analytics &amp; Reports</h2>
          <p className="ck-page-sub">Insights, history, calendar, fitness & AI usage</p>
        </div>
      </div>

      <div className="ck-subtabs" style={{ marginBottom: '18px' }}>
        <button className={`ck-subtab ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => selectTab('insights')}>📈 Insights</button>
        <button className={`ck-subtab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => selectTab('history')}>📜 History</button>
        <button className={`ck-subtab ${activeTab === 'monthly' ? 'active' : ''}`} onClick={() => selectTab('monthly')}>📅 Calendar</button>
        <button className={`ck-subtab ${activeTab === 'fitness' ? 'active' : ''}`} onClick={() => selectTab('fitness')}>🏃 Fitness</button>
        <button className={`ck-subtab ${activeTab === 'ai' ? 'active' : ''}`} onClick={() => selectTab('ai')}>🤖 AI</button>
      </div>

      <div className="sub-tab-content">
        {activeTab === 'insights' && <InsightsView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'monthly' && <MonthlyView />}
        {activeTab === 'fitness' && (
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading Fitness...</div>}>
            <FitnessAnalyticsPanel />
          </Suspense>
        )}
        {activeTab === 'ai' && (
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading AI History...</div>}>
            <AIHistoryView />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;

