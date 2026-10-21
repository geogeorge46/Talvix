import { useState } from 'react';
import {
  Briefcase,
  Sparkles,
  Calendar,
} from 'lucide-react';

export function PlatformShowcase() {
  const [activeTab, setActiveTab] = useState<
    'candidate' | 'recruiter' | 'org'
  >('candidate');

  return (
    <section id="showcase" className="relative bg-slate-50/60 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 shadow-sm">
            <Sparkles size={13} className="text-emerald-500" />
            <span>Interactive Experience</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Designed for Every Stage of the{' '}
            <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
              Talent Journey
            </span>
          </h2>
          <p className="mt-3 text-base text-slate-600">
            Explore the tailored workspaces purpose-built for candidates, hiring
            teams, and recruiters.
          </p>

          {/* Tab Switcher */}
          <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5">
            <button
              onClick={() => setActiveTab('candidate')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                activeTab === 'candidate'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Candidate
            </button>
            <button
              onClick={() => setActiveTab('recruiter')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                activeTab === 'recruiter'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Recruiter
            </button>
            <button
              onClick={() => setActiveTab('org')}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                activeTab === 'org'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Organization
            </button>
          </div>
        </div>

        {/* Dashboard Preview Window (Modern Light Theme) */}
        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white text-slate-900 shadow-xl">
          {/* Mock Browser Light Header */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-6 py-3.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-2 font-mono text-xs text-slate-500">
                app.talvix.com/{activeTab}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span>Live Workspace Connected</span>
            </div>
          </div>

          {/* TAB 1: CANDIDATE */}
          {activeTab === 'candidate' && (
            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <span>Hello, Asha Rao</span>
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      Verified Senior Candidate
                    </span>
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Your coding assessment has been benchmarked: 96th percentile
                    in React & Distributed Systems.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                    Profile Completeness: 100%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Active Applications</span>
                    <Briefcase size={14} className="text-emerald-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    4 In Review
                  </div>
                  <div className="mt-1 text-xs font-semibold text-emerald-600">
                    2 Interview Invites Ready
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>AI Skill Score</span>
                    <Sparkles size={14} className="text-cyan-600" />
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    96 / 100
                  </div>
                  <div className="mt-1 text-xs font-semibold text-cyan-600">
                    Top Tier Matching Tier
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Upcoming Interview</span>
                    <Calendar size={14} className="text-blue-600" />
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    WebRTC Technical Round
                  </div>
                  <div className="mt-1 text-xs font-semibold text-blue-600">
                    Tomorrow, 10:00 AM UTC
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RECRUITER */}
          {activeTab === 'recruiter' && (
            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Recruiter Intelligence Workspace
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    AI-powered talent matching, sandboxed code evaluations, and
                    automated candidate staging.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    14 Positions Filled This Month
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-1 text-xs text-slate-500">
                    Time to Hire
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-600">
                    9 Days Avg
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    68% faster than traditional ATS
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-1 text-xs text-slate-500">
                    Pass-Through Rate
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    84.2%
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Qualified after AI assessment
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                  <div className="mb-1 text-xs text-slate-500">
                    Candidate Satisfaction
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    4.9 / 5.0
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Based on 1,420 post-interview reviews
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORGANIZATION */}
          {activeTab === 'org' && (
            <div className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    Enterprise Organization Administration
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Granular team access, department budgets, custom interview
                    rubrics, and hiring compliance.
                  </p>
                </div>
                <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
                  SOC-2 Type II Certified
                </span>
              </div>

              <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 sm:flex-row">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    Role-Based Access Control (RBAC)
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Enforce strict approval chains on offers, candidate
                    contracts, and assessment question banks.
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
                  Audit Logs Active
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
