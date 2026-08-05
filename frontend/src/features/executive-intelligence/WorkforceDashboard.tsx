import React, { useState } from 'react';

export const WorkforceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const generateReport = () => {
    setLoading(true);
    setTimeout(() => {
      setReport({
        aiSummary: 'Hiring funnel velocity is steady. Drop-offs are concentrated in assessments.',
        forecasts: {
          predictedHiringDemand: 15,
          expectedCompletionDays: 25,
          budgetForecastUSD: 5000
        },
        riskAlerts: ['High drop-off in React assessment section'],
        recommendations: ['Shorten React assessments to reduce drop-offs']
      });
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>Workforce Intelligence & AI Forecasts</h2>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={generateReport}
          disabled={loading}
          style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Synthesizing report...' : 'Generate Executive Report'}
        </button>
      </div>

      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Left panel - AI Summary & Alerts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', padding: '20px', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 10px', color: '#92400E' }}>Risk Alerts</h4>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#B45309' }}>
                {report.riskAlerts.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </div>

            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#4A5568' }}>Hiring Forecasts</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Predicted Demand</span><strong>{report.forecasts.predictedHiringDemand} positions</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Estimated Time</span><strong>{report.forecasts.expectedCompletionDays} days</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Budget Forecast</span><strong>${report.forecasts.budgetForecastUSD.toLocaleString()}</strong></div>
              </div>
            </div>
          </div>

          {/* Right panel - Recommendations */}
          <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '18px', color: '#2B6CB0' }}>Executive AI Insights</h3>
            <p style={{ margin: '0 0 20px', color: '#4A5568', fontSize: '14px', lineHeight: '1.5' }}>
              {report.aiSummary}
            </p>

            <h4 style={{ margin: '0 0 10px', color: '#2B6CB0' }}>Actionable Recommendations</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {report.recommendations.map((rec: string, i: number) => (
                <div key={i} style={{ background: '#F7FAFC', borderLeft: '4px solid #3182CE', padding: '12px 16px', borderRadius: '0 6px 6px 0', fontSize: '13px', color: '#2D3748' }}>
                  {rec}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
