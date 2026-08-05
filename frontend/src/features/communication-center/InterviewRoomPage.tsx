import React, { useState } from 'react';

export const InterviewRoomPage: React.FC = () => {
  const [meetingActive, setMeetingActive] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const toggleMeeting = () => {
    setMeetingActive(prev => !prev);
  };

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput) return;

    setNotes(prev => [...prev, noteInput]);
    setNoteInput('');
  };

  const triggerAISummary = () => {
    setLoadingSummary(true);
    setTimeout(() => {
      setAiSummary({
        highlights: ['Jane has high proficiency in TypeScript and microservices architecture.'],
        strengths: ['Analytical mindset', 'Excellent communication skills'],
        concerns: ['Availability is subject to a 60-day notice period.'],
        actionItems: ['Send coding challenges feedback', 'Organize manager review round']
      });
      setLoadingSummary(false);
    }, 1000);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'sans-serif', background: '#F7FAFC' }}>
      {/* Video workspace area */}
      <div style={{ flex: 2, padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF', padding: '16px 24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#2D3748' }}>Video Interview Room Lobbies</h3>
          <button
            onClick={toggleMeeting}
            style={{
              background: meetingActive ? '#E53E3E' : '#38A169',
              color: '#FFF',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {meetingActive ? 'End Call' : 'Join Call'}
          </button>
        </div>

        {meetingActive ? (
          <div style={{ flex: 1, background: '#2D3748', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#FFF', position: 'relative' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>Active WebRTC Stream</div>
              <span style={{ fontSize: '14px', color: '#CBD5E0' }}>Recruiter (You) ↔ Jane Doe (Candidate)</span>
            </div>
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px' }}>
              00:12:45
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, border: '2px dashed #CBD5E0', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#718096', background: '#FFF' }}>
            Click "Join Call" above to launch the secure video interview lobby.
          </div>
        )}
      </div>

      {/* Note side sheets */}
      <div style={{ width: '400px', borderLeft: '1px solid #E2E8F0', background: '#FFF', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid #E2E8F0' }}>
          <h4 style={{ margin: 0, fontSize: '16px', color: '#2D3748' }}>Interview Notes & AI summary</h4>
        </div>

        {/* Note input form */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <form onSubmit={addNote} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#4A5568', fontWeight: 'bold' }}>Add Shared/Private Comments</label>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Type evaluation notes or scoring metrics..."
              rows={4}
              style={{ width: '100%', padding: '10px', border: '1px solid #CBD5E0', borderRadius: '4px', outline: 'none' }}
            />
            <button
              type="submit"
              style={{ background: '#319795', color: '#FFF', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Add Note
            </button>
          </form>

          {/* List of notes */}
          {notes.length > 0 && (
            <div>
              <h5 style={{ margin: '0 0 10px', color: '#4A5568' }}>Interviewer Notes</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notes.map((n, i) => (
                  <div key={i} style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '6px', fontSize: '13px', color: '#2D3748' }}>
                    {n}
                  </div>
                ))}
              </div>
            </div>
          )}

          <hr style={{ border: '0', borderTop: '1px solid #E2E8F0', margin: '10px 0' }} />

          {/* AI summaries generation */}
          <div>
            <button
              onClick={triggerAISummary}
              disabled={loadingSummary}
              style={{ width: '100%', background: '#3182CE', color: '#FFF', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loadingSummary ? 'Compiling discussion notes...' : 'Generate AI Summary'}
            </button>

            {aiSummary && (
              <div style={{ marginTop: '16px', background: '#F0FFF4', border: '1px solid #C6F6D5', padding: '16px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <h6 style={{ margin: '0 0 4px', color: '#22543D', fontSize: '13px' }}>Highlights</h6>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#2F855A' }}>
                    {aiSummary.highlights.map((h: string, i: number) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
                <div>
                  <h6 style={{ margin: '0 0 4px', color: '#22543D', fontSize: '13px' }}>Action Items</h6>
                  <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#2F855A' }}>
                    {aiSummary.actionItems.map((a: string, i: number) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
