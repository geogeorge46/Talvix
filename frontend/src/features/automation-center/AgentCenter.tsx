import React, { useState } from 'react';

export const AgentCenter: React.FC = () => {
  const [activeAgent, setActiveAgent] = useState('Recruiting');
  const [instruction, setInstruction] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const triggerAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction) return;

    setLoading(true);
    setTimeout(() => {
      setLogs(prev => [
        `[${new Date().toLocaleTimeString()}] Agent ${activeAgent} processed instruction: "${instruction}"`,
        `[${new Date().toLocaleTimeString()}] Decision: Shortlist Candidate & Schedule Assessment.`,
        ...prev
      ]);
      setInstruction('');
      setLoading(false);
    }, 1000);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'sans-serif', background: '#F7FAFC' }}>
      {/* Sidebar - Agents selector */}
      <div style={{ width: '280px', borderRight: '1px solid #E2E8F0', background: '#FFF', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#2D3748' }}>Agent Cockpit</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['Recruiting', 'Interview', 'Analytics', 'Compliance', 'Communication'].map(agent => (
            <div
              key={agent}
              onClick={() => setActiveAgent(agent)}
              style={{
                padding: '12px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeAgent === agent ? '#EBF8FF' : '#FFF',
                color: activeAgent === agent ? '#2B6CB0' : '#4A5568',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
            >
              {agent} Agent
            </div>
          ))}
        </div>
      </div>

      {/* Main console logger */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <h4 style={{ margin: '0 0 16px', fontSize: '16px', color: '#2D3748' }}>Instruct {activeAgent} Agent</h4>
          <form onSubmit={triggerAgent} style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={`e.g. "Screen all newly uploaded resume profiles for TypeScript compatibility..."`}
              style={{ flex: 1, padding: '12px', border: '1px solid #CBD5E0', borderRadius: '6px', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '0 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loading ? 'Processing...' : 'Execute'}
            </button>
          </form>
        </div>

        {/* Real-time output logs terminal */}
        <div style={{ flex: 1, background: '#2D3748', color: '#FFF', borderRadius: '8px', padding: '24px', fontFamily: 'monospace', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ borderBottom: '1px solid #4A5568', paddingBottom: '10px', color: '#A0AEC0', fontSize: '13px' }}>
            Autonomous Agent Terminal Outputs
          </div>
          {logs.length > 0 ? (
            logs.map((log, i) => (
              <div key={i} style={{ fontSize: '13px', lineHeight: '1.4', color: log.includes('Decision') ? '#48BB78' : '#FFF' }}>
                {log}
              </div>
            ))
          ) : (
            <div style={{ color: '#718096', fontSize: '13px' }}>Console idle. Awaiting instruction input triggers...</div>
          )}
        </div>
      </div>
    </div>
  );
};
