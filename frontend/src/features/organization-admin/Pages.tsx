import { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useLocation,
  useBlocker,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  DescriptionList,
  EmptyState,
  ErrorState,
  Form,
  FormActions,
  FormSection,
  FieldError,
  LoadingState,
  PageHeader,
  PermissionState,
  SearchField,
  Select,
  StatusTag,
  TextArea,
  TextField,
  Toolbar,
} from '../../design-system';
import {
  companyToDraft,
  COMPANY_SIZES,
  emptyCompanyDraft,
  knownPermissions,
  type CompanyDraft,
  type TeamMember,
} from './model';
import {
  useAddMember,
  useCompany,
  useRemoveMember,
  useSaveCompany,
  useUpdateMember,
} from './api';
import './organization-admin.css';

const title = (s: string) =>
  s
    .replaceAll('.', ' · ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
const errorMessage = (e: unknown) =>
  e instanceof ApiError && e.status === 409
    ? 'The organization changed or this action is not allowed. Refresh and try again.'
    : e instanceof Error
      ? e.message
      : 'The request could not be completed.';
function useOrgAccess() {
  const auth = useAuth();
  const p = auth.recruiter?.permissions ?? [];
  return {
    ...auth,
    canCompany: p.includes('company.manage'),
    canTeam: p.includes('team.manage'),
  };
}
function Verification({ status, active }: { status: string; active: boolean }) {
  const tone =
    !active || status === 'suspended' || status === 'rejected'
      ? 'danger'
      : status === 'verified'
        ? 'success'
        : 'warning';
  return (
    <StatusTag tone={tone}>{!active ? 'Inactive' : title(status)}</StatusTag>
  );
}
function CompanyLoad({
  children,
  includeTeam = false,
}: {
  children: (company: ReturnType<typeof useCompany>['data']) => React.ReactNode;
  includeTeam?: boolean;
}) {
  const q = useCompany(true, includeTeam);
  if (q.isLoading) return <LoadingState label="Loading organization" />;
  if (q.isError)
    return (
      <ErrorState
        detail={(q.error as Error).message}
        retry={() => void q.refetch()}
      />
    );
  return <>{children(q.data)}</>;
}

export function CompanyOverviewPage() {
  const a = useOrgAccess();
  const location = useLocation();
  return (
    <main className="org-admin-page">
      <PageHeader
        title="Company"
        description="The public organization profile and membership status used across Talvix."
        primaryAction={
          a.canCompany ? (
            <Link
              className="tvx-button tvx-button--primary tvx-button--md"
              to="/org/company/edit"
            >
              Edit company
            </Link>
          ) : undefined
        }
      />
      {(location.state as { companySaved?: boolean } | null)?.companySaved && (
        <Alert tone="success" title="Company profile saved">
          Your supported public organization details are up to date.
        </Alert>
      )}
      <CompanyLoad>
        {(c) =>
          c ? (
            <>
              <div className="org-admin-summary">
                <Card
                  heading={c.name}
                  headingLevel={2}
                  actions={
                    <Verification
                      status={c.verificationStatus}
                      active={c.isActive}
                    />
                  }
                >
                  <p>
                    {c.description || 'No company description has been added.'}
                  </p>
                  <DescriptionList
                    items={[
                      {
                        term: 'Industry',
                        description: c.industry || 'Not provided',
                      },
                      {
                        term: 'Company size',
                        description: c.companySize
                          ? title(c.companySize)
                          : 'Not provided',
                      },
                      {
                        term: 'Website',
                        description: c.website ? (
                          <a href={c.website} rel="noreferrer" target="_blank">
                            Visit website
                          </a>
                        ) : (
                          'Not provided'
                        ),
                      },
                      {
                        term: 'Headquarters',
                        description:
                          [
                            c.headquarters?.city,
                            c.headquarters?.state,
                            c.headquarters?.country,
                          ]
                            .filter(Boolean)
                            .join(', ') || 'Not provided',
                      },
                    ]}
                  />
                </Card>
                <Card heading="Verification" headingLevel={2}>
                  <Verification
                    status={c.verificationStatus}
                    active={c.isActive}
                  />
                  <p>
                    {c.verificationStatus === 'verified'
                      ? 'Your organization is verified.'
                      : c.verificationStatus === 'rejected'
                        ? 'Verification was not approved. Contact Talvix support for safe next steps.'
                        : c.verificationStatus === 'suspended'
                          ? 'Organization access is suspended. Contact Talvix support.'
                          : 'Verification is pending. You may maintain supported profile information while review is in progress.'}
                  </p>
                  <p className="org-admin-note">
                    Private review notes are never displayed here.
                  </p>
                </Card>
              </div>
            </>
          ) : (
            <EmptyState
              title="No company yet"
              description="Create an organization to establish your recruiter workspace."
              action={
                <Link
                  className="tvx-button tvx-button--primary tvx-button--md"
                  to="/org/company/new"
                >
                  Create company
                </Link>
              }
            />
          )
        }
      </CompanyLoad>
    </main>
  );
}

const permissionGroups = [
  ['Company', ['company.manage']],
  ['Jobs', knownPermissions.filter((p) => p.startsWith('jobs.'))],
  [
    'Applications',
    knownPermissions.filter((p) => p.startsWith('applications.')),
  ],
  ['Assessments', knownPermissions.filter((p) => p.startsWith('assessments.'))],
  ['Interviews', knownPermissions.filter((p) => p.startsWith('interviews.'))],
  ['Offers', knownPermissions.filter((p) => p.startsWith('offers.'))],
  ['Team', ['team.manage']],
  ['Documents', knownPermissions.filter((p) => p.startsWith('documents.'))],
] as const;
function PermissionGroups({
  selected,
  onChange,
  disabled = false,
}: {
  selected: typeof knownPermissions;
  onChange: (permissions: typeof knownPermissions) => void;
  disabled?: boolean;
}) {
  return (
    <div className="org-permission-groups">
      {permissionGroups.map(([label, permissions]) => {
        const count = permissions.filter((permission) =>
          selected.includes(permission),
        ).length;
        return (
          <details key={label} className="org-permission-group" open>
            <summary>
              <strong>{label}</strong>
              <span>
                {count}/{permissions.length} selected
              </span>
            </summary>
            <fieldset disabled={disabled}>
              <legend className="visually-hidden">{label} permissions</legend>
              {permissions.map((permission) => (
                <Checkbox
                  key={permission}
                  label={title(permission)}
                  checked={selected.includes(permission)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, permission]
                        : selected.filter((item) => item !== permission),
                    )
                  }
                />
              ))}
            </fieldset>
          </details>
        );
      })}
    </div>
  );
}
function CompanyForm({ mode }: { mode: 'create' | 'edit' }) {
  const a = useOrgAccess(),
    nav = useNavigate(),
    q = useCompany(mode === 'edit'),
    save = useSaveCompany(mode);
  const [draft, setDraft] = useState<CompanyDraft | null>(null),
    [error, setError] = useState(''),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [saved, setSaved] = useState(false);
  const d =
    draft ??
    (mode === 'edit' && q.data ? companyToDraft(q.data) : emptyCompanyDraft);
  const set = (k: keyof CompanyDraft, v: string) => setDraft({ ...d, [k]: v });
  const dirty = draft !== null && !saved;
  const blocker = useBlocker(dirty);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  if (mode === 'edit' && !a.canCompany)
    return (
      <PermissionState
        title="Company editing unavailable"
        description="The company.manage permission is required. The server remains authoritative."
      />
    );
  if (mode === 'create' && a.recruiter?.company)
    return (
      <PermissionState
        title="Company creation unavailable"
        description="You already belong to an organization. Use the company profile to review supported settings."
      />
    );
  if (mode === 'edit' && q.isLoading)
    return <LoadingState label="Loading company editor" />;
  return (
    <main className="org-admin-page">
      <PageHeader
        title={mode === 'create' ? 'Create company' : 'Edit company'}
        description={
          mode === 'create'
            ? 'For approved recruiters who do not already belong to an organization.'
            : 'Changes update the organization profile used throughout Talvix.'
        }
      />
      {error && (
        <Alert tone="danger" title="Could not save">
          {error}
        </Alert>
      )}
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!d.name.trim()) {
            setError('Company name is required.');
            return;
          }
          try {
            setError('');
            setFieldErrors({});
            await save.mutateAsync(d);
            setSaved(true);
            await a.refreshCapabilities();
            nav('/org/company', { state: { companySaved: true } });
          } catch (x) {
            setError(errorMessage(x));
            setFieldErrors(x instanceof ApiError ? x.fieldErrors : {});
          }
        }}
      >
        <FormSection heading="Company identity">
          <TextField
            label="Company name"
            required
            value={d.name}
            error={fieldErrors.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <TextArea
            label="Description"
            value={d.description}
            error={fieldErrors.description}
            onChange={(e) => set('description', e.target.value)}
          />
          <div className="org-admin-grid">
            <TextField
              label="Website"
              type="url"
              value={d.website}
              error={fieldErrors.website}
              onChange={(e) => set('website', e.target.value)}
            />
            <TextField
              label="Public email"
              type="email"
              value={d.email}
              error={fieldErrors.email}
              onChange={(e) => set('email', e.target.value)}
            />
            <TextField
              label="Phone"
              value={d.phone}
              error={fieldErrors.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            <TextField
              label="Industry"
              value={d.industry}
              error={fieldErrors.industry}
              onChange={(e) => set('industry', e.target.value)}
            />
            <Select
              label="Company size"
              value={d.companySize}
              options={COMPANY_SIZES.map((v) => ({
                value: v,
                label: `${v} employees`,
              }))}
              onChange={(e) => set('companySize', e.target.value)}
            />
            {fieldErrors.companySize && (
              <FieldError>{fieldErrors.companySize}</FieldError>
            )}
            <TextField
              label="Founded year"
              type="number"
              value={d.foundedYear}
              error={fieldErrors.foundedYear}
              onChange={(e) => set('foundedYear', e.target.value)}
            />
          </div>
        </FormSection>
        <FormSection heading="Location and branding URLs">
          <div className="org-admin-grid">
            <TextField
              label="Headquarters city"
              value={d.headquartersCity}
              error={fieldErrors['headquarters.city']}
              onChange={(e) => set('headquartersCity', e.target.value)}
            />
            <TextField
              label="State or region"
              value={d.headquartersState}
              error={fieldErrors['headquarters.state']}
              onChange={(e) => set('headquartersState', e.target.value)}
            />
            <TextField
              label="Country"
              value={d.headquartersCountry}
              error={fieldErrors['headquarters.country']}
              onChange={(e) => set('headquartersCountry', e.target.value)}
            />
            <TextField
              label="Logo URL"
              type="url"
              value={d.logoUrl}
              error={fieldErrors['logo.url'] ?? fieldErrors.logo}
              onChange={(e) => set('logoUrl', e.target.value)}
            />
            <TextField
              label="Banner URL"
              type="url"
              value={d.bannerUrl}
              error={fieldErrors['banner.url'] ?? fieldErrors.banner}
              onChange={(e) => set('bannerUrl', e.target.value)}
            />
          </div>
          <TextArea
            label="Additional locations"
            hint="One location per line: City | State or region | Country"
            value={d.locations}
            error={
              fieldErrors.locations ??
              Object.entries(fieldErrors).find(([key]) =>
                key.startsWith('locations.'),
              )?.[1]
            }
            onChange={(e) => set('locations', e.target.value)}
          />
          <p className="org-admin-note">
            Talvix supports public image URLs here. There is no company-branding
            upload workflow.
          </p>
        </FormSection>
        <FormSection heading="Social links">
          <div className="org-admin-grid">
            {(['linkedin', 'twitter', 'github', 'facebook'] as const).map(
              (network) => (
                <TextField
                  key={network}
                  label={`${title(network)} URL`}
                  type="url"
                  value={d[network]}
                  error={fieldErrors[`socialLinks.${network}`]}
                  onChange={(e) => set(network, e.target.value)}
                />
              ),
            )}
          </div>
        </FormSection>
        <FormSection heading="Organization details">
          <TextArea
            label="Benefits, one per line"
            value={d.benefits}
            error={fieldErrors.benefits}
            onChange={(e) => set('benefits', e.target.value)}
          />
          <TextField
            label="Technologies, comma separated"
            value={d.technologies}
            error={fieldErrors.technologies}
            onChange={(e) => set('technologies', e.target.value)}
          />
        </FormSection>
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => nav('/org/company')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {mode === 'create' ? 'Create company' : 'Save changes'}
          </Button>
        </FormActions>
      </Form>
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && blocker.reset()}
          title="Discard company changes?"
          description="Your unsaved company profile changes will be lost."
          confirmLabel="Discard and leave"
          variant="destructive"
          onConfirm={async () => {
            setSaved(true);
            blocker.proceed();
          }}
        />
      )}
    </main>
  );
}
export const CompanyCreatePage = () => <CompanyForm mode="create" />;
export const CompanyEditPage = () => <CompanyForm mode="edit" />;

