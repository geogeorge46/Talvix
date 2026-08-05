import React, { useState } from 'react';

export const SecurityComplianceCenter: React.FC = () => {
  const [incidents, setIncidents] = useState<any[]>([
    { id: 'inc-90', severity: 'critical', category: 'Failed MFA Attempts', desc: 'Multiple credential locking blocks on recruiter terminal IP.', status: 'open' },
    { id: 'inc-91', severity: 'medium', category: 'Geo-location Anomaly', desc: 'Active session mismatch reported from remote IP coordinates.', status: 'investigating' }
  ]);

  const resolveIncident = (id: string) => {
    setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status: 'resolved' } : inc));
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '8px' }}>Security & Compliance Center</h2>
        <p style={{ color: '#718096', fontSize: '14px' }}>Monitor platform threat logs, immutable audit trails, and SOC2 regulation statuses.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Threats Incidents Panel */}
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#2D3748', fontSize: '18px' }}>Active Threat Incidents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {incidents.map(inc => (
              <div
                key={inc.id}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '16px',
                  background: inc.status === 'resolved' ? '#FFF' : '#FFF5F5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#2D3748' }}>{inc.category}</div>
                  <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px', lineHeight: '1.4' }}>{inc.desc}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: inc.status === 'resolved' ? '#C6F6D5' : '#FED7D7',
                      color: inc.status === 'resolved' ? '#22543D' : '#9B2C2C',
                      textTransform: 'uppercase'
                    }}
                  >
                    {inc.status}
                  </span>
                  {inc.status !== 'resolved' && (
                    <button
                      onClick={() => resolveIncident(inc.id)}
                      style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SOC2 compliance audit card */}
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: '#2D3748', fontSize: '18px' }}>Compliance Regulation Audit</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#EBF8FF', padding: '16px', borderRadius: '6px', border: '1px solid #BEE3F8' }}>
              <div style={{ fontWeight: 'bold', color: '#2B6CB0', fontSize: '15px' }}>GDPR compliance status</div>
              <div style={{ fontSize: '13px', color: '#4A5568', marginTop: '6px', lineHeight: '1.4' }}>Active data deletion triggers and consent records mapped successfully.</div>
            </div>
            <div style={{ background: '#EBF8FF', padding: '16px', borderRadius: '6px', border: '1px solid #BEE3F8' }}>
              <div style={{ fontWeight: 'bold', color: '#2B6CB0', fontSize: '15px' }}>SOC 2 compliance status</div>
              <div style={{ fontSize: '13px', color: '#4A5568', marginTop: '6px', lineHeight: '1.4' }}>Immutable audit log collections active. Export timelines enabled.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
