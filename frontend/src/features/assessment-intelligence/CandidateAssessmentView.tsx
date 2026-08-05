import React, { useState, useEffect } from 'react';

export const CandidateAssessmentView: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes
  const [selectedAnswers, setSelectedAnswers] = useState<string>('');
  const [codeAnswer, setCodeAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Basic countdown timer
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    setCodeAnswer('function sum(a, b) {\n  // Write code here\n  return a + b;\n}');

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '40px auto', textAlign: 'center', background: '#FFF', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#38A169', marginBottom: '16px' }}>Assessment Submitted Successfully</h2>
        <p style={{ color: '#4A5568', lineHeight: '1.5', marginBottom: '24px' }}>
          Your responses have been logged and queued for automatic grading evaluation. The recruiter will notify you of your score breakdown soon.
        </p>
        <div style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 10px', color: '#2B6CB0' }}>AI Recommended Practice Resources:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', textAlign: 'left', fontSize: '14px', color: '#4A5568' }}>
            <li>Advanced Event Loops and Task Queues (MDN)</li>
            <li>System Architecture Principles (O\'Reilly Book)</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', fontFamily: 'sans-serif', background: '#F7FAFC' }}>
      {/* Question sheet */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFF', padding: '16px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#2D3748' }}>JavaScript Developer Assessment Attempt</h3>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#E53E3E' }}>Time Remaining: {formatTime(timeLeft)}</span>
        </div>

        {/* MCQ Question */}
        <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <strong style={{ display: 'block', fontSize: '15px', color: '#4A5568', marginBottom: '12px' }}>
            Question 1: What is the complexity of lookup inside a JavaScript Map?
          </strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="mcq" value="a" onChange={() => setSelectedAnswers('a')} checked={selectedAnswers === 'a'} />
              O(N)
            </label>
            <label style={{ display: 'flex', gap: '8px', cursor: 'pointer' }}>
              <input type="radio" name="mcq" value="b" onChange={() => setSelectedAnswers('b')} checked={selectedAnswers === 'b'} />
              O(1)
            </label>
          </div>
        </div>

        {/* Coding Question */}
        <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <strong style={{ fontSize: '15px', color: '#4A5568' }}>
            Question 2: Coding - Write a function sum(a, b) that returns the sum of two integers.
          </strong>
          <textarea
            value={codeAnswer}
            onChange={(e) => setCodeAnswer(e.target.value)}
            rows={10}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '14px', padding: '12px', border: '1px solid #CBD5E0', borderRadius: '4px', outline: 'none' }}
          />
        </div>
      </div>

      {/* Control panel sidebar */}
      <div style={{ width: '260px', borderLeft: '1px solid #E2E8F0', background: '#FFF', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <h4 style={{ margin: '0 0 16px', color: '#4A5568' }}>Question Navigator</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-block', width: '32px', height: '32px', borderRadius: '4px', background: selectedAnswers ? '#319795' : '#E2E8F0', color: selectedAnswers ? '#FFF' : '#4A5568', textAlign: 'center', lineHeight: '32px', cursor: 'pointer', fontWeight: 'bold' }}>1</span>
            <span style={{ display: 'inline-block', width: '32px', height: '32px', borderRadius: '4px', background: codeAnswer.length > 55 ? '#319795' : '#E2E8F0', color: codeAnswer.length > 55 ? '#FFF' : '#4A5568', textAlign: 'center', lineHeight: '32px', cursor: 'pointer', fontWeight: 'bold' }}>2</span>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          style={{ width: '100%', background: '#38A169', color: '#FFF', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
        >
          Submit Test
        </button>
      </div>
    </div>
  );
};
