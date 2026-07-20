import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  DescriptionList,
  Dialog,
  ErrorState,
  LoadingState,
  PageHeader,
  PermissionState,
  StatusTag,
  TextArea,
  TextField,
} from '../../design-system';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useAssignment, useAssignmentAction } from './api';
import { formatDate, label } from './model';

export function RecruiterAssignmentPage() {
  const { assignmentId = '' } = useParams();
  const { recruiter } = useAuth();
  const permissions = recruiter?.permissions ?? [];
  const canView = permissions.includes('assessments.view');
  const canAssign = permissions.includes('assessments.assign');
  const canReview = permissions.includes('assessments.review');
  const query = useAssignment(
    assignmentId,
    false,
    canView && /^[a-f\d]{24}$/i.test(assignmentId),
  );
  const action = useAssignmentAction(assignmentId);
  const [modal, setModal] = useState<'cancel' | 'extend' | null>(null);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  if (!canView)
    return (
      <PermissionState description="The assessments.view permission is required." />
    );
  if (query.isLoading) return <LoadingState label="Loading assignment" />;
  if (query.isError)
    return (
      <ErrorState
        detail={
          query.error instanceof Error
            ? query.error.message
            : 'Could not load assignment.'
        }
        retry={() => void query.refetch()}
      />
    );
  if (!query.data) return null;
  const assignment = query.data;
  const mutable = !['cancelled', 'expired', 'completed'].includes(
    assignment.status,
  );
  const run = async () => {
    if (!modal || !reason.trim()) return;
    await action.mutateAsync({
      action: modal,
      body:
        modal === 'extend'
          ? {
              expiresAt: new Date(expiresAt).toISOString(),
              reason: reason.trim(),
            }
          : { reason: reason.trim() },
    });
    setModal(null);
    setReason('');
    setExpiresAt('');
  };
  return (
    <div className="as-page">
      <PageHeader
        title={assignment.title}
        description={`Assigned to ${assignment.candidateName}`}
        metadata={<StatusTag>{label(assignment.status)}</StatusTag>}
        secondaryActions={
          <>
            {canAssign && mutable && (
              <>
                <Button variant="secondary" onClick={() => setModal('extend')}>
                  Extend deadline
                </Button>
                <Button variant="danger" onClick={() => setModal('cancel')}>
                  Cancel assignment
                </Button>
              </>
            )}
            {canReview &&
              assignment.status === 'completed' &&
              !assignment.resultReleased && (
                <Button
                  onClick={() =>
                    void action.mutateAsync({ action: 'release-result' })
                  }
                >
                  Release result
                </Button>
              )}
          </>
        }
      />
      <Card heading="Assignment details" headingLevel={2}>
        <DescriptionList
          items={[
            { term: 'Candidate', description: assignment.candidateName },
            { term: 'Status', description: label(assignment.status) },
            {
              term: 'Available',
              description: formatDate(assignment.availableFrom),
            },
            { term: 'Deadline', description: formatDate(assignment.expiresAt) },
            {
              term: 'Result',
              description: assignment.resultReleased
                ? 'Released'
                : 'Not released',
            },
          ]}
        />
      </Card>
      {action.isError && (
        <Alert
          tone={
            action.error instanceof ApiError && action.error.status === 409
              ? 'warning'
              : 'danger'
          }
          title="Assignment was not changed"
        >
          {action.error instanceof Error
            ? action.error.message
            : 'Refresh and try again.'}
        </Alert>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
        title={
          modal === 'cancel'
            ? 'Cancel assignment?'
            : 'Extend assessment deadline'
        }
        description="Confirm this consequential change. The reason is recorded by the backend."
        busy={action.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Keep unchanged
            </Button>
            <Button
              onClick={() => void run()}
              loading={action.isPending}
              disabled={!reason.trim() || (modal === 'extend' && !expiresAt)}
            >
              Confirm change
            </Button>
          </>
        }
      >
        <TextArea
          label="Reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {modal === 'extend' && (
          <TextField
            label="New deadline"
            type="datetime-local"
            required
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        )}
      </Dialog>
    </div>
  );
}
