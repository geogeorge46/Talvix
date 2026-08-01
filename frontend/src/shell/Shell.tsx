/* eslint-disable react-refresh/only-export-components -- Typed navigation models intentionally live beside their renderers. */
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleUserRound,
  FileText,
  Home,
  LayoutDashboard,
  Menu as MenuIcon,
  Search,
  ShieldCheck,
  ClipboardCheck,
  CalendarDays,
  Users,
  Settings,
  BarChart3,
  UserRound,
  RadioTower,
  MessageSquareText,
  ListChecks,
} from 'lucide-react';
import { Button, Drawer, IconButton, Menu } from '../design-system';
import { useAuth } from '../auth/AuthProvider';
import type { RecruiterPermission } from '../auth/types';

export interface NavigationItem {
  id: string;
  label: string;
  to: string;
  icon: ReactNode;
  anyPermission?: RecruiterPermission[];
}
export const SHELL_DESKTOP_BREAKPOINT = 1024;
export const isDesktopShell = (width: number) =>
  width >= SHELL_DESKTOP_BREAKPOINT;
export const candidateNavigation: NavigationItem[] = [
  { id: 'home', label: 'Workspace', to: '/candidate', icon: <Home /> },
  {
    id: 'profile',
    label: 'Profile',
    to: '/candidate/profile',
    icon: <UserRound />,
  },
  { id: 'jobs', label: 'Jobs', to: '/candidate/jobs', icon: <Search /> },
  {
    id: 'applications',
    label: 'Applications',
    to: '/candidate/applications',
    icon: <BriefcaseBusiness />,
  },
  {
    id: 'interviews',
    label: 'Interviews',
    to: '/candidate/interviews',
    icon: <CalendarDays />,
  },
  {
    id: 'assessments',
    label: 'Assessments',
    to: '/candidate/assessments',
    icon: <ClipboardCheck />,
  },
  {
    id: 'documents',
    label: 'Documents',
    to: '/candidate/documents',
    icon: <FileText />,
  },
  {
    id: 'offers',
    label: 'Offers',
    to: '/candidate/offers',
    icon: <BriefcaseBusiness />,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    to: '/candidate/notifications',
    icon: <Bell />,
  },
  {
    id: 'settings',
    label: 'Settings',
    to: '/candidate/settings',
    icon: <Settings />,
  },
];
export const organizationNavigation: NavigationItem[] = [
  { id: 'overview', label: 'Overview', to: '/org', icon: <LayoutDashboard /> },
  {
    id: 'interviews',
    label: 'Interviews',
    to: '/org/interviews',
    icon: <CalendarDays />,
    anyPermission: [
      'interviews.view',
      'interviews.manage',
      'interviews.schedule',
      'interviews.evaluate',
    ],
  },
  {
    id: 'assessments',
    label: 'Assessments',
    to: '/org/assessments',
    icon: <ClipboardCheck />,
    anyPermission: [
      'assessments.view',
      'assessments.manage',
      'assessments.assign',
      'assessments.review',
    ],
  },
  {
    id: 'jobs',
    label: 'Jobs',
    to: '/org/jobs',
    icon: <BriefcaseBusiness />,
    anyPermission: [
      'jobs.create',
      'jobs.update',
      'jobs.delete',
      'jobs.publish',
    ],
  },
  {
    id: 'applications',
    label: 'Applications',
    to: '/org/applications',
    icon: <FileText />,
    anyPermission: ['applications.view'],
  },
  {
    id: 'candidates',
    label: 'Candidates',
    to: '/org/candidates',
    icon: <CircleUserRound />,
    anyPermission: ['applications.view'],
  },
  {
    id: 'offers',
    label: 'Offers',
    to: '/org/offers',
    icon: <BriefcaseBusiness />,
    anyPermission: ['offers.view'],
  },
  {
    id: 'documents',
    label: 'Documents',
    to: '/org/documents',
    icon: <FileText />,
    anyPermission: ['documents.verify'],
  },
  {
    id: 'company',
    label: 'Company',
    to: '/org/company',
    icon: <Building2 />,
  },
  {
    id: 'team',
    label: 'Team',
    to: '/org/team',
    icon: <Users />,
    anyPermission: ['team.manage'],
  },
  {
    id: 'settings',
    label: 'Settings',
    to: '/org/settings',
    icon: <Settings />,
    anyPermission: ['company.manage'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    to: '/org/analytics',
    icon: <BarChart3 />,
  },
];
export const adminNavigation: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    to: '/admin',
    icon: <ShieldCheck />,
  },
  {
    id: 'approvals',
    label: 'Approvals',
    to: '/admin/approvals',
    icon: <ListChecks />,
  },
  {
    id: 'operations',
    label: 'Operations',
    to: '/admin/operations',
    icon: <RadioTower />,
  },
  {
    id: 'communications',
    label: 'Communications',
    to: '/admin/communications',
    icon: <MessageSquareText />,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    to: '/admin/analytics',
    icon: <BarChart3 />,
  },
];

