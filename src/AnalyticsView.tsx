import React, { useState, lazy, Suspense } from 'react';
import HistoryView from './HistoryView';
import MonthlyView from './MonthlyView';
import InsightsView from './InsightsView';

const AIHistoryView = lazy(() => import('./components/ai/AIHistoryView'));
const FitnessAnalyticsPanel = lazy(() => import('./components/FitnessAnalyticsPanel'));

type AnalyticsTab = 'history' | 'monthly' | 'insights' | 'ai' | 'fitness';

const ANALYTICS_TAB_KEY = 'myday_analytics_tab';

const PANE_META: Record<AnalyticsTab, { icon: string; title: string; subtitle: string }> = {
  insights: { icon: '📈', title: 'Insights', subtitle: 'Performance patterns, trends, and smart recommendations.' },
  history:  { icon: '📜', title: 'History',  subtitle: 'Completion stats, streaks, and progress over time.' },
  monthly:  { icon: '📅', title: 'Calendar', subtitle: 'Month-at-a-glance view of your activity.' },
  fitness:  { icon: '🏃', title: 'Fitness',  subtitle: 'Steps, calories, and activity from your connected providers.' },
  ai:       { icon: '🤖', title: 'AI',       subtitle: 'AI call history, token usage, and projected costs.' },
};

const AnalyticsPane: React.FC<{ tab: AnalyticsTab; children: React.ReactNode }> = ({ tab, children }) => {
  const meta = PANE_META[tab];
  return (
    <div className="ck-pane">
      <div className="ck-pane-head">
        <div>
          <h3 className="ck-pane-title">
            <span>{meta.icon}</span>
            <span>{meta.title}</span>
          </h3>
          <p className="ck-pane-sub">{meta.subtitle}</p>
        </div>
      </div>
      <div className="ck-pane-body">{children}</div>
    </div>
  );
};

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
        {activeTab === 'insights' && (
          <AnalyticsPane tab="insights"><InsightsView /></AnalyticsPane>
        )}
        {activeTab === 'history' && (
          <AnalyticsPane tab="history"><HistoryView /></AnalyticsPane>
        )}
        {activeTab === 'monthly' && (
          <AnalyticsPane tab="monthly"><MonthlyView hideHeader /></AnalyticsPane>
        )}
        {activeTab === 'fitness' && (
          <AnalyticsPane tab="fitness">
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading Fitness...</div>}>
              <FitnessAnalyticsPanel />
            </Suspense>
          </AnalyticsPane>
        )}
        {activeTab === 'ai' && (
          <AnalyticsPane tab="ai">
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading AI History...</div>}>
              <AIHistoryView hideHeader />
            </Suspense>
          </AnalyticsPane>
        )}
      </div>
    </div>
  );
};

export default AnalyticsView;

