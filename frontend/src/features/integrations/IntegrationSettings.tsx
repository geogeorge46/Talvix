import React, { useState } from 'react';

export const IntegrationSettings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hrisStatus, setHrisStatus] = useState('Disconnected');

  const generateKey = () => {
    setApiKey(`tlvx_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`);
  };

  const connectHRIS = (provider: string) => {
    setHrisStatus(`Connected to ${provider}`);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ fontSize: '28px', color: 'var(--color-text-strong)', marginBottom: '8px' }}>Integration Settings</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>Configure API keys, public webhooks, and HRIS integrations.</p>
      </div>

      {/* HRIS panel */}
      <div style={{ background: 'var(--color-surface-1)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-strong)', fontSize: '18px' }}>HRIS Connector</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 16px' }}>Status: <strong style={{ color: hrisStatus.includes('Connected') ? 'var(--color-success-fg)' : 'var(--color-danger-fg)' }}>{hrisStatus}</strong></p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['Workday', 'BambooHR', 'SAP SuccessFactors'].map(provider => (
            <button
              key={provider}
              onClick={() => connectHRIS(provider)}
              style={{ background: 'var(--color-canvas)', border: '1px solid var(--color-border-default)', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: 'var(--color-text-default)' }}
            >
              Connect {provider}
            </button>
          ))}
        </div>
      </div>

      {/* API Keys panel */}
      <div style={{ background: 'var(--color-surface-1)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-strong)', fontSize: '18px' }}>Developer API Access</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 16px' }}>Generate secure authentication keys for client connections.</p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={generateKey} style={{ background: 'var(--color-action-primary)', color: 'var(--color-text-inverse)', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            Generate API Key
          </button>
          {apiKey && (
            <code style={{ background: 'var(--color-surface-2)', padding: '10px', borderRadius: '4px', fontSize: '14px', flex: 1, border: '1px solid var(--color-border-subtle)', color: 'var(--color-info-fg)' }}>
              {apiKey}
            </code>
          )}
        </div>
      </div>

      {/* Webhooks panel */}
      <div style={{ background: 'var(--color-surface-1)', padding: '24px', borderRadius: '8px', border: '1px solid var(--color-border-subtle)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 8px', color: 'var(--color-text-strong)', fontSize: '18px' }}>Webhooks Dispatcher</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: '0 0 16px' }}>Receive real-time candidate notifications at external endpoints.</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-api.com/webhooks"
            style={{ flex: 1, padding: '10px', border: '1px solid var(--color-border-default)', borderRadius: '6px', outline: 'none' }}
          />
          <button style={{ background: 'var(--color-success-fg)', color: 'var(--color-text-inverse)', border: 'none', padding: '0 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            Save Endpoint
          </button>
        </div>
      </div>
    </div>
  );
};
