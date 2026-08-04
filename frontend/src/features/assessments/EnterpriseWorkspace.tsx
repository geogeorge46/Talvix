import { useState, useEffect } from 'react';
import { Card, Button } from '../../design-system';

export function EnterpriseWorkspace() {
  const [fullscreen, setFullscreen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('ws-theme') || 'dark');
  const [candidateNotes, setCandidateNotes] = useState('');
  
  const [leftPanel, setLeftPanel] = useState<string | null>('instructions'); // instructions, jd, resume
  const [showNavigator, setShowNavigator] = useState(true);

  useEffect(() => {
    localStorage.setItem('ws-theme', theme);
  }, [theme]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  return (
    <div 
      className={`enterprise-workspace ${theme === 'dark' ? 'ws-theme-dark' : 'ws-theme-light'}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
        color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
        fontFamily: 'sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* Top Controls Bar */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 24px',
          borderBottom: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`,
          backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <strong style={{ fontSize: '1.2rem' }}>Candidate Evaluation Workspace</strong>
          <span style={{ fontSize: '0.9rem', color: '#10b981' }}>● Active Session</span>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={() => setFocusMode(!focusMode)}>
            {focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          </Button>
          <Button variant="secondary" onClick={toggleFullscreen}>
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>
          <select 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              backgroundColor: theme === 'dark' ? '#334155' : '#f1f5f9',
              color: theme === 'dark' ? '#ffffff' : '#000000',
              border: 'none'
            }}
          >
            <option value="dark">Dark Theme</option>
            <option value="light">Light Theme</option>
          </select>
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Collapsible Left Side panel options */}
        {!focusMode && (
          <div 
            style={{
              width: '60px',
              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
              borderRight: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: '20px',
              gap: '16px'
            }}
          >
            <button 
              onClick={() => setLeftPanel(leftPanel === 'instructions' ? null : 'instructions')}
              style={{ padding: '8px', cursor: 'pointer', background: leftPanel === 'instructions' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px' }}
              title="Instructions"
            >
              📋
            </button>
            <button 
              onClick={() => setLeftPanel(leftPanel === 'jd' ? null : 'jd')}
              style={{ padding: '8px', cursor: 'pointer', background: leftPanel === 'jd' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px' }}
              title="Job Description"
            >
              💼
            </button>
            <button 
              onClick={() => setLeftPanel(leftPanel === 'resume' ? null : 'resume')}
              style={{ padding: '8px', cursor: 'pointer', background: leftPanel === 'resume' ? '#3b82f6' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px' }}
              title="Resume Preview"
            >
              📄
            </button>
          </div>
        )}

        {/* Left Resizable Details View */}
        {leftPanel && !focusMode && (
          <div 
            style={{
              width: '350px',
              borderRight: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
              backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
              padding: '20px',
              overflowY: 'auto'
            }}
          >
            {leftPanel === 'instructions' && (
              <div>
                <h3>Assessment Instructions</h3>
                <ul>
                  <li>Do not leave or switch tabs. Any switches are audited automatically.</li>
                  <li>Autosaving completes in the background.</li>
                  <li>Click submit once all test cases pass.</li>
                </ul>
              </div>
            )}
            {leftPanel === 'jd' && (
              <div>
                <h3>Job Description</h3>
                <p><strong>Role:</strong> Senior Software Engineer (MERN Stack)</p>
                <p><strong>Details:</strong> Build performant, secure, and isolated background processors and APIs for Talvix workflows.</p>
              </div>
            )}
            {leftPanel === 'resume' && (
              <div>
                <h3>Resume Preview</h3>
                <Card heading="John Doe Profile" headingLevel={4}>
                  <p>B.Tech Computer Science from Stanford University</p>
                  <p>Experienced in React, Node, Express, and Mongo databases.</p>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Center Monaco Code Editor Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px' }}>
          <div style={{ flex: 1, backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, paddingBottom: '8px' }}>
              <span>Monaco Code Editor Workspace</span>
              <small>StarterCode loaded successfully</small>
            </div>
            
            <textarea 
              style={{
                flex: 1,
                width: '100%',
                backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
                border: 'none',
                fontFamily: 'monospace',
                fontSize: '14px',
                padding: '12px',
                marginTop: '8px',
                resize: 'none'
              }}
              placeholder="Write your code here..."
              defaultValue={`function solution() {\n  // Implement logic\n}`}
            />
          </div>
          
          {/* Notes Pad */}
          <div style={{ height: '150px', marginTop: '16px', display: 'flex', flexDirection: 'column' }}>
            <strong>Scratchpad & Notes</strong>
            <textarea 
              value={candidateNotes}
              onChange={(e) => setCandidateNotes(e.target.value)}
              placeholder="Jot down notes or algorithm draft thoughts here..."
              style={{
                flex: 1,
                width: '100%',
                backgroundColor: theme === 'dark' ? '#334155' : '#f1f5f9',
                color: theme === 'dark' ? '#fff' : '#000',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                marginTop: '6px',
                resize: 'none'
              }}
            />
          </div>
        </div>

        {/* Right Collapsible Question Navigator */}
        {showNavigator && (
          <div 
            style={{
              width: '240px',
              backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
              borderLeft: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <h3>Questions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {[1, 2, 3, 4].map((num) => (
                <button 
                  key={num}
                  style={{
                    padding: '12px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: num === 1 ? '#3b82f6' : '#94a3b8',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  {num}
                </button>
              ))}
            </div>
            <hr style={{ borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }} />
            <button 
              onClick={() => setShowNavigator(false)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Hide Navigator
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
