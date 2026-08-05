import React, { useState } from 'react';

export const ResumeReviewDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const triggerReview = () => {
    setLoading(true);
    setTimeout(() => {
      setReport({
        atsScore: 85,
        grammarScore: 90,
        formattingScore: 80,
        technicalScore: 88,
        projectScore: 82,
        overallScore: 85,
        strengths: ['Clear project summaries', 'Quantified impacts'],
        weaknesses: ['Vague summary keywords'],
        recommendations: ['Add dynamic skill highlights'],
        missingKeywords: ['Docker', 'Kubernetes'],
        missingSections: ['Certifications']
      });
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>AI Resume Review & Quality Audit</h2>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={triggerReview}
          disabled={loading}
          style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {loading ? 'Evaluating Resume...' : 'Analyze Resume Quality'}
        </button>
      </div>

      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Scorecards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: '#718096', marginBottom: '6px', fontWeight: 'bold' }}>Overall Quality Score</div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#2B6CB0' }}>{report.overallScore}</div>
            </div>
            <div style={{ background: '#FFF', padding: '16px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: '#4A5568' }}>Score Breakdown</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>ATS Score</span><strong>{report.atsScore}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Grammar</span><strong>{report.grammarScore}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Formatting</span><strong>{report.formattingScore}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Technical Fit</span><strong>{report.technicalScore}</strong></div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '18px', color: '#2C5282' }}>Key Audit Results</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: '#38A169' }}>Strengths</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#4A5568' }}>
                    {report.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 8px', color: '#E53E3E' }}>Weaknesses</h4>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#4A5568' }}>
                    {report.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 8px', color: '#D69E2E' }}>Missing Keywords</h4>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {report.missingKeywords.map((k: string, i: number) => (
                    <span key={i} style={{ background: '#FEFCBF', color: '#B7791F', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{k}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
