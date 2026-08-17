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
        <h2 style={{ fontSize: '28px', color: 'var(--color-text-strong)', marginBottom: '8px' }}>Security & Compliance Center</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Monitor platform threat logs, immutable audit trails, and SOC2 regulation statuses.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Threats Incidents Panel */}
        <div style={{ background: 'var(--color-surface-1)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--color-text-strong)', fontSize: '18px' }}>Active Threat Incidents</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {incidents.map(inc => (
              <div
                key={inc.id}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: '6px',
                  padding: '16px',
                  background: inc.status === 'resolved' ? 'var(--color-surface-1)' : 'var(--color-danger-bg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--color-text-strong)' }}>{inc.category}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', lineHeight: '1.4' }}>{inc.desc}</div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: inc.status === 'resolved' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: inc.status === 'resolved' ? 'var(--color-success-fg)' : 'var(--color-danger-fg)',
                      textTransform: 'uppercase'
                    }}
                  >
                    {inc.status}
                  </span>
                  {inc.status !== 'resolved' && (
                    <button
                      onClick={() => resolveIncident(inc.id)}
                      style={{ background: 'var(--color-action-primary)', color: 'var(--color-text-inverse)', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
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
        <div style={{ background: 'var(--color-surface-1)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: '0 0 16px', color: 'var(--color-text-strong)', fontSize: '18px' }}>Compliance Regulation Audit</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--color-info-bg)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-info-border)' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-info-fg)', fontSize: '15px' }}>GDPR compliance status</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-default)', marginTop: '6px', lineHeight: '1.4' }}>Active data deletion triggers and consent records mapped successfully.</div>
            </div>
            <div style={{ background: 'var(--color-info-bg)', padding: '16px', borderRadius: '6px', border: '1px solid var(--color-info-border)' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-info-fg)', fontSize: '15px' }}>SOC 2 compliance status</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-default)', marginTop: '6px', lineHeight: '1.4' }}>Immutable audit log collections active. Export timelines enabled.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
