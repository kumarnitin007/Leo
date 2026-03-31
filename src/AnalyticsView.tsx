import React, { useState, lazy, Suspense } from 'react';
import HistoryView from './HistoryView';
import MonthlyView from './MonthlyView';
import InsightsView from './InsightsView';

const AIHistoryView = lazy(() => import('./components/ai/AIHistoryView'));
const FitnessAnalyticsPanel = lazy(() => import('./components/FitnessAnalyticsPanel'));

type AnalyticsTab = 'history' | 'monthly' | 'insights' | 'ai' | 'fitness';

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
          📈 Insights
        </button>
        <button
          className={`sub-tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 History
        </button>
        <button
          className={`sub-tab ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          📅 Calendar
        </button>
        <button
          className={`sub-tab ${activeTab === 'fitness' ? 'active' : ''}`}
          onClick={() => setActiveTab('fitness')}
        >
          🏃 Fitness
        </button>
        <button
          className={`sub-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          🤖 AI
        </button>
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

