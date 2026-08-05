import React, { useState } from 'react';

export const MarketplaceDashboard: React.FC = () => {
  const [plugins, setPlugins] = useState<any[]>([
    { name: 'Workday HRIS Connect', desc: 'Syncs active employee profiles and departments context.', installed: false },
    { name: 'Google Calendar Scheduler', desc: 'Schedules interview slots directly in Gmail diaries.', installed: true },
    { name: 'Slack Alerts Dispatcher', desc: 'Pushes real-time applicant updates to channel rooms.', installed: false }
  ]);

  const toggleInstall = (name: string) => {
    setPlugins(prev => prev.map(p => p.name === name ? { ...p, installed: !p.installed } : p));
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '8px' }}>App Marketplace</h2>
      <p style={{ color: '#718096', fontSize: '14px', marginBottom: '24px' }}>
        Install third-party plugins and enterprise connection adapters to synchronize calendars, HRIS suites, and video rooms.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
        {plugins.map(plugin => (
          <div
            key={plugin.name}
            style={{
              background: '#FFF',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '180px'
            }}
          >
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#2D3748' }}>{plugin.name}</div>
              <div style={{ fontSize: '13px', color: '#718096', marginTop: '8px', lineHeight: '1.4' }}>{plugin.desc}</div>
            </div>

            <button
              onClick={() => toggleInstall(plugin.name)}
              style={{
                width: '100%',
                background: plugin.installed ? '#E53E3E' : '#3182CE',
                color: '#FFF',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px'
              }}
            >
              {plugin.installed ? 'Uninstall' : 'Install App'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
