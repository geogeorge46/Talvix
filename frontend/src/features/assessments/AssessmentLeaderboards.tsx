import { useEffect, useState } from 'react';
import { Card, DataTable, PageHeader, Button } from '../../design-system';

export function AssessmentLeaderboards() {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [benchmarks, setBenchmarks] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [universityFilter, setUniversityFilter] = useState('');
  const [assessmentId, setAssessmentId] = useState('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [lRes, bRes] = await Promise.all([
        fetch(`/api/v1/assessments/manage/${assessmentId || 'all'}/leaderboard?university=${universityFilter}`),
        fetch(`/api/v1/assessments/benchmarking?assessmentId=${assessmentId}`)
      ]);
      
      const lJson = await lRes.json();
      const bJson = await bRes.json();
      
      if (lJson.success) setLeaderboard(lJson.data.leaderboard || []);
      if (bJson.success) setBenchmarks(bJson.data || null);
    } catch (err) {
      console.error('Failed to load leaderboards statistics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [assessmentId, universityFilter]);

  return (
    <div className="as-page">
      <PageHeader
        title="Leaderboards & Benchmarking Analytics"
        description="View rankings, percentile statistics, university reports, and skill distributions."
      />

      <div style={{ display: 'flex', gap: '16px', margin: '20px 0' }}>
        <input
          type="text"
          placeholder="Filter by University"
          value={universityFilter}
          onChange={(e) => setUniversityFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <Button onClick={fetchStats}>Reload Stats</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Candidate Leaderboard table */}
        <Card heading="Candidate Rankings" headingLevel={2}>
          {loading ? (
            <div>Loading rankings...</div>
          ) : (
            <DataTable
              caption="Ranked results"
              rows={leaderboard}
              rowKey={(row) => row.candidateId}
              columns={[
                {
                  id: 'rank',
                  header: 'Rank',
                  render: (row) => <span><strong>#{row.rank}</strong></span>
                },
                {
                  id: 'fullName',
                  header: 'Name',
                  render: (row) => <span>{row.fullName}</span>
                },
                {
                  id: 'score',
                  header: 'Score',
                  render: (row) => <span>{row.score}%</span>
                },
                {
                  id: 'percentile',
                  header: 'Percentile',
                  render: (row) => <span>{row.percentile}th</span>
                },
                {
                  id: 'university',
                  header: 'University',
                  render: (row) => <span>{row.university}</span>
                }
              ]}
            />
          )}
        </Card>

        {/* Benchmarking breakdown details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <Card heading="University Performance Benchmarks" headingLevel={2}>
            {loading || !benchmarks ? (
              <div>Loading benchmarks...</div>
            ) : (
              <DataTable
                caption="University summary details"
                rows={benchmarks.universityPerformance || []}
                rowKey={(row) => row.name}
                columns={[
                  {
                    id: 'name',
                    header: 'University',
                    render: (row) => <span>{row.name}</span>
                  },
                  {
                    id: 'averageScore',
                    header: 'Avg Score',
                    render: (row) => <span>{row.averageScore}%</span>
                  },
                  {
                    id: 'passRate',
                    header: 'Pass Rate',
                    render: (row) => <span>{row.passRate}%</span>
                  }
                ]}
              />
            )}
          </Card>

          <Card heading="Skill Strengths Distribution" headingLevel={2}>
            {loading || !benchmarks ? (
              <div>Loading benchmarks...</div>
            ) : (
              <DataTable
                caption="Skill summary details"
                rows={benchmarks.skillDistribution || []}
                rowKey={(row) => row.skill}
                columns={[
                  {
                    id: 'skill',
                    header: 'Skill Area',
                    render: (row) => <span>{row.skill}</span>
                  },
                  {
                    id: 'averagePercentage',
                    header: 'Avg Proficiency',
                    render: (row) => <span>{row.averagePercentage}%</span>
                  }
                ]}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
