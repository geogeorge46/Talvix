import React, { useState } from 'react';

export const ExecutiveDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);

  const loadData = () => {
    setLoading(true);
    setTimeout(() => {
      setSnapshot({
        funnel: {
          applied: 120,
          screened: 85,
          interviewed: 40,
          offers: 15,
          hired: 12,
          rejected: 8
        },
        metrics: {
          timeToHireDays: 21,
          offerAcceptanceRate: 92,
          assessmentCompletionRate: 78,
          recruiterProductivityScore: 88
        },
        aiSpending: {
          totalTokens: 25000,
          totalCostUSD: 12.50
        }
      });
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>Executive AI Dashboard</h2>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={loadData}
          disabled={loading}
          style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Compiling Metrics...' : 'Load Executive Insights'}
        </button>
      </div>

      {snapshot && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Top Score Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '13px', color: '#718096', fontWeight: 'bold' }}>Average Time-to-Hire</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#2B6CB0', marginTop: '8px' }}>{snapshot.metrics.timeToHireDays} days</div>
            </div>
            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '13px', color: '#718096', fontWeight: 'bold' }}>Offer Acceptance Rate</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#38A169', marginTop: '8px' }}>{snapshot.metrics.offerAcceptanceRate}%</div>
            </div>
            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '13px', color: '#718096', fontWeight: 'bold' }}>Assessment Completion</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#319795', marginTop: '8px' }}>{snapshot.metrics.assessmentCompletionRate}%</div>
            </div>
            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '13px', color: '#718096', fontWeight: 'bold' }}>Total AI Cost</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#E53E3E', marginTop: '8px' }}>${snapshot.aiSpending.totalCostUSD}</div>
            </div>
          </div>

          {/* Funnel chart mock */}
          <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 20px', color: '#2D3748', fontSize: '18px' }}>Hiring Conversion Funnel</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Applied</span><strong>{snapshot.funnel.applied}</strong>
                </div>
                <div style={{ background: '#E2E8F0', height: '16px', borderRadius: '4px' }}>
                  <div style={{ background: '#4299E1', width: '100%', height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Screened</span><strong>{snapshot.funnel.screened}</strong>
                </div>
                <div style={{ background: '#E2E8F0', height: '16px', borderRadius: '4px' }}>
                  <div style={{ background: '#319795', width: `${(snapshot.funnel.screened / snapshot.funnel.applied) * 100}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Interviewed</span><strong>{snapshot.funnel.interviewed}</strong>
                </div>
                <div style={{ background: '#E2E8F0', height: '16px', borderRadius: '4px' }}>
                  <div style={{ background: '#38A169', width: `${(snapshot.funnel.interviewed / snapshot.funnel.applied) * 100}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                  <span>Offers Accepted</span><strong>{snapshot.funnel.hired}</strong>
                </div>
                <div style={{ background: '#E2E8F0', height: '16px', borderRadius: '4px' }}>
                  <div style={{ background: '#48BB78', width: `${(snapshot.funnel.hired / snapshot.funnel.applied) * 100}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