export function SkipLink() {
  return (
    <a className="tvx-skip-link" href="#main-content">
      Skip to main content
    </a>
  );
}
export function WorkspaceIdentity({
  name,
  detail,
}: {
  name: string;
  detail: string;
}) {
  return (
    <div className="tvx-workspace-identity">
      <span aria-hidden>TV</span>
      <div>
        <strong>{name}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}
export function SideNav({
  items,
  label,
  onSelect,
}: {
  items: NavigationItem[];
  label: string;
  onSelect?: () => void;
}) {
  return (
    <nav className="tvx-side-nav" aria-label={label}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <NavLink
              onClick={onSelect}
              to={item.to}
              end={item.to.split('/').length === 2}
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="visually-hidden"> (current)</span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
export function GlobalSearch() {
  return (
    <button
      className="tvx-global-search"
      type="button"
      disabled
      aria-label="Global search, coming soon"
    >
      <Search aria-hidden />
      <span>Search Talvix</span>
      <kbd>⌘ K</kbd>
    </button>
  );
}
export function NotificationTrigger() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <IconButton
      icon={<Bell />}
      aria-label="Notifications"
      variant="quiet"
      onClick={() =>
        navigate(
          user?.role === 'candidate'
            ? '/candidate/notifications'
            : '/notifications',
        )
      }
    />
  );
}
export function AccountMenu() {
  const { user, logout } = useAuth();
  return (
    <Menu
      label="Account"
      trigger={
        <Button variant="quiet" trailingIcon={<ChevronDown />}>
          <CircleUserRound aria-hidden /> {user?.fullName ?? 'Account'}
        </Button>
      }
      items={[
        { id: 'email', kind: 'label', label: user?.email ?? '' },
        { id: 'separator', kind: 'separator' },
        { id: 'logout', label: 'Sign out', onSelect: () => void logout() },
      ]}
    />
  );
}
export function TopNav({
  onOpenNavigation,
  navigationTriggerRef,
}: {
  onOpenNavigation: () => void;
  navigationTriggerRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <header className="tvx-top-nav">
      <IconButton
        ref={navigationTriggerRef}
        className="tvx-mobile-nav-trigger"
        icon={<MenuIcon />}
        aria-label="Open navigation"
        variant="quiet"
        onClick={onOpenNavigation}
      />
      <GlobalSearch />
      <div className="tvx-top-actions">
        <NotificationTrigger />
        <AccountMenu />
      </div>
    </header>
  );
}
export function MobileNavDrawer({
  open,
  onOpenChange,
  identity,
  items,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: ReactNode;
  items: NavigationItem[];
  onNavigate: () => void;
}) {
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Navigation"
      side="start"
    >
      <div className="tvx-mobile-drawer-identity">{identity}</div>
      <SideNav items={items} label="Mobile navigation" onSelect={onNavigate} />
    </Drawer>
  );
}
export function MainContent({ children }: { children?: ReactNode }) {
  return (
    <main id="main-content" className="tvx-main-content" tabIndex={-1}>
      {children ?? <Outlet />}
    </main>
  );
}
export function OptionalContextRail({
  children,
  label = 'Context',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <aside className="tvx-context-rail" aria-label={label}>
      {children}
    </aside>
  );
}
export function AppShell({
  items,
  workspaceName,
  workspaceDetail,
  contextRail,
  content,
}: {
  items: NavigationItem[];
  workspaceName: string;
  workspaceDetail: string;
  contextRail?: ReactNode;
  content?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationSelected = useRef(false);
  useEffect(() => {
    if (navigationSelected.current) {
      document.getElementById('main-content')?.focus();
      navigationSelected.current = false;
    }
  }, [location.pathname]);
  const identity = (
    <WorkspaceIdentity name={workspaceName} detail={workspaceDetail} />
  );
  return (
    <div className="tvx-app-shell">
      <SkipLink />
      <aside className="tvx-app-sidebar">
        {identity}
        <SideNav items={items} label="Primary navigation" />
      </aside>
      <TopNav
        onOpenNavigation={() => setMobileOpen(true)}
        navigationTriggerRef={mobileTriggerRef}
      />
      <MobileNavDrawer
        open={mobileOpen}
        onOpenChange={(open) => {
          setMobileOpen(open);
          if (!open)
            window.setTimeout(() => {
              if (!navigationSelected.current)
                mobileTriggerRef.current?.focus();
            }, 0);
        }}
        identity={identity}
        items={items}
        onNavigate={() => {
          navigationSelected.current = true;
          setMobileOpen(false);
        }}
      />
      <div className="tvx-shell-body">
        <MainContent>{content}</MainContent>
        {contextRail && (
          <OptionalContextRail>{contextRail}</OptionalContextRail>
        )}
      </div>
    </div>
  );
}
