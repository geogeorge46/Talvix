import { Outlet, useLocation } from 'react-router-dom';
import {
  AppShell,
  adminNavigation,
  candidateNavigation,
  organizationNavigation,
  SkipLink,
} from '../shell/Shell';
import { useAuth } from '../auth/AuthProvider';
import {
  ErrorState,
  LoadingState,
  PendingApprovalState,
  SuspendedState,
  UnverifiedCompanyState,
  EmptyState,
} from '../design-system';
export function PublicLayout() {
  return (
    <div className="tvx-public-layout">
      <SkipLink />
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
export function AuthLayout() {
  return (
    <div className="tvx-auth-layout">
      <SkipLink />
      <div className="tvx-auth-brand">
        <strong>Talvix</strong>
        <span>Recruitment, thoughtfully organized.</span>
      </div>
      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
export function CandidateWorkspaceLayout() {
  return (
    <AppShell
      items={candidateNavigation}
      workspaceName="My workspace"
      workspaceDetail="Candidate"
    />
  );
}
export function OrganizationWorkspaceLayout() {
  const { recruiter, capabilityStatus, refreshCapabilities } = useAuth();
  const location = useLocation();
  const restricted = organizationNavigation.filter(
    (item) => item.id === 'profile',
  );
  const stateShell = (content: React.ReactNode, items = restricted) => (
    <AppShell
      items={items}
      workspaceName={recruiter?.company?.name ?? 'Organization'}
      workspaceDetail="Restricted workspace"
      content={content}
    />
  );
  if (capabilityStatus === 'loading' || capabilityStatus === 'idle')
    return stateShell(<LoadingState label="Loading organization access" />);
  if (capabilityStatus === 'error')
    return stateShell(
      <ErrorState
        detail="Organization access could not be verified."
        retry={() => void refreshCapabilities()}
      />,
    );
  if (!recruiter?.isApproved) return stateShell(<PendingApprovalState />);
  if (!recruiter.company)
    return stateShell(
      <EmptyState
        title="Set up your organization"
        description="Create or join an organization before opening this workspace."
      />,
    );
  if (!recruiter.company.isActive)
    return stateShell(
      <SuspendedState
        title="Organization inactive"
        description="This organization is inactive. Contact a Talvix administrator before continuing."
      />,
    );
  const allowed = organizationNavigation.filter(
    (item) =>
      !item.anyPermission ||
      item.anyPermission.some((permission) =>
        recruiter.permissions.includes(permission),
      ),
  );
  if (recruiter.company.verificationStatus === 'suspended')
    return stateShell(<SuspendedState title="Organization suspended" />);
  if (recruiter.company.verificationStatus === 'rejected')
    return stateShell(
      <UnverifiedCompanyState
        title="Verification declined"
        description="Organization verification was declined. Review the company profile before requesting another review."
      />,
    );
  if (recruiter.company.verificationStatus !== 'verified') {
    const pendingItems = allowed.filter((item) =>
      ['jobs', 'profile'].includes(item.id),
    );
    const setupAllowed =
      location.pathname === '/org/profile' ||
      location.pathname.startsWith('/org/jobs');
    return stateShell(
      setupAllowed ? <Outlet /> : <UnverifiedCompanyState />,
      pendingItems,
    );
  }
  return (
    <AppShell
      items={allowed}
      workspaceName={recruiter?.company?.name ?? 'Organization'}
      workspaceDetail={
        recruiter?.isApproved ? 'Recruiter workspace' : 'Approval pending'
      }
    />
  );
}
export function AdminWorkspaceLayout() {
  return (
    <AppShell
      items={adminNavigation}
      workspaceName="Talvix"
      workspaceDetail="Administration"
    />
  );
}
export function AuthenticatedWorkspaceLayout() {
  const { user, recruiter } = useAuth();
  if (user?.role === 'candidate') return <CandidateWorkspaceLayout />;
  if (user?.role === 'recruiter')
    return (
      <AppShell
        items={organizationNavigation.filter((item) => item.id === 'profile')}
        workspaceName={recruiter?.company?.name ?? 'Organization'}
        workspaceDetail="Recruiter"
      />
    );
  return <AdminWorkspaceLayout />;
}
