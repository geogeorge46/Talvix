import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { LoadingState } from '../design-system';
import { homeForRole, useAuth } from '../auth/AuthProvider';
import type { UserRole } from '../auth/types';
import type { RecruiterPermission } from '../auth/types';
import {
  AdminWorkspaceLayout,
  AuthLayout,
  CandidateWorkspaceLayout,
  OrganizationWorkspaceLayout,
  PublicLayout,
  AuthenticatedWorkspaceLayout,
} from '../layouts/Layouts';
import {
  RegisterPage,
  SessionExpiredPage,
  SignInPage,
} from '../pages/auth/AuthPages';
import {
  ForbiddenPage,
  NotFoundPage,
  UnauthorizedPage,
  WorkspacePlaceholder,
} from '../pages/SystemPages';
import { OrganizationDashboardPage } from '../features/organization-dashboard';
import {
  JobDetailsPage,
  JobFormPage,
  ManagedJobsPage,
} from '../features/job-management';
import {
  ApplicationDetailPage,
  ApplicationsPage,
  CandidateDetailPage,
  CandidatesPage,
} from '../features/ats-workspace';
import {
  AssessmentDetailPage,
  AssessmentFormPage,
  AssessmentsPage,
  AssignmentsPage,
  AttemptPage,
  CandidateAssignmentPage,
  ResultPage,
  RecruiterAssignmentPage,
  RecruiterReviewDetailPage,
  CreateAssignmentPage,
  QuestionBankPage,
  ReviewsPage,
} from '../features/assessments';
import {
  AvailabilityPage,
  CandidateInterviewDetailPage,
  CandidateInterviewsPage,
  CandidateSchedulePage,
  FeedbackDetailPage,
  FeedbackQueuePage,
  ProcessCreatePage,
  ProcessDetailPage,
  ProcessesPage,
  TemplateDetailPage,
  TemplateFormPage,
  TemplatesPage,
} from '../features/interviews';
import {
  ApprovalDetailPage,
  ApprovalQueuePage,
  CandidateDocumentsPage,
  CandidateDocumentDetailPage,
  CandidateApplicationDocumentsPage,
  CandidateOfferDetailPage,
  CandidateOffersPage,
  ManagedOfferDetailPage,
  ManagedOffersPage,
  OfferFormPage,
  OfferRevisionPage,
  RecruiterDocumentsPage,
  TemplateDetailPage as OfferTemplateDetailPage,
  TemplateFormPage as OfferTemplateFormPage,
  TemplatesPage as OfferTemplatesPage,
  VerificationDetailPage,
} from '../features/offers-documents';

