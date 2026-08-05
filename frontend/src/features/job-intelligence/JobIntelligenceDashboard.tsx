import React, { useState, useEffect } from 'react';

export const JobIntelligenceDashboard: React.FC = () => {
  const [intel, setIntel] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setIntel({
        skills: {
          required: ['TypeScript', 'Node.js', 'Express', 'MongoDB'],
          preferred: ['Redis', 'Docker', 'AWS'],
          soft: ['Problem Solving', 'Communication']
        },
        responsibilities: [
          'Design and maintain robust backend API endpoints.',
          'Coordinate database schemas and data migrations.',
          'Integrate third-party services and AI vendor endpoints.'
        ],
        experience: { minYears: 3, maxYears: 6 },
        location: { country: 'United States', city: 'San Francisco', type: 'hybrid' },
        hiringSummary: 'Looking for a solid mid-level backend engineer experienced in ES Modules and Mongoose.',
        riskFlags: [
          { category: 'Salary Range', message: 'Salary bounds are not specified inside job description.', severity: 'medium' }
        ]
      });
      setVersions([
        { version: 1, createdAt: '2026-08-05T10:00:00Z' }
      ]);
      setLoading(false);
    }, 400);
  }, []);

  if (loading) {
    return <div style={{ padding: '24px', color: '#888' }}>Loading job intelligence...</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>Job Intelligence Dashboard</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
        {/* Main Details Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Summary Card */}
          {intel && (
            <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '20px', color: '#2D3748' }}>AI Hiring Summary</h3>
              <p style={{ color: '#4A5568', lineHeight: '1.6', margin: 0 }}>{intel.hiringSummary}</p>
            </div>
          )}

          {/* Skill Breakdown */}
          {intel && (
            <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px', color: '#2D3748' }}>Skill Breakdown</h3>

              <h4 style={{ fontSize: '14px', color: '#718096', marginBottom: '8px' }}>Required Skills</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
                {intel.skills.required.map((sk: string) => (
                  <span key={sk} style={{ background: '#FEEBC8', color: '#C05621', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500 }}>
                    {sk}
                  </span>
                ))}
              </div>

              <h4 style={{ fontSize: '14px', color: '#718096', marginBottom: '8px' }}>Preferred Skills</h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
                {intel.skills.preferred.map((sk: string) => (
                  <span key={sk} style={{ background: '#E2E8F0', color: '#4A5568', padding: '4px 10px', borderRadius: '16px', fontSize: '13px', fontWeight: 500 }}>
                    {sk}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Risk Flags */}
          {intel && intel.riskFlags.length > 0 && (
            <div style={{ background: '#FFFDF5', border: '1px solid #FEEBC8', padding: '20px', borderRadius: '8px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px', color: '#C05621' }}>AI Risk Indicators</h3>
              {intel.riskFlags.map((risk: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ background: '#DD6B20', color: '#FFF', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    {risk.severity}
                  </span>
                  <p style={{ margin: 0, color: '#744210', fontSize: '14px' }}>
                    <strong>{risk.category}</strong>: {risk.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Info Card */}
          <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Metadata</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <div>
                <span style={{ color: '#718096' }}>Location: </span>
                <span style={{ fontWeight: 500 }}>{intel?.location.city}, {intel?.location.type}</span>
              </div>
              <div>
                <span style={{ color: '#718096' }}>Experience: </span>
                <span style={{ fontWeight: 500 }}>{intel?.experience.minYears} - {intel?.experience.maxYears} Years</span>
              </div>
            </div>
          </div>

          {/* Version History */}
          <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>Version Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {versions.map((ver) => (
                <div key={ver.version} style={{ borderLeft: '3px solid #C05621', paddingLeft: '12px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>Version {ver.version}</div>
                  <div style={{ fontSize: '11px', color: '#A0AEC0', marginTop: '2px' }}>
                    {new Date(ver.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