export function OrganizationSettingsPage() {
  const a = useOrgAccess();
  return (
    <main className="org-admin-page">
      <PageHeader
        title="Organization settings"
        description="Settings backed by the current company-profile contract."
      />
      <Card heading="Public company profile" headingLevel={2}>
        <p>
          Manage identity, contact information, locations, public branding URLs,
          benefits, and technologies.
        </p>
        {a.canCompany ? (
          <Link
            className="tvx-button tvx-button--secondary tvx-button--md"
            to="/org/company/edit"
          >
            Review profile settings
          </Link>
        ) : (
          <PermissionState description="company.manage is required to change profile settings." />
        )}
      </Card>
      <Card heading="Unavailable settings" headingLevel={2}>
        <p>
          Billing, domains, authentication policies, custom roles, ownership
          transfer, and deletion are not supported by the organization API.
        </p>
      </Card>
    </main>
  );
}

function TeamTable({ rows }: { rows: TeamMember[] }) {
  return (
    <DataTable
      caption="Organization team"
      rows={rows}
      rowKey={(m) => m.id}
      columns={[
        {
          id: 'name',
          header: 'Recruiter',
          render: (m) => (
            <>
              <strong>{m.fullName || 'Recruiter'}</strong>
              <small>{m.email}</small>
            </>
          ),
        },
        { id: 'role', header: 'Membership role', accessor: (m) => m.role },
        {
          id: 'status',
          header: 'Status',
          render: (m) => (
            <StatusTag tone={m.status === 'active' ? 'success' : 'neutral'}>
              {title(m.status)}
            </StatusTag>
          ),
        },
        {
          id: 'permissions',
          header: 'Permissions',
          render: (m) => `${m.permissions.length} granted`,
        },
      ]}
      renderNarrow={(m) => (
        <div className="org-member-card">
          <div>
            <strong>{m.fullName || 'Recruiter'}</strong>
            <small>{m.email}</small>
          </div>
          <StatusTag tone={m.status === 'active' ? 'success' : 'neutral'}>
            {title(m.status)}
          </StatusTag>
          <p>
            {m.role} · {m.permissions.length} permissions
          </p>
        </div>
      )}
      rowActions={(m) => (
        <Link
          className="tvx-button tvx-button--secondary tvx-button--md"
          to={`/org/team/${m.id}`}
        >
          Manage
        </Link>
      )}
    />
  );
}
export function TeamPage() {
  const a = useOrgAccess(),
    [sp, setSp] = useSearchParams(),
    q = (sp.get('q') ?? '').toLowerCase(),
    status = sp.get('status') ?? '';
  if (!a.canTeam)
    return (
      <PermissionState
        title="Team administration unavailable"
        description="The team.manage permission is required. Server authorization is authoritative."
      />
    );
  return (
    <main className="org-admin-page">
      <PageHeader
        title="Team & permissions"
        description="Manage active and removed memberships loaded from your organization."
        primaryAction={
          <Link
            className="tvx-button tvx-button--primary tvx-button--md"
            to="/org/team/add"
          >
            Add approved recruiter
          </Link>
        }
      />
      <CompanyLoad includeTeam>
        {(c) => {
          const rows = (c?.team ?? []).filter(
            (m) =>
              (!q ||
                `${m.fullName} ${m.email} ${m.role}`
                  .toLowerCase()
                  .includes(q)) &&
              (!status || m.status === status),
          );
          return (
            <>
              <Toolbar
                label="Team filters"
                start={
                  <SearchField
                    label="Search loaded team"
                    defaultValue={q}
                    onSearch={(v) => {
                      const n = new URLSearchParams(sp);
                      if (v) n.set('q', v);
                      else n.delete('q');
                      setSp(n);
                    }}
                  />
                }
                end={
                  <Select
                    aria-label="Membership status"
                    value={status}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'removed', label: 'Removed' },
                    ]}
                    onChange={(e) => {
                      const n = new URLSearchParams(sp);
                      if (e.target.value) n.set('status', e.target.value);
                      else n.delete('status');
                      setSp(n);
                    }}
                  />
                }
              />
              <p className="org-admin-note">
                Filters apply to the complete team returned by this organization
                response.
              </p>
              {rows.length ? (
                <TeamTable rows={rows} />
              ) : q || status ? (
                <EmptyState
                  title="No matching members"
                  description="Clear the loaded-team filters to see other members."
                />
              ) : (
                <EmptyState
                  title="No team members"
                  description="Add an already registered and approved recruiter by ID."
                />
              )}
            </>
          );
        }}
      </CompanyLoad>
    </main>
  );
}