function Protected({
  requiredRole,
  children,
}: {
  requiredRole?: UserRole;
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'restoring')
    return (
      <div className="tvx-restoring">
        <LoadingState label="Restoring your session" />
      </div>
    );
  if (status === 'session-expired')
    return <Navigate to="/session-expired" replace />;
  if (!user)
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  if (requiredRole && user.role !== requiredRole)
    return <Navigate to="/unauthorized" replace />;
  return children;
}
function RoleHome() {
  const { status, user } = useAuth();
  if (status === 'restoring')
    return <LoadingState label="Restoring your session" />;
  return user ? (
    <Navigate to={homeForRole(user.role)} replace />
  ) : (
    <Navigate to="/login" replace />
  );
}
function CapabilityRoute({
  anyPermission,
  children,
}: {
  anyPermission: RecruiterPermission[];
  children: React.ReactNode;
}) {
  const { recruiter } = useAuth();
  if (
    anyPermission.length > 0 &&
    !anyPermission.some((permission) =>
      recruiter?.permissions.includes(permission),
    )
  )
    return <Navigate to="/forbidden" replace />;
  return children;
}
function RecruiterAlias({
  target,
  anyPermission = [],
}: {
  target: (id?: string) => string;
  anyPermission?: RecruiterPermission[];
}) {
  const params = useParams();
  const id = Object.values(params)[0];
  if (id && !/^[a-f\d]{24}$/i.test(id))
    return <Navigate to="/not-found" replace />;
  return (
    <CapabilityRoute anyPermission={anyPermission}>
      <Navigate to={target(id)} replace />
    </CapabilityRoute>
  );
}
function ValidatedPlaceholder({
  title,
  param,
}: {
  title: string;
  param: string;
}) {
  const params = useParams();
  const id = params[param];
  return id && /^[a-f\d]{24}$/i.test(id) ? (
    <WorkspacePlaceholder title={title} />
  ) : (
    <Navigate to="/not-found" replace />
  );
}
function ValidatedApplicationDetail() {
  const { applicationId } = useParams();
  return applicationId && /^[a-f\d]{24}$/i.test(applicationId) ? (
    <ApplicationDetailPage />
  ) : (
    <Navigate to="/not-found" replace />
  );
}
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<RoleHome />} />
        <Route path="session-expired" element={<SessionExpiredPage />} />
        <Route path="unauthorized" element={<UnauthorizedPage />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="not-found" element={<NotFoundPage />} />
      </Route>
      <Route element={<AuthLayout />}>
        <Route path="login" element={<SignInPage />} />
        <Route path="register" element={<RegisterPage />} />
      </Route>
      <Route
        path="candidate"
        element={
          <Protected requiredRole="candidate">
            <CandidateWorkspaceLayout />
          </Protected>
        }
      >
        <Route
          index
          element={<WorkspacePlaceholder title="Candidate workspace" />}
        />
        <Route
          path="applications"
          element={<WorkspacePlaceholder title="Applications" />}
        />
        <Route
          path="applications/:applicationId"
          element={
            <ValidatedPlaceholder title="Application" param="applicationId" />
          }
        />
        <Route path="assessments" element={<AssignmentsPage candidate />} />
        <Route
          path="assessments/:assignmentId"
          element={<CandidateAssignmentPage />}
        />
        <Route
          path="assessments/:assignmentId/attempt/:attemptId"
          element={<AttemptPage />}
        />
        <Route
          path="assessments/:assignmentId/result/:attemptId"
          element={<ResultPage />}
        />
        <Route path="offers/:offerId" element={<CandidateOfferDetailPage />} />
        <Route path="offers" element={<CandidateOffersPage />} />
        <Route
          path="profile"
          element={<WorkspacePlaceholder title="Candidate profile" />}
        />
        <Route path="interviews" element={<CandidateInterviewsPage />} />
        <Route path="interviews/availability" element={<AvailabilityPage />} />
        <Route
          path="interviews/schedules/:scheduleId"
          element={<CandidateSchedulePage />}
        />
        <Route
          path="interviews/:processId"
          element={<CandidateInterviewDetailPage />}
        />
        <Route path="documents" element={<CandidateDocumentsPage />} />
        <Route
          path="documents/:documentId"
          element={<CandidateDocumentDetailPage />}
        />
        <Route
          path="documents/applications/:applicationId"
          element={<CandidateApplicationDocumentsPage />}
        />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Route>
      <Route
        path="org"
        element={
          <Protected requiredRole="recruiter">
            <OrganizationWorkspaceLayout />
          </Protected>
        }
      >
        <Route index element={<OrganizationDashboardPage />} />
        <Route
          path="applications"
          element={
            <CapabilityRoute anyPermission={['applications.view']}>
              <ApplicationsPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="candidates"
          element={
            <CapabilityRoute anyPermission={['applications.view']}>
              <CandidatesPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="candidates/:candidateId"
          element={
            <CapabilityRoute anyPermission={['applications.view']}>
              <CandidateDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="jobs"
          element={
            <CapabilityRoute anyPermission={['jobs.update']}>
              <ManagedJobsPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="jobs/new"
          element={
            <CapabilityRoute anyPermission={['jobs.create']}>
              <JobFormPage mode="create" />
            </CapabilityRoute>
          }
        />
        <Route
          path="jobs/:jobId"
          element={
            <CapabilityRoute anyPermission={['jobs.update']}>
              <JobDetailsPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="jobs/:jobId/edit"
          element={
            <CapabilityRoute anyPermission={['jobs.update']}>
              <JobFormPage mode="edit" />
            </CapabilityRoute>
          }
        />
        <Route
          path="team/*"
          element={
            <CapabilityRoute anyPermission={['team.manage']}>
              <WorkspacePlaceholder title="Team" />
            </CapabilityRoute>
          }
        />
        <Route
          path="applications/:applicationId"
          element={
            <CapabilityRoute anyPermission={['applications.view']}>
              <ValidatedApplicationDetail />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments"
          element={
            <CapabilityRoute anyPermission={['assessments.view']}>
              <AssessmentsPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/new"
          element={
            <CapabilityRoute anyPermission={['assessments.manage']}>
              <AssessmentFormPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/assignments"
          element={
            <CapabilityRoute anyPermission={['assessments.view']}>
              <AssignmentsPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/assignments/new"
          element={
            <CapabilityRoute anyPermission={['assessments.assign']}>
              <CreateAssignmentPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/questions"
          element={
            <CapabilityRoute anyPermission={['assessments.view']}>
              <QuestionBankPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/assignments/:assignmentId"
          element={
            <CapabilityRoute anyPermission={['assessments.view']}>
              <RecruiterAssignmentPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/reviews"
          element={
            <CapabilityRoute anyPermission={['assessments.review']}>
              <ReviewsPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/:assessmentId"
          element={
            <CapabilityRoute anyPermission={['assessments.view']}>
              <AssessmentDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/:assessmentId/edit"
          element={
            <CapabilityRoute anyPermission={['assessments.manage']}>
              <AssessmentFormPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="assessments/reviews/:attemptId"
          element={
            <CapabilityRoute anyPermission={['assessments.review']}>
              <RecruiterReviewDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews"
          element={
            <CapabilityRoute anyPermission={['interviews.view']}>
              <ProcessesPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/new"
          element={
            <CapabilityRoute anyPermission={['interviews.manage']}>
              <ProcessCreatePage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/templates"
          element={
            <CapabilityRoute anyPermission={['interviews.view']}>
              <TemplatesPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/templates/new"
          element={
            <CapabilityRoute anyPermission={['interviews.manage']}>
              <TemplateFormPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/templates/:templateId"
          element={
            <CapabilityRoute anyPermission={['interviews.view']}>
              <TemplateDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/templates/:templateId/edit"
          element={
            <CapabilityRoute anyPermission={['interviews.manage']}>
              <TemplateFormPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/feedback"
          element={
            <CapabilityRoute anyPermission={['interviews.evaluate']}>
              <FeedbackQueuePage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/feedback/:roundId"
          element={
            <CapabilityRoute anyPermission={['interviews.evaluate']}>
              <FeedbackDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="interviews/:processId"
          element={
            <CapabilityRoute anyPermission={['interviews.view']}>
              <ProcessDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/approvals/:offerId"
          element={
            <CapabilityRoute anyPermission={['offers.approve']}>
              <ApprovalDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers"
          element={
            <CapabilityRoute anyPermission={['offers.view']}>
              <ManagedOffersPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/new"
          element={
            <CapabilityRoute anyPermission={['offers.manage']}>
              <OfferFormPage mode="create" />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/templates"
          element={
            <CapabilityRoute anyPermission={['offers.view']}>
              <OfferTemplatesPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/templates/new"
          element={
            <CapabilityRoute anyPermission={['offers.manage']}>
              <OfferTemplateFormPage mode="create" />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/templates/:templateId"
          element={
            <CapabilityRoute anyPermission={['offers.view']}>
              <OfferTemplateDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/templates/:templateId/edit"
          element={
            <CapabilityRoute anyPermission={['offers.manage']}>
              <OfferTemplateFormPage mode="edit" />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/approvals"
          element={
            <CapabilityRoute anyPermission={['offers.approve']}>
              <ApprovalQueuePage />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/:offerId/revise"
          element={
            <CapabilityRoute anyPermission={['offers.manage']}>
              <OfferRevisionPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/:offerId/edit"
          element={
            <CapabilityRoute anyPermission={['offers.manage']}>
              <OfferFormPage mode="edit" />
            </CapabilityRoute>
          }
        />
        <Route
          path="offers/:offerId"
          element={
            <CapabilityRoute anyPermission={['offers.view']}>
              <ManagedOfferDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="documents"
          element={
            <CapabilityRoute anyPermission={['documents.verify']}>
              <RecruiterDocumentsPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="documents/verification/:documentId"
          element={
            <CapabilityRoute anyPermission={['documents.verify']}>
              <VerificationDetailPage />
            </CapabilityRoute>
          }
        />
        <Route
          path="profile"
          element={<WorkspacePlaceholder title="Company profile" />}
        />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Route>
      <Route
        path="admin"
        element={
          <Protected requiredRole="admin">
            <AdminWorkspaceLayout />
          </Protected>
        }
      >
        <Route
          index
          element={<WorkspacePlaceholder title="Administration" />}
        />
        <Route path="users" element={<WorkspacePlaceholder title="Users" />} />
        <Route
          path="companies"
          element={<WorkspacePlaceholder title="Companies" />}
        />
        <Route
          path="reviews/:id"
          element={<ValidatedPlaceholder title="Review queue" param="id" />}
        />
        <Route
          path="jobs/:jobId"
          element={<ValidatedPlaceholder title="Job review" param="jobId" />}
        />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Route>
      <Route
        element={
          <Protected>
            <AuthenticatedWorkspaceLayout />
          </Protected>
        }
      >
        <Route
          path="notifications"
          element={<WorkspacePlaceholder title="Notifications" />}
        />
      </Route>
      <Route
        path="settings/notifications"
        element={
          <Protected>
            <Navigate to="/notifications" replace />
          </Protected>
        }
      />
      <Route
        path="recruiter/profile"
        element={
          <Protected requiredRole="recruiter">
            <RecruiterAlias target={() => '/org/profile'} />
          </Protected>
        }
      />
      <Route
        path="recruiter/applications/:applicationId"
        element={
          <Protected requiredRole="recruiter">
            <RecruiterAlias
              anyPermission={['applications.view']}
              target={(id) => `/org/applications/${id}`}
            />
          </Protected>
        }
      />
      <Route
        path="recruiter/assessments/reviews/:attemptId"
        element={
          <Protected requiredRole="recruiter">
            <RecruiterAlias
              anyPermission={['assessments.review']}
              target={(id) => `/org/assessments/reviews/${id}`}
            />
          </Protected>
        }
      />
      <Route
        path="recruiter/interviews/:processId"
        element={
          <Protected requiredRole="recruiter">
            <RecruiterAlias
              anyPermission={['interviews.view']}
              target={(id) => `/org/interviews/${id}`}
            />
          </Protected>
        }
      />
      <Route
        path="recruiter/offers/approvals/:offerId"
        element={
          <Protected requiredRole="recruiter">
            <RecruiterAlias
              anyPermission={['offers.approve']}
              target={(id) => `/org/offers/approvals/${id}`}
            />
          </Protected>
        }
      />
      <Route
        path="recruiter/documents/verification/:documentId"
        element={
          <Protected requiredRole="recruiter">
            <RecruiterAlias
              anyPermission={['documents.verify']}
              target={(id) => `/org/documents/verification/${id}`}
            />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/not-found" replace />} />
    </Routes>
  );
}
