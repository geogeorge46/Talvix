import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Play,
  Users,
  Briefcase,
  Layers,
  Shield,
  X,
  Code2,
  Heart,
  GraduationCap,
  Building,
  MoreHorizontal,
  Video,
  FileCheck,
} from 'lucide-react';
import { useAuth, homeForRole } from '../../auth/AuthProvider';
import { HeroBento } from './components/HeroBento';
import { LiveJobsSection } from './components/LiveJobsSection';
import { PlatformCapabilities } from './components/PlatformCapabilities';
import { PlatformShowcase } from './components/PlatformShowcase';
import { FaqSection } from './components/FaqSection';
import './landing-page.css';

export function LandingPage() {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const [showVideoModal, setShowVideoModal] = useState(false);

  const authenticated = status === 'authenticated' && user;

  const handleCTA = () => {
    if (authenticated) {
      navigate(homeForRole(user.role));
    } else {
      navigate('/register');
    }
  };

  const handleLogin = () => {
    if (authenticated) {
      navigate(homeForRole(user.role));
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="landing-page-root flex min-h-screen flex-col">
      {/* 1. TOP HEADER - ONLY TALVIX LOGO AND NAME */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-20 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & Name */}
          <Link
            to="/"
            className="group flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 transition-transform group-hover:scale-105">
              <svg
                width="24"
                height="24"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 12C8 10.8954 8.8954 10 10 10H30C31.1046 10 32 10.8954 32 12C32 13.1046 31.1046 14 30 14H23V28C23 29.1046 22.1046 30 21 30C19.8954 30 19 29.1046 19 28V14H10C8.8954 14 8 13.1046 8 12Z"
                  fill="white"
                />
                <circle cx="28" cy="12" r="3" fill="#6ee7b7" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700">
              Talvix
            </span>
          </Link>
        </div>
      </header>

      {/* 2. HERO SECTION - FAITHFULLY MATCHING THE USER REFERENCE IMAGE */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24">
        {/* Soft Organic Background Glows */}
        <div className="landing-hero-backdrop" />
        <div className="hero-curve-accent" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Main Top Row: Left Content + Right Visual Bento */}
          <div className="mb-16 grid grid-cols-1 items-center gap-10 sm:mb-20 lg:grid-cols-12 lg:gap-8">
            {/* HERO LEFT COLUMN */}
            <div className="flex flex-col items-start text-left lg:col-span-6 xl:col-span-6">
              {/* Badge: AI-Powered Recruitment & Assessment */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/90 px-4 py-2 text-xs font-semibold text-emerald-800 shadow-sm sm:text-sm">
                <Sparkles size={16} className="text-emerald-600" />
                <span>AI-Powered Recruitment & Assessment</span>
              </div>

              {/* Main Headline: Smarter Hiring for a Brighter Future */}
              <h1 className="mb-6 text-4xl font-black tracking-tight leading-[1.12] text-slate-900 sm:text-5xl lg:text-6xl">
                Smarter Hiring <br />
                for a <span className="text-emerald-500">Brighter</span>{' '}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                  Future
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mb-8 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Talvix helps organizations find the right talent with AI-driven
                skill assessments, intelligent matching and seamless interviews
                — all in one platform.
              </p>

              {/* CTA Action Buttons */}
              <div className="mb-4 flex w-full flex-wrap items-center gap-4 sm:w-auto">
                <button
                  onClick={handleCTA}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-2xl sm:w-auto"
                >
                  <span>Get Started Free</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowVideoModal(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition-all hover:border-slate-800 hover:shadow-md sm:w-auto"
                >
                  <span>Learn More</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white">
                    <Play size={10} fill="currentColor" className="ml-0.5" />
                  </div>
                </button>
              </div>

              <div className="mb-10 text-xs sm:text-sm text-slate-500 font-medium">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={handleLogin}
                  className="font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Sign in to your account &rarr;
                </button>
              </div>

              {/* Social Proof Avatars Row */}
              <div className="mb-10 flex items-center gap-3.5">
                <div className="flex -space-x-2.5 overflow-hidden">
                  <img
                    className="inline-block h-9 w-9 rounded-full object-cover ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80"
                    alt="Recruiter user"
                  />
                  <img
                    className="inline-block h-9 w-9 rounded-full object-cover ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80"
                    alt="Recruiter user"
                  />
                  <img
                    className="inline-block h-9 w-9 rounded-full object-cover ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80"
                    alt="Recruiter user"
                  />
                  <img
                    className="inline-block h-9 w-9 rounded-full object-cover ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80"
                    alt="Recruiter user"
                  />
                </div>
                <div className="text-xs text-slate-600 sm:text-sm">
                  <span className="font-bold text-slate-900">
                    Trusted by 100+ recruiters
                  </span>{' '}
                  and growing
                </div>
              </div>

              {/* Quick Feature Pillars from reference image */}
              <div className="grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-2">
                <div className="feature-quick-pill">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Sparkles size={16} />
                  </span>
                  <span>AI Matching</span>
                </div>
                <div className="feature-quick-pill">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700">
                    <FileCheck size={16} />
                  </span>
                  <span>Assessments</span>
                </div>
                <div className="feature-quick-pill">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                    <Video size={16} />
                  </span>
                  <span>WebRTC Interviews</span>
                </div>
                <div className="feature-quick-pill">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                    <Shield size={16} />
                  </span>
                  <span>Secure & Compliant</span>
                </div>
              </div>
            </div>

            {/* HERO RIGHT COLUMN - THE BENTO COMPONENT */}
            <div className="w-full lg:col-span-6 xl:col-span-6">
              <HeroBento />
            </div>
          </div>

          {/* BOTTOM HERO SECTION: 4 ROLE PILLARS */}
          <div className="mb-12 grid grid-cols-1 gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {/* 1. For Candidates */}
            <div className="role-card-hero">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-700">
                <Users size={20} />
              </div>
              <h2 className="mb-1 text-base font-bold text-slate-900">
                For Candidates
              </h2>
              <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                Showcase your skills and get hired based on direct engineering
                merit.
              </p>
            </div>

            {/* 2. For Recruiters */}
            <div className="role-card-hero">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-100/80 text-cyan-700">
                <Briefcase size={20} />
              </div>
              <h2 className="mb-1 text-base font-bold text-slate-900">
                For Recruiters
              </h2>
              <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                Find the best talent faster with automated AI skill scoring &
                candidate staging.
              </p>
            </div>

            {/* 3. For Teams */}
            <div className="role-card-hero">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100/80 text-blue-700">
                <Layers size={20} />
              </div>
              <h2 className="mb-1 text-base font-bold text-slate-900">
                For Teams
              </h2>
              <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                Build high-performing teams with structured evaluations and rubric
                sharing.
              </p>
            </div>

            {/* 4. For Administrators */}
            <div className="role-card-hero">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100/80 text-emerald-800">
                <Shield size={20} />
              </div>
              <h2 className="mb-1 text-base font-bold text-slate-900">
                For Administrators
              </h2>
              <p className="text-xs leading-relaxed text-slate-500 sm:text-sm">
                Manage with ease and security through verified audit logs and
                compliance checks.
              </p>
            </div>
          </div>

          {/* INDUSTRY TICKER: Empowering Talent Across Industries */}
          <div className="flex flex-col items-center justify-between gap-4 pt-4 text-xs text-slate-500 md:flex-row">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="mr-1 font-bold text-slate-700">
                Empowering Talent Across Industries:
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                <Code2 size={13} className="text-emerald-600" /> IT & Software
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                <Heart size={13} className="text-rose-500" /> Healthcare
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                <GraduationCap size={13} className="text-blue-600" /> Education
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-sm">
                <Building size={13} className="text-amber-600" /> Finance
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 font-medium text-slate-600">
                <MoreHorizontal size={13} /> And More
              </span>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold tracking-tight text-slate-900">
              <span>Join Talvix Today</span>
              <span className="text-base text-emerald-600">⤵</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. LIVE JOBS FROM DATABASE SECTION */}
      <LiveJobsSection />

      {/* 4. NEXT-GEN HIRING CAPABILITIES & INTERACTIVE 3D CANVAS (LIGHT THEME) */}
      <PlatformCapabilities />

      {/* 5. INTERACTIVE ROLE EXPERIENCE SHOWCASE (LIGHT THEME) */}
      <PlatformShowcase />

      {/* 6. FAQ SECTION */}
      <FaqSection />

      {/* 7. HIGH-CONVERTING FINAL CTA & LIGHT MODERN FOOTER */}
      <footer
        id="footer"
        className="relative overflow-hidden border-t border-slate-200 bg-slate-50 pt-16 pb-12 text-slate-600"
      >
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* CTA Box (Vibrant Emerald Gradient) */}
          <div className="mx-auto mb-16 max-w-4xl rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-8 text-center text-white shadow-xl sm:p-12">
            <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl md:text-4xl">
              Ready to Upgrade to <span className="text-emerald-200">Skills-First</span> Hiring?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-sm text-emerald-50 sm:text-base">
              Join leading organizations and high-caliber candidates connecting
              through verifiable talent assessments and WebRTC interviews.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleCTA}
                className="rounded-full bg-white px-8 py-3.5 text-sm font-bold text-slate-900 shadow-md transition-all hover:bg-slate-100 hover:scale-105"
              >
                Create Free Account
              </button>
              <button
                onClick={handleLogin}
                className="rounded-full border border-white/40 bg-emerald-800/40 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-emerald-800/60"
              >
                Sign In to Platform
              </button>
            </div>
          </div>

          {/* Links & Brand columns */}
          <div className="grid grid-cols-2 gap-8 border-b border-slate-200 pb-12 text-xs sm:text-sm md:grid-cols-5">
            <div className="col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-black text-white">
                  T
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Talvix
                </span>
              </div>
              <p className="mb-4 max-w-xs text-xs leading-relaxed text-slate-500">
                The modern skills-first recruitment ecosystem. Real assessments,
                proctored interviews, and secure offers.
              </p>
              <div className="text-xs text-slate-400">
                © {new Date().getFullYear()} Talvix Inc. All rights reserved.
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase">
                Platform
              </h3>
              <ul className="space-y-2 text-slate-600">
                <li>
                  <a href="#capabilities" className="hover:text-emerald-600">
                    AI Matching
                  </a>
                </li>
                <li>
                  <a href="#capabilities" className="hover:text-emerald-600">
                    Coding Sandbox
                  </a>
                </li>
                <li>
                  <a href="#capabilities" className="hover:text-emerald-600">
                    WebRTC Video
                  </a>
                </li>
                <li>
                  <a href="#jobs" className="hover:text-emerald-600">
                    Job Board
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase">
                Audience
              </h3>
              <ul className="space-y-2 text-slate-600">
                <li>
                  <Link
                    to="/register?role=candidate"
                    className="hover:text-emerald-600"
                  >
                    For Candidates
                  </Link>
                </li>
                <li>
                  <Link
                    to="/register?role=recruiter"
                    className="hover:text-emerald-600"
                  >
                    For Recruiters
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-emerald-600">
                    For Enterprises
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-emerald-600">
                    Admin Portal
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-3 text-xs font-bold tracking-wider text-slate-900 uppercase">
                Security & Trust
              </h3>
              <ul className="space-y-2 text-slate-600">
                <li>
                  <span className="text-slate-400">SOC2 Type II</span>
                </li>
                <li>
                  <span className="text-slate-400">GDPR Compliant</span>
                </li>
                <li>
                  <span className="text-slate-400">AES-256 Storage</span>
                </li>
                <li>
                  <a href="#faq" className="hover:text-emerald-600">
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 pt-8 text-xs text-slate-500 sm:flex-row">
            <div>
              Engineered for transparent, objective, and high-performance talent
              evaluation.
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-900">
                Terms of Service
              </a>
              <a href="#" className="hover:text-slate-900">
                Privacy Notice
              </a>
              <a href="#" className="hover:text-slate-900">
                Status Monitor
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* 8. INTERACTIVE FEATURE / VIDEO MODAL (CLEAN LIGHT THEME) */}
      {showVideoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Talvix Platform Overview"
          className="animate-fade-in fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl sm:p-8">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <Sparkles size={14} className="text-emerald-500" />
              <span>Platform Tour</span>
            </div>
            <h3 className="mb-3 text-xl font-bold text-slate-900 sm:text-2xl">
              How Talvix Accelerates Hiring
            </h3>
            <p className="mb-6 text-xs leading-relaxed text-slate-600 sm:text-sm">
              Unlike traditional keyword-filtered resume queues, Talvix evaluates
              actual coding and problem-solving capability.
            </p>

            <div className="mb-6 space-y-3.5">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                  1
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Interactive Skill Blueprint
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Candidates prove abilities in sandboxed environments with
                    automated test suites.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">
                  2
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Live WebRTC Technical Interview
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Synchronized Monaco code editor with multi-evaluator rubrics
                    and proctoring.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  3
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Transactional Offer Delivery
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Cryptographically verifiable contracts and transparent
                    compensation milestones.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowVideoModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowVideoModal(false);
                  handleCTA();
                }}
                className="rounded-full bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
