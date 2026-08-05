import React, { useState } from 'react';

export const CommunicationCenter: React.FC = () => {
  const [conversations, setConversations] = useState<any[]>([
    { id: '1', title: 'Hiring Team - Senior Node.js position', type: 'group', lastMessage: 'Let\'s finalize the matching candidate' },
    { id: '2', title: 'Jane Doe (Candidate)', type: 'direct', lastMessage: 'I am available for the interview next week.' }
  ]);
  const [activeConv, setActiveConv] = useState<any>(conversations[0]);
  const [messages, setMessages] = useState<any[]>([
    { id: '101', senderName: 'Alice Recruiter', text: 'Hi team, what do we think about Jane\'s matching score?' },
    { id: '102', senderName: 'Bob Manager', text: 'Her technical rating is solid. Let\'s schedule.' }
  ]);
  const [inputText, setInputText] = useState('');

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;

    setMessages(prev => [...prev, { id: String(Date.now()), senderName: 'Me', text: inputText }]);
    setInputText('');
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'sans-serif', background: '#F7FAFC' }}>
      {/* Sidebar - Conversation list */}
      <div style={{ width: '300px', borderRight: '1px solid #E2E8F0', background: '#FFF', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#2D3748' }}>Recruiter Inbox</h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => setActiveConv(conv)}
              style={{
                padding: '16px',
                borderBottom: '1px solid #EDF2F7',
                cursor: 'pointer',
                background: activeConv?.id === conv.id ? '#EBF8FF' : '#FFF',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#2D3748', marginBottom: '4px' }}>{conv.title}</div>
              <div style={{ fontSize: '12px', color: '#718096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {conv.lastMessage}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat layout */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F7FAFC' }}>
        {/* Header */}
        <div style={{ background: '#FFF', padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: '16px', color: '#2D3748' }}>{activeConv?.title}</h4>
          <span style={{ fontSize: '12px', background: '#C6F6D5', color: '#22543D', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>ACTIVE</span>
        </div>

        {/* Messages list */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignSelf: msg.senderName === 'Me' ? 'flex-end' : 'flex-start', maxWidth: '60%' }}>
              <span style={{ fontSize: '11px', color: '#718096', marginBottom: '4px', alignSelf: msg.senderName === 'Me' ? 'flex-end' : 'flex-start' }}>{msg.senderName}</span>
              <div
                style={{
                  background: msg.senderName === 'Me' ? '#3182CE' : '#FFF',
                  color: msg.senderName === 'Me' ? '#FFF' : '#2D3748',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                  lineHeight: '1.4',
                  fontSize: '14px'
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input box */}
        <form onSubmit={sendMessage} style={{ background: '#FFF', padding: '16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '12px' }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message here..."
            style={{ flex: 1, padding: '12px', border: '1px solid #CBD5E0', borderRadius: '6px', outline: 'none', fontSize: '14px' }}
          />
          <button
            type="submit"
            style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '0 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
