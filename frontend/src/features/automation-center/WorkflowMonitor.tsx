import React, { useState } from 'react';

export const WorkflowMonitor: React.FC = () => {
  const [executions, setExecutions] = useState<any[]>([
    { id: 'ex-101', name: 'Campus Technical Screening', trigger: 'Resume Uploaded', status: 'completed', duration: 1.2, cost: 0.45, date: '2026-08-05' },
    { id: 'ex-102', name: 'Campus Technical Screening', trigger: 'Resume Uploaded', status: 'failed', duration: 0.4, cost: 0.15, date: '2026-08-05' }
  ]);

  const triggerRetry = (id: string) => {
    setExecutions(prev => prev.map(ex => ex.id === id ? { ...ex, status: 'completed', duration: 1.5 } : ex));
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: 'var(--color-text-strong)', marginBottom: '24px' }}>Workflow Execution Monitor</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {executions.map(ex => (
          <div
            key={ex.id}
            style={{
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'var(--color-text-strong)' }}>{ex.name}</div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Trigger: <strong>{ex.trigger}</strong> | Run Duration: <strong>{ex.duration}s</strong> | AI Cost: <strong>${ex.cost}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  padding: '6px 12px',
                  borderRadius: '12px',
                  background: ex.status === 'completed' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  color: ex.status === 'completed' ? 'var(--color-success-fg)' : 'var(--color-danger-fg)',
                  textTransform: 'uppercase'
                }}
              >
                {ex.status}
              </span>
              {ex.status === 'failed' && (
                <button
                  onClick={() => triggerRetry(ex.id)}
                  style={{ background: 'var(--color-action-primary)', color: 'var(--color-text-inverse)', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  Retry Execution
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
