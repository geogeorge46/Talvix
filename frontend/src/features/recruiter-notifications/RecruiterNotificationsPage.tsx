import { useState } from 'react';
import {
  Bell,
  Settings,
  Mail,
  Smartphone,
  Check,
  Archive,
  Trash,
} from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '../../design-system';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import {
  useNotifications,
  useNotificationMutation,
  useNotificationPreferences,
  useNotificationPreferenceMutation,
} from './api';

export function RecruiterNotificationsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'inbox' | 'preferences'>('inbox');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const qNotifications = useNotifications();
  const mNotification = useNotificationMutation();
  const qPrefs = useNotificationPreferences();
  const mPrefs = useNotificationPreferenceMutation();

  const handleActionClick = (action: any) => {
    apiRequest(action.path, { method: action.method || 'POST', body: action.body })
      .then(() => {
        alert('Action executed successfully.');
        qNotifications.refetch();
      })
      .catch(err => alert(err.message || 'Action execution failed'));
  };

  // Local Form state for preferences
  const [inApp, setInApp] = useState<boolean | null>(null);
  const [email, setEmail] = useState<boolean | null>(null);
  const [digest, setDigest] = useState<boolean | null>(null);
  const [freq, setFreq] = useState<'daily' | 'weekly'>('daily');

  // Initialize local prefs form state when queries load
  if (qPrefs.data && inApp === null) {
    setInApp(qPrefs.data.inAppEnabled);
    setEmail(qPrefs.data.emailEnabled);
    setDigest(qPrefs.data.digestEnabled);
    setFreq(qPrefs.data.digestFrequency);
  }

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
        preferredHour: qPrefs.data?.preferredHour || 9,
      },
      quietHours: {
        enabled: qPrefs.data?.quietHoursEnabled ?? false,
        startHour: qPrefs.data?.quietStartHour ?? 22,
        endHour: qPrefs.data?.quietEndHour ?? 7,
      },
    };
    mPrefs.mutate(payload);
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
          setSelectedIds([]);
        },
      }
    );
  };

  const handleMarkAllRead = () => {
    mNotification.mutate({
      path: '/notifications/read-all',
    });
  };

  const handleArchiveAll = () => {
    mNotification.mutate({
      path: '/notifications/archive-all',
    });
  };

  return (
    <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHeader
        title="Notification Center"
        description="Review alerts, candidate triggers, system events, and delivery preferences."
        secondaryActions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button
              variant={activeTab === 'inbox' ? 'secondary' : 'quiet'}
              onClick={() => setActiveTab('inbox')}
              leadingIcon={<Bell />}
            >
              Inbox
            </Button>
            <Button
              variant={activeTab === 'preferences' ? 'secondary' : 'quiet'}
              onClick={() => setActiveTab('preferences')}
              leadingIcon={<Settings />}
            >
              Preferences
            </Button>
          </div>
        }
      />

      {activeTab === 'inbox' ? (
        <Card heading="Inbox Alerts" headingLevel={2}>
          {qNotifications.isLoading ? (
            <LoadingState label="Loading recruiter notifications" />
          ) : qNotifications.isError ? (
            <ErrorState
              detail="Failed to retrieve recruiter notifications inbox."
              retry={() => void qNotifications.refetch()}
            />
          ) : (
            <>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: '1rem' }}>
                <Button variant="secondary" onClick={handleMarkAllRead}>
                  Mark all read
                </Button>
                <Button variant="secondary" onClick={handleArchiveAll}>
                  Archive all
                </Button>
                {selectedIds.length > 0 && (
                  <>
                    <Button variant="secondary" onClick={() => handleBulkAction('read')}>
                      Mark selected read
                    </Button>
                    <Button variant="secondary" onClick={() => handleBulkAction('archive')}>
                      Archive selected
                    </Button>
                  </>
                )}
              </div>

              {qNotifications.data?.items.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {qNotifications.data.items.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'flex-start',
                        padding: '1rem',
                        border: '1px solid var(--color-border-subtle)',
                        borderRadius: '8px',
                        background: n.read ? 'transparent' : 'var(--color-bg-accent-subtle)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(n.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, n.id]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== n.id));
                          }
                        }}
                        style={{ marginTop: '0.25rem' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--color-text-subtle)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span>{n.category || n.type}</span>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              background: n.priority === 'critical' ? 'var(--color-bg-danger-subtle || #fde8e8)' : n.priority === 'high' ? 'var(--color-bg-warning-subtle || #fef08a)' : n.priority === 'medium' ? 'var(--color-bg-info-subtle || #e0f2fe)' : 'var(--color-bg-subtle || #f3f4f6)',
                              color: n.priority === 'critical' ? '#b91c1c' : n.priority === 'high' ? '#a16207' : n.priority === 'medium' ? '#0369a1' : '#4b5563'
                            }}>
                              {n.priority}
                            </span>
                          </span>
                          <small style={{ color: 'var(--color-text-subtle)' }}>
                            {new Date(n.createdAt).toLocaleDateString()}
                          </small>
                        </div>
                        <h3 style={{ margin: '0.25rem 0' }}>{n.title}</h3>
                        <p style={{ margin: '0.5rem 0', color: 'var(--color-text-subtle)' }}>{n.message}</p>

                        {/* Actionable buttons */}
                        {n.actions && n.actions.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--color-border-subtle)' }}>
                            {n.actions.map((act: any) => (
                              <Button
                                key={act.label}
                                variant={act.label === 'Reject Candidate' || act.label === 'Decline' ? 'danger' : 'secondary'}
                                onClick={() => {
                                  if (act.type === 'link') {
                                    navigate(act.path);
                                  } else {
                                    handleActionClick(act);
                                  }
                                }}
                              >
                                {act.label}
                              </Button>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                          <Button
                            variant="quiet"
                            onClick={() =>
                              mNotification.mutate({
                                path: `/notifications/${n.id}/${n.read ? 'unread' : 'read'}`,
                              })
                            }
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
                          >
                            {n.archived ? 'Restore' : 'Archive'}
                          </Button>
                          <Button
                            variant="danger"
                            onClick={() =>
                              mNotification.mutate({
                                path: `/notifications/${n.id}`,
                                method: 'DELETE',
                              })
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="All caught up!"
                  description="You have no notifications in your inbox."
                />
              )}
            </>
          )}
        </Card>
      ) : (
        <Card heading="Notification Preferences" headingLevel={2}>
          {qPrefs.isLoading ? (
            <LoadingState label="Loading preferences" />
          ) : qPrefs.isError ? (
            <ErrorState
              detail="Failed to retrieve notification preferences."
              retry={() => void qPrefs.refetch()}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h3>Delivery Channels</h3>
                <p style={{ color: 'var(--color-text-subtle)', marginBottom: '1rem' }}>
                  Enable or disable notification delivery channels for recruiter activities.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={inApp ?? true}
                      onChange={(e) => setInApp(e.target.checked)}
                    />
                    <span>In-App Notifications (Web dashboard inbox alerts)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={email ?? true}
                      onChange={(e) => setEmail(e.target.checked)}
                    />
                    <span>Email Notifications (Immediate email digests on actions)</span>
                  </label>
                </div>
              </div>

              <div>
                <h3>Email Digests</h3>
                <p style={{ color: 'var(--color-text-subtle)', marginBottom: '1rem' }}>
                  Bundle individual alerts into periodic email updates.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={digest ?? false}
                      onChange={(e) => setDigest(e.target.checked)}
                    />
                    <span>Enable Email Digests</span>
                  </label>
                  {digest && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <span>Frequency</span>
                      <select
                        value={freq}
                        onChange={(e) => setFreq(e.target.value as 'daily' | 'weekly')}
                        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border-subtle)', width: '200px' }}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </label>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1.5rem' }}>
                <Button
                  onClick={handleSavePreferences}
                  disabled={mPrefs.isPending}
                >
                  Save Preferences
                </Button>
                {mPrefs.isSuccess && (
                  <span style={{ color: 'var(--color-text-success)', marginLeft: '1rem' }}>
                    Preferences saved successfully!
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
