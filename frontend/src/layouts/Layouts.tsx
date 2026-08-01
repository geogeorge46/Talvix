import { Link, Outlet, useLocation } from 'react-router-dom';
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
    <div className="tvx-auth-layout-redesigned">
      <SkipLink />
      <main id="main-content" className="w-full">
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
    (item) => item.id === 'company',
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
  if (!recruiter.company) {
    if (location.pathname === '/org/company/new')
      return stateShell(<Outlet />, restricted);
    return stateShell(
      <EmptyState
        title="Set up your organization"
        description="Create or join an organization before opening this workspace."
        action={
          <Link
            className="tvx-button tvx-button--primary tvx-button--md"
            to="/org/company/new"
          >
            Create company
          </Link>
        }
      />,
    );
  }
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
  if (recruiter.company.verificationStatus === 'suspended') {
    const companyRoute = location.pathname === '/org/company';
    return stateShell(
      companyRoute ? (
        <Outlet />
      ) : (
        <SuspendedState
          title="Organization suspended"
          description="Hiring and administration actions are unavailable. The company overview remains available for status context."
        />
      ),
    );
  }
  if (recruiter.company.verificationStatus === 'rejected') {
    const recoveryRoute =
      location.pathname === '/org/company' ||
      location.pathname === '/org/company/edit';
    return stateShell(
      recoveryRoute ? (
        <Outlet />
      ) : (
        <UnverifiedCompanyState
          title="Verification declined"
          description="Organization verification was declined. Review the company profile for supported corrections; other workspace areas remain unavailable."
        />
      ),
    );
  }
  if (recruiter.company.verificationStatus !== 'verified') {
    const pendingItems = allowed.filter((item) =>
      ['jobs', 'company', 'settings', 'team'].includes(item.id),
    );
    const setupAllowed =
      location.pathname.startsWith('/org/company') ||
      location.pathname.startsWith('/org/settings') ||
      location.pathname.startsWith('/org/team') ||
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
        items={organizationNavigation.filter((item) => item.id === 'company')}
        workspaceName={recruiter?.company?.name ?? 'Organization'}
        workspaceDetail="Recruiter"
      />
    );
  return <AdminWorkspaceLayout />;
}
