import React, { useState } from 'react';

export const CandidateIntelligenceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [intel, setIntel] = useState<any>(null);

  const loadMetrics = () => {
    setLoading(true);
    setTimeout(() => {
      setIntel({
        technicalScore: 88,
        communicationScore: 82,
        assessmentScore: 90,
        resumeScore: 85,
        interviewScore: 80,
        cultureFit: 85,
        learningSpeed: 90,
        overallCandidateRating: 86,
        hiringReadiness: 'ready',
        expectedSalary: 120000,
        expectedNoticePeriodDays: 30,
        hiringRecommendation: 'hire'
      });
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>AI Candidate Intelligence Dashboard</h2>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={loadMetrics}
          disabled={loading}
          style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Compiling Intelligence...' : 'Fetch Candidate Scorecard'}
        </button>
      </div>

      {intel && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Left panel metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#718096', marginBottom: '6px', fontWeight: 'bold' }}>Overall Fit Score</div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#38A169' }}>{intel.overallCandidateRating}%</div>
              <div style={{ marginTop: '12px', background: '#C6F6D5', color: '#22543D', padding: '4px 12px', borderRadius: '20px', display: 'inline-block', fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Recommendation: {intel.hiringRecommendation}
              </div>
            </div>

            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#4A5568' }}>Hiring Overview</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Notice Period</span><strong>{intel.expectedNoticePeriodDays} days</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Expected Salary</span><strong>${intel.expectedSalary.toLocaleString()}/yr</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Job Readiness</span><strong>{intel.hiringReadiness}</strong></div>
              </div>
            </div>
          </div>

          {/* Radar skill distribution mock */}
          <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', color: '#2C5282' }}>Competency Radar Dimensions</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#718096' }}>Technical Aptitude</span>
                <div style={{ background: '#EDF2F7', borderRadius: '4px', height: '10px', marginTop: '6px' }}>
                  <div style={{ background: '#3182CE', width: `${intel.technicalScore}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '13px', color: '#718096' }}>Communication Skill</span>
                <div style={{ background: '#EDF2F7', borderRadius: '4px', height: '10px', marginTop: '6px' }}>
                  <div style={{ background: '#319795', width: `${intel.communicationScore}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '13px', color: '#718096' }}>Assessment Grade</span>
                <div style={{ background: '#EDF2F7', borderRadius: '4px', height: '10px', marginTop: '6px' }}>
                  <div style={{ background: '#319795', width: `${intel.assessmentScore}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '13px', color: '#718096' }}>Culture Compatibility</span>
                <div style={{ background: '#EDF2F7', borderRadius: '4px', height: '10px', marginTop: '6px' }}>
                  <div style={{ background: '#38A169', width: `${intel.cultureFit}%`, height: '100%', borderRadius: '4px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
