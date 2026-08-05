import React, { useState } from 'react';

export const AssessmentWorkspace: React.FC = () => {
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedAssessment, setGeneratedAssessment] = useState<any>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription) return;

    setLoading(true);
    setTimeout(() => {
      setGeneratedAssessment({
        title: 'AI Generated Assessment - Senior React developer',
        durationMinutes: 60,
        passingPercentage: 70,
        questions: [
          {
            type: 'single-choice',
            prompt: 'What is the runtime complexity of lookup inside a JavaScript Map?',
            difficulty: 'easy',
            options: [
              { id: 'a', text: 'O(N)' },
              { id: 'b', text: 'O(1)' }
            ]
          },
          {
            type: 'coding',
            prompt: 'Write a function sum(a, b) that returns the sum of two integers.',
            difficulty: 'medium',
            starterCode: 'function sum(a, b) {\n  return a + b;\n}'
          }
        ]
      });
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>AI Assessment & Question Builder</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Generation Request Panel */}
        <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '20px' }}>Generate New Test</h3>
          <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', color: '#4A5568', fontWeight: 'bold' }}>Job Description / Details</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Enter job description or required skills to construct an assessment plan..."
                rows={6}
                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #CBD5E0', outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              {loading ? 'Generating Assessment blueprint...' : 'Generate with AI'}
            </button>
          </form>
        </div>

        {/* Right Blueprint Preview Panel */}
        <div>
          {generatedAssessment ? (
            <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '20px', color: '#2B6CB0' }}>{generatedAssessment.title}</h3>
              <p style={{ margin: '0 0 20px', color: '#718096', fontSize: '14px' }}>
                Duration: {generatedAssessment.durationMinutes} mins | Target: {generatedAssessment.passingPercentage}% passing
              </p>

              <h4 style={{ fontSize: '16px', color: '#4A5568', marginBottom: '12px' }}>Question Blueprint</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {generatedAssessment.questions.map((q: any, idx: number) => (
                  <div key={idx} style={{ background: '#F7FAFC', border: '1px solid #E2E8F0', padding: '14px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', color: '#319795' }}>{q.type}</span>
                      <span style={{ fontSize: '12px', color: '#718096', background: '#E2E8F0', padding: '2px 6px', borderRadius: '4px' }}>{q.difficulty}</span>
                    </div>
                    <p style={{ margin: '0 0 10px', fontSize: '14px', color: '#2D3748', lineHeight: '1.4' }}>{q.prompt}</p>
                    {q.options && q.options.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#4A5568' }}>
                        {q.options.map((opt: any) => (
                          <li key={opt.id}>{opt.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: '#F7FAFC', border: '2px dashed #CBD5E0', padding: '40px', borderRadius: '8px', textAlign: 'center', color: '#718096' }}>
              Submit specifications on the left to preview AI assessment questions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
