import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  PageHeader,
  TextArea,
  StatusTag
} from '../../design-system';
import { useGenerateAIAssessment } from '../assessments/api';
import { label } from '../assessments/model';

export function AssessmentWorkspace() {
  const [jobDescription, setJobDescription] = useState('');
  const [generatedAssessment, setGeneratedAssessment] = useState<any>(null);
  const generate = useGenerateAIAssessment();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    try {
      const data = await generate.mutateAsync(jobDescription);
      if (data?.assessment) {
        setGeneratedAssessment(data.assessment);
      }
    } catch (err) {
      console.error('AI Generation error:', err);
    }
  };

  return (
    <div className="as-page">
      <PageHeader
        title="AI Assessment & Question Builder"
        description="Leverage AI to construct optimized assessment blueprints and questions directly from job specifications."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Spec Card */}
        <Card heading="Generate Assessment Blueprint" headingLevel={2}>
          <form onSubmit={(e) => void handleGenerate(e)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TextArea
              label="Job Description / Requirements"
              required
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste job details, required technologies, or specific developer requirements to generate the assessment..."
              rows={8}
            />
            <Button
              type="submit"
              loading={generate.isPending}
              disabled={!jobDescription.trim()}
            >
              Generate with AI
            </Button>
          </form>

          {generate.isError && (
            <div style={{ marginTop: '16px' }}>
              <Alert tone="danger" title="Generation Failed">
                {generate.error instanceof Error ? generate.error.message : 'Could not generate assessment. Please try again.'}
              </Alert>
            </div>
          )}
        </Card>

        {/* Blueprint Preview Panel */}
        <div>
          {generatedAssessment ? (
            <Card
              heading={generatedAssessment.title}
              headingLevel={2}
              actions={
                <Link
                  className="tvx-button tvx-button--primary"
                  to={`/org/assessments/manage/${generatedAssessment._id || generatedAssessment.id}`}
                >
                  Manage Assessment
                </Link>
              }
            >
              <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <StatusTag tone="info">mixed type</StatusTag>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
                  Duration: <strong>{generatedAssessment.durationMinutes} mins</strong>
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
                  Passing Score: <strong>{generatedAssessment.passingPercentage}%</strong>
                </span>
              </div>

              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Generated Questions</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(generatedAssessment.questions || []).map((qItem: any, idx: number) => {
                  const q = qItem.question || qItem;
                  return (
                    <div
                      key={q._id || q.id || idx}
                      style={{
                        background: 'var(--color-bg-subtle)',
                        border: '1px solid var(--color-border-default)',
                        padding: '16px',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', color: 'var(--color-info-strong)' }}>
                          {label(q.type)}
                        </span>
                        <StatusTag tone="neutral">{q.difficulty}</StatusTag>
                      </div>
                      <p style={{ margin: '0 0 10px', fontSize: '14px', lineHeight: '1.4' }}>
                        {q.prompt}
                      </p>
                      {q.options && q.options.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
                          {q.options.map((opt: any) => (
                            <li key={opt.id || opt.text}>{opt.text}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <div
              style={{
                background: 'var(--color-bg-subtle)',
                border: '2px dashed var(--color-border-default)',
                padding: '48px',
                borderRadius: '8px',
                textAlign: 'center',
                color: 'var(--color-text-muted)'
              }}
            >
              Submit specifications on the left to preview generated AI assessment questions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
