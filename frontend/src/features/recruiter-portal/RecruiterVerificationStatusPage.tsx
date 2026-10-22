import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { Button } from '../../design-system';
import { useAuth } from '../../auth/AuthProvider';

export function RecruiterVerificationStatusPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ['recruiter-profile', 'me'],
    queryFn: () => apiRequest<{ profile: any }>('/recruiters/me'),
  });

  const profile = profileQuery.data?.profile;
  const company = profile?.company;
  const recruiterStatus = profile?.user?.recruiterVerificationStatus ?? user?.recruiterVerificationStatus ?? 'none';
  const companyStatus = company?.verificationStatus ?? 'none';

  const isAnyRejected = recruiterStatus === 'rejected' || companyStatus === 'rejected';
  const isBothVerified = recruiterStatus === 'verified' && companyStatus === 'verified';
  
  let overallState: 'rejected' | 'verified' | 'pending' = 'pending';
  if (isAnyRejected) {
    overallState = 'rejected';
  } else if (isBothVerified) {
    overallState = 'verified';
  } else {
    overallState = 'pending';
  }

  const formattedDate = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    return new Date(dateString).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 font-sans antialiased flex flex-col">
      {/* Modern Navigation Header */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/90 bg-white/95 backdrop-blur-md shadow-xs transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand Logo + Back to Home Button + Breadcrumbs */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <Link
              to="/"
              title="Return to Talvix Home"
              className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-xl"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 group-hover:bg-black text-white shadow-md shadow-slate-900/20 transition-all group-hover:scale-105">
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L2 6v6c0 5.52 4.48 10 9 10s9-4.48 9-10V6l-9-4zm0 2.5l7 3.1v4.4c0 4.1-3 7.8-7 8.5-4-.7-7-4.4-7-8.5V7.6l7-3.1z" />
                  <path d="M11 7h2v6h-2zM11 14h2v2h-2z" />
                </svg>
              </div>
              <span className="text-xl font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                Talvix
              </span>
            </Link>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            {/* Back to Home Button */}
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 rounded-lg border border-slate-300/80 shadow-2xs transition-all"
            >
              <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Home</span>
            </Link>

            {/* Breadcrumb nav on larger screens */}
            <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Link to="/" className="hover:text-slate-700 transition-colors">Home</Link>
              <span>/</span>
              <span className="text-slate-600 font-semibold">Recruiter Portal</span>
              <span>/</span>
              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                Verification Status
              </span>
            </nav>
          </div>

          {/* Right: Onboarding Setup Link + User Info & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/recruiter/onboarding"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-transparent hover:border-slate-200 transition-all"
            >
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Onboarding Wizard</span>
            </Link>

            {user && (
              <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {user.fullName?.charAt(0).toUpperCase() || 'R'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-tight max-w-[120px] truncate">
                    {user.fullName || 'Recruiter'}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                    Recruiter
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={async () => {
                await logout();
                window.location.reload();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 rounded-lg border border-rose-200/80 transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold mb-3 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            LEGITIMACY VERIFICATION
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Verification Status
          </h1>
          <p className="text-sm text-slate-600">
            Track the status of your recruiter identity and corporate membership credentials.
          </p>
        </div>

        {/* ================= STATUS: PENDING ================= */}
        {overallState === 'pending' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl shadow-slate-100 p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Verification Submitted</h2>
                <p className="text-xs text-slate-500">Currently awaiting administrator review</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              Your recruiter profile and company information have been submitted to the administrative queue. Our compliance audit confirms your official corporate registry identifiers and organizational domain.
            </p>

            <div className="flex flex-col gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Recruiter Identity Verification</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  recruiterStatus === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {recruiterStatus === 'verified' ? '✓ Verified' : '⏳ Pending'}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Company Entity Verification</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  companyStatus === 'verified'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {companyStatus === 'verified' ? '✓ Verified' : '⏳ Pending'}
                </span>
              </div>

              {company?.registryVerificationStatus && company.registryVerificationStatus !== 'none' && (
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Official Registry Check (CIN/GST)</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    company.registryVerificationStatus === 'verified'
                      ? 'bg-emerald-100 text-emerald-800'
                      : company.registryVerificationStatus === 'failed'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {company.registryVerificationStatus === 'verified'
                      ? '✓ Registry Match'
                      : company.registryVerificationStatus === 'failed'
                      ? '⚠ Review Advised'
                      : '⏳ Under Review'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 mb-6 px-1">
              <span>Last Updated:</span>
              <span className="font-bold text-slate-800">{formattedDate(profile?.updatedAt)}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-slate-100">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Home</span>
              </Link>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-bold bg-slate-900 hover:bg-black text-white rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer"
              >
                <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STATUS: REJECTED ================= */}
        {overallState === 'rejected' && (
          <div className="bg-white rounded-2xl border border-rose-200/90 shadow-xl shadow-rose-100/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Verification Not Approved</h2>
                <p className="text-xs text-rose-600 font-semibold">Action required to resolve rejection</p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              Your verification request could not be approved based on the submitted business entity or recruiter credentials. Please review the reasons below, update your details, and resubmit.
            </p>

            <div className="flex flex-col gap-4 p-5 rounded-xl border border-rose-200 bg-rose-50/40 mb-6">
              {recruiterStatus === 'rejected' && (
                <div>
                  <div className="flex items-center justify-between text-sm font-bold text-slate-900 mb-1">
                    <span>Recruiter Verification</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">Rejected</span>
                  </div>
                  <p className="text-xs text-rose-700 italic bg-white p-2.5 rounded-lg border border-rose-200 mt-1">
                    {profile?.rejectionReason || 'No specific feedback provided by administrator.'}
                  </p>
                </div>
              )}

              {companyStatus === 'rejected' && (
                <div>
                  <div className="flex items-center justify-between text-sm font-bold text-slate-900 mb-1">
                    <span>Company Verification ({company?.name})</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">Rejected</span>
                  </div>
                  <p className="text-xs text-rose-700 italic bg-white p-2.5 rounded-lg border border-rose-200 mt-1">
                    {company?.rejectionReason || 'No specific feedback provided by administrator.'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-slate-100">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Back to Home</span>
              </Link>

              <div className="flex items-center gap-2">
                {recruiterStatus === 'rejected' && (
                  <Button onClick={() => navigate('/recruiter/onboarding')} className="bg-slate-900 text-white font-bold">
                    Edit Recruiter Profile
                  </Button>
                )}
                {companyStatus === 'rejected' && (
                  <Button onClick={() => navigate('/recruiter/onboarding?editCompany=true')} className="bg-slate-900 text-white font-bold">
                    Edit Company Details
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= STATUS: VERIFIED ================= */}
        {overallState === 'verified' && (
          <div className="bg-white rounded-2xl border border-emerald-200/90 shadow-xl shadow-emerald-100/50 p-6 sm:p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-1">Verification Approved!</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto mb-6">
              Your recruiter account and company membership are fully validated. You have unlocked access to create jobs, manage ATS pipelines, and invite team members.
            </p>

            <div className="flex flex-col gap-2 max-w-sm mx-auto p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 text-left text-xs mb-6 font-semibold text-emerald-900">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Recruiter Identity Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Corporate Entity Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Company Membership Active</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Link
                to="/"
                className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              >
                Back to Home
              </Link>
              <Button onClick={() => navigate('/org')} className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-md">
                Launch Recruiter Workspace &rarr;
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Talvix</span>
            <span>&copy; {new Date().getFullYear()} Talvix Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link to="/recruiter/onboarding" className="hover:text-slate-900 transition-colors">Onboarding Wizard</Link>
            <a href="mailto:support@talvix.com" className="hover:text-slate-900 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
