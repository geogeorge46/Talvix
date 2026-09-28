import { useEffect, useRef, useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  FileEdit,
  Archive,
  Users,
  Search,
  Plus,
  Clock,
  Code2,
  CheckSquare,
  Layers,
  FileText,
  HelpCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  RotateCcw,
  AlertCircle,
  Send,
  FileCheck,
  Eye,
  Sparkles,
} from 'lucide-react';
import {
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DataTable,
  DescriptionList,
  Dialog,
  EmptyState,
  ErrorState,
  FilteredEmptyState,
  LoadingState,
  PageHeader,
  PermissionState,
  Select,
  StatusTag,
  TextArea,
  TextField,
} from '../../design-system';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import {
  useAssessment,
  useAssessments,
  useAssessmentAction,
  useAssessmentSave,
  useComposition,
  useAssignment,
  useAssignments,
  useAttempt,
  useResult,
  useReviews,
  useReview,
  useReviewAction,
  useSaveAnswer,
  useStart,
  useSubmit,
  useQuestions,
  useAttemptDocuments,
  downloadAttemptDocument,
  uploadAttemptDeliverable,
  useCohortLeaderboard,
  usePromoteCandidates,
  useGenerateQuestions,
} from './api';
import {
  formatDate,
  label,
  type Assessment,
  type Assignment,
  type Question,
  type CohortCandidate,
  type PromoteCandidatesResult,
} from './model';
import './assessments.css';
const err = (e: unknown) =>
  e instanceof Error ? e.message : 'The request could not be completed.';
const oid = /^[a-f\d]{24}$/i;
const has = (p: string[], v: string) => p.includes(v);
const statusTone = (s: string) =>
  s === 'completed' || s === 'published'
    ? 'success'
    : s === 'expired' || s === 'cancelled'
      ? 'danger'
      : s === 'evaluating' || s === 'submitted'
        ? 'warning'
        : 'neutral';
export function Tabs() {
  const { recruiter } = useAuth();
  const manage = has(recruiter?.permissions ?? [], 'assessments.manage');

  return (
    <div className="as-nav-tabs-wrapper">
      <nav className="as-nav-tabs" aria-label="Assessment sections">
        <NavLink
          to="/org/assessments"
          end
          className={({ isActive }) => `as-nav-tab ${isActive ? 'active' : ''}`}
        >
          <FileText size={15} />
          <span>Definitions</span>
        </NavLink>
        <NavLink
          to="/org/assessments/assignments"
          className={({ isActive }) => `as-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Users size={15} />
          <span>Assignments</span>
        </NavLink>
        <NavLink
          to="/org/assessments/questions"
          className={({ isActive }) => `as-nav-tab ${isActive ? 'active' : ''}`}
        >
          <HelpCircle size={15} />
          <span>Question Bank</span>
        </NavLink>
        <NavLink
          to="/org/assessments/blueprints"
          className={({ isActive }) => `as-nav-tab ${isActive ? 'active' : ''}`}
        >
          <Layers size={15} />
          <span>Blueprints</span>
        </NavLink>
        <NavLink
          to="/org/assessments/reviews"
          className={({ isActive }) => `as-nav-tab ${isActive ? 'active' : ''}`}
        >
          <CheckCircle2 size={15} />
          <span>Reviews</span>
        </NavLink>
        {manage && (
          <NavLink
            to="/org/assessments/new"
            className={({ isActive }) => `as-nav-tab as-nav-tab--create ${isActive ? 'active' : ''}`}
          >
            <Plus size={15} />
            <span>Create assessment</span>
          </NavLink>
        )}
      </nav>
    </div>
  );
}

function formatDateTimeParts(dateStr?: string) {
  if (!dateStr) return { date: '-', time: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '-', time: '' };
    const dateFormatted = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
    const timeFormatted = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
    return { date: dateFormatted, time: timeFormatted };
  } catch {
    return { date: '-', time: '' };
  }
}

function getAssessmentTypeIcon(type: string) {
  switch (type) {
    case 'coding':
      return <Code2 size={18} />;
    case 'single-choice':
    case 'multiple-choice':
    case 'mcq':
      return <CheckSquare size={18} />;
    case 'work-sample':
      return <Briefcase size={18} />;
    default:
      return <Layers size={18} />;
  }
}

function Empty({ filtered = false, onClear }: { filtered?: boolean; onClear?: () => void }) {
  return filtered ? (
    <FilteredEmptyState
      title="No matching assessments found"
      description="Try clearing search keywords or status filters."
      onClear={onClear || (() => location.assign(location.pathname))}
    />
  ) : (
    <EmptyState
      title="No assessments defined yet"
      description="Create your first candidate assessment definition to get started."
    />
  );
}

export function AssessmentsPage() {
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'assessments.view');
  const manage = has(recruiter?.permissions ?? [], 'assessments.manage');
  const [p, setP] = useSearchParams();

  const search = p.get('search') || '';
  const statusFilter = p.get('status') || '';
  const typeFilter = p.get('type') || '';
  const sort = p.get('sort') || 'newest';
  const page = Math.max(1, Number(p.get('page') || 1));
  const limit = 10;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Paginated query for table
  const queryStr = `page=${page}&limit=${limit}&sort=${sort}${
    search ? `&search=${encodeURIComponent(search)}` : ''
  }${statusFilter ? `&status=${statusFilter}` : ''}${
    typeFilter ? `&type=${typeFilter}` : ''
  }`;
  const q = useAssessments(queryStr, can);

  // Queries for top 5 metric cards summary
  const allQ = useAssessments('limit=50&sort=newest', can);
  const assignmentsQ = useAssignments('limit=1', can);

  if (!can) {
    return (
      <PermissionState description="The assessments.view permission is required." />
    );
  }

  const items = (q.data?.items ?? []) as Assessment[];
  const totalItems = q.data?.pagination?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  const allItems = (allQ.data?.items ?? []) as Assessment[];
  const totalAssessments = allQ.data?.pagination?.total ?? allItems.length;
  const publishedCount = allItems.filter((a) => a.status === 'published').length;
  const draftCount = allItems.filter((a) => a.status === 'draft').length;
  const archivedCount = allItems.filter((a) => a.status === 'archived').length;
  const totalAssignedCount = assignmentsQ.data?.pagination?.total ?? 0;

  const startIdx = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, totalItems);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handlePageChange = (newPage: number) => {
    const n = new URLSearchParams(p);
    n.set('page', String(newPage));
    setP(n);
  };

  const handleClearFilters = () => {
    const n = new URLSearchParams();
    setP(n);
    setSelectedIds(new Set());
  };

  const isFiltered = Boolean(search || statusFilter || typeFilter || sort !== 'newest');

  return (
    <div className="as-page">
      {/* Header & Sub-Navigation Pill Tabs */}
      <PageHeader
        title="Assessments"
        description="Design, publish and monitor structured technical and behavioral assessments."
        secondaryActions={<Tabs />}
      />

      {/* 5 Metrics Cards (Matching the Parclgo design from the image) */}
      <div className="as-metrics-grid">
        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <ClipboardCheck size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--success">
              • Configured
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Total Assessments</span>
            <strong className="as-metric-card__val">{totalAssessments}</strong>
            <span className="as-metric-card__sub">Assessment templates</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <CheckCircle2 size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--success">
              • Active
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Published</span>
            <strong className="as-metric-card__val" style={{ color: '#059669' }}>
              {publishedCount}
            </strong>
            <span className="as-metric-card__sub">Ready for candidates</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <FileEdit size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--warning">
              • In Progress
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">In Draft</span>
            <strong className="as-metric-card__val" style={{ color: '#d97706' }}>
              {draftCount}
            </strong>
            <span className="as-metric-card__sub">Under composition</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <Archive size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--neutral">
              • Retired
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Archived</span>
            <strong className="as-metric-card__val" style={{ color: '#475569' }}>
              {archivedCount}
            </strong>
            <span className="as-metric-card__sub">Historical records</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <Users size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--info">
              • Assigned
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Total Assignments</span>
            <strong className="as-metric-card__val" style={{ color: '#0284c7' }}>
              {totalAssignedCount}
            </strong>
            <span className="as-metric-card__sub">Candidate invitations</span>
          </div>
        </div>
      </div>

      {/* Modern Filter Toolbar (Matching the image) */}
      <div className="as-modern-toolbar">
        <div className="as-toolbar-filters">
          <div className="as-filter-group">
            <span className="as-filter-label">Search</span>
            <div className="as-search-container">
              <Search className="as-search-icon" size={16} />
              <input
                type="text"
                className="as-search-input"
                placeholder="Search assessments by title, skill..."
                value={search}
                onChange={(e) => {
                  const n = new URLSearchParams(p);
                  if (e.target.value) n.set('search', e.target.value);
                  else n.delete('search');
                  n.set('page', '1');
                  setP(n);
                }}
              />
              {search && (
                <button
                  type="button"
                  className="as-search-clear"
                  onClick={() => {
                    const n = new URLSearchParams(p);
                    n.delete('search');
                    n.set('page', '1');
                    setP(n);
                  }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="as-filter-group">
            <span className="as-filter-label">Status</span>
            <select
              className="as-pill-select"
              value={statusFilter}
              onChange={(e) => {
                const n = new URLSearchParams(p);
                if (e.target.value) n.set('status', e.target.value);
                else n.delete('status');
                n.set('page', '1');
                setP(n);
              }}
            >
              <option value="">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="as-filter-group">
            <span className="as-filter-label">Type</span>
            <select
              className="as-pill-select"
              value={typeFilter}
              onChange={(e) => {
                const n = new URLSearchParams(p);
                if (e.target.value) n.set('type', e.target.value);
                else n.delete('type');
                n.set('page', '1');
                setP(n);
              }}
            >
              <option value="">All types</option>
              <option value="mixed">Mixed</option>
              <option value="coding">Coding</option>
              <option value="single-choice">Single Choice</option>
              <option value="multiple-choice">Multiple Choice</option>
              <option value="work-sample">Work Sample</option>
            </select>
          </div>

          <div className="as-filter-group">
            <span className="as-filter-label">Sort By</span>
            <select
              className="as-pill-select"
              value={sort}
              onChange={(e) => {
                const n = new URLSearchParams(p);
                n.set('sort', e.target.value);
                setP(n);
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

          {isFiltered && (
            <button
              type="button"
              className="tvx-button tvx-button--secondary text-xs"
              style={{ borderRadius: '9999px', height: '42px', padding: '0 16px' }}
              onClick={handleClearFilters}
            >
              <RotateCcw size={14} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Modern Data Table Card (Matching the design of the image) */}
      <div className="as-table-card">
        {q.isError ? (
          <div className="p-6">
            <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
          </div>
        ) : q.isLoading ? (
          <div className="p-12">
            <LoadingState label="Loading assessments list..." />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <Empty filtered={isFiltered} onClear={handleClearFilters} />
          </div>
        ) : (
          <>
            <div className="as-table-wrapper">
              <table className="as-modern-table" aria-label="Assessments table">
                <thead>
                  <tr>
                    <th scope="col" className="as-checkbox-cell">
                      <input
                        type="checkbox"
                        className="as-custom-checkbox"
                        aria-label="Select all assessments"
                        checked={items.length > 0 && selectedIds.size === items.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th scope="col">Assessment ID</th>
                    <th scope="col">Assessment</th>
                    <th scope="col">Status</th>
                    <th scope="col">Format & Marks</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Pass Criteria</th>
                    <th scope="col">Created Date</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => {
                    const isSelected = selectedIds.has(a.id);
                    const dt = formatDateTimeParts(a.createdAt);
                    const shortCode = `#ASM-${a.id.slice(-6).toUpperCase()}`;

                    return (
                      <tr key={a.id} className={isSelected ? 'is-selected' : undefined}>
                        <td className="as-checkbox-cell">
                          <input
                            type="checkbox"
                            className="as-custom-checkbox"
                            aria-label={`Select ${a.title}`}
                            checked={isSelected}
                            onChange={() => handleToggleRow(a.id)}
                          />
                        </td>
                        <td>
                          <span className="as-code-badge">{shortCode}</span>
                        </td>
                        <td>
                          <div className="as-entity-cell">
                            <div className="as-entity-icon">
                              {getAssessmentTypeIcon(a.type)}
                            </div>
                            <div className="as-entity-info">
                              <Link
                                to={`/org/assessments/${a.id}`}
                                className="as-entity-title"
                              >
                                {a.title}
                              </Link>
                              <span className="as-entity-meta">
                                <span>{label(a.type)}</span>
                                {a.skills && a.skills.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{a.skills.slice(0, 2).join(', ')}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`as-status-pill as-status-pill--${
                              a.status === 'published'
                                ? 'published'
                                : a.status === 'draft'
                                ? 'draft'
                                : 'archived'
                            }`}
                          >
                            <span className="as-status-dot" />
                            {label(a.status)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 500 }}>
                              {a.questionCount} {a.questionCount === 1 ? 'Question' : 'Questions'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {a.totalMarks ? `${a.totalMarks} total marks` : 'Variable marks'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={14} style={{ color: '#94a3b8' }} />
                            <span>{a.durationMinutes} mins</span>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: 500,
                              color: '#334155',
                            }}
                          >
                            {a.passingPercentage}% to pass
                          </span>
                        </td>
                        <td>
                          <div className="as-date-cell">
                            <span className="as-date-main">{dt.date}</span>
                            {dt.time && <span className="as-date-sub">{dt.time}</span>}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Link
                              to={`/org/assessments/${a.id}`}
                              className="as-action-link"
                            >
                              Open
                            </Link>
                            {a.status === 'published' && has(recruiter?.permissions ?? [], 'assessments.assign') && (
                              <Link
                                to={`/org/assessments/assignments/new?assessmentId=${a.id}`}
                                className="as-action-link"
                                style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }}
                              >
                                Assign
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer (Matching the image) */}
            <div className="as-pagination-footer">
              <span className="as-pagination-info">
                Showing {startIdx} to {endIdx} of {totalItems} assessments
              </span>

              <div className="as-pagination-controls">
                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => {
                  if (
                    pNum === 1 ||
                    pNum === totalPages ||
                    (pNum >= page - 1 && pNum <= page + 1)
                  ) {
                    return (
                      <button
                        key={pNum}
                        type="button"
                        className={`as-page-btn ${pNum === page ? 'as-page-btn--active' : ''}`}
                        onClick={() => handlePageChange(pNum)}
                      >
                        {pNum}
                      </button>
                    );
                  }
                  if (pNum === page - 2 || pNum === page + 2) {
                    return (
                      <span
                        key={pNum}
                        style={{ padding: '0 4px', color: '#94a3b8', fontSize: '0.8125rem' }}
                      >
                        ...
                      </span>
                    );
                  }
                  return null;
                })}

                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
