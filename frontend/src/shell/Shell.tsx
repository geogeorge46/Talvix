/* eslint-disable react-refresh/only-export-components -- Typed navigation models intentionally live beside their renderers. */
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../api/client';
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
  ShieldAlert,
  ClipboardCheck,
  CalendarDays,
  Users,
  Settings,
  BarChart3,
  UserRound,
  RadioTower,
  MessageSquareText,
  ListChecks,
  History as HistoryIcon,
  Cpu,
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
    id: 'talent-pool',
    label: 'Talent Pool',
    to: '/org/talent-pool',
    icon: <Users />,
    anyPermission: ['jobs.update'],
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
  {
    id: 'activity-timeline',
    label: 'Activity Log',
    to: '/org/activity-timeline',
    icon: <HistoryIcon />,
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
    id: 'claims',
    label: 'Disputes & Claims',
    to: '/admin/claims',
    icon: <ShieldAlert />,
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
  {
    id: 'ai-gateway',
    label: 'AI Console',
    to: '/admin/ai-console',
    icon: <Cpu />,
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Toggle command palette shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch search results on query change
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      return;
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }

    if (!query.trim()) {
      setResults([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await apiRequest<any[]>('/search?q=' + encodeURIComponent(query));
        setResults(response || []);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Failed to search', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, isOpen]);

  // Handle keyboard navigation inside the list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        navigate(results[selectedIndex].url);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <>
      <button
        className="tvx-global-search"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Search Talvix"
      >
        <Search aria-hidden />
        <span>Search Talvix...</span>
        <kbd>⌘ K</kbd>
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex justify-center p-4 pt-[12vh]"
          onClick={() => setIsOpen(false)}
        >
          <div 
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[500px]"
          >
            {/* Search Header */}
            <div className="flex items-center gap-3 px-4 border-b border-slate-100 py-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search jobs, candidates, users or companies..."
                className="w-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
              />
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5 select-none shrink-0">
                ESC
              </span>
            </div>

            {/* Results body */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
              {loading && (
                <div className="py-12 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></span>
                  Searching...
                </div>
              )}

              {!loading && query && results.length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">
                  No results found for &ldquo;{query}&rdquo;
                </div>
              )}

              {!loading && !query && (
                <div className="py-8 text-center text-xs text-slate-400 font-medium tracking-wide uppercase select-none">
                  Press keys to navigate, enter to select
                </div>
              )}

              {!loading && results.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      navigate(item.url);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between px-4 py-3.5 cursor-pointer transition-all duration-150 ${
                      isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.type === 'Job' && <BriefcaseBusiness className="w-4 h-4 text-slate-500 shrink-0" />}
                      {item.type === 'Company' && <Building2 className="w-4 h-4 text-slate-500 shrink-0" />}
                      {item.type === 'User' && <UserRound className="w-4 h-4 text-slate-500 shrink-0" />}
                      {item.type === 'Candidate' && <Users className="w-4 h-4 text-slate-500 shrink-0" />}
                      
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100/80 px-2 py-0.5 rounded-md shrink-0">
                      {item.type}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
function useUnreadCountQuery() {
  return useQuery({
    queryKey: ['global-notifications-unread-count'],
    queryFn: async () => {
      try {
        const res = await apiRequest<any>('/notifications/unread-count');
        return Number(res?.count ?? 0);
      } catch (err) {
        return 0;
      }
    },
    refetchInterval: 10000,
  });
}

export function NotificationTrigger() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: count = 0 } = useUnreadCountQuery();
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
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
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: 'var(--color-action-primary)',
            color: 'white',
            borderRadius: '50%',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 'bold',
            lineHeight: 1,
            pointerEvents: 'none',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
export function AccountMenu() {
  const { user, logout } = useAuth();
  return (
    <Menu
      label="Account"
      trigger={
        <Button
          variant="quiet"
          leadingIcon={<CircleUserRound aria-hidden />}
          trailingIcon={<ChevronDown />}
        >
          {user?.fullName ?? 'Account'}
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
