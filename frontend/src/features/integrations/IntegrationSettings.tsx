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
        <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '8px' }}>Integration Settings</h2>
        <p style={{ color: '#718096', fontSize: '14px' }}>Configure API keys, public webhooks, and HRIS integrations.</p>
      </div>

      {/* HRIS panel */}
      <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 8px', color: '#2D3748', fontSize: '18px' }}>HRIS Connector</h3>
        <p style={{ color: '#718096', fontSize: '13px', margin: '0 0 16px' }}>Status: <strong style={{ color: hrisStatus.includes('Connected') ? '#38A169' : '#E53E3E' }}>{hrisStatus}</strong></p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['Workday', 'BambooHR', 'SAP SuccessFactors'].map(provider => (
            <button
              key={provider}
              onClick={() => connectHRIS(provider)}
              style={{ background: '#F7FAFC', border: '1px solid #CBD5E0', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#4A5568' }}
            >
              Connect {provider}
            </button>
          ))}
        </div>
      </div>

      {/* API Keys panel */}
      <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 8px', color: '#2D3748', fontSize: '18px' }}>Developer API Access</h3>
        <p style={{ color: '#718096', fontSize: '13px', margin: '0 0 16px' }}>Generate secure authentication keys for client connections.</p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button onClick={generateKey} style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            Generate API Key
          </button>
          {apiKey && (
            <code style={{ background: '#EDF2F7', padding: '10px', borderRadius: '4px', fontSize: '14px', flex: 1, border: '1px solid #E2E8F0', color: '#2C5282' }}>
              {apiKey}
            </code>
          )}
        </div>
      </div>

      {/* Webhooks panel */}
      <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
        <h3 style={{ margin: '0 0 8px', color: '#2D3748', fontSize: '18px' }}>Webhooks Dispatcher</h3>
        <p style={{ color: '#718096', fontSize: '13px', margin: '0 0 16px' }}>Receive real-time candidate notifications at external endpoints.</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-api.com/webhooks"
            style={{ flex: 1, padding: '10px', border: '1px solid #CBD5E0', borderRadius: '6px', outline: 'none' }}
          />
          <button style={{ background: '#38A169', color: '#FFF', border: 'none', padding: '0 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
            Save Endpoint
          </button>
        </div>
      </div>
    </div>
  );
};
