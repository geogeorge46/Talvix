import React, { useState, useEffect } from 'react';

export const CopilotWorkspace: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [compareList, setCompareList] = useState<string[]>([]);

  useEffect(() => {
    // Seed suggested prompts
    setSuggestedPrompts([
      'Find React developers with AWS.',
      'Who is interview ready?',
      'Show candidates lacking Docker.',
      'Compare Jane Doe and Bob Smith.'
    ]);

    // Seed conversations list
    setConversations([
      { id: '1', title: 'React Search Californian Pool', pinned: true },
      { id: '2', title: 'Staff Java Engineers', pinned: false }
    ]);
  }, []);

  const handleSelectSession = (id: string) => {
    setActiveSession(id);
    // Seed initial message history
    setMessages([
      { sender: 'recruiter', text: 'Find React developers with AWS.' },
      {
        sender: 'copilot',
        text: 'I found 2 candidates matching your request: Jane Doe (92% Match) and Alice Johnson (82% Match). Jane Doe holds AWS Cloud Practitioner certifications.',
        intent: 'search_candidates',
        executionPlan: { overallWinner: 'Jane Doe' }
      }
    ]);
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    setSending(true);

    const userMsg = { sender: 'recruiter', text };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      let botResponse = 'I reviewed your request and analyzed the pool. ';
      if (text.includes('Compare')) {
        botResponse += 'Jane Doe is recommended as the overall winner due to leadership and certifications.';
      } else {
        botResponse += 'I matching these parameters to active profiles in your company candidate database.';
      }

      const botMsg = { sender: 'copilot', text: botResponse };
      setMessages(prev => [...prev, botMsg]);
      setSending(false);
    }, 600);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'sans-serif', background: '#F7FAFC' }}>
      {/* Sidebar history */}
      <div style={{ width: '280px', borderRight: '1px solid #E2E8F0', background: '#FFF', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #E2E8F0' }}>
          <button
            onClick={() => {
              setActiveSession(null);
              setMessages([]);
            }}
            style={{ width: '100%', background: '#3182CE', color: '#FFF', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            + New Chat Session
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          <h4 style={{ margin: '0 0 10px', color: '#718096', fontSize: '12px', textTransform: 'uppercase' }}>Recent Chats</h4>
          {conversations.map(c => (
            <div
              key={c.id}
              onClick={() => handleSelectSession(c.id)}
              style={{
                padding: '10px',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '6px',
                background: activeSession === c.id ? '#EBF8FF' : 'transparent',
                color: activeSession === c.id ? '#2B6CB0' : '#4A5568',
                fontWeight: activeSession === c.id ? 'bold' : 'normal'
              }}
            >
              {c.pinned ? '📌 ' : ''}{c.title}
            </div>
          ))}
        </div>
      </div>

      {/* Main Workspace chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Chat message list */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', maxWidth: '500px' }}>
              <h3 style={{ fontSize: '24px', color: '#2D3748', marginBottom: '8px' }}>Recruiter AI Copilot</h3>
              <p style={{ color: '#718096', marginBottom: '24px' }}>
                Ask me natural language questions to search, compare profiles, match constraints, or draft invite summaries.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {suggestedPrompts.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSendMessage(p)}
                    style={{ background: '#FFF', border: '1px solid #E2E8F0', padding: '12px', borderRadius: '6px', textAlign: 'left', cursor: 'pointer', fontSize: '13px', hover: { background: '#EDF2F7' } } as any}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: m.sender === 'recruiter' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '650px',
                    background: m.sender === 'recruiter' ? '#3182CE' : '#FFF',
                    color: m.sender === 'recruiter' ? '#FFF' : '#2D3748',
                    padding: '14px 18px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    lineHeight: '1.4'
                  }}
                >
                  <div style={{ fontSize: '11px', color: m.sender === 'recruiter' ? '#EBF8FF' : '#718096', marginBottom: '4px', fontWeight: 'bold' }}>
                    {m.sender === 'recruiter' ? 'YOU' : 'TALVIX AI COPILOT'}
                  </div>
                  <div style={{ fontSize: '14px' }}>{m.text}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Panel */}
        <div style={{ background: '#FFF', borderTop: '1px solid #E2E8F0', padding: '16px' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
              setInputText('');
            }}
            style={{ display: 'flex', gap: '12px', maxWidth: '800px', margin: '0 auto' }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask the recruiter copilot..."
              style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid #CBD5E0', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={sending}
              style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '0 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {sending ? 'Processing...' : 'Send'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