export function TeamDetailPage() {
  const a = useOrgAccess(),
    { memberId = '' } = useParams(),
    q = useCompany(a.canTeam, true),
    nav = useNavigate(),
    company = q.data,
    member = company?.team.find((m) => m.id === memberId),
    isOwner = Boolean(
      member &&
      a.recruiter?.isCompanyOwner &&
      member.recruiterId === a.user?._id,
    );
  const [role, setRole] = useState<string | null>(null),
    [permissions, setPermissions] = useState<typeof knownPermissions | null>(
      null,
    ),
    [status, setStatus] = useState<'active' | 'removed' | null>(null),
    [confirm, setConfirm] = useState<'save' | 'remove' | null>(null),
    [error, setError] = useState('');
  const update = useUpdateMember(memberId),
    remove = useRemoveMember(memberId);
  if (!a.canTeam)
    return (
      <PermissionState description="team.manage is required to access this member." />
    );
  if (q.isLoading) return <LoadingState label="Loading team member" />;
  if (!member)
    return (
      <ErrorState
        title="Team member not found"
        detail="This member is not present in the current organization response."
      />
    );
  const chosen = permissions ?? member.permissions,
    currentRole = role ?? member.role,
    currentStatus = status ?? member.status;
  const added = chosen.filter((p) => !member.permissions.includes(p)),
    removed = member.permissions.filter((p) => !chosen.includes(p));
  return (
    <main className="org-admin-page">
      <PageHeader
        title={member.fullName || 'Team member'}
        description={member.email}
      />
      {error && (
        <Alert tone="danger" title="Action failed">
          {error}
        </Alert>
      )}
      {isOwner && (
        <Alert tone="info" title="Owner membership is immutable">
          Talvix does not support changing or removing the organization owner.
        </Alert>
      )}
      <Form
        onSubmit={(e) => {
          e.preventDefault();
          setConfirm('save');
        }}
      >
        <FormSection heading="Membership">
          <TextField
            label="Membership role"
            value={currentRole}
            readOnly={isOwner}
            onChange={(e) => setRole(e.target.value)}
          />
          <Select
            label="Status"
            value={currentStatus}
            disabled={isOwner}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'removed', label: 'Removed' },
            ]}
            onChange={(e) => setStatus(e.target.value as 'active' | 'removed')}
          />
        </FormSection>
        <FormSection heading="Permission matrix">
          <PermissionGroups
            selected={chosen}
            onChange={setPermissions}
            disabled={isOwner}
          />
        </FormSection>
        <Card
          heading="Proposed changes"
          headingLevel={2}
          className="org-change-review"
        >
          <p>
            <strong>Added:</strong> {added.map(title).join(', ') || 'None'}
          </p>
          <p>
            <strong>Removed:</strong> {removed.map(title).join(', ') || 'None'}
          </p>
        </Card>
        <FormActions>
          <Button
            type="button"
            variant="danger"
            disabled={isOwner || remove.isPending}
            onClick={() => setConfirm('remove')}
          >
            Remove member
          </Button>
          <Button type="submit" disabled={isOwner} loading={update.isPending}>
            Review and save
          </Button>
        </FormActions>
      </Form>
      {confirm && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={
            confirm === 'remove'
              ? 'Remove team member?'
              : 'Apply membership changes?'
          }
          description={
            confirm === 'remove'
              ? 'This immediately removes organization access and clears permissions.'
              : `Add ${added.length} and remove ${removed.length} permissions. The server will re-check your authority.`
          }
          confirmLabel={
            confirm === 'remove' ? 'Remove member' : 'Apply changes'
          }
          variant={confirm === 'remove' ? 'destructive' : 'default'}
          onConfirm={async () => {
            try {
              setError('');
              if (confirm === 'remove') {
                await remove.mutateAsync();
                await a.refreshCapabilities();
                nav('/org/team');
              } else {
                await update.mutateAsync({
                  role: currentRole,
                  permissions: chosen,
                  status: currentStatus,
                });
                await a.refreshCapabilities();
                setConfirm(null);
              }
            } catch (e) {
              setConfirm(null);
              setError(errorMessage(e));
            }
          }}
        />
      )}
    </main>
  );
}