const initial = {
  title: '',
  description: '',
  instructions: '',
  type: 'general',
  durationMinutes: '30',
  passingPercentage: '70',
};
export function AssessmentFormPage() {
  const { assessmentId } = useParams();
  const edit = Boolean(assessmentId);
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'assessments.manage');
  const q = useAssessment(assessmentId ?? '', edit && can);
  const save = useAssessmentSave(assessmentId);
  const nav = useNavigate();
  const [d, setD] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [initializedAssessmentId, setInitializedAssessmentId] = useState('');
  if (q.data && initializedAssessmentId !== q.data.id) {
    setInitializedAssessmentId(q.data.id);
    setD({
      title: q.data.title,
      description: q.data.description,
      instructions: q.data.instructions,
      type: q.data.type,
      durationMinutes: String(q.data.durationMinutes),
      passingPercentage: String(q.data.passingPercentage),
    });
  }
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    addEventListener('beforeunload', fn);
    return () => removeEventListener('beforeunload', fn);
  }, [dirty]);
  if (!can)
    return (
      <PermissionState description="The assessments.manage permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading assessment" />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await save.mutateAsync({
        ...d,
        durationMinutes: Number(d.durationMinutes),
        passingPercentage: Number(d.passingPercentage),
        skills: [],
        maximumAttempts: 1,
        shuffleQuestions: false,
        shuffleOptions: false,
        showResultImmediately: false,
        allowBackNavigation: true,
        negativeMarking: false,
        negativeMarkValue: 0,
        attachments: {
          enabled: false,
          maximumFiles: 0,
          maximumFileBytes: 10485760,
          maximumTotalBytes: 20971520,
          allowedMimeTypes: [],
        },
      });
      setDirty(false);
      const id = (result as { assessment?: { _id?: string } }).assessment?._id;
      nav(
        edit
          ? `/org/assessments/${assessmentId}`
          : `/org/assessments/${id ?? ''}`,
      );
    } catch {
      /* rendered */
    }
  };
  return (
    <div className="as-page">
      <div className="as-page-header-row">
        <div>
          <PageHeader
            title={edit ? 'Edit Assessment' : 'Create Assessment'}
            description="Configure candidate-facing instructions, time limits, and passing criteria."
          />
        </div>
        <Tabs />
      </div>

      {!edit && (
        <div className="as-starter-cards">
          <button
            type="button"
            className={`as-starter-card ${d.type === 'technical' ? 'active' : ''}`}
            onClick={() =>
              setD((prev) => ({
                ...prev,
                type: 'technical',
                durationMinutes: '60',
                passingPercentage: '65',
              }))
            }
          >
            <div className="as-starter-card__icon">
              <Code2 size={18} />
            </div>
            <span className="as-starter-card__title">Technical Assessment</span>
            <span className="as-starter-card__desc">
              Recommended for engineering roles. Standard 60-min timed evaluation with coding criteria.
            </span>
          </button>

          <button
            type="button"
            className={`as-starter-card ${d.type === 'work-sample' ? 'active' : ''}`}
            onClick={() =>
              setD((prev) => ({
                ...prev,
                type: 'work-sample',
                durationMinutes: '180',
                passingPercentage: '70',
              }))
            }
          >
            <div className="as-starter-card__icon">
              <Briefcase size={18} />
            </div>
            <span className="as-starter-card__title">Take-Home Project</span>
            <span className="as-starter-card__desc">
              Best for case studies and design challenges. Allows file deliverable submission and rubric evaluation.
            </span>
          </button>

          <button
            type="button"
            className={`as-starter-card ${d.type === 'general' ? 'active' : ''}`}
            onClick={() =>
              setD((prev) => ({
                ...prev,
                type: 'general',
                durationMinutes: '45',
                passingPercentage: '50',
              }))
            }
          >
            <div className="as-starter-card__icon">
              <CheckSquare size={18} />
            </div>
            <span className="as-starter-card__title">General Screening</span>
            <span className="as-starter-card__desc">
              Quick aptitude & multiple-choice screening. 45-min duration with immediate scoring options.
            </span>
          </button>
        </div>
      )}

      <form className="as-form-card" onSubmit={submit}>
        <div className="as-form-header">
          <h2 className="as-form-title">
            {edit ? 'Update Assessment Details' : 'Assessment Specifications'}
          </h2>
          <p className="as-form-desc">
            Provide the assessment title, candidate instructions, and delivery parameters.
          </p>
        </div>

        <div className="as-form-section">
          <h3 className="as-form-section-heading">
            <FileText size={16} /> Basic Information
          </h3>
          <TextField
            required
            label="Assessment Title"
            placeholder="e.g. Senior Frontend Engineer Challenge"
            value={d.title}
            onChange={(e) => {
              setD({ ...d, title: e.target.value });
              setDirty(true);
            }}
          />
          <TextArea
            label="Internal Description"
            placeholder="Describe the assessment objectives and target seniority..."
            value={d.description}
            onChange={(e) => {
              setD({ ...d, description: e.target.value });
              setDirty(true);
            }}
          />
          <TextArea
            label="Candidate-Facing Instructions"
            placeholder="Provide clear rules, environment requirements, and submission instructions for the candidate..."
            value={d.instructions}
            onChange={(e) => {
              setD({ ...d, instructions: e.target.value });
              setDirty(true);
            }}
          />
        </div>

        <div className="as-form-section">
          <h3 className="as-form-section-heading">
            <Clock size={16} /> Format & Thresholds
          </h3>
          <div className="as-form-grid-3">
            <Select
              label="Evaluation Type"
              value={d.type}
              onChange={(e) => setD({ ...d, type: e.target.value })}
              options={[
                'general',
                'technical',
                'aptitude',
                'coding',
                'mixed',
                'work-sample',
              ].map((x) => ({ value: x, label: label(x) }))}
            />
            <TextField
              label="Duration (Minutes)"
              type="number"
              min="5"
              max="1440"
              value={d.durationMinutes}
              onChange={(e) => setD({ ...d, durationMinutes: e.target.value })}
            />
            <TextField
              label="Passing Percentage (%)"
              type="number"
              min="0"
              max="100"
              value={d.passingPercentage}
              onChange={(e) => setD({ ...d, passingPercentage: e.target.value })}
            />
          </div>
        </div>

        {save.isError && (
          <div style={{ marginBottom: '16px' }}>
            <Alert tone="danger" title="Could not save assessment">
              {err(save.error)}
            </Alert>
          </div>
        )}

        <div className="as-form-footer">
          <button
            type="button"
            className="as-btn-table-action"
            onClick={() => nav(-1)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="as-btn-black"
            disabled={save.isPending || !d.title.trim()}
          >
            {save.isPending ? 'Saving...' : edit ? 'Save Changes' : 'Create Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
}
function QuestionList({
  a,
  manage,
  onAddClick,
  onRemove,
  isRemoving,
}: {
  a: Assessment;
  manage: boolean;
  onAddClick?: () => void;
  onRemove?: (questionId: string) => void;
  isRemoving?: boolean;
}) {
  return (
    <Card
      heading="Questions"
      headingLevel={2}
      description="Use the explicit controls to review composition. Dragging is never required."
      actions={
        manage && a.status === 'draft' && onAddClick ? (
          <Button variant="secondary" onClick={onAddClick}>
            Add question from bank
          </Button>
        ) : undefined
      }
    >
      {a.questions.length ? (
        <ol className="as-questions" style={{ listStyle: 'none', padding: 0 }}>
          {a.questions.map((q, i) => (
            <li key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid var(--color-border-default)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', wordBreak: 'break-word' }}>{q.title || q.prompt}</strong>
                  <small style={{ display: 'block', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {label(q.type)} · {q.marks} marks
                  </small>
                </div>
              </div>
              {manage && a.status === 'draft' && onRemove && (
                <div style={{ flexShrink: 0 }}>
                  <Button
                    variant="danger"
                    onClick={() => onRemove(q.id)}
                    disabled={isRemoving}
                  >
                    Remove
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title="No questions added"
          description="Add questions from the reusable question bank before publishing."
        />
      )}
    </Card>
  );
}

function AddQuestionDialog({
  open,
  onOpenChange,
  onAdd,
  isAdding,
  existingIds,
  defaultTopic = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (q: Question) => Promise<void>;
  isAdding: boolean;
  existingIds: string[];
  defaultTopic?: string;
}) {
  const [mode, setMode] = useState<'bank' | 'ai'>('bank');
  const query = useQuestions(open);
  const questions = (query.data?.items ?? []) as Question[];

  // AI Generator state
  const generate = useGenerateQuestions();
  const [userTopic, setUserTopic] = useState<string | null>(null);
  const topic = userTopic ?? defaultTopic;
  const [skills, setSkills] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [type, setType] = useState<'mixed' | 'single-choice' | 'multiple-choice' | 'coding' | 'work-sample'>('mixed');
  const [count, setCount] = useState('3');
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [isAddingAll, setIsAddingAll] = useState(false);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;
    const skillsList = skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const numCount = Math.min(Math.max(parseInt(count, 10) || 3, 1), 10);
    try {
      const res = await generate.mutateAsync({
        topic: topic.trim(),
        ...(skillsList.length ? { skills: skillsList } : {}),
        difficulty,
        type,
        count: numCount,
      });
      setGeneratedQuestions(res.questions);
    } catch {
      // Handled by generate.isError
    }
  };

  const handleAddAll = async () => {
    setIsAddingAll(true);
    try {
      for (const q of generatedQuestions) {
        if (!existingIds.includes(q.id)) {
          await onAdd(q);
        }
      }
    } finally {
      setIsAddingAll(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add questions to assessment"
      description="Select reusable questions from the question bank or generate targeted questions using AI."
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--color-border-default)', paddingBottom: '12px' }}>
        <Button
          variant={mode === 'bank' ? 'primary' : 'secondary'}
          onClick={() => setMode('bank')}
        >
          From Question Bank
        </Button>
        <Button
          variant={mode === 'ai' ? 'primary' : 'secondary'}
          onClick={() => setMode('ai')}
        >
          ✨ Generate with AI
        </Button>
      </div>

      {mode === 'bank' ? (
        query.isLoading ? (
          <LoadingState label="Loading question bank" />
        ) : query.isError ? (
          <ErrorState detail={err(query.error)} retry={() => void query.refetch()} />
        ) : questions.length === 0 ? (
          <EmptyState
            title="No reusable questions"
            description="Create some questions in the Question Bank or switch to '✨ Generate with AI'."
          />
        ) : (
          <div style={{ maxHeight: '440px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 2px' }}>
            {questions.map((q) => {
              const added = existingIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '20px',
                    padding: '14px 16px',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '8px',
                    backgroundColor: added ? 'var(--color-bg-subtle, #f8fafc)' : 'var(--color-surface-1, #ffffff)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontWeight: 600,
                        fontSize: '14px',
                        lineHeight: '1.45',
                        color: 'var(--color-text-default)',
                        marginBottom: '4px',
                        wordBreak: 'break-word',
                      }}
                    >
                      {q.title || q.prompt}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                        {label(q.type)} · {q.marks} marks
                      </span>
                      {q.category && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '1px 7px',
                            borderRadius: '10px',
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                          }}
                        >
                          {q.category}
                        </span>
                      )}
                      {q.difficulty && (
                        <span
                          style={{
                            fontSize: '11px',
                            textTransform: 'capitalize',
                            padding: '1px 7px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--color-bg-subtle, #f1f5f9)',
                            color: 'var(--color-text-muted)',
                            border: '1px solid var(--color-border-default)',
                          }}
                        >
                          {q.difficulty}
                        </span>
                      )}
                      {q.skills && q.skills.length > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {q.skills.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    <Button
                      variant={added ? 'quiet' : 'secondary'}
                      disabled={added || isAdding}
                      onClick={() => void onAdd(q)}
                      style={{ minWidth: '108px', textAlign: 'center' }}
                    >
                      {added ? 'Added' : 'Add to Test'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <form
            onSubmit={handleGenerate}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            <TextField
              label="Topic or Focus Area"
              required
              placeholder="e.g. React Performance, PostgreSQL Indexing, Python Async"
              value={topic}
              onChange={(e) => setUserTopic(e.target.value)}
            />
            <TextField
              label="Key Skills (comma-separated, optional)"
              placeholder="e.g. React, TypeScript, Redux"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <Select
                label="Difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                options={[
                  { value: 'easy', label: 'Easy' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'hard', label: 'Hard' },
                ]}
              />
              <Select
                label="Question Type"
                value={type}
                onChange={(e) =>
                  setType(
                    e.target.value as
                      | 'mixed'
                      | 'single-choice'
                      | 'multiple-choice'
                      | 'coding'
                      | 'work-sample',
                  )
                }
                options={[
                  { value: 'mixed', label: 'Mixed Types' },
                  { value: 'single-choice', label: 'Single Choice' },
                  { value: 'multiple-choice', label: 'Multiple Choice' },
                  { value: 'coding', label: 'Coding Challenge' },
                  { value: 'work-sample', label: 'Work Sample' },
                ]}
              />
              <Select
                label="Count"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                options={[
                  { value: '1', label: '1 question' },
                  { value: '2', label: '2 questions' },
                  { value: '3', label: '3 questions' },
                  { value: '5', label: '5 questions' },
                ]}
              />
            </div>

            {generate.isError && (
              <Alert tone="danger" title="Generation failed">
                {generate.error instanceof Error
                  ? generate.error.message
                  : 'An error occurred during question generation.'}
              </Alert>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button
                variant="primary"
                type="submit"
                loading={generate.isPending}
                disabled={!topic.trim()}
              >
                ✨ Generate Questions
              </Button>
            </div>
          </form>

          {generatedQuestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-default)' }}>
                  Generated {generatedQuestions.length} Questions (Saved to Bank)
                </span>
                {generatedQuestions.some((q) => !existingIds.includes(q.id)) && (
                  <Button
                    variant="secondary"
                    onClick={() => void handleAddAll()}
                    disabled={isAddingAll || isAdding}
                    loading={isAddingAll}
                  >
                    Add All to Assessment
                  </Button>
                )}
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {generatedQuestions.map((q) => {
                  const added = existingIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '16px',
                        padding: '12px 14px',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: '6px',
                        backgroundColor: added ? 'var(--color-bg-subtle, #f8fafc)' : 'var(--color-surface-1, #ffffff)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: '13px', color: 'var(--color-text-default)', marginBottom: '4px' }}>
                          {q.title || q.prompt}
                        </strong>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {label(q.type)} · {q.marks} marks
                          </span>
                          {q.category && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                              }}
                            >
                              {q.category}
                            </span>
                          )}
                          {q.difficulty && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                textTransform: 'capitalize',
                                backgroundColor: 'var(--color-surface-1, #f1f5f9)',
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              {q.difficulty}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <Button
                          variant={added ? 'quiet' : 'secondary'}
                          disabled={added || isAdding || isAddingAll}
                          onClick={() => void onAdd(q)}
                          style={{ minWidth: '96px', textAlign: 'center' }}
                        >
                          {added ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}h ${remM}m`;
  }
  return `${m}m ${s}s`;
}

export function PromoteCohortCandidatesModal({
  open,
  onClose,
  assessmentId,
  selectedCandidates,
  onPromoted,
}: {
  open: boolean;
  onClose: () => void;
  assessmentId: string;
  selectedCandidates: CohortCandidate[];
  onPromoted?: (result: PromoteCandidatesResult) => void;
}) {
  const [targetStage, setTargetStage] = useState<
    'shortlisted' | 'interview-scheduled' | 'under-review'
  >('interview-scheduled');
  const [reason, setReason] = useState('');
  const [allowProvisional, setAllowProvisional] = useState(false);
  const [result, setResult] = useState<PromoteCandidatesResult | null>(null);
  const promote = usePromoteCandidates(assessmentId);
  const hasProvisional = selectedCandidates.some((c) => c.isProvisional);

  const handleClose = () => {
    setResult(null);
    setAllowProvisional(false);
    setReason('');
    setTargetStage('interview-scheduled');
    onClose();
  };

  const handlePromote = async () => {
    try {
      const res = await promote.mutateAsync({
        applicationIds: selectedCandidates.map((c) => c.applicationId),
        targetStage,
        reason: reason.trim() || undefined,
        allowProvisional,
      });
      setResult(res);
      onPromoted?.(res);
    } catch {
      // Handled by promote.error
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
      title={result ? 'Advancement Results' : 'Advance Candidates to Next Round'}
      description={
        result
          ? 'Review the outcome of the cohort advancement request.'
          : `Advance ${selectedCandidates.length} selected candidate(s) to the next application stage.`
      }
      busy={promote.isPending}
      footer={
        result ? (
          <Button onClick={handleClose}>Done</Button>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={promote.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handlePromote()}
              loading={promote.isPending}
              disabled={
                promote.isPending ||
                selectedCandidates.length === 0 ||
                (hasProvisional && !allowProvisional)
              }
            >
              Advance {selectedCandidates.length} Candidate
              {selectedCandidates.length !== 1 ? 's' : ''}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="as-dialog-content">
          <div className="as-cohort-summary-grid">
            <div className="as-cohort-metric">
              <span>Promoted</span>
              <strong style={{ color: 'var(--color-success, #16a34a)' }}>
                {result.summary.promoted}
              </strong>
            </div>
            <div className="as-cohort-metric">
              <span>Already in Stage</span>
              <strong>{result.summary.alreadyInStage}</strong>
            </div>
            <div className="as-cohort-metric">
              <span>Failed / Skipped</span>
              <strong
                style={{
                  color:
                    result.summary.failed > 0
                      ? 'var(--color-danger, #dc2626)'
                      : undefined,
                }}
              >
                {result.summary.failed}
              </strong>
            </div>
          </div>
          {result.summary.note && (
            <Alert tone="info" title="Advancement Summary">
              {result.summary.note}
            </Alert>
          )}
          {result.details && result.details.length > 0 && (
            <div
              style={{
                marginTop: '16px',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              <table
                style={{
                  width: '100%',
                  fontSize: '0.875rem',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom:
                        '1px solid var(--color-border-subtle, #e2e8f0)',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '6px 8px' }}>Candidate</th>
                    <th style={{ padding: '6px 8px' }}>Status</th>
                    <th style={{ padding: '6px 8px' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {result.details.map((d) => (
                    <tr
                      key={d.applicationId}
                      style={{
                        borderBottom:
                          '1px solid var(--color-border-subtle, #f1f5f9)',
                      }}
                    >
                      <td style={{ padding: '6px 8px' }}>
                        <strong>{d.candidateName || d.applicationId}</strong>
                        {d.candidateEmail && (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {d.candidateEmail}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <StatusTag
                          tone={
                            d.status === 'promoted'
                              ? 'success'
                              : d.status === 'already-in-stage'
                                ? 'neutral'
                                : 'danger'
                          }
                        >
                          {label(d.status)}
                        </StatusTag>
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          fontSize: '0.8125rem',
                        }}
                      >
                        {d.reason ||
                          (d.status === 'promoted'
                            ? `Advanced to ${result.summary.targetStage}`
                            : '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div
          className="as-dialog-content"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <Alert tone="info" title="Interview Scheduling Notice">
            Advancing candidate stage to <strong>interview-scheduled</strong> qualifies
            them for the interview round. Specific calendar time slots, panel
            interviewers, and conference links must be scheduled separately in the
            Interviews workspace.
          </Alert>

          {hasProvisional && (
            <div>
              <Alert tone="warning" title="Provisional Scores Detected">
                {selectedCandidates.filter((c) => c.isProvisional).length}{' '}
                selected candidate(s) have provisional evaluation scores (pending
                manual review or unfinalized evaluations). The backend requires
                explicit confirmation to advance candidates with provisional scores.
              </Alert>
              <div style={{ marginTop: '8px' }}>
                <Checkbox
                  label="Allow advancing candidates with provisional reviews (allowProvisional)"
                  description="Required to advance candidates whose evaluations have not undergone final review."
                  checked={allowProvisional}
                  onChange={(e) => setAllowProvisional(e.target.checked)}
                />
              </div>
            </div>
          )}

          <Select
            label="Target Application Stage"
            value={targetStage}
            onChange={(e) =>
              setTargetStage(
                e.target.value as
                  | 'shortlisted'
                  | 'interview-scheduled'
                  | 'under-review',
              )
            }
            options={[
              {
                value: 'interview-scheduled',
                label: 'Advance to Interview Round (interview-scheduled)',
              },
              { value: 'shortlisted', label: 'Shortlist (shortlisted)' },
              {
                value: 'under-review',
                label: 'Move to Under Review (under-review)',
              },
            ]}
          />

          <TextField
            label="Audit Reason / Note (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Qualified based on top cohort assessment score"
          />

          {promote.isError && (
            <Alert tone="danger" title="Advancement Request Failed">
              {err(promote.error)}
            </Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}

export function CohortLeaderboardSection({
  assessmentId,
  canManageApplications,
}: {
  assessmentId: string;
  canManageApplications: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(new Set());
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);

  const queryStr = statusFilter ? `status=${statusFilter}` : '';
  const q = useCohortLeaderboard(assessmentId, queryStr);

  if (q.isLoading) return <LoadingState label="Loading cohort leaderboard" />;
  if (q.isError)
    return <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />;

  const leaderboard = q.data;
  const summary = leaderboard?.summary ?? {
    totalAssigned: 0,
    notStarted: 0,
    inProgress: 0,
    underReview: 0,
    completed: 0,
    resultReleased: 0,
    overdue: 0,
    cancelled: 0,
  };
  const candidates: CohortCandidate[] = leaderboard?.candidates ?? [];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAppIds(new Set(candidates.map((c) => c.applicationId)));
    } else {
      setSelectedAppIds(new Set());
    }
  };

  const handleToggleCandidate = (appId: string) => {
    const next = new Set(selectedAppIds);
    if (next.has(appId)) {
      next.delete(appId);
    } else {
      next.add(appId);
    }
    setSelectedAppIds(next);
  };

  const selectedCandidates = candidates.filter((c) =>
    selectedAppIds.has(c.applicationId),
  );

  return (
    <div className="as-cohort-leaderboard">
      <div className="as-cohort-summary-grid">
        <div className="as-cohort-metric">
          <span>Total Assigned</span>
          <strong>{summary.totalAssigned}</strong>
        </div>
        <div className="as-cohort-metric">
          <span>Completed</span>
          <strong style={{ color: 'var(--color-success, #16a34a)' }}>
            {summary.completed}
          </strong>
        </div>
        <div className="as-cohort-metric">
          <span>In Progress</span>
          <strong>{summary.inProgress}</strong>
        </div>
        <div className="as-cohort-metric">
          <span>Under Review</span>
          <strong style={{ color: 'var(--color-warning, #d97706)' }}>
            {summary.underReview}
          </strong>
        </div>
        <div className="as-cohort-metric">
          <span>Overdue</span>
          <strong style={{ color: 'var(--color-danger, #dc2626)' }}>
            {summary.overdue}
          </strong>
        </div>
        <div className="as-cohort-metric">
          <span>Cancelled</span>
          <strong>{summary.cancelled}</strong>
        </div>
      </div>

      <div className="as-leaderboard-toolbar">
        <div style={{ minWidth: '220px' }}>
          <Select
            label="Filter by Assignment Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSelectedAppIds(new Set());
            }}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'completed', label: 'Completed' },
              { value: 'under-review', label: 'Under Review' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'not-started', label: 'Not Started' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selectedAppIds.size > 0 && (
            <Button
              variant="primary"
              onClick={() => setPromoteModalOpen(true)}
              disabled={!canManageApplications}
              title={
                !canManageApplications
                  ? 'The applications.manage permission is required to advance candidates.'
                  : undefined
              }
            >
              Advance Selected ({selectedAppIds.size})
            </Button>
          )}
          <Button variant="secondary" onClick={() => void q.refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {!canManageApplications && selectedAppIds.size > 0 && (
        <Alert tone="warning" title="Permission Notice">
          You need the <strong>applications.manage</strong> permission to advance
          candidates to the next round.
        </Alert>
      )}

      {candidates.length === 0 ? (
        <EmptyState
          title="No candidates found"
          description={
            statusFilter
              ? 'No candidates match the selected status filter.'
              : 'No candidates have been assigned to this assessment yet.'
          }
        />
      ) : (
        <div className="tvx-data">
          <div className="tvx-data__wide">
            <table>
              <thead>
                <tr>
                  <th scope="col" style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      aria-label="Select all candidates"
                      checked={
                        candidates.length > 0 &&
                        selectedAppIds.size === candidates.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th scope="col">Rank</th>
                  <th scope="col">Candidate</th>
                  <th scope="col">Status</th>
                  <th scope="col">Score</th>
                  <th scope="col">Evaluation</th>
                  <th scope="col">Competencies</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const isSelected = selectedAppIds.has(c.applicationId);
                  return (
                    <tr
                      key={c.applicationId}
                      className={isSelected ? 'tvx-row--selected' : undefined}
                    >
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${c.candidateName}`}
                          checked={isSelected}
                          onChange={() =>
                            handleToggleCandidate(c.applicationId)
                          }
                        />
                      </td>
                      <td>
                        <strong>#{c.rank}</strong>
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {c.candidateName}
                          </span>
                          <small
                            style={{
                              color: 'var(--color-text-secondary, #64748b)',
                            }}
                          >
                            {c.candidateEmail}
                          </small>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--color-text-secondary, #64748b)',
                            }}
                          >
                            App: {c.applicationNumber}
                            {c.university ? ` • ${c.university}` : ''}
                            {c.department ? ` (${c.department})` : ''}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusTag tone={statusTone(c.status)}>
                          {label(c.status)}
                        </StatusTag>
                      </td>
                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>
                            {c.score !== null && c.score !== undefined
                              ? `${c.score} (${c.percentage}%)`
                              : '-'}
                          </span>
                          {c.passed === true && (
                            <StatusTag tone="success">Passed</StatusTag>
                          )}
                          {c.passed === false && (
                            <StatusTag tone="danger">Failed</StatusTag>
                          )}
                        </div>
                      </td>
                      <td>
                        {c.isProvisional ? (
                          <span
                            className="as-category-pill as-category-pill--provisional"
                            title="Evaluation is provisional (manual review pending)"
                          >
                            ⚠️ Provisional
                          </span>
                        ) : c.status === 'completed' ||
                          c.status === 'result-released' ? (
                          <span className="as-category-pill">Final</span>
                        ) : (
                          <span
                            style={{
                              color: 'var(--color-text-secondary, #64748b)',
                            }}
                          >
                            -
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="as-category-pills">
                          {c.categoryScores?.map((cat) => (
                            <span
                              key={cat.category}
                              className={`as-category-pill ${
                                cat.isProvisional
                                  ? 'as-category-pill--provisional'
                                  : ''
                              }`}
                              title={`${cat.category}: ${cat.awardedMarks}/${cat.totalMarks} (${cat.percentage}%)${
                                cat.isProvisional ? ' - Provisional' : ''
                              }`}
                            >
                              {cat.category}: {cat.percentage}%
                              {cat.isProvisional ? ' ⚠️' : ''}
                            </span>
                          ))}
                          {!c.categoryScores?.length && <span>-</span>}
                        </div>
                      </td>
                      <td>{formatDuration(c.durationSeconds)}</td>
                      <td>{c.submittedAt ? formatDate(c.submittedAt) : '-'}</td>
                      <td>
                        {c.attemptId ? (
                          <Link
                            to={`/org/assessments/reviews/${c.attemptId}`}
                            className="tvx-button tvx-button--secondary text-xs"
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {c.isProvisional || c.status === 'under-review'
                              ? 'Review Submission'
                              : 'View Submission'}
                          </Link>
                        ) : (
                          <span
                            style={{
                              color: 'var(--color-text-secondary, #64748b)',
                            }}
                          >
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PromoteCohortCandidatesModal
        open={promoteModalOpen}
        onClose={() => setPromoteModalOpen(false)}
        assessmentId={assessmentId}
        selectedCandidates={selectedCandidates}
        onPromoted={() => {
          setSelectedAppIds(new Set());
          void q.refetch();
        }}
      />
    </div>
  );
}

export function AssessmentDetailPage() {
  const { assessmentId = '' } = useParams();
  const { recruiter } = useAuth();
  const view = has(recruiter?.permissions ?? [], 'assessments.view'),
    manage = has(recruiter?.permissions ?? [], 'assessments.manage'),
    canManageApplications = has(
      recruiter?.permissions ?? [],
      'applications.manage',
    );
  const q = useAssessment(assessmentId, view && oid.test(assessmentId));
  const action = useAssessmentAction(assessmentId);
  const composition = useComposition(assessmentId);
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'structure' | 'leaderboard'>(
    'structure',
  );

  if (!view)
    return (
      <PermissionState description="The assessments.view permission is required." />
    );
  if (q.isLoading) return <LoadingState label="Loading assessment" />;
  if (q.isError)
    return <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />;
  if (!q.data) return null;
  const a = q.data;

  const handleAddQuestion = async (question: Question) => {
    await composition.mutateAsync({
      action: 'add',
      body: { questionId: question.id, marks: question.marks },
    });
    setAddOpen(false);
  };

  const handleRemoveQuestion = async (questionId: string) => {
    await composition.mutateAsync({
      action: 'remove',
      questionId,
    });
  };

  const existingIds = a.questions.map((q) => q.id);

  return (
    <div className="as-page">
      <PageHeader
        title={a.title}
        description={a.description || 'No description provided.'}
        metadata={
          <StatusTag tone={statusTone(a.status)}>{label(a.status)}</StatusTag>
        }
        primaryAction={
          manage && a.status === 'draft' ? (
            <Button onClick={() => void action.mutateAsync('publish')}>
              Publish
            </Button>
          ) : undefined
        }
        secondaryActions={
          manage ? (
            <>
              <Link
                className="tvx-button tvx-button--secondary"
                to={`/org/assessments/${a.id}/edit`}
              >
                Edit
              </Link>
              {a.status === 'published' && (
                <>
                  {has(recruiter?.permissions ?? [], 'assessments.assign') && (
                    <Link
                      className="tvx-button tvx-button--primary"
                      to={`/org/assessments/assignments/new?assessmentId=${a.id}`}
                    >
                      Assign to candidate
                    </Link>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => void action.mutateAsync('archive')}
                  >
                    Archive
                  </Button>
                </>
              )}
            </>
          ) : undefined
        }
      />
      {action.isError && (
        <Alert
          tone={
            (action.error as ApiError).status === 409 ? 'warning' : 'danger'
          }
          title="Assessment changed"
        >
          {err(action.error)} Refresh before trying again.
        </Alert>
      )}

      <div className="as-tab-bar" role="tablist" aria-label="Assessment views">
        <Button
          variant={activeTab === 'structure' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('structure')}
          role="tab"
          aria-selected={activeTab === 'structure'}
        >
          Structure & Questions
        </Button>
        <Button
          variant={activeTab === 'leaderboard' ? 'primary' : 'secondary'}
          onClick={() => setActiveTab('leaderboard')}
          role="tab"
          aria-selected={activeTab === 'leaderboard'}
        >
          Cohort Leaderboard & Results
        </Button>
      </div>

      {activeTab === 'structure' ? (
        <>
          <div className="as-layout">
            <Card heading="Definition" headingLevel={2}>
              <DescriptionList
                items={[
                  { term: 'Type', description: label(a.type) },
                  {
                    term: 'Duration',
                    description: `${a.durationMinutes} minutes`,
                  },
                  {
                    term: 'Passing score',
                    description: `${a.passingPercentage}%`,
                  },
                  {
                    term: 'Back navigation',
                    description: a.allowBackNavigation
                      ? 'Allowed'
                      : 'Not allowed',
                  },
                ]}
              />
              <h3>Candidate instructions</h3>
              <p className="as-preserve">
                {a.instructions || 'No instructions provided.'}
              </p>
            </Card>
            <QuestionList
              a={a}
              manage={manage}
              onAddClick={() => setAddOpen(true)}
              onRemove={handleRemoveQuestion}
              isRemoving={composition.isPending}
            />
          </div>
          {composition.isError && (
            <Alert tone="danger" title="Question composition failed">
              {err(composition.error)}
            </Alert>
          )}
          <AddQuestionDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdd={handleAddQuestion}
            isAdding={composition.isPending}
            existingIds={existingIds}
            defaultTopic={a.title}
          />
        </>
      ) : (
        <CohortLeaderboardSection
          assessmentId={a.id}
          canManageApplications={canManageApplications}
        />
      )}
    </div>
  );
}
function AssignmentCard({
  a,
  candidate = false,
}: {
  a: Assignment;
  candidate?: boolean;
}) {
  return (
    <article className="as-record">
      <div>
        <strong>{a.title}</strong>
        {!candidate && <span>{a.candidateName}</span>}
      </div>
      <StatusTag tone={statusTone(a.status)}>{label(a.status)}</StatusTag>
      <span>Due {formatDate(a.expiresAt)}</span>
      <Link
        className="tvx-button tvx-button--secondary"
        to={`${candidate ? '/candidate/assessments' : '/org/assessments/assignments'}/${a.id}`}
      >
        Open
      </Link>
    </article>
  );
}
export function AssignmentsPage({
  candidate = false,
}: {
  candidate?: boolean;
}) {
  const { recruiter } = useAuth();
  const can =
    candidate || has(recruiter?.permissions ?? [], 'assessments.view');
  const [p, setP] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const currentPage = Number(p.get('page') || 1);
  const currentStatus = p.get('status') || '';

  const q = useAssignments(
    `page=${currentPage}&limit=10${currentStatus ? `&status=${currentStatus}` : ''}`,
    can,
    candidate,
  );

  // Fetch summary counts for cards when recruiter view
  const summaryQ = useAssignments('limit=50', can && !candidate, false);

  if (!can)
    return (
      <PermissionState description="The assessments.view permission is required." />
    );

  const rawRows = (q.data?.items ?? []) as Assignment[];
  const allAssignments = (summaryQ.data?.items ?? []) as Assignment[];

  const countTotal = summaryQ.data?.total ?? allAssignments.length;
  const countInProgress = allAssignments.filter((a) => a.status === 'in-progress').length;
  const countSubmitted = allAssignments.filter((a) => a.status === 'submitted' || a.status === 'evaluating').length;
  const countCompleted = allAssignments.filter((a) => a.status === 'completed').length;
  const countExpired = allAssignments.filter((a) => a.status === 'expired').length;

  if (candidate) {
    return (
      <div className="candidate-page candidate-domain-container">
        <div className="candidate-hero-banner-mindease">
          <div className="banner-left-content">
            <div className="banner-icon-badge theme-green">
              <ClipboardCheck size={22} />
            </div>
            <div className="banner-text-details">
              <h1 className="banner-title">My Assessments</h1>
              <p className="banner-subtext">Review instructions, deadlines and your assessment progress.</p>
            </div>
          </div>
        </div>
        <Select
          label="Status filter"
          value={p.get('status') || ''}
          onChange={(e) => {
            const n = new URLSearchParams(p);
            if (e.target.value) n.set('status', e.target.value);
            else n.delete('status');
            setP(n);
          }}
          options={[
            'assigned',
            'available',
            'in-progress',
            'submitted',
            'evaluating',
            'completed',
            'expired',
            'cancelled',
          ].map((x) => ({ value: x, label: label(x) }))}
        />
        {q.isError ? (
          <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
        ) : (
          <DataTable
            caption="Assigned assessments"
            rows={rawRows}
            rowKey={(a) => a.id}
            isLoading={q.isLoading}
            empty={<Empty filtered={p.has('status')} />}
            columns={[
              {
                id: 'assessment',
                header: 'Assessment',
                render: (a) => <strong>{a.title}</strong>,
              },
              {
                id: 'status',
                header: 'Status',
                render: (a) => (
                  <StatusTag tone={statusTone(a.status)}>
                    {label(a.status)}
                  </StatusTag>
                ),
              },
              {
                id: 'expiry',
                header: 'Deadline',
                render: (a) => formatDate(a.expiresAt),
              },
            ]}
            renderNarrow={(a) => <AssignmentCard a={a} candidate={candidate} />}
            rowActions={(a) => (
              <Link
                className="tvx-button tvx-button--secondary tvx-button--compact"
                to={`/candidate/assessments/${a.id}`}
              >
                Open
              </Link>
            )}
          />
        )}
      </div>
    );
  }

  // Recruiter view
  const filteredRows = rawRows.filter((a) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (a.title || '').toLowerCase().includes(term) ||
      (a.candidateName || '').toLowerCase().includes(term) ||
      (a.id || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil((q.data?.total || filteredRows.length) / 10) || 1;

  const setPageParam = (newPage: number) => {
    const next = new URLSearchParams(p);
    next.set('page', String(newPage));
    setP(next);
  };

  const handleStatusChange = (val: string) => {
    const next = new URLSearchParams(p);
    if (val) next.set('status', val);
    else next.delete('status');
    next.set('page', '1');
    setP(next);
  };

  const clearFilters = () => {
    setSearchTerm('');
    const next = new URLSearchParams(p);
    next.delete('status');
    next.set('page', '1');
    setP(next);
  };

  const toggleSelectAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      filteredRows.forEach((a) => {
        next[a.id] = true;
      });
    }
    setSelectedIds(next);
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allSelected =
    filteredRows.length > 0 && filteredRows.every((a) => selectedIds[a.id]);

  return (
    <div className="as-page">
      <div className="as-page-header-row">
        <div>
          <PageHeader
            title="Candidate Assignments"
            description="Track candidate invitations, ongoing tests, deadlines, and review readiness."
          />
        </div>
        <Tabs />
      </div>

      {/* 5 Top Metric Cards */}
      <div className="as-metrics-grid">
        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <Users size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--neutral">
              All Cohorts
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Total Assignments</span>
            <span className="as-metric-card__val">{countTotal}</span>
            <span className="as-metric-card__sub">Across all candidate pools</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#0284c7' }}>
              <Clock size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--info">Active</span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">In Progress</span>
            <span className="as-metric-card__val">{countInProgress}</span>
            <span className="as-metric-card__sub">Candidates testing now</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#7c3aed' }}>
              <Send size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--warning">
              Needs Scoring
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Submitted</span>
            <span className="as-metric-card__val">{countSubmitted}</span>
            <span className="as-metric-card__sub">Awaiting evaluation</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#16a34a' }}>
              <CheckCircle2 size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--success">
              Finalized
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Completed</span>
            <span className="as-metric-card__val">{countCompleted}</span>
            <span className="as-metric-card__sub">Graded & results ready</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#e11d48' }}>
              <AlertCircle size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--neutral">
              Overdue
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Expired</span>
            <span className="as-metric-card__val">{countExpired}</span>
            <span className="as-metric-card__sub">Passed deadline</span>
          </div>
        </div>
      </div>

      {/* Modern Toolbar */}
      <div className="as-modern-toolbar">
        <div className="as-toolbar-filters">
          <div className="as-search-container">
            <Search className="as-search-icon" size={16} />
            <input
              type="text"
              className="as-search-input"
              placeholder="Search candidate, assessment title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="as-search-clear"
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="as-filter-group">
            <span className="as-filter-label">Status</span>
            <select
              className="as-pill-select"
              value={currentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in-progress">In Progress</option>
              <option value="submitted">Submitted</option>
              <option value="evaluating">Evaluating</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {(searchTerm || currentStatus) && (
            <button
              type="button"
              className="as-action-link"
              onClick={clearFilters}
              style={{ height: '42px', borderRadius: '9999px', padding: '0 16px' }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>

        <div className="as-toolbar-actions">
          {has(recruiter?.permissions ?? [], 'assessments.assign') && (
            <Link
              className="as-btn-black"
              to="/org/assessments/assignments/new"
            >
              <Plus size={16} /> Assign Assessment
            </Link>
          )}
        </div>
      </div>

      {/* Modern Table Card */}
      <div className="as-table-card">
        {q.isError ? (
          <div style={{ padding: '24px' }}>
            <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
          </div>
        ) : q.isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <LoadingState label="Loading candidate assignments..." />
          </div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <Empty filtered={Boolean(searchTerm || currentStatus)} />
          </div>
        ) : (
          <div className="as-table-wrapper">
            <table className="as-modern-table">
              <thead>
                <tr>
                  <th className="as-checkbox-cell">
                    <input
                      type="checkbox"
                      className="as-custom-checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      aria-label="Select all rows"
                    />
                  </th>
                  <th>Assignment ID</th>
                  <th>Assessment</th>
                  <th>Candidate</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((a) => {
                  const isSelected = Boolean(selectedIds[a.id]);
                  const deadlineParts = formatDateTimeParts(a.expiresAt);

                  return (
                    <tr
                      key={a.id}
                      className={isSelected ? 'is-selected' : ''}
                    >
                      <td className="as-checkbox-cell">
                        <input
                          type="checkbox"
                          className="as-custom-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(a.id)}
                          aria-label={`Select assignment ${a.id}`}
                        />
                      </td>
                      <td>
                        <span className="as-code-badge">
                          #ASG-{a.id.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="as-entity-cell">
                          <div className="as-entity-icon">
                            <ClipboardCheck size={18} />
                          </div>
                          <div className="as-entity-info">
                            <Link
                              to={`/org/assessments/assignments/${a.id}`}
                              className="as-entity-title"
                            >
                              {a.title}
                            </Link>
                            <span className="as-entity-meta">
                              Ref: {a.applicationId ? `#APP-${a.applicationId.slice(-6).toUpperCase()}` : 'Direct'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong style={{ color: '#0f172a', fontSize: '0.875rem' }}>
                            {a.candidateName || 'Candidate'}
                          </strong>
                          {a.bestPercentage !== undefined && (
                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                              Score: {a.bestPercentage}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`as-status-pill as-status-pill--${a.status}`}>
                          <span className="as-status-dot" />
                          {label(a.status)}
                        </span>
                      </td>
                      <td>
                        <div className="as-date-cell">
                          <span className="as-date-main">{deadlineParts.date}</span>
                          <span className="as-date-sub">{deadlineParts.time}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          className="as-btn-table-action"
                          to={`/org/assessments/assignments/${a.id}`}
                        >
                          <Eye size={14} /> Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Custom Pagination Footer */}
            <div className="as-pagination-footer">
              <div className="as-pagination-info">
                Showing{' '}
                <strong>
                  {filteredRows.length > 0 ? (currentPage - 1) * 10 + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(currentPage * 10, q.data?.total || filteredRows.length)}
                </strong>{' '}
                of <strong>{q.data?.total || filteredRows.length}</strong> assignments
              </div>

              <div className="as-pagination-controls">
                <button
                  type="button"
                  className="as-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPageParam(currentPage - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`as-page-btn ${pageNum === currentPage ? 'as-page-btn--active' : ''}`}
                      onClick={() => setPageParam(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  className="as-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPageParam(currentPage + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export function CandidateAssignmentPage() {
  const { assignmentId = '' } = useParams();
  const q = useAssignment(assignmentId, true, oid.test(assignmentId));
  const start = useStart();
  const nav = useNavigate();
  const [loadedAt] = useState(() => Date.now());
  if (q.isLoading)
    return <LoadingState label="Loading assessment instructions" />;
  if (q.isError)
    return (
      <ErrorState
        title="Assessment unavailable"
        detail={err(q.error)}
        retry={() => void q.refetch()}
      />
    );
  const a = q.data;
  if (!a) return null;
  const expired = Date.parse(a.expiresAt) <= loadedAt || a.status === 'expired';
  const begin = async () => {
    const x = await start.mutateAsync(a.id);
    const id = (x.attempt as { id?: string; _id?: string })?.id || (x.attempt as { id?: string; _id?: string })?._id;
    if (id) nav(`/candidate/assessments/${a.id}/attempt/${id}`);
  };
  return (
    <div className="as-page">
      <PageHeader
        title={a.title}
        eyebrow="Assessment instructions"
        description={`Available from ${formatDate(a.availableFrom)} · deadline ${formatDate(a.expiresAt)}`}
        metadata={
          <StatusTag tone={statusTone(a.status)}>{label(a.status)}</StatusTag>
        }
      />
      {expired && (
        <Alert tone="danger" title="Deadline passed">
          This assessment can no longer be started or changed.
        </Alert>
      )}
      <Card heading="Before you begin" headingLevel={2}>
        <ul>
          <li>Your answers are saved only when you select Save answer.</li>
          <li>Keep this page open during recoverable connection failures.</li>
          <li>Submitting is final and requires confirmation.</li>
          <li>No proctoring, compiler or AI evaluation is provided.</li>
        </ul>
        {a.attemptId ? (
          <Link
            className="tvx-button tvx-button--primary"
            to={`/candidate/assessments/${a.id}/attempt/${a.attemptId}`}
          >
            Continue attempt
          </Link>
        ) : (
          <Button
            onClick={() => void begin()}
            loading={start.isPending}
            disabled={expired || !['assigned', 'available'].includes(a.status)}
          >
            Start assessment
          </Button>
        )}
        {start.isError && (
          <Alert tone="danger" title="Could not start">
            {err(start.error)}
          </Alert>
        )}
      </Card>
    </div>
  );
}
function WorkSampleDeliverableUploads({
  attemptId,
  deliverable,
  disabled,
}: {
  attemptId?: string | undefined;
  deliverable?: Question['deliverable'] | undefined;
  disabled?: boolean | undefined;
}) {
  const docsQuery = useAttemptDocuments(attemptId || '', Boolean(attemptId));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!attemptId || !deliverable) return null;
  const isFileDeliverable = deliverable.type === 'file' || deliverable.type === 'mixed';
  if (!isFileDeliverable) return null;

  const docs = docsQuery.data ?? [];
  const maxFiles = deliverable.maxFiles || 5;
  const canUploadMore = !disabled && docs.length < maxFiles;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    setProgress(0);

    try {
      if (deliverable.allowedFormats?.length) {
        const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const match = deliverable.allowedFormats.some(
          (f) => f.toLowerCase() === ext || f.toLowerCase() === ext.replace('.', ''),
        );
        if (!match) {
          throw new Error(
            `Unsupported file extension "${ext}". Allowed formats: ${deliverable.allowedFormats.join(', ')}`,
          );
        }
      }
      if (deliverable.maxFileSizeBytes && file.size > deliverable.maxFileSizeBytes) {
        const maxMb = Math.round(deliverable.maxFileSizeBytes / 1024 / 1024);
        throw new Error(`File exceeds the maximum limit of ${maxMb}MB.`);
      }

      await uploadAttemptDeliverable(attemptId, file, file.name, (pct) =>
        setProgress(pct),
      );
      await docsQuery.refetch();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDownload = async (docId: string) => {
    try {
      const url = await downloadAttemptDocument(attemptId, docId);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not download file');
    }
  };

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-sm text-slate-900">
          Deliverable Files ({docs.length} / {maxFiles})
        </h4>
        {deliverable.allowedFormats?.length ? (
          <span className="text-xs text-slate-500">
            Allowed formats: {deliverable.allowedFormats.join(', ')}
          </span>
        ) : null}
      </div>

      {docs.length > 0 && (
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded bg-white text-xs">
          {docs.map((d: Record<string, unknown>, idx: number) => {
            const docId = String(d.id || d._id || '');
            const name = String(d.displayName || d.originalFileName || `File ${idx + 1}`);
            const size = Number(d.sizeBytes || 0);
            const sizeKb = Math.round(size / 1024);
            const scan = String(
              (d.malwareScan as Record<string, unknown>)?.status || d.scanStatus || 'clean',
            );

            return (
              <li
                key={docId || idx}
                className="p-2.5 flex justify-between items-center hover:bg-slate-50"
              >
                <div className="space-x-2 flex items-center">
                  <span className="font-medium text-slate-800">{name}</span>
                  <span className="text-slate-400">({sizeKb} KB)</span>
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                      scan === 'clean'
                        ? 'bg-emerald-100 text-emerald-800'
                        : scan === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {scan}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-800 font-medium underline"
                  onClick={() => handleDownload(docId)}
                >
                  Download / View
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canUploadMore && (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={uploading || disabled}
            style={{ display: 'none' }}
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={uploading || disabled}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? `Uploading (${progress}%)…` : 'Upload Deliverable File'}
            </Button>
            {uploading && (
              <span className="text-xs text-slate-500 animate-pulse">
                Uploading and verifying file…
              </span>
            )}
          </div>
        </div>
      )}

      {uploadError && (
        <Alert tone="danger" title="Upload Failed">
          {uploadError}
        </Alert>
      )}
    </div>
  );
}

function Answer({
  q,
  value,
  onChange,
  attemptId,
  disabled,
}: {
  q: Question;
  value: unknown;
  onChange: (v: unknown) => void;
  attemptId?: string;
  disabled?: boolean;
}) {
  if (q.type === 'single-choice' || q.type === 'true-false')
    return (
      <fieldset>
        <legend>{q.prompt}</legend>
        {(q.type === 'true-false'
          ? [
              { id: 'true', text: 'True' },
              { id: 'false', text: 'False' },
            ]
          : q.options
        ).map((o) => (
          <label className="as-choice" key={o.id}>
            <input
              type="radio"
              name={q.id}
              checked={String(value) === o.id}
              onChange={() =>
                onChange(q.type === 'true-false' ? o.id === 'true' : o.id)
              }
            />
            {o.text}
          </label>
        ))}
      </fieldset>
    );
  if (q.type === 'multiple-choice')
    return (
      <fieldset>
        <legend>{q.prompt}</legend>
        {q.options.map((o) => (
          <label className="as-choice" key={o.id}>
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes(o.id)}
              onChange={(e) => {
                const a = Array.isArray(value) ? (value as string[]) : [];
                onChange(
                  e.target.checked ? [...a, o.id] : a.filter((x) => x !== o.id),
                );
              }}
            />
            {o.text}
          </label>
        ))}
      </fieldset>
    );
  if (q.type === 'work-sample') {
    return (
      <div className="space-y-4">
        {q.deliverable && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="font-semibold text-sm text-slate-900">Task Instructions & Deliverables</h4>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{q.deliverable.instructions}</p>
            {q.deliverable.allowedFormats?.length > 0 && (
              <div className="text-xs text-slate-600">
                <strong>Allowed formats:</strong> {q.deliverable.allowedFormats.join(', ')} (Max {q.deliverable.maxFiles} file{q.deliverable.maxFiles > 1 ? 's' : ''})
              </div>
            )}
            {q.deliverable.referenceAssets?.length > 0 && (
              <div className="text-xs space-y-1">
                <strong>Reference Materials:</strong>
                {q.deliverable.referenceAssets.map((asset, i) => (
                  <div key={i}>
                    <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                      {asset.name}
                    </a>
                    {asset.description && <span className="text-slate-500 ml-1">({asset.description})</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {q.rubricCriteria && q.rubricCriteria.length > 0 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs space-y-1">
            <strong className="text-blue-900">Evaluation Criteria:</strong>
            <ul className="list-disc list-inside text-blue-800 space-y-0.5">
              {q.rubricCriteria.map((c, i) => (
                <li key={i}>
                  <strong>{c.name}</strong> ({c.weight}% weight)
                </li>
              ))}
            </ul>
          </div>
        )}

        <WorkSampleDeliverableUploads
          attemptId={attemptId}
          deliverable={q.deliverable}
          disabled={disabled}
        />

        <TextArea
          label="Your Submission Notes & Strategy / URLs"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          hint="Provide your writeup, strategy, or links to cloud deliverables (e.g. Figma, GitHub, Google Docs)."
        />
      </div>
    );
  }
  return (
    <TextArea
      label={q.prompt}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      rows={q.type === 'short-answer' ? 3 : 10}
      hint={
        q.type === 'coding'
          ? 'Code is saved as text only. Talvix does not execute or compile it.'
          : undefined
      }
    />
  );
}
function Timer({
  deadline,
  onExpire,
}: {
  deadline: string;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(() =>
    Math.max(0, Date.parse(deadline) - Date.now()),
  );
  useEffect(() => {
    const id = setInterval(() => {
      const n = Math.max(0, Date.parse(deadline) - Date.now());
      setLeft(n);
      if (n === 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, onExpire]);
  const m = Math.ceil(left / 60000);
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const timeStr =
    days > 0
      ? `${days}d ${hours}h remaining`
      : hours > 0
        ? `${hours}h ${mins}m remaining`
        : `${m} minutes remaining`;

  return (
    <div
      role="timer"
      aria-live={m <= 5 ? 'assertive' : 'off'}
      className={m <= 5 ? 'as-timer as-timer--risk' : 'as-timer'}
    >
      <strong>{left ? timeStr : 'Time expired'}</strong>
      <span>Deadline {formatDate(deadline)}</span>
    </div>
  );
}
export function AttemptPage() {
  const { assignmentId = '', attemptId = '' } = useParams();
  const q = useAttempt(attemptId, oid.test(attemptId));
  const save = useSaveAnswer(attemptId);
  const submit = useSubmit(attemptId);
  const nav = useNavigate();
  const [attemptLoadedAt] = useState(() => Date.now());
  const [index, setIndex] = useState(0),
    [drafts, setDrafts] = useState<Record<string, unknown>>({}),
    [saved, setSaved] = useState<Record<string, string>>({}),
    [expired, setExpired] = useState(false),
    [confirm, setConfirm] = useState(false),
    [notice, setNotice] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    // Restore the server's persisted answers after session recovery.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.data) setDrafts(q.data.answers);
  }, [q.data]);
  if (q.isLoading) return <LoadingState label="Restoring assessment attempt" />;
  if (q.isError)
    return (
      <ErrorState
        title="Attempt unavailable"
        detail={err(q.error)}
        retry={() => void q.refetch()}
      />
    );
  const a = q.data;
  if (!a) return null;
  const question = a.questions[index];
  const deadlineExpired = Date.parse(a.expiresAt) <= attemptLoadedAt;
  const disabled = expired || deadlineExpired || a.status !== 'in-progress';
  const doSave = async () => {
    if (!question || disabled) return;
    try {
      const v = drafts[question.id];
      await save.mutateAsync({
        questionId: question.id,
        ...(question.type === 'coding'
          ? { code: v ?? '', language: question.languages[0] ?? 'javascript' }
          : { answer: v }),
        timeSpentSeconds: 0,
        flaggedForReview: false,
      });
      setSaved({ ...saved, [question.id]: new Date().toISOString() });
      setNotice(`Answer ${index + 1} saved.`);
    } catch {
      setNotice(
        'Save failed. Your answer remains in this browser; retry when the connection returns.',
      );
    }
  };
  const final = async () => {
    if (lock.current || disabled) return;
    lock.current = true;
    try {
      await submit.mutateAsync();
      setConfirm(false);
      setNotice('Assessment submitted successfully.');
      nav(`/candidate/assessments/${assignmentId}/result/${attemptId}`);
    } catch (e) {
      if (e instanceof ApiError && [409, 422].includes(e.status)) {
        setNotice(
          'This assessment was already submitted or changed. Refreshing its status.',
        );
        await q.refetch();
      } else setNotice(`Submission failed. ${err(e)}`);
    } finally {
      lock.current = false;
    }
  };
  return (
    <div className="as-page">
      <PageHeader
        title={a.title}
        eyebrow={`Question ${index + 1} of ${a.questions.length}`}
        description="Manual save is required for each answer."
        primaryAction={
          <Button
            variant="danger"
            onClick={() => setConfirm(true)}
            disabled={disabled || submit.isPending}
          >
            Finish & Submit
          </Button>
        }
        secondaryActions={
          <Button
            variant="secondary"
            onClick={() => nav('/candidate/assessments')}
          >
            Close & Exit
          </Button>
        }
      />
      <Timer deadline={a.expiresAt} onExpire={() => setExpired(true)} />
      <div className="as-attempt">
        <nav aria-label="Question navigation" className="as-navigator">
          {a.questions.map((x, i) => (
            <Button
              key={x.id}
              variant={i === index ? 'primary' : 'secondary'}
              onClick={() => {
                if (a.allowBackNavigation || i > index) setIndex(i);
              }}
              disabled={!a.allowBackNavigation && i < index}
              aria-label={`Question ${i + 1}${saved[x.id] ? ', saved' : ''}`}
            >
              {i + 1}
            </Button>
          ))}
        </nav>
        {question ? (
          <Card
            heading={question.title || `Question ${index + 1}`}
            headingLevel={2}
          >
            <Answer
              q={question}
              value={drafts[question.id]}
              onChange={(v) => setDrafts({ ...drafts, [question.id]: v })}
              attemptId={a.id}
              disabled={disabled}
            />
            <div className="as-save-status" role="status">
              {save.isPending
                ? 'Saving…'
                : saved[question.id]
                  ? `Saved ${formatDate(saved[question.id] ?? '')}`
                  : 'Not saved'}
            </div>
            <div className="as-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                onClick={() => void doSave()}
                loading={save.isPending}
                disabled={disabled}
              >
                Save answer
              </Button>
              {index < a.questions.length - 1 && (
                <Button variant="secondary" onClick={() => setIndex(index + 1)}>
                  Next question
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => nav('/candidate/assessments')}
              >
                Close & Exit
              </Button>
              <div style={{ flexGrow: 1 }} />
              <Button
                variant="danger"
                onClick={() => setConfirm(true)}
                disabled={disabled || submit.isPending}
              >
                Submit assessment
              </Button>
            </div>
          </Card>
        ) : (
          <EmptyState
            title="No questions available"
            description="Contact the hiring organization."
          />
        )}
      </div>
      <div className="visually-hidden" aria-live="polite">
        {notice}
      </div>
      {(expired || deadlineExpired) && (
        <Alert tone="danger" title="Time expired">
          Saving and submission are disabled. Contact the hiring organization if
          you need help.
        </Alert>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit assessment?"
        description="This is final. You will not be able to change answers after submission."
        busy={submit.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Keep working
            </Button>
            <Button onClick={() => void final()} loading={submit.isPending}>
              Submit final answers
            </Button>
          </>
        }
      >
        <p>Confirm only when every intended answer has been saved.</p>
      </Dialog>
    </div>
  );
}
export function ResultPage() {
  const { attemptId = '' } = useParams();
  const q = useResult(attemptId, oid.test(attemptId));
  if (q.isLoading) return <LoadingState label="Loading released result" />;
  if (q.isError) {
    const status = (q.error as ApiError).status;
    if (status === 409) {
      return (
        <div className="as-page">
          <PageHeader
            title="Submission Successful"
            eyebrow="Assessment completed"
            description="Your answers have been submitted successfully."
          />
          <Card heading="Pending Manual Evaluation" headingLevel={2}>
            <p>
              This assessment contains questions that require manual review by the hiring team.
              Once evaluated, your results will be finalized and updated on your profile.
            </p>
            <div style={{ marginTop: '16px' }}>
              <Link className="tvx-button tvx-button--primary" to="/candidate/assessments">
                Back to Assessments
              </Link>
            </div>
          </Card>
        </div>
      );
    }
    return status === 403 ? (
      <PermissionState
        title="Result not released"
        description="The hiring organization has not released this result to you."
        action={
          <Link className="tvx-button tvx-button--primary" to="/candidate/assessments">
            Back to Assessments
          </Link>
        }
      />
    ) : (
      <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
    );
  }
  if (!q.data) return null;
  return (
    <div className="as-page">
      <PageHeader
        title={q.data.title}
        eyebrow="Assessment result"
        description="Only information released by the hiring organization is shown."
      />
      <Card heading="Result summary" headingLevel={2}>
        <DescriptionList
          items={[
            { term: 'Status', description: label(q.data.status) },
            { term: 'Score', description: `${q.data.score}%` },
            ...(q.data.totalMarks
              ? [{ term: 'Total Marks', description: String(q.data.totalMarks) }]
              : []),
            {
              term: 'Outcome',
              description:
                q.data.passed === undefined
                  ? 'Not disclosed'
                  : q.data.passed
                    ? 'Passed'
                    : 'Not passed',
            },
            {
              term: 'Feedback',
              description: q.data.feedback || 'No candidate feedback released.',
            },
          ]}
        />
      </Card>

      {q.data.questionResults && q.data.questionResults.length > 0 && (
        <div className="space-y-4 mt-6">
          <h3 className="text-xl font-bold">Question & Rubric Breakdown</h3>
          {q.data.questionResults.map((qr, idx) => (
            <Card
              key={qr.questionId || idx}
              heading={`Question ${idx + 1}`}
              headingLevel={3}
            >
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">
                    Type: {label(qr.questionType)}
                  </span>
                  <span className="font-semibold text-slate-900">
                    Score: {qr.awardedMarks} / {qr.marks} marks
                  </span>
                </div>
                {qr.feedback && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700">
                    <strong>Feedback:</strong> {qr.feedback}
                  </div>
                )}
                {qr.rubricScores && qr.rubricScores.length > 0 && (
                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                      Rubric Criteria Breakdown
                    </h4>
                    <div className="space-y-1.5">
                      {qr.rubricScores.map((rs, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex justify-between items-center p-2.5 bg-blue-50 border border-blue-100 rounded text-xs"
                        >
                          <span className="font-medium text-blue-950">
                            {rs.criterionName}
                          </span>
                          <span className="font-bold text-blue-900">
                            {rs.awardedMarks} / {rs.maxMarks} marks
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
export function ReviewsPage() {
  const { recruiter } = useAuth();
  const can = has(recruiter?.permissions ?? [], 'assessments.review');
  const q = useReviews(can);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  if (!can)
    return (
      <PermissionState description="The assessments.review permission is required." />
    );

  const rawReviews = (q.data ?? []) as Attempt[];

  const countTotal = rawReviews.length;
  const countManualReview = rawReviews.filter((a) =>
    a.questionResults?.some((qr) => qr.requiresManualReview),
  ).length;
  const countAutoScored = rawReviews.filter(
    (a) => (a.evaluation?.objectiveScore ?? 0) > 0,
  ).length;
  const countPending = rawReviews.filter(
    (a) => a.status === 'review-pending' || a.status === 'in-progress',
  ).length;

  const filteredReviews = rawReviews.filter((a) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (a.title || '').toLowerCase().includes(term) ||
      (a.id || '').toLowerCase().includes(term) ||
      (a.assignmentId || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredReviews.length / pageSize) || 1;
  const paginatedReviews = filteredReviews.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  return (
    <div className="as-page">
      <div className="as-page-header-row">
        <div>
          <PageHeader
            title="Assessment Reviews"
            description="Evaluate candidate submissions, score subjective answers, and inspect work sample deliverables."
          />
        </div>
        <Tabs />
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="as-metrics-grid">
        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box">
              <FileCheck size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--warning">
              Pending
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Review Queue</span>
            <span className="as-metric-card__val">{countTotal}</span>
            <span className="as-metric-card__sub">Submissions awaiting grading</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#7c3aed' }}>
              <FileText size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--info">
              Action Required
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Manual Rubric Scoring</span>
            <span className="as-metric-card__val">{countManualReview}</span>
            <span className="as-metric-card__sub">Subjective / work samples</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#0284c7' }}>
              <Sparkles size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--success">
              Auto Graded
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">Auto-Scored Components</span>
            <span className="as-metric-card__val">{countAutoScored}</span>
            <span className="as-metric-card__sub">MCQ & test cases passed</span>
          </div>
        </div>

        <div className="as-metric-card">
          <div className="as-metric-card__header">
            <div className="as-metric-icon-box" style={{ background: '#16a34a' }}>
              <Clock size={20} />
            </div>
            <span className="as-metric-badge as-metric-badge--neutral">
              SLA
            </span>
          </div>
          <div className="as-metric-card__body">
            <span className="as-metric-card__label">In Progress</span>
            <span className="as-metric-card__val">{countPending}</span>
            <span className="as-metric-card__sub">Active evaluations</span>
          </div>
        </div>
      </div>

      {/* Modern Toolbar */}
      <div className="as-modern-toolbar">
        <div className="as-toolbar-filters">
          <div className="as-search-container">
            <Search className="as-search-icon" size={16} />
            <input
              type="text"
              className="as-search-input"
              placeholder="Search assessment title, submission ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
            {searchTerm && (
              <button
                type="button"
                className="as-search-clear"
                onClick={() => setSearchTerm('')}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchTerm && (
            <button
              type="button"
              className="as-action-link"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              style={{ height: '42px', borderRadius: '9999px', padding: '0 16px' }}
            >
              <RotateCcw size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Modern Table Card */}
      <div className="as-table-card">
        {q.isError ? (
          <div style={{ padding: '24px' }}>
            <ErrorState detail={err(q.error)} retry={() => void q.refetch()} />
          </div>
        ) : q.isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <LoadingState label="Loading review queue..." />
          </div>
        ) : filteredReviews.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <EmptyState
              title="Review queue is clear"
              description="Submissions requiring manual review or evaluation will appear here."
            />
          </div>
        ) : (
          <div className="as-table-wrapper">
            <table className="as-modern-table">
              <thead>
                <tr>
                  <th>Submission ID</th>
                  <th>Assessment & Details</th>
                  <th>Status</th>
                  <th>Questions to Review</th>
                  <th>Submission Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReviews.map((a) => {
                  const deadlineParts = formatDateTimeParts(a.expiresAt);
                  const manualQuestions =
                    a.questionResults?.filter((qr) => qr.requiresManualReview).length ?? 0;

                  return (
                    <tr key={a.id}>
                      <td>
                        <span className="as-code-badge">
                          #REV-{a.id.slice(-6).toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div className="as-entity-cell">
                          <div className="as-entity-icon">
                            <FileText size={18} />
                          </div>
                          <div className="as-entity-info">
                            <Link
                              to={`/org/assessments/reviews/${a.id}`}
                              className="as-entity-title"
                            >
                              {a.title || 'Candidate Assessment'}
                            </Link>
                            <span className="as-entity-meta">
                              {a.questions?.length ?? 0} total questions
                              {a.assignmentId ? ` · Assignment #${a.assignmentId.slice(-6).toUpperCase()}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`as-status-pill as-status-pill--${a.status}`}>
                          <span className="as-status-dot" />
                          {label(a.status)}
                        </span>
                      </td>
                      <td>
                        {manualQuestions > 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#d97706',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                            }}
                          >
                            ⚠️ {manualQuestions} need scoring
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#059669',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                            }}
                          >
                            ✓ Auto-Scored
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="as-date-cell">
                          <span className="as-date-main">{deadlineParts.date}</span>
                          <span className="as-date-sub">{deadlineParts.time}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          className="as-btn-table-primary"
                          to={`/org/assessments/reviews/${a.id}`}
                        >
                          <Eye size={14} /> Review Submission
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Custom Pagination Footer */}
            <div className="as-pagination-footer">
              <div className="as-pagination-info">
                Showing{' '}
                <strong>
                  {filteredReviews.length > 0 ? (page - 1) * pageSize + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong>
                  {Math.min(page * pageSize, filteredReviews.length)}
                </strong>{' '}
                of <strong>{filteredReviews.length}</strong> submissions
              </div>

              <div className="as-pagination-controls">
                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      className={`as-page-btn ${pageNum === page ? 'as-page-btn--active' : ''}`}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  className="as-page-btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function RecruiterAttemptDocuments({ attemptId }: { attemptId: string }) {
  const docsQuery = useAttemptDocuments(attemptId, Boolean(attemptId), true);
  const docs = docsQuery.data ?? [];
  if (!docs.length) return null;

  const handleDownload = async (docId: string) => {
    try {
      const url = await downloadAttemptDocument(attemptId, docId, true);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not download file');
    }
  };

  return (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2 text-xs">
      <strong className="text-slate-800">Submitted Deliverable Files:</strong>
      <ul className="divide-y divide-slate-200 border border-slate-200 rounded bg-white">
        {docs.map((d: Record<string, unknown>, idx: number) => {
          const docId = String(d.id || d._id || '');
          const name = String(
            d.displayName || d.originalFileName || `File ${idx + 1}`,
          );
          const sizeKb = Math.round(Number(d.sizeBytes || 0) / 1024);
          const scan = String(
            (d.malwareScan as Record<string, unknown>)?.status ||
              d.scanStatus ||
              'clean',
          );
          return (
            <li
              key={docId || idx}
              className="p-2 flex justify-between items-center"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{name}</span>
                <span className="text-slate-400">({sizeKb} KB)</span>
                <span
                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                    scan === 'clean'
                      ? 'bg-emerald-100 text-emerald-800'
                      : scan === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {scan}
                </span>
              </div>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 font-semibold underline ml-3"
                onClick={() => handleDownload(docId)}
              >
                Download
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewQuestionCard({
  q,
  answer,
  result,
  canReview,
  onSaveScore,
  attemptId,
}: {
  q: Question;
  answer: unknown;
  result?: {
    marks: number;
    awardedMarks: number;
    requiresManualReview: boolean;
    feedback?: string | undefined;
    rubricScores?: { criterionName: string; awardedMarks: number; maxMarks: number }[] | undefined;
    codingResult?: unknown;
  } | undefined;
  canReview: boolean;
  onSaveScore: (
    awardedMarks?: number | undefined,
    feedback?: string | undefined,
    rubricScores?: { criterionName: string; awardedMarks: number; feedback?: string }[] | undefined,
  ) => Promise<void>;
  attemptId?: string | undefined;
}) {
  const [awardedMarks, setAwardedMarks] = useState(String(result?.awardedMarks ?? ''));
  const [feedback, setFeedback] = useState(result?.feedback ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Per-criterion state for rubric-based questions
  const [rubricState, setRubricState] = useState<Record<string, { marks: number; feedback: string }>>(() => {
    const initial: Record<string, { marks: number; feedback: string }> = {};
    if (result?.rubricScores && Array.isArray(result.rubricScores)) {
      result.rubricScores.forEach((rs) => {
        initial[rs.criterionName] = { marks: rs.awardedMarks ?? 0, feedback: '' };
      });
    } else if (q.rubricCriteria && Array.isArray(q.rubricCriteria)) {
      q.rubricCriteria.forEach((rc) => {
        initial[rc.name] = { marks: 0, feedback: '' };
      });
    }
    return initial;
  });

  const isWorkSample = q.type === 'work-sample' && q.rubricCriteria && q.rubricCriteria.length > 0;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      if (isWorkSample) {
        const scores = (q.rubricCriteria ?? []).map((rc) => {
          const entry = rubricState[rc.name] ?? { marks: 0, feedback: '' };
          if (entry.marks < 0 || entry.marks > rc.maxMarks) {
            throw new Error(`Score for "${rc.name}" must be between 0 and ${rc.maxMarks}`);
          }
          return {
            criterionName: rc.name,
            awardedMarks: entry.marks,
            feedback: entry.feedback,
          };
        });
        await onSaveScore(undefined, feedback, scores);
      } else {
        const score = Number(awardedMarks);
        if (isNaN(score) || score < 0 || score > q.marks) {
          throw new Error(`Marks must be between 0 and ${q.marks}`);
        }
        await onSaveScore(score, feedback);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card heading={`${q.title || 'Question'} (${q.marks} marks)`} headingLevel={3}>
      <div className="space-y-4">
        <div>
          <strong>Prompt:</strong>
          <p className="text-slate-700 mt-1 whitespace-pre-wrap">{q.prompt}</p>
        </div>

        {q.deliverable && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 space-y-1">
            <strong>Deliverable Instructions:</strong>
            <p className="whitespace-pre-wrap">{q.deliverable.instructions}</p>
          </div>
        )}

        <div>
          <strong>Candidate Response:</strong>
          {q.type === 'coding' ? (
            <pre className="p-4 bg-slate-950 text-slate-100 rounded mt-1 overflow-x-auto font-mono text-sm">
              <code>{String(answer || '// No response')}</code>
            </pre>
          ) : (
            <p className="text-slate-800 bg-slate-50 p-3 border border-slate-200 rounded mt-1 whitespace-pre-wrap">
              {String(answer || 'No response')}
            </p>
          )}
        </div>

        {attemptId && (q.type === 'work-sample' || q.type === 'file-upload') && (
          <RecruiterAttemptDocuments attemptId={attemptId} />
        )}

        {result && (
          <div className="p-3 bg-slate-100 border border-slate-200 rounded text-sm space-y-1">
            <div><strong>Scoring Status:</strong> {result.requiresManualReview ? 'Pending Manual Review' : 'Scored'}</div>
            <div><strong>Awarded Marks:</strong> {result.awardedMarks} / {result.marks}</div>
            {result.feedback && <div><strong>Overall Feedback:</strong> {result.feedback}</div>}
            {result.rubricScores && (
              <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
                <strong>Rubric Breakdown:</strong>
                {result.rubricScores.map((rs, idx: number) => (
                  <div key={idx} className="text-xs text-slate-700 flex justify-between">
                    <span>{rs.criterionName}:</span>
                    <span className="font-semibold">{rs.awardedMarks} / {rs.maxMarks} marks</span>
                  </div>
                ))}
              </div>
            )}
            {Boolean(result.codingResult) && (
              <div>
                <strong>Execution Result:</strong>
                <pre className="mt-1 p-2 bg-slate-800 text-white rounded text-xs overflow-x-auto font-mono">
                  {JSON.stringify(result.codingResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {canReview && result?.requiresManualReview && (
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="font-semibold text-sm">Grade Response</h4>

            {isWorkSample ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  {(q.rubricCriteria ?? []).map((rc, idx) => {
                    const current = rubricState[rc.name] ?? { marks: 0, feedback: '' };
                    return (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-sm">{rc.name} (Weight: {rc.weight}%)</span>
                          <span className="text-xs text-slate-500">Max marks: {rc.maxMarks}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <TextField
                              label="Awarded Marks"
                              type="number"
                              min="0"
                              max={String(rc.maxMarks)}
                              value={String(current.marks)}
                              onChange={(e) => {
                                setRubricState({
                                  ...rubricState,
                                  [rc.name]: { ...current, marks: Number(e.target.value) || 0 },
                                });
                              }}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <TextField
                              label="Criterion Feedback (Optional)"
                              value={current.feedback}
                              onChange={(e) => {
                                setRubricState({
                                  ...rubricState,
                                  [rc.name]: { ...current, feedback: e.target.value },
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <TextField
                    label="Overall Submission Feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>
                <Button onClick={handleSave} loading={saving}>
                  Save Rubric Score
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                  <TextField
                    label={`Awarded Marks (Max ${q.marks})`}
                    type="number"
                    min="0"
                    max={String(q.marks)}
                    required
                    value={awardedMarks}
                    onChange={(e) => setAwardedMarks(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <TextField
                    label="Feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>
                <div className="md:col-span-1">
                  <Button onClick={handleSave} loading={saving} disabled={!awardedMarks}>
                    Save Score
                  </Button>
                </div>
              </div>
            )}
            {error && <Alert tone="danger" title="Validation Error">{error}</Alert>}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ReviewDetailPage() {
  const { attemptId = '' } = useParams();
  const { recruiter } = useAuth();
  const canReview = has(recruiter?.permissions ?? [], 'assessments.review');
  const query = useReview(attemptId, canReview && Boolean(attemptId));
  const action = useReviewAction(attemptId);
  const [completionError, setCompletionError] = useState('');

  if (!canReview) {
    return (
      <PermissionState description="The assessments.review permission is required to evaluate candidates." />
    );
  }

  if (query.isLoading) return <LoadingState label="Loading candidate submission details" />;
  if (query.isError) {
    return (
      <ErrorState
        detail={err(query.error)}
        retry={() => void query.refetch()}
      />
    );
  }

  const attempt = query.data;
  if (!attempt) return null;

  const handleSaveQuestionScore = async (
    questionId: string,
    awardedMarks?: number,
    feedback?: string,
    rubricScores?: { criterionName: string; awardedMarks: number; feedback?: string }[],
  ) => {
    const payload: {
      questionId: string;
      awardedMarks?: number;
      feedback?: string;
      rubricScores?: { criterionName: string; awardedMarks: number; feedback?: string }[];
    } = { questionId };
    if (awardedMarks !== undefined) payload.awardedMarks = awardedMarks;
    if (feedback !== undefined) payload.feedback = feedback;
    if (rubricScores !== undefined) payload.rubricScores = rubricScores;
    await action.mutateAsync(payload);
    await query.refetch();
  };

  const handleCompleteReview = async () => {
    try {
      setCompletionError('');
      await action.mutateAsync({ complete: true });
      await query.refetch();
    } catch (e) {
      setCompletionError(e instanceof Error ? e.message : 'Could not finalize review');
    }
  };

  const pendingQuestions = attempt.questionResults?.filter(q => q.requiresManualReview) ?? [];
  const evalData = attempt.evaluation;

  return (
    <div className="as-page">
      <PageHeader
        title="Assessment Submission Review"
        eyebrow={attempt.title}
        description={`Status: ${label(attempt.status)}`}
        secondaryActions={
          attempt.status === 'review-pending' && pendingQuestions.length === 0 ? (
            <Button onClick={handleCompleteReview} loading={action.isPending}>
              Finalize & Complete Review
            </Button>
          ) : undefined
        }
      />

      {attempt.status === 'review-pending' && pendingQuestions.length > 0 && (
        <Alert tone="warning" title="Manual grading required">
          There are {pendingQuestions.length} subjective or coding questions that require your manual score evaluation.
        </Alert>
      )}

      {completionError && <Alert tone="danger" title="Review Finalization Error">{completionError}</Alert>}

      <div className="space-y-6 mt-6">
        {evalData && (
          <Card heading="Evaluation Summary" headingLevel={2}>
            <DescriptionList
              items={[
                { term: 'Current Score Percentage', description: `${evalData.percentage}%` },
                { term: 'Objective/MCQ Score', description: `${evalData.objectiveScore} marks` },
                { term: 'Subjective/Manual Score', description: `${evalData.subjectiveScore} marks` },
                { term: 'Coding Score', description: `${evalData.codingScore} marks` },
                { term: 'Total Score Calculated', description: `${evalData.totalScore} marks` },
                { term: 'Passing Status', description: evalData.passed ? 'Passed' : 'Failed' },
              ]}
            />
          </Card>
        )}

        <RecruiterAttemptDocuments attemptId={attempt.id} />

        <div className="space-y-4">
          <h3 className="text-xl font-bold">Responses & Grading</h3>
          {attempt.questions.map((q) => {
            const answer = attempt.answers[q.id];
            const result = attempt.questionResults?.find(r => r.questionId === q.id);
            return (
              <ReviewQuestionCard
                key={q.id}
                q={q}
                answer={answer}
                result={result}
                canReview={attempt.status === 'review-pending'}
                onSaveScore={(marks, fb, scores) => handleSaveQuestionScore(q.id, marks, fb, scores)}
                attemptId={attempt.id}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
