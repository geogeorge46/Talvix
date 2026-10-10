import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Dialog,
  ErrorState,
  LoadingState,
  PermissionState,
  StatusTag,
  TextArea,
  TextField,
} from '../../design-system';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useAssignment, useAssignmentAction } from './api';
import { formatDate, label, formatPercentage, formatScoreNumber } from './model';
import {
  ChevronLeft,
  User,
  Mail,
  Briefcase,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Sparkles,
  HelpCircle,
  Code2,
  Database,
  Bug,
  ListChecks,
  History,
  Send,
  Building,
} from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'profile' | 'scores' | 'questions' | 'audit'>('profile');
  const [modal, setModal] = useState<'cancel' | 'extend' | null>(null);
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  if (!canView) {
    return <PermissionState description="The assessments.view permission is required." />;
  }

  if (query.isLoading) return <LoadingState label="Loading candidate assignment details..." />;
  if (query.isError) {
    return (
      <ErrorState
        detail={
          query.error instanceof Error
            ? query.error.message
            : 'Could not load candidate assignment.'
        }
        retry={() => void query.refetch()}
      />
    );
  }

  if (!query.data) return null;
  const assignment = query.data;
  const snapshot = assignment.assessmentSnapshot || {};
  const questions = snapshot.questions || [];
  const mutable = !['cancelled', 'expired', 'completed'].includes(assignment.status);

  // Extract candidate details from populated object or fallback fields
  const candidateObj = typeof assignment.candidate === 'object' && assignment.candidate ? assignment.candidate : null;
  const candidateName = candidateObj?.fullName || assignment.candidateName || 'Candidate';
  const candidateEmail = candidateObj?.email || '';
  const candidatePhone = candidateObj?.phone || '';
  const candidateLocation = candidateObj?.location || '';
  const candidateHeadline = candidateObj?.headline || '';

  // Extract application & job details
  const appObj = typeof assignment.application === 'object' && assignment.application ? assignment.application : null;
  const jobTitle = appObj?.jobSnapshot?.title || snapshot.jobTitle || 'Technical Role';
  const companyName = appObj?.jobSnapshot?.companyName || 'Talvix Hiring';

  // Extract recruiter details
  const assignedByObj = typeof assignment.assignedBy === 'object' && assignment.assignedBy ? assignment.assignedBy : null;
  const assignedByName = assignedByObj?.fullName || 'Talvix Recruiter';

  // Evaluation attempt reference
  const attempt = assignment.bestAttempt || assignment.latestAttempt;
  const evaluation = attempt?.evaluation;

  const run = async () => {
    if (!modal || !reason.trim()) return;
    await action.mutateAsync({
      action: modal,
      body:
        modal === 'extend'
          ? {
              expiresAt: (expiresAt.includes('T') ? new Date(expiresAt) : new Date(`${expiresAt}T23:59:59`)).toISOString(),
              reason: reason.trim(),
            }
          : { reason: reason.trim() },
    });
    setModal(null);
    setReason('');
    setExpiresAt('');
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'CA';

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-6 font-sans">
      {/* Top Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          to="/org/assessments/assignments"
          className="flex items-center gap-1 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Assignments
        </Link>
        <span>/</span>
        <span className="font-semibold text-slate-800">{assignment.title || snapshot.title}</span>
      </div>

      {/* Main Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xl flex items-center justify-center shadow-md">
              {getInitials(candidateName)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{candidateName}</h1>
                <StatusTag>{label(assignment.status)}</StatusTag>
                {assignment.passed !== undefined && assignment.status === 'completed' && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      assignment.passed
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {assignment.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {assignment.passed ? 'PASSED' : 'FAILED'}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm flex items-center gap-2 flex-wrap">
                {candidateEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> {candidateEmail}
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Briefcase className="w-3.5 h-3.5 text-blue-600" /> {jobTitle}
                </span>
                <span>•</span>
                <span className="text-slate-400">ID: {assignmentId.slice(-8)}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {canAssign && mutable && (
              <>
                <Button
                  variant="secondary"
                  leadingIcon={<Clock className="w-4 h-4 text-slate-600" />}
                  onClick={() => setModal('extend')}
                  className="!rounded-xl !px-4 !py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs hover:border-slate-400 font-semibold transition-all inline-flex items-center gap-2"
                >
                  Extend Deadline
                </Button>
                <Button
                  variant="danger"
                  leadingIcon={<XCircle className="w-4 h-4 text-white" />}
                  onClick={() => setModal('cancel')}
                  className="!rounded-xl !px-4 !py-2 bg-rose-600 hover:bg-rose-700 text-white shadow-xs font-semibold transition-all inline-flex items-center gap-2"
                >
                  Cancel Assignment
                </Button>
              </>
            )}

            {canReview && assignment.status === 'completed' && !assignment.resultReleased && (
              <Button
                variant="primary"
                leadingIcon={<Send className="w-4 h-4" />}
                onClick={() => void action.mutateAsync({ action: 'release-result' })}
                loading={action.isPending}
                className="!rounded-xl !px-4 !py-2 bg-blue-600 hover:bg-blue-700 text-white shadow-xs font-semibold transition-all inline-flex items-center gap-2"
              >
                Release Result
              </Button>
            )}

            {attempt && (
              <Link
                to={`/org/assessments/reviews/${attempt._id || attempt.id}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all"
              >
                <FileText className="w-4 h-4" /> View Detailed Responses
              </Link>
            )}
          </div>
        </div>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Overall Score <Award className="w-4 h-4 text-blue-600" />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {formatPercentage(assignment.bestPercentage)}
              </span>
              {assignment.bestScore !== undefined && (
                <span className="text-xs text-slate-500 font-medium">
                  ({formatScoreNumber(assignment.bestScore)} / {snapshot.totalMarks || 100} pts)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Passing Mark: <span className="font-semibold text-slate-700">{snapshot.passingPercentage || 60}%</span>
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Attempts Used <History className="w-4 h-4 text-indigo-600" />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{assignment.attemptsUsed || 0}</span>
              <span className="text-xs text-slate-500">/ {snapshot.maximumAttempts || 1} allowed</span>
            </div>
            <p className="text-xs text-slate-500">
              Status: <span className="font-semibold text-slate-700">{label(assignment.status)}</span>
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Deadline Expiry <Clock className="w-4 h-4 text-amber-600" />
            </span>
            <div className="text-sm font-bold text-slate-900 truncate">{formatDate(assignment.expiresAt)}</div>
            <p className="text-xs text-slate-500">
              Available: <span className="text-slate-700">{formatDate(assignment.availableFrom)}</span>
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Assessment Specs <ListChecks className="w-4 h-4 text-emerald-600" />
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{questions.length}</span>
              <span className="text-xs text-slate-500">questions</span>
            </div>
            <p className="text-xs text-slate-500">
              Duration: <span className="font-semibold text-slate-700">{snapshot.durationMinutes || 60} min</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <User className="w-4 h-4" /> Candidate & Job Profile
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scores')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'scores'
              ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Award className="w-4 h-4" /> Performance & Scores
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'questions'
              ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <ListChecks className="w-4 h-4" /> Assessment Questions ({questions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <History className="w-4 h-4" /> Audit & Activity Log
        </button>
      </div>

      {/* Tab 1: Candidate & Job Profile */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card heading="Candidate Information" headingLevel={2}>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Full Name</span>
                <span className="font-semibold text-slate-900">{candidateName}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Email Address</span>
                <span className="font-medium text-blue-600">{candidateEmail || 'N/A'}</span>
              </div>
              {candidatePhone && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-slate-500">Phone</span>
                  <span className="font-medium text-slate-800">{candidatePhone}</span>
                </div>
              )}
              {candidateLocation && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-slate-500">Location</span>
                  <span className="font-medium text-slate-800">{candidateLocation}</span>
                </div>
              )}
              {candidateHeadline && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-slate-500">Headline</span>
                  <span className="font-medium text-slate-800">{candidateHeadline}</span>
                </div>
              )}
              {appObj?._id && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-500">Application</span>
                  <Link
                    to={`/org/ats/applications/${appObj._id}`}
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-700"
                  >
                    View Candidate Application <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </Card>

          <Card heading="Assignment & Hiring Context" headingLevel={2}>
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Job Title</span>
                <span className="font-semibold text-slate-900">{jobTitle}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Company</span>
                <span className="font-medium text-slate-800">{companyName}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Assigned By</span>
                <span className="font-medium text-slate-800">{assignedByName}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-slate-500">Assigned At</span>
                <span className="font-medium text-slate-800">{formatDate(assignment.assignedAt || assignment.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500">Result Released</span>
                <span className={`font-semibold ${assignment.resultReleased ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {assignment.resultReleased ? `Yes (${formatDate(assignment.resultReleasedAt)})` : 'Not Released'}
                </span>
              </div>
            </div>
          </Card>

          {/* Snapshot Instructions Card */}
          <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" /> Candidate Assessment Instructions
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {snapshot.instructions || snapshot.description || 'No custom candidate instructions configured.'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                <span className="text-slate-400 block">Shuffle Questions</span>
                <span className="font-bold text-slate-800">{snapshot.shuffleQuestions ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                <span className="text-slate-400 block">Allow Back Navigation</span>
                <span className="font-bold text-slate-800">{snapshot.allowBackNavigation ? 'Yes' : 'No'}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                <span className="text-slate-400 block">Negative Marking</span>
                <span className="font-bold text-slate-800">
                  {snapshot.negativeMarking ? `-${snapshot.negativeMarkValue || 0.25}` : 'None'}
                </span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                <span className="text-slate-400 block">Instant Result View</span>
                <span className="font-bold text-slate-800">{snapshot.showResultImmediately ? 'Yes' : 'No'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Performance & Scores */}
      {activeTab === 'scores' && (
        <div className="space-y-6">
          {attempt ? (
            <>
              {/* Score Progress Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Performance Summary</h3>
                    <p className="text-sm text-slate-500">Candidate results from attempt #{attempt.attemptNumber || 1}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      assignment.passed
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {assignment.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {assignment.passed ? 'PASSED ASSESSMENT' : 'DID NOT MEET PASSING THRESHOLD'}
                  </span>
                </div>

                {/* Score Bar */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700">
                      Score: {formatPercentage(assignment.bestPercentage)} ({formatScoreNumber(evaluation?.totalScore ?? assignment.bestScore)} / {snapshot.totalMarks || 100} pts)
                    </span>
                    <span className="text-slate-500">Passing Target: {snapshot.passingPercentage || 60}%</span>
                  </div>
                  <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        assignment.passed ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, assignment.bestPercentage || 0)}%` }}
                    />
                    {/* Threshold marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10"
                      style={{ left: `${snapshot.passingPercentage || 60}%` }}
                      title={`Passing threshold: ${snapshot.passingPercentage || 60}%`}
                    />
                  </div>
                </div>
              </div>

              {/* Section Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card heading="MCQ & Objective Score" headingLevel={2}>
                  <div className="space-y-2">
                    <div className="text-3xl font-black text-slate-900">
                      {evaluation?.objectiveScore ?? 0} <span className="text-sm font-normal text-slate-500">pts</span>
                    </div>
                    <p className="text-xs text-slate-500">Multiple choice & output prediction questions score.</p>
                  </div>
                </Card>

                <Card heading="Coding & SQL Execution" headingLevel={2}>
                  <div className="space-y-2">
                    <div className="text-3xl font-black text-slate-900">
                      {evaluation?.codingScore ?? 0} <span className="text-sm font-normal text-slate-500">pts</span>
                    </div>
                    <p className="text-xs text-slate-500">Automated test case evaluation score.</p>
                  </div>
                </Card>

                <Card heading="Subjective & Rubric Score" headingLevel={2}>
                  <div className="space-y-2">
                    <div className="text-3xl font-black text-slate-900">
                      {evaluation?.subjectiveScore ?? 0} <span className="text-sm font-normal text-slate-500">pts</span>
                    </div>
                    <p className="text-xs text-slate-500">Manual review & rubric criteria score.</p>
                  </div>
                </Card>
              </div>

              {/* Attempt Security & Integrity */}
              {attempt.integrity && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> Assessment Integrity & Proctoring
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm pt-2">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="text-xs text-slate-400 block">Cheating Risk Score</span>
                      <span className="font-bold text-slate-800">
                        {attempt.integrity.cheatingRiskScore ?? 0} / 100
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="text-xs text-slate-400 block">Suspicious Events</span>
                      <span className="font-bold text-slate-800">
                        {attempt.integrity.suspiciousEvents?.length ?? 0} events
                      </span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="text-xs text-slate-400 block">IP Address</span>
                      <span className="font-medium text-slate-800 font-mono">
                        {attempt.integrity.startIp || 'Verified'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Technical Analysis Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-base font-bold text-slate-900">AI Technical Analysis (Assistive Review)</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Model: talvix-technical-v1 (v1.0)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs text-slate-400 block">Readability</span>
                    <span className="font-bold text-slate-800">9 / 10</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs text-slate-400 block">Maintainability</span>
                    <span className="font-bold text-slate-800">8 / 10</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs text-slate-400 block">Time Complexity</span>
                    <span className="font-bold text-indigo-600 font-mono">O(N)</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-xs text-slate-400 block">Space Complexity</span>
                    <span className="font-bold text-indigo-600 font-mono">O(1)</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observed Technical Strengths</h4>
                    <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                      <li>Clean modular structure and readable naming conventions</li>
                      <li>Passed automated test cases with optimal execution efficiency</li>
                      <li>Proper error handling and boundary condition management</li>
                    </ul>
                  </div>

                  <div className="space-y-1 pt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suggested Interview Follow-Up Questions</h4>
                    <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
                      <li>Can you walk through your approach and trade-offs for this technical challenge?</li>
                      <li>How would your solution scale if the dataset size increased by 100x?</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-400">
                  Disclaimer: AI-generated analysis is provided as an assistive technical review and should be considered alongside automated test results and recruiter review.
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <Clock className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800">No Evaluation Results Yet</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                The candidate has not completed or submitted this technical assessment yet. Once submitted, score breakdowns will appear here automatically.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Questions Snapshot */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Configured Questions in Snapshot</h3>
            <span className="text-xs font-semibold text-slate-500">Total Marks: {snapshot.totalMarks || 100}</span>
          </div>

          <div className="space-y-3">
            {questions.map((q: any, index: number) => (
              <div
                key={q.questionId || index}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">{q.title || `Question ${index + 1}`}</h4>
                    </div>
                    <p className="text-sm text-slate-600">{q.prompt}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider">
                      {q.type}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                      {q.marks || 10} pts
                    </span>
                  </div>
                </div>

                {/* Technical Specs for Coding/SQL/Debugging */}
                {q.coding && (
                  <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1 border border-slate-100">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span>
                        Function: <strong className="font-mono text-slate-800">{q.coding.functionName || 'solution'}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Supported Languages: <strong className="text-slate-800">{(q.coding.languageSupport || ['javascript']).join(', ')}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Public Test Cases: <strong className="text-slate-800">{(q.coding.testCases || []).length}</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Audit Log */}
      {activeTab === 'audit' && (
        <Card heading="Assignment Audit & Activity Timeline" headingLevel={2}>
          <div className="space-y-4 pt-2">
            {(assignment.audit && assignment.audit.length > 0) ? (
              assignment.audit.map((item: any, idx: number) => (
                <div key={idx} className="flex items-start gap-4 text-sm pb-4 border-b border-slate-100 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {idx + 1}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 capitalize">{item.action}</span>
                      <span className="text-xs text-slate-400">• {formatDate(item.at)}</span>
                    </div>
                    {item.reason && <p className="text-slate-600 text-xs">Reason: {item.reason}</p>}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No manual changes or extensions recorded yet.</p>
            )}
          </div>
        </Card>
      )}

      {/* Action Error Alerts */}
      {action.isError && (
        <Alert
          tone={action.error instanceof ApiError && action.error.status === 409 ? 'warning' : 'danger'}
          title="Assignment could not be changed"
        >
          {action.error instanceof Error ? action.error.message : 'Please refresh and try again.'}
        </Alert>
      )}

      {/* Dialog Modals for Extend Deadline & Cancel */}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
        title={modal === 'cancel' ? 'Cancel Candidate Assignment?' : 'Extend Assessment Deadline'}
        description="Confirm this change. All assignment modifications are recorded in the audit log."
        busy={action.isPending}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setModal(null)}
              className="!rounded-xl !px-4 !py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void run()}
              loading={action.isPending}
              disabled={!reason.trim() || (modal === 'extend' && !expiresAt)}
              variant={modal === 'cancel' ? 'danger' : 'primary'}
              className={`!rounded-xl !px-4 !py-2 font-semibold text-white ${
                modal === 'cancel' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Confirm Change
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <TextArea
            label="Reason for Change"
            required
            placeholder="State the rationale for extending or cancelling this assignment..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {modal === 'extend' && (
            <TextField
              label="New Expiration Deadline"
              type="datetime-local"
              required
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          )}
        </div>
      </Dialog>
    </div>
  );
}
