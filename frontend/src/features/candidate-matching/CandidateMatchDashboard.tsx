import React, { useState, useEffect } from 'react';

export const CandidateMatchDashboard: React.FC = () => {
  const [rankings, setRankings] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Seed initial mock data for recruiter matching validation
    setTimeout(() => {
      setRankings([
        {
          rank: 1,
          percentile: 98,
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          match: {
            scores: { overallScore: 92, skillsScore: 95, experienceScore: 88, reasoning: 'Strong hire. Candidate matches technical stacks perfectly.' },
            skillGap: { matchedSkills: ['React', 'Node.js', 'TypeScript'], missingSkills: ['Docker'], learningRoadmap: ['1. Learn Docker core containerization principles'] }
          }
        },
        {
          rank: 2,
          percentile: 85,
          fullName: 'Bob Smith',
          email: 'bob@example.com',
          match: {
            scores: { overallScore: 78, skillsScore: 80, experienceScore: 75, reasoning: 'Average fit. Missing critical cloud parameters.' },
            skillGap: { matchedSkills: ['Node.js'], missingSkills: ['React', 'AWS'], learningRoadmap: ['1. React details', '2. AWS ECS deploy'] }
          }
        }
      ]);
      setLoading(false);
    }, 400);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    setSearching(true);
    setTimeout(() => {
      setSearchResults([
        { fullName: 'Jane Doe', skills: ['React', 'TypeScript'], semanticScore: 0.94 },
        { fullName: 'Alice Johnson', skills: ['React', 'Redux'], semanticScore: 0.82 }
      ]);
      setSearching(false);
    }, 600);
  };

  if (loading) {
    return <div style={{ padding: '24px', color: '#888' }}>Loading candidate matching pool...</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '28px', color: '#2D3748', marginBottom: '24px' }}>AI Candidate Matching Engine</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px' }}>
        {/* Main Panel */}
        <div>
          {/* Natural Language Search */}
          <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '18px' }}>Semantic Natural Language Search</h3>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Find React developers with AWS under 2 years available immediately..."
                style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #CBD5E0' }}
              />
              <button
                type="submit"
                style={{ background: '#3182CE', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}
              >
                {searching ? 'Searching...' : 'AI Search'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div style={{ marginTop: '16px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#4A5568' }}>Search Results</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {searchResults.map((sr, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#F7FAFC', padding: '8px 12px', borderRadius: '4px' }}>
                      <div>
                        <strong>{sr.fullName}</strong>
                        <span style={{ fontSize: '12px', color: '#718096', marginLeft: '10px' }}>{sr.skills.join(', ')}</span>
                      </div>
                      <span style={{ color: '#38A169', fontWeight: 'bold' }}>{Math.round(sr.semanticScore * 100)}% Match</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Rankings Table */}
          <div style={{ background: '#FFF', padding: '24px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '20px' }}>Applicant Rankings</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#718096', fontSize: '14px' }}>
                  <th style={{ padding: '10px 0' }}>Rank</th>
                  <th>Candidate</th>
                  <th>Percentile</th>
                  <th>Overall Match</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((rk) => (
                  <tr key={rk.rank} style={{ borderBottom: '1px solid #EDF2F7', fontSize: '15px' }}>
                    <td style={{ padding: '12px 0', fontWeight: 'bold', color: '#2B6CB0' }}>#{rk.rank}</td>
                    <td>
                      <div><strong>{rk.fullName}</strong></div>
                      <div style={{ fontSize: '12px', color: '#A0AEC0' }}>{rk.email}</div>
                    </td>
                    <td>{rk.percentile}%</td>
                    <td style={{ color: '#38A169', fontWeight: 'bold' }}>{rk.match.scores.overallScore}%</td>
                    <td>
                      <button
                        onClick={() => setSelectedMatch(rk.match)}
                        style={{ background: '#E2E8F0', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Inspect Gap
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar AI Explainability & Gap Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {selectedMatch ? (
            <div style={{ background: '#FFF', padding: '20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', color: '#2C5282' }}>AI Match Explainability</h3>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '14px', color: '#4A5568' }}>AI Reasoning:</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#718096', lineHeight: '1.4' }}>
                  {selectedMatch.scores.reasoning}
                </p>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '14px', color: '#4A5568' }}>Matched Skills:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {selectedMatch.skillGap.matchedSkills.map((sk: string) => (
                    <span key={sk} style={{ background: '#E6FFFA', color: '#319795', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '14px', color: '#4A5568' }}>Missing Skills:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {selectedMatch.skillGap.missingSkills.map((sk: string) => (
                    <span key={sk} style={{ background: '#FFF5F5', color: '#C53030', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                      {sk}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <strong style={{ fontSize: '14px', color: '#4A5568' }}>Learning Roadmap:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '13px', color: '#718096' }}>
                  {selectedMatch.skillGap.learningRoadmap.map((step: string, i: number) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div style={{ background: '#F7FAFC', border: '1px dashed #CBD5E0', padding: '24px', borderRadius: '8px', textAlign: 'center', color: '#718096' }}>
              Select a candidate from applicant rankings to inspect AI match explainability.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
