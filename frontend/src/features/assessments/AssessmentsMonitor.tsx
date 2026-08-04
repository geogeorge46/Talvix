import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, DataTable, StatusTag, Button, PageHeader } from '../../design-system';

export function AssessmentsMonitor() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Poll or SSE connection logic
  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const res = await fetch(`/api/v1/assessments/manage/${assessmentId}/active-attempts`);
        const json = await res.json();
        if (json.success) {
          setAttempts(json.data.attempts);
        }
      } catch (err) {
        console.error('Failed to load active attempts', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttempts();

    // Listen to SSE broadcasts for dynamic live updates
    const eventSource = new EventSource('/api/v1/realtime/stream');
    eventSource.addEventListener('assessment_activity', (e: any) => {
      const activity = JSON.parse(e.data);
      setAttempts(prev => {
        return prev.map(item => {
          if (item.id === activity.attemptId) {
            return {
              ...item,
              cheatingRiskScore: activity.cheatingRiskScore ?? item.cheatingRiskScore,
              status: activity.eventType === 'submitted' ? 'completed' : item.status,
              saveCount: activity.eventType === 'autosave' ? item.saveCount + 1 : item.saveCount
            };
          }
          return item;
        });
      });
    });

    return () => {
      eventSource.close();
    };
  }, [assessmentId]);

  return (
    <div className="as-page">
      <PageHeader
        title="Assessment Live Monitor"
        description="Monitor active candidates, cheating risk alerts, and completion status in real-time."
      />

      <Card heading="Active Attempt Instances" headingLevel={2}>
        {loading ? (
          <div>Loading attempts...</div>
        ) : (
          <DataTable
            caption="Active attempt details"
            rows={attempts}
            rowKey={(row) => row.id}
            columns={[
              {
                id: 'candidate',
                header: 'Candidate',
                render: (row) => (
                  <div>
                    <strong>{row.candidate?.fullName || 'Anonymous'}</strong>
                    <br />
                    <small>{row.candidate?.email || 'N/A'}</small>
                  </div>
                )
              },
              {
                id: 'status',
                header: 'Status',
                render: (row) => (
                  <StatusTag tone={row.status === 'completed' ? 'success' : 'warning'}>
                    {row.status}
                  </StatusTag>
                )
              },
              {
                id: 'cheatingRiskScore',
                header: 'Cheating Risk Score',
                render: (row) => (
                  <strong style={{ color: row.cheatingRiskScore >= 50 ? '#dc2626' : '#16a34a' }}>
                    {row.cheatingRiskScore} / 100
                  </strong>
                )
              },
              {
                id: 'saveCount',
                header: 'Save Ticks',
                render: (row) => <span>{row.saveCount} saves</span>
              },
              {
                id: 'actions',
                header: 'Reports',
                render: (row) => (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      className="tvx-button tvx-button--secondary"
                      href={`/api/v1/assessments/attempts/${row.id}/report/html`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Report
                    </a>
                  </div>
                )
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