export function AddTeamMemberPage() {
  const a = useOrgAccess(),
    nav = useNavigate(),
    add = useAddMember(),
    [recruiterId, setId] = useState(''),
    [role, setRole] = useState('recruiter'),
    [permissions, setPermissions] = useState<typeof knownPermissions>([]),
    [error, setError] = useState('');
  if (!a.canTeam)
    return (
      <PermissionState description="team.manage is required to add a member." />
    );
  return (
    <main className="org-admin-page">
      <PageHeader
        title="Add approved recruiter"
        description="Immediately add an existing recruiter account to this organization."
      />
      <Alert tone="info" title="This is not an invitation">
        The recruiter must already be registered, active, and admin-approved.
        Talvix does not provide recruiter search or email invitations.
      </Alert>
      {error && (
        <Alert tone="danger" title="Could not add recruiter">
          {error}
        </Alert>
      )}
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/^[a-f\d]{24}$/i.test(recruiterId)) {
            setError('Enter a valid 24-character recruiter ID.');
            return;
          }
          try {
            await add.mutateAsync({ recruiterId, role, permissions });
            await a.refreshCapabilities();
            nav('/org/team');
          } catch (x) {
            setError(errorMessage(x));
          }
        }}
      >
        <FormSection heading="Membership">
          <TextField
            label="Recruiter ID"
            required
            value={recruiterId}
            onChange={(e) => setId(e.target.value.trim())}
          />
          <TextField
            label="Membership role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </FormSection>
        <FormSection heading="Initial permissions">
          <PermissionGroups selected={permissions} onChange={setPermissions} />
        </FormSection>
        <FormActions>
          <Button
            type="button"
            variant="secondary"
            onClick={() => nav('/org/team')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={add.isPending}>
            Add recruiter now
          </Button>
        </FormActions>
      </Form>
    </main>
  );
}

export function UnsupportedOrganizationPage({
  kind,
}: {
  kind: 'invitations' | 'analytics' | 'exports';
}) {
  const copy = (
    {
      invitations: [
        'Invitations unavailable',
        'There are no invitation, list, resend, revoke, acceptance, or email APIs. Add an approved recruiter by ID from Team instead.',
      ],
      analytics: [
        'Organization analytics unavailable',
        'No organization-scoped analytics contract exists. System-admin analytics cannot be reused here.',
      ],
      exports: [
        'Organization exports unavailable',
        'No organization-scoped export contract exists. Talvix will not fabricate a client-side export.',
      ],
    } as const
  )[kind];
  return (
    <main className="org-admin-page">
      <PageHeader
        title={title(kind)}
        description="Supported capabilities only"
      />
      <EmptyState
        title={copy[0]}
        description={copy[1]}
        action={
          kind === 'invitations' ? (
            <Link
              className="tvx-button tvx-button--secondary tvx-button--md"
              to="/org/team/add"
            >
              Add approved recruiter
            </Link>
          ) : undefined
        }
      />
    </main>
  );
}
