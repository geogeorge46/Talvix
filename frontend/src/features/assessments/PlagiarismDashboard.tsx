import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, DataTable, StatusTag, Button, PageHeader } from '../../design-system';

export function PlagiarismDashboard() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/v1/assessments/manage/${assessmentId}/plagiarism`);
      const json = await res.json();
      if (json.success) {
        setReport(json.data.report);
      }
    } catch (err) {
      console.error('Failed to load plagiarism report', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerScan = async () => {
    try {
      setLoading(true);
      await fetch(`/api/v1/assessments/manage/${assessmentId}/plagiarism/scan`, { method: 'POST' });
      await fetchReport();
    } catch (err) {
      console.error('Failed to scan for plagiarism', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [assessmentId]);

  return (
    <div className="as-page">
      <PageHeader
        title="Plagiarism Analysis Dashboard"
        description="Verify candidate submission codes for structural anomalies, copied logic, and token similarities."
        primaryAction={
          <Button onClick={triggerScan} loading={loading}>
            Run Plagiarism Scan
          </Button>
        }
      />

      <Card heading="Flagged Plagiarism Pairs" headingLevel={2}>
        {loading ? (
          <div>Analyzing code similarities...</div>
        ) : (
          <DataTable
            caption="Similarity scan overview"
            rows={report}
            rowKey={(row) => row._id}
            columns={[
              {
                id: 'question',
                header: 'Question',
                render: (row) => <span>{row.question?.title || 'Unknown Question'}</span>
              },
              {
                id: 'candidateA',
                header: 'Candidate A',
                render: (row) => <span>{row.candidateA?.fullName || 'N/A'}</span>
              },
              {
                id: 'candidateB',
                header: 'Candidate B',
                render: (row) => <span>{row.candidateB?.fullName || 'N/A'}</span>
              },
              {
                id: 'similarityScore',
                header: 'Similarity',
                render: (row) => (
                  <strong style={{ color: row.similarityScore >= 80 ? '#dc2626' : '#ea580c' }}>
                    {row.similarityScore}%
                  </strong>
                )
              },
              {
                id: 'riskLevel',
                header: 'Risk Level',
                render: (row) => {
                  const tone = row.similarityScore >= 80 ? 'danger' : 'warning';
                  const text = row.similarityScore >= 80 ? 'HIGH' : 'MEDIUM';
                  return <StatusTag tone={tone}>{text}</StatusTag>;
                }
              }
            ]}
          />
        )}
      </Card>
    </div>
  );
}
