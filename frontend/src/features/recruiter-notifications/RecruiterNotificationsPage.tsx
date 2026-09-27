import { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  Settings,
  Mail,
  Smartphone,
  Check,
  Archive,
  Trash2,
  Clock,
  Sparkles,
  CheckCircle2,
  Award,
  FileText,
  Users,
  UserCheck,
  Shield,
  Calendar,
  Filter,
  Search,
  X,
  RefreshCw,
  AlertCircle,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SearchField,
  Select,
} from '../../design-system';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import {
  useNotifications,
  useNotificationMutation,
  useNotificationPreferences,
  useNotificationPreferenceMutation,
  useUnreadCount,
} from './api';

export function RecruiterNotificationsPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const activeTab = (sp.get('tab') as 'inbox' | 'preferences') || 'inbox';
  const setActiveTab = (tab: 'inbox' | 'preferences') => {
    const next = new URLSearchParams(sp);
    if (tab === 'inbox') next.delete('tab');
    else next.set('tab', tab);
    setSp(next, { replace: true });
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState(''); // '' (all), 'unread', 'read', 'archived'
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Build API query string
  const page = Number(sp.get('page')) || 1;
  const queryStr = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '20');
    if (readFilter === 'unread') params.set('read', 'false');
    if (readFilter === 'read') params.set('read', 'true');
    if (readFilter === 'archived') params.set('archived', 'true');
    else if (readFilter !== 'archived') params.set('archived', 'false');
    if (priorityFilter) params.set('priority', priorityFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    return params.toString();
  }, [page, readFilter, priorityFilter, categoryFilter]);

  const qNotifications = useNotifications(queryStr);
  const qUnread = useUnreadCount();
  const mNotification = useNotificationMutation();
  const qPrefs = useNotificationPreferences();
  const mPrefs = useNotificationPreferenceMutation();

  const handleActionClick = async (action: any) => {
    try {
      await apiRequest(action.path, { method: action.method || 'POST', body: action.body });
      setToastMessage({ type: 'success', text: `Action executed: ${action.label}` });
      qNotifications.refetch();
      qUnread.refetch();
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Action execution failed.' });
    }
  };

  // Local Form state for preferences
  const [inApp, setInApp] = useState<boolean | null>(null);
  const [email, setEmail] = useState<boolean | null>(null);
  const [digest, setDigest] = useState<boolean | null>(null);
  const [freq, setFreq] = useState<'daily' | 'weekly'>('daily');
  const [prefHour, setPrefHour] = useState<number>(9);
  const [quiet, setQuiet] = useState<boolean | null>(null);
  const [quietStart, setQuietStart] = useState<number>(22);
  const [quietEnd, setQuietEnd] = useState<number>(7);

  // Sync preferences data when query loads
  useEffect(() => {
    if (qPrefs.data && inApp === null) {
      setInApp(qPrefs.data.inAppEnabled);
      setEmail(qPrefs.data.emailEnabled);
      setDigest(qPrefs.data.digestEnabled);
      setFreq(qPrefs.data.digestFrequency);
      setPrefHour(qPrefs.data.preferredHour ?? 9);
      setQuiet(qPrefs.data.quietHoursEnabled);
      setQuietStart(qPrefs.data.quietStartHour ?? 22);
      setQuietEnd(qPrefs.data.quietEndHour ?? 7);
    }
  }, [qPrefs.data, inApp]);

  const handleSavePreferences = () => {
    const payload = {
      global: {
        inAppEnabled: inApp ?? true,
        emailEnabled: email ?? true,
      },
      digest: {
        enabled: digest ?? false,
        frequency: freq,
        timezone: qPrefs.data?.timezone || 'UTC',
        preferredHour: prefHour,
      },
      quietHours: {
        enabled: quiet ?? false,
        startHour: quietStart,
        endHour: quietEnd,
      },
    };
    mPrefs.mutate(payload, {
      onSuccess: () => {
        setToastMessage({ type: 'success', text: 'Notification preferences updated successfully!' });
      },
      onError: (err: any) => {
        setToastMessage({ type: 'error', text: err.message || 'Failed to save preferences.' });
      },
    });
  };

  const handleBulkAction = (action: 'read' | 'archive') => {
    if (!selectedIds.length) return;
    mNotification.mutate(
      {
        path: `/notifications/bulk/${action}`,
        body: { notificationIds: selectedIds },
      },
      {
        onSuccess: () => {
          setToastMessage({ type: 'success', text: `Updated ${selectedIds.length} notifications.` });
          setSelectedIds([]);
          qUnread.refetch();
        },
      }
    );
  };

  const handleMarkAllRead = () => {
    mNotification.mutate(
      { path: '/notifications/read-all' },
      {
        onSuccess: () => {
          setToastMessage({ type: 'success', text: 'All notifications marked as read.' });
          qUnread.refetch();
        },
      }
    );
  };

  const handleArchiveAll = () => {
    mNotification.mutate(
      { path: '/notifications/archive-all' },
      {
        onSuccess: () => {
          setToastMessage({ type: 'success', text: 'All notifications archived.' });
          qUnread.refetch();
        },
      }
    );
  };

  const items = useMemo(() => {
    const raw = qNotifications.data?.items ?? [];
    if (!search.trim()) return raw;
    const s = search.toLowerCase().trim();
    return raw.filter(
      (n) =>
        n.title.toLowerCase().includes(s) ||
        n.message.toLowerCase().includes(s) ||
        (n.category && n.category.toLowerCase().includes(s)) ||
        (n.type && n.type.toLowerCase().includes(s))
    );
  }, [qNotifications.data?.items, search]);

  const totalAlerts = qNotifications.data?.pagination?.total ?? items.length;
  const unreadCount = qUnread.data ?? items.filter((n) => !n.read).length;
  const actionableCount = items.filter((n) => n.actions && n.actions.length > 0).length;
  const archivedCount = items.filter((n) => n.archived).length;
  const deliveryStatusLabel = (inApp ?? true) && (email ?? true) ? 'In-App & Email' : (inApp ?? true) ? 'In-App Only' : (email ?? true) ? 'Email Only' : 'Disabled';

  const allSelectedOnPage = items.length > 0 && items.every((n) => selectedIds.includes(n.id));

  const toggleSelectAll = () => {
    if (allSelectedOnPage) {
      setSelectedIds(selectedIds.filter((id) => !items.some((n) => n.id === id)));
    } else {
      const pageIds = items.map((n) => n.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
    }
  };

  const renderCategoryIcon = (cat?: string, type?: string) => {
    const c = (cat || type || '').toLowerCase();
    if (c.includes('offer'))
      return (
        <div className="job-entity-icon" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}>
          <Award size={18} />
        </div>
      );
    if (c.includes('app') || c.includes('candidate'))
      return (
        <div className="job-entity-icon" style={{ background: '#f3e8ff', border: '1px solid #e9d5ff', color: '#9333ea' }}>
          <UserCheck size={18} />
        </div>
      );
    if (c.includes('interview'))
      return (
        <div className="job-entity-icon" style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#d97706' }}>
          <Calendar size={18} />
        </div>
      );
    if (c.includes('assessment'))
      return (
        <div className="job-entity-icon" style={{ background: '#e0e7ff', border: '1px solid #c7d2fe', color: '#4f46e5' }}>
          <FileText size={18} />
        </div>
      );
    return (
      <div className="job-entity-icon" style={{ background: '#e0f2fe', border: '1px solid #bae6fd', color: '#0284c7' }}>
        <Shield size={18} />
      </div>
    );
  };

  const renderPriorityPill = (p?: string) => {
    const priority = (p || 'medium').toLowerCase();
    const tone =
      priority === 'critical' || priority === 'urgent'
        ? 'danger'
        : priority === 'high'
        ? 'warning'
        : priority === 'medium'
        ? 'info'
        : 'neutral';

    return (
      <span className={`job-status-pill job-status-pill--${tone}`}>
        <span className={`job-status-dot job-status-dot--${tone}`} />
        {priority}
      </span>
    );
  };

  return (
    <main className="ats-page" style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem' }}>
      <PageHeader
        title="Notification Center"
        description="Review alerts, candidate triggers, system events, and delivery preferences."
        secondaryActions={
          <nav className="ats-nav-tabs-wrapper" aria-label="Notification sections">
            <div className="ats-nav-tabs">
              <button
                type="button"
                className={`ats-nav-tab ${activeTab === 'inbox' ? 'active' : ''}`}
                onClick={() => setActiveTab('inbox')}
              >
                <Bell size={15} />
                <span>Inbox Alerts</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      background: activeTab === 'inbox' ? '#ef4444' : '#fee2e2',
                      color: activeTab === 'inbox' ? '#ffffff' : '#991b1b',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '9999px',
                      marginLeft: '4px',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                className={`ats-nav-tab ${activeTab === 'preferences' ? 'active' : ''}`}
                onClick={() => setActiveTab('preferences')}
              >
                <Settings size={15} />
                <span>Delivery Preferences</span>
              </button>
            </div>
          </nav>
        }
      />

      {toastMessage && (
        <Alert tone={toastMessage.type === 'success' ? 'success' : 'danger'}>
          {toastMessage.text}
        </Alert>
      )}

      {/* 5-Card Metrics Summary Grid */}
      <div className="ats-metrics-grid">
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box"><Bell size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--neutral">All Time</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Total Alerts</span>
            <span className="ats-metric-card__val">{totalAlerts}</span>
            <span className="ats-metric-card__sub">Notifications in catalog</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: unreadCount > 0 ? '#f59e0b' : '#64748b' }}><Clock size={18} /></div>
            <span className={`ats-metric-badge ats-metric-badge--${unreadCount > 0 ? 'warning' : 'neutral'}`}>
              {unreadCount > 0 ? 'Action Needed' : 'Caught Up'}
            </span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Unread Alerts</span>
            <span className="ats-metric-card__val">{unreadCount}</span>
            <span className="ats-metric-card__sub">Pending recruiter review</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#0284c7' }}><Sparkles size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--info">Actionable</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Action Needed</span>
            <span className="ats-metric-card__val">{actionableCount}</span>
            <span className="ats-metric-card__sub">Direct workflow triggers</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#64748b' }}><Archive size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--neutral">Archived</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Archived Alerts</span>
            <span className="ats-metric-card__val">{archivedCount}</span>
            <span className="ats-metric-card__sub">Stored in history</span>
          </div>
        </div>
        <div className="ats-metric-card">
          <div className="ats-metric-card__header">
            <div className="ats-metric-icon-box" style={{ background: '#10b981' }}><CheckCircle2 size={18} /></div>
            <span className="ats-metric-badge ats-metric-badge--success">Delivery</span>
          </div>
          <div className="ats-metric-card__body">
            <span className="ats-metric-card__label">Delivery Channels</span>
            <span className="ats-metric-card__val" style={{ fontSize: '1.25rem' }}>
              {deliveryStatusLabel}
            </span>
            <span className="ats-metric-card__sub">Active notification channels</span>
          </div>
        </div>
      </div>

      {activeTab === 'inbox' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters & Actions Toolbar */}
          <div className="ats-board-controls" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search notifications..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: '38px',
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    borderRadius: '9999px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>

              <Select
                aria-label="Filter by read state"
                value={readFilter}
                options={[
                  { value: '', label: 'All Alerts' },
                  { value: 'unread', label: 'Unread Only' },
                  { value: 'read', label: 'Read Only' },
                  { value: 'archived', label: 'Archived Only' },
                ]}
                onChange={(e) => {
                  setReadFilter(e.target.value);
                  const next = new URLSearchParams(sp);
                  next.delete('page');
                  setSp(next);
                }}
              />

              <Select
                aria-label="Filter by priority"
                value={priorityFilter}
                options={[
                  { value: '', label: 'All Priorities' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'high', label: 'High' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'low', label: 'Low' },
                ]}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  const next = new URLSearchParams(sp);
                  next.delete('page');
                  setSp(next);
                }}
              />

              <Select
                aria-label="Filter by category"
                value={categoryFilter}
                options={[
                  { value: '', label: 'All Categories' },
                  { value: 'offer', label: 'Offers' },
                  { value: 'application', label: 'Applications' },
                  { value: 'interview', label: 'Interviews' },
                  { value: 'assessment', label: 'Assessments' },
                  { value: 'system', label: 'System' },
                ]}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  const next = new URLSearchParams(sp);
                  next.delete('page');
                  setSp(next);
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Button
                variant="secondary"
                onClick={handleMarkAllRead}
                style={{ height: '36px', borderRadius: '9999px', fontSize: '0.8125rem' }}
              >
                <Check size={14} style={{ marginRight: '4px' }} /> Mark all read
              </Button>
              <Button
                variant="secondary"
                onClick={handleArchiveAll}
                style={{ height: '36px', borderRadius: '9999px', fontSize: '0.8125rem' }}
              >
                <Archive size={14} style={{ marginRight: '4px' }} /> Archive all
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  qNotifications.refetch();
                  qUnread.refetch();
                }}
                style={{ height: '36px', borderRadius: '9999px', fontSize: '0.8125rem' }}
              >
                <RefreshCw size={14} />
              </Button>
            </div>
          </div>

          {/* Batch Selection Action Bar */}
          {selectedIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '12px',
                fontSize: '0.875rem',
                boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
              }}
            >
              <span>{selectedIds.length} notification{selectedIds.length === 1 ? '' : 's'} selected</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="secondary"
                  onClick={() => handleBulkAction('read')}
                  style={{ height: '30px', fontSize: '0.78125rem', borderRadius: '9999px' }}
                >
                  Mark Selected Read
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleBulkAction('archive')}
                  style={{ height: '30px', fontSize: '0.78125rem', borderRadius: '9999px' }}
                >
                  Archive Selected
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => setSelectedIds([])}
                  style={{ height: '30px', fontSize: '0.78125rem', color: '#94a3b8' }}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Notifications List */}
          {qNotifications.isLoading ? (
            <LoadingState label="Loading recruiter notifications" />
          ) : qNotifications.isError ? (
            <ErrorState
              detail="Failed to retrieve recruiter notifications inbox."
              retry={() => void qNotifications.refetch()}
            />
          ) : items.length ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 8px 8px' }}>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 500,
                  }}
                >
                  {allSelectedOnPage ? <CheckSquare size={16} /> : <Square size={16} />}
                  <span>{allSelectedOnPage ? 'Deselect Page' : 'Select Page'}</span>
                </button>
                <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                  Showing {items.length} of {totalAlerts} alerts
                </span>
              </div>

              {items.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '16px 20px',
                    border: '1px solid var(--color-border-subtle, #e2e8f0)',
                    borderRadius: '16px',
                    background: n.read ? '#ffffff' : '#f8fafc',
                    marginBottom: '12px',
                    boxShadow: n.read ? '0 1px 3px rgba(0,0,0,0.02)' : '0 2px 8px rgba(15,23,42,0.04)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'flex-start',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ paddingTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(n.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, n.id]);
                        else setSelectedIds(selectedIds.filter((id) => id !== n.id));
                      }}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                  </div>

                  {renderCategoryIcon(n.category, n.type)}

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="job-code-badge" style={{ textTransform: 'uppercase' }}>
                          {n.category || n.type || 'SYSTEM'}
                        </span>
                        <span className="job-code-badge" style={{ background: '#f1f5f9', color: '#64748b' }}>
                          {`#NTF-${n.id.slice(-6).toUpperCase()}`}
                        </span>
                        {renderPriorityPill(n.priority)}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <strong style={{ fontSize: '0.9375rem', color: '#0f172a', fontWeight: 600 }}>{n.title}</strong>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.5 }}>{n.message}</p>

                    {n.actions && n.actions.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {n.actions.map((act: any) => (
                          <Button
                            key={act.label}
                            variant={act.label?.toLowerCase().includes('reject') || act.label?.toLowerCase().includes('decline') ? 'danger' : 'secondary'}
                            onClick={() => {
                              if (act.type === 'link') navigate(act.path);
                              else handleActionClick(act);
                            }}
                            style={{ height: '32px', borderRadius: '9999px', fontSize: '0.8125rem' }}
                          >
                            {act.label}
                          </Button>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                      <Button
                        variant="quiet"
                        onClick={() =>
                          mNotification.mutate({
                            path: `/notifications/${n.id}/${n.read ? 'unread' : 'read'}`,
                          })
                        }
                        style={{ height: '28px', fontSize: '0.75rem' }}
                      >
                        Mark {n.read ? 'Unread' : 'Read'}
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() =>
                          mNotification.mutate({
                            path: `/notifications/${n.id}/${n.archived ? 'unarchive' : 'archive'}`,
                          })
                        }
                        style={{ height: '28px', fontSize: '0.75rem' }}
                      >
                        {n.archived ? 'Restore' : 'Archive'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          mNotification.mutate({
                            path: `/notifications/${n.id}`,
                            method: 'DELETE',
                          })
                        }
                        style={{ height: '28px', fontSize: '0.75rem', color: '#ef4444', borderColor: '#fee2e2' }}
                      >
                        <Trash2 size={12} style={{ marginRight: '4px' }} /> Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination controls */}
              {qNotifications.data?.pagination && qNotifications.data.pagination.pages > 1 && (
                <nav className="od-pagination" aria-label="Pagination" style={{ marginTop: '16px' }}>
                  <Button
                    variant="secondary"
                    disabled={qNotifications.data.pagination.page <= 1}
                    onClick={() => {
                      const next = new URLSearchParams(sp);
                      next.set('page', String(qNotifications.data.pagination.page - 1));
                      setSp(next);
                    }}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {qNotifications.data.pagination.page} of {qNotifications.data.pagination.pages}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={qNotifications.data.pagination.page >= qNotifications.data.pagination.pages}
                    onClick={() => {
                      const next = new URLSearchParams(sp);
                      next.set('page', String(qNotifications.data.pagination.page + 1));
                      setSp(next);
                    }}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </div>
          ) : (
            <EmptyState
              title="All caught up!"
              description={
                search || readFilter || priorityFilter || categoryFilter
                  ? 'No notifications match your current search or filter criteria.'
                  : 'You have no notifications in your inbox.'
              }
            />
          )}
        </div>
      ) : (
        /* Delivery Preferences Tab */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          <Card heading="Delivery Channels" headingLevel={2}>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '16px' }}>
              Enable or disable notification delivery channels for recruiter activities.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={inApp ?? true}
                  onChange={(e) => setInApp(e.target.checked)}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer' }}
                />
                <Smartphone size={16} style={{ color: '#0284c7' }} />
                <span>In-App Notifications (Web dashboard inbox alerts)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={email ?? true}
                  onChange={(e) => setEmail(e.target.checked)}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer' }}
                />
                <Mail size={16} style={{ color: '#9333ea' }} />
                <span>Email Notifications (Immediate email digests on actions)</span>
              </label>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px' }}>
                Note: Mandatory security and account alerts are always delivered regardless of preference.
              </p>
            </div>
          </Card>

          <Card heading="Email Digest Schedule" headingLevel={2}>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '16px' }}>
              Bundle individual alerts into periodic email updates.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={digest ?? false}
                  onChange={(e) => setDigest(e.target.checked)}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer' }}
                />
                <span>Enable Email Digests</span>
              </label>
              {digest && (
                <>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Digest Frequency</span>
                    <Select
                      value={freq}
                      options={[
                        { value: 'daily', label: 'Daily Summary' },
                        { value: 'weekly', label: 'Weekly Summary' },
                      ]}
                      onChange={(e) => setFreq(e.target.value as 'daily' | 'weekly')}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Preferred Delivery Time</span>
                    <Select
                      value={String(prefHour)}
                      options={[
                        { value: '8', label: '08:00 AM UTC' },
                        { value: '9', label: '09:00 AM UTC' },
                        { value: '12', label: '12:00 PM UTC' },
                        { value: '17', label: '05:00 PM UTC' },
                      ]}
                      onChange={(e) => setPrefHour(Number(e.target.value))}
                    />
                  </label>
                </>
              )}
            </div>
          </Card>

          <Card heading="Quiet Hours Policy" headingLevel={2}>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '16px' }}>
              Pause non-critical notifications during your off-hours.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={quiet ?? false}
                  onChange={(e) => setQuiet(e.target.checked)}
                  style={{ width: '18px', height: '18px', borderRadius: '4px', cursor: 'pointer' }}
                />
                <span>Enable Quiet Hours</span>
              </label>
              {quiet && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Start Hour</span>
                    <Select
                      value={String(quietStart)}
                      options={Array.from({ length: 24 }).map((_, i) => ({
                        value: String(i),
                        label: `${String(i).padStart(2, '0')}:00`,
                      }))}
                      onChange={(e) => setQuietStart(Number(e.target.value))}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>End Hour</span>
                    <Select
                      value={String(quietEnd)}
                      options={Array.from({ length: 24 }).map((_, i) => ({
                        value: String(i),
                        label: `${String(i).padStart(2, '0')}:00`,
                      }))}
                      onChange={(e) => setQuietEnd(Number(e.target.value))}
                    />
                  </label>
                </div>
              )}
            </div>
          </Card>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
            <Button
              onClick={handleSavePreferences}
              loading={mPrefs.isPending}
              style={{ minWidth: '160px' }}
            >
              Save Preferences
            </Button>
            {mPrefs.isSuccess && (
              <span style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 500 }}>
                Preferences saved successfully!
              </span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
