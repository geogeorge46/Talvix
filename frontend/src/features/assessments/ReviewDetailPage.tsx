import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  PermissionState,
  TextArea,
  TextField,
} from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';
import { useReview, useReviewAction } from './api';
import { label } from './model';

export function RecruiterReviewDetailPage() {
  const { attemptId = '' } = useParams();
  const { recruiter } = useAuth();
  const canReview = Boolean(
    recruiter?.permissions.includes('assessments.review'),
  );
  const query = useReview(
    attemptId,
    canReview && /^[a-f\d]{24}$/i.test(attemptId),
  );
  const mutation = useReviewAction(attemptId);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  if (!canReview)
    return (
      <PermissionState description="The assessments.review permission is required." />
    );
  if (query.isLoading)
    return <LoadingState label="Loading submitted assessment" />;
  if (query.isError)
    return (
      <ErrorState
        detail={
          query.error instanceof Error
            ? query.error.message
            : 'Could not load review.'
        }
        retry={() => void query.refetch()}
      />
    );
  const attempt = query.data;
  if (!attempt) return null;
  const reviewable = ['review-pending', 'submitted', 'auto-evaluated'].includes(
    attempt.status,
  );
  return (
    <div className="as-page">
      <PageHeader
        title={attempt.title}
        eyebrow="Manual assessment review"
        description="Score only the submitted snapshot. Correct answers and private explanations are not rendered."
        primaryAction={
          reviewable ? (
            <Button
              onClick={() => void mutation.mutateAsync({ complete: true })}
              loading={mutation.isPending}
            >
              Complete review
            </Button>
          ) : undefined
        }
      />
      {!reviewable && (
        <Alert tone="info" title={`Review ${label(attempt.status)}`}>
          This review is read-only in its current state.
        </Alert>
      )}
      {mutation.isError && (
        <Alert tone="danger" title="Review was not saved">
          {mutation.error instanceof Error
            ? mutation.error.message
            : 'Refresh and retry.'}
        </Alert>
      )}
      {attempt.questions.map((question, index) => (
        <Card
          key={question.id}
          heading={`Question ${index + 1}`}
          headingLevel={2}
          description={`${label(question.type)} · ${question.marks} available marks`}
        >
          <p className="as-preserve">{question.prompt}</p>
          <TextField
            label="Awarded marks"
            type="number"
            min="0"
            max={String(question.marks)}
            value={scores[question.id] ?? ''}
            onChange={(event) =>
              setScores({ ...scores, [question.id]: event.target.value })
            }
            readOnly={!reviewable}
          />
          <TextArea
            label="Candidate feedback (optional)"
            value={feedback[question.id] ?? ''}
            onChange={(event) =>
              setFeedback({ ...feedback, [question.id]: event.target.value })
            }
            readOnly={!reviewable}
          />
          {reviewable && (
            <Button
              onClick={() =>
                void mutation.mutateAsync({
                  questionId: question.id,
                  awardedMarks: Number(scores[question.id]),
                  ...(feedback[question.id] !== undefined
                    ? { feedback: feedback[question.id] }
                    : {}),
                })
              }
              disabled={
                scores[question.id] === undefined ||
                Number(scores[question.id]) < 0 ||
                Number(scores[question.id]) > question.marks
              }
              loading={mutation.isPending}
            >
              Save question review
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
}
