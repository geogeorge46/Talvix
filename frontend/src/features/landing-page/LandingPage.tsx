import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  ChevronDown,
  Shield,
  Activity,
  Mail,
  Settings,
  Users,
  Briefcase,
  FileText,
  Brain,
  Bot,
  Sparkles,
  Clock,
  Menu,
  X,
  CheckCircle2,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useAuth, homeForRole } from '../../auth/AuthProvider';
import './landing-page.css';

// Reusable components
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass-card p-8 pt-12 flex flex-col items-center text-center badge-overlapped">
      <div className="dark-badge">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">{description}</p>
    </div>
  );
}

function StatCard({
  value,
  label,
  suffix = "",
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(() => {
    return typeof IntersectionObserver === 'undefined' ? value : 0;
  });
  const elementRef = useRef<HTMLDivElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && !animated.current) {
          animated.current = true;
          let start = 0;
          const end = value;
          const duration = 1500;
          const stepTime = Math.max(Math.floor(duration / 50), 15);
          const timer = setInterval(() => {
            start += Math.ceil(end / (duration / stepTime));
            if (start >= end) {
              clearInterval(timer);
              setCount(end);
            } else {
              setCount(start);
            }
          }, stepTime);
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => observer.disconnect();
  }, [value]);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + "K";
    }
    return num.toString();
  };

  return (
    <div ref={elementRef} className="glass-card p-8 text-center flex flex-col justify-center items-center">
      <div className="text-4xl font-extrabold text-slate-900 mb-2">
        {formatNumber(count)}{suffix}
      </div>
      <div className="text-slate-500 font-medium text-sm">{label}</div>
    </div>
  );
}

function JourneyTimeline({
  title,
  steps,
}: {
  title: string;
  steps: { label: string; desc: string }[];
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <h3 className="text-2xl font-bold text-slate-900 mb-12">{title}</h3>
      <div className="relative w-full flex flex-col md:flex-row md:justify-between items-stretch md:items-start gap-8 md:gap-4 max-w-5xl">
        <div className="journey-timeline-line hidden md:block" />
        {steps.map((step, idx) => (
          <div key={idx} className="flex md:flex-col items-center md:items-center text-left md:text-center flex-1 relative z-10">
            <div className="flex flex-col items-center mr-4 md:mr-0 md:mb-4">
              <div className="journey-node text-sm font-semibold">
                {idx + 1}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base mb-1">{step.label}</h4>
              <p className="text-slate-500 text-xs max-w-xs">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModuleGrid() {
  const modules = [
    { name: 'Candidate Portal', desc: 'Secure profile management, visual skill matrices, application tracking and offer revision workflows.', icon: <Users size={20} /> },
    { name: 'Recruiter Workspace', desc: 'Sleek ATS overview, applicant review, job postings, company management, and verification states.', icon: <Briefcase size={20} /> },
    { name: 'Organization Administration', desc: 'Company verification profiles, granular team member management, and support routes.', icon: <Settings size={20} /> },
    { name: 'Admin Workspace', desc: 'Central audit controls, company verification pipelines, health monitors, and communications.', icon: <Shield size={20} /> },
    { name: 'Assessment Engine', desc: 'Strict candidate coding tests, question banks, secure review flows, and execution statistics.', icon: <Brain size={20} /> },
    { name: 'Interview Engine', desc: 'Feedback queues, template building, process states, and smart slots matching availability.', icon: <Clock size={20} /> },
    { name: 'Offer Management', desc: 'Multi-stage approvals, automated workflow, template compilation, revisions, and audits.', icon: <FileText size={20} /> },
    { name: 'Document Management', desc: 'Transaction-capable uploads, security malware flags, and owner-only file delivery.', icon: <Mail size={20} /> },
    { name: 'Notification Center', desc: 'Transactional notifications, inbox delivery, settings, and outbox failure logging.', icon: <Activity size={20} /> },
    { name: 'Analytics Module', desc: 'Aggregated reports, cohort progress metrics, conversion funnels, and data compliance.', icon: <TrendingUp size={20} /> },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {modules.map((m, idx) => (
        <div key={idx} className="glass-card p-6 flex flex-col justify-between text-left hover:scale-[1.02] transition-transform">
          <div>
            <div className="text-slate-800 mb-4">{m.icon}</div>
            <h4 className="font-bold text-slate-900 mb-1 text-sm">{m.name}</h4>
            <p className="text-slate-500 text-xs leading-relaxed">{m.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TestimonialCard({
  jobTitle,
  name,
  quote,
  company,
}: {
  jobTitle: string;
  name: string;
  quote: string;
  company: string;
}) {
  return (
    <div className="glass-card p-8 flex flex-col justify-between text-left h-full">
      <div className="mb-6">
        <div className="flex gap-1 text-amber-500 mb-4">
          <Star size={16} fill="currentColor" />
          <Star size={16} fill="currentColor" />
          <Star size={16} fill="currentColor" />
          <Star size={16} fill="currentColor" />
          <Star size={16} fill="currentColor" />
        </div>
        <p className="text-slate-600 italic text-sm leading-relaxed">"{quote}"</p>
      </div>
      <div>
        <h4 className="font-bold text-slate-900 text-sm mb-0.5">{name}</h4>
        <p className="text-xs text-slate-400 font-medium">{jobTitle} • {company}</p>
      </div>
    </div>
  );
}

function FAQAccordion() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does Talvix work?',
      a: 'Talvix operates on a skills-first methodology. Candidates complete interactive assessments that prove their competencies directly, while recruiters leverage AI-powered matching that bypasses generic resumes and manual review bottlenecks.',
    },
    {
      q: 'Is AI replacing recruiters?',
      a: 'Not at all. Talvix uses AI as a superpower for recruiters. By automating parsing, matching, and question generation, recruiters can focus on building relationships and conducting deeper interviews, rather than wading through hundreds of resumes manually.',
    },
    {
      q: 'How are assessments conducted?',
      a: 'Coding and skills assessments are built directly within Talvix using an isolated environment. Code execution is fully sandboxed, and test suites validate responses securely. Recruiter reviews are fully guided by detailed metric breakdowns.',
    },
    {
      q: 'How are interviews managed?',
      a: 'The platform integrates templates, process tracks, and availability slots. Recruiters can quickly design standard interview rubrics, assign reviewers, collect feedback in structured queues, and coordinate safe candidate schedules.',
    },
    {
      q: 'How are offers handled?',
      a: 'Offers flow through a rigorous internal approval workflow within the organization space. Revisions are tracked chronologically, and document mutations are transactional, ensuring candidates always view verified and secure offer details.',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      {faqs.map((faq, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="glass-card overflow-hidden faq-item"
            data-state={isOpen ? 'open' : 'closed'}
          >
            <button
              id={`faq-trigger-${idx}`}
              className="faq-trigger"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${idx}`}
            >
              <span>{faq.q}</span>
              <ChevronDown className="faq-icon text-slate-400" size={18} />
            </button>
            <div
              id={`faq-answer-${idx}`}
              aria-labelledby={`faq-trigger-${idx}`}
              className="faq-content text-slate-500 text-sm leading-relaxed"
              role="region"
            >
              <p>{faq.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LandingPage() {
  const { user, status } = useAuth();
  const navigate = useNavigate();
  const [activeShowcaseTab, setActiveShowcaseTab] = useState<'candidate' | 'recruiter' | 'org' | 'admin'>('candidate');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');

  const authenticated = status === 'authenticated' && user;

  const handleCTA = () => {
    if (authenticated) {
      navigate(homeForRole(user.role));
    } else {
      navigate('/register');
    }
  };

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authenticated) {
      navigate(homeForRole(user.role));
    } else {
      navigate(`/register?email=${encodeURIComponent(email)}`);
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
    <div className="landing-page min-h-screen flex flex-col">
      
      {/* 15 HEADER / NAVIGATION */}
      <header className="sticky top-0 z-[100] glass-panel border-b border-slate-200 w-full">
        <div className="landing-container h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-slate-900 rounded-lg">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" rx="50" fill="var(--ref-steel-900)" />
              <path d="M30 45 L50 25 L70 45 L55 45 L55 75 L45 75 L45 45 Z" fill="white" />
            </svg>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">
              TALVIX
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500" aria-label="Main Navigation">
            <a href="#why-talvix" className="hover:text-slate-900 transition-colors">Why Talvix</a>
            <a href="#modules" className="hover:text-slate-900 transition-colors">Modules</a>
            <a href="#journey" className="hover:text-slate-900 transition-colors">Journeys</a>
            <a href="#showcase" className="hover:text-slate-900 transition-colors">Showcase</a>
            <a href="#comparison" className="hover:text-slate-900 transition-colors">ATS vs Talvix</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          </nav>

          {/* Nav CTAs - Primary High Contrast Slate */}
          <div className="hidden md:flex items-center gap-4">
            {authenticated ? (
              <button
                onClick={handleCTA}
                className="tvx-button tvx-button--primary tvx-button--compact"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="tvx-button tvx-button--quiet tvx-button--compact text-slate-600 hover:text-slate-900"
                >
                  Login
                </button>
                <button
                  onClick={handleCTA}
                  className="tvx-button tvx-button--primary tvx-button--compact"
                >
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-slate-500 hover:text-slate-900 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu Panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white p-4 flex flex-col gap-4 animate-fade-in">
            <nav className="flex flex-col gap-3 font-semibold text-slate-500">
              <a href="#why-talvix" onClick={() => setMobileMenuOpen(false)} className="hover:text-slate-900">Why Talvix</a>
              <a href="#modules" onClick={() => setMobileMenuOpen(false)} className="hover:text-slate-900">Modules</a>
              <a href="#journey" onClick={() => setMobileMenuOpen(false)} className="hover:text-slate-900">Journeys</a>
              <a href="#showcase" onClick={() => setMobileMenuOpen(false)} className="hover:text-slate-900">Showcase</a>
              <a href="#comparison" onClick={() => setMobileMenuOpen(false)} className="hover:text-slate-900">ATS vs Talvix</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="hover:text-slate-900">FAQ</a>
            </nav>
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              {authenticated ? (
                <button
                  onClick={() => { setMobileMenuOpen(false); handleCTA(); }}
                  className="tvx-button tvx-button--primary w-full text-center"
                >
                  Go to Dashboard
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleLogin(); }}
                    className="tvx-button tvx-button--secondary w-full text-center"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => { setMobileMenuOpen(false); handleCTA(); }}
                    className="tvx-button tvx-button--primary w-full text-center"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 1 HERO SECTION */}
        <section className="relative pt-20 pb-20 md:pt-28 md:pb-32 overflow-visible">
          <div className="landing-container text-center flex flex-col items-center animate-slide-up">
            
            {/* Mockup bird-style dark logo badge */}
            <div className="dark-badge mb-6 scale-110">
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="50" fill="black" />
                <path d="M30 45 L50 25 L70 45 L55 45 L55 75 L45 75 L45 45 Z" fill="white" />
              </svg>
            </div>

            {/* Sub-badge status container utilizing glassmorphism */}
            <div className="glass-card inline-flex items-center gap-2 px-4 py-1.5 border border-white text-slate-800 rounded-full text-xs font-semibold mb-6 shadow-sm">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span>Beta goes live soon</span>
            </div>

            {/* Main Header */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6 max-w-4xl mx-auto">
              AI-Powered Skills-First Recruitment Platform
            </h1>

            {/* Subtitle */}
            <p className="text-slate-500 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto">
              Helping candidates and recruiters connect through intelligent hiring workflows, AI-powered assessments, secure hiring, and transparent recruitment.
            </p>

            {/* Pill Waitlist input form with glass backdrop */}
            <form onSubmit={handleWaitlistSubmit} className="hero-pill-input mb-8 mx-auto">
              <input
                type="email"
                placeholder="Your email address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email address for Waitlist"
              />
              <button type="submit" className="hero-pill-button">
                {authenticated ? 'Go to Dashboard' : 'Join Waitlist'}
              </button>
            </form>

            {/* Waitlist stats row */}
            <div className="flex items-center gap-3 mb-16 justify-center">
              <div className="avatar-group">
                <div className="avatar-group-item bg-slate-900 flex items-center justify-center text-white text-[8px] font-bold">C1</div>
                <div className="avatar-group-item bg-slate-700 flex items-center justify-center text-white text-[8px] font-bold">R2</div>
                <div className="avatar-group-item bg-slate-500 flex items-center justify-center text-white text-[8px] font-bold">A3</div>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                Join 8,258+ candidates & recruiters
              </span>
            </div>

            {/* 3 columns side-by-side features using glassmorphism cards and overlapping badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-5xl mt-4 mx-auto">
              <div className="glass-card p-8 pt-14 text-center flex flex-col items-center badge-overlapped">
                <div className="dark-badge">
                  <Brain size={20} />
                </div>
                <div className="font-bold text-slate-900 text-base mb-2">Smart Automation</div>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Automate parsing, test allocations, and scheduling queues.
                </p>
              </div>

              <div className="glass-card p-8 pt-14 text-center flex flex-col items-center badge-overlapped">
                <div className="dark-badge">
                  <TrendingUp size={20} />
                </div>
                <div className="font-bold text-slate-900 text-base mb-2">AI Insights</div>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Unlock transparent capability metrics and match indexes.
                </p>
              </div>

              <div className="glass-card p-8 pt-14 text-center flex flex-col items-center badge-overlapped">
                <div className="dark-badge">
                  <Users size={20} />
                </div>
                <div className="font-bold text-slate-900 text-base mb-2">Team Collaboration</div>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Scale your hiring pipelines and share reviewer rubrics.
                </p>
              </div>
            </div>

            {/* Minimalist Dashboard Preview container utilizing glassmorphism cards */}
            <div className="w-full max-w-4xl mt-20 mx-auto">
              <div className="glass-card bg-white/60 border border-white/60 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/50">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-slate-200 rounded-full" />
                    <span className="w-3 h-3 bg-slate-200 rounded-full" />
                    <span className="w-3 h-3 bg-slate-200 rounded-full" />
                    <span className="text-xs font-semibold text-slate-400 ml-2">talvix.app/dashboard</span>
                  </div>
                  <div className="px-2 py-0.5 bg-slate-200/50 text-slate-800 text-[9px] font-bold rounded">
                    Unified Platform
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Candidate Component (Glass styled) */}
                  <div className="glass-card p-4 flex flex-col gap-2 bg-white/70 border-white/50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-900 text-white font-bold rounded-full flex items-center justify-center text-xs">
                        AR
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-xs text-slate-900">Asha Rao</div>
                        <p className="text-[9px] text-slate-500">Software Engineer</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[8px] bg-slate-100/60 px-1.5 py-0.5 rounded text-slate-600 font-medium">React</span>
                      <span className="text-[8px] bg-slate-100/60 px-1.5 py-0.5 rounded text-slate-600 font-medium">TypeScript</span>
                      <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-semibold">AI Verified</span>
                    </div>
                  </div>

                  {/* Recruiter component */}
                  <div className="glass-card p-4 flex flex-col justify-between bg-white/70 border-white/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Active Recruiter</span>
                      <span className="w-2.5 h-2.5 bg-slate-900 rounded-full animate-ping" />
                    </div>
                    <div className="text-left mt-2">
                      <div className="font-bold text-xs text-slate-900">Rina Shah</div>
                      <p className="text-[9px] text-slate-500">Northstar Recruiting</p>
                    </div>
                  </div>

                  {/* Pipeline */}
                  <div className="glass-card p-4 md:col-span-2 bg-white/70 border-white/50">
                    <div className="font-bold text-xs text-slate-800 text-left mb-3">Hiring Pipeline</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { name: 'Applied', count: 18, color: 'bg-slate-200/50 text-slate-700' },
                        { name: 'Assess', count: 12, color: 'bg-slate-900 text-white' },
                        { name: 'Interview', count: 4, color: 'bg-slate-100/50 text-slate-800' },
                        { name: 'Offer', count: 2, color: 'bg-slate-50/50 text-slate-500' },
                      ].map((stage, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-50/50 flex flex-col items-center">
                          <span className="text-[9px] font-medium text-slate-400">{stage.name}</span>
                          <span className={`text-xs font-bold mt-1 px-2 py-0.5 rounded-full ${stage.color}`}>{stage.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating Notification using glassmorphism dark mode alert */}
                <div className="absolute bottom-3 right-3 left-3 glass-card-dark text-white rounded-xl p-3 shadow-lg flex items-center gap-3 animate-float">
                  <div className="p-1.5 bg-white text-slate-900 rounded-lg">
                    <Bot size={16} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-[10px]">Talvix Bot</div>
                    <p className="text-[9px] text-slate-300">Asha Rao matched 9/10 core skills. Interview scheduled.</p>
                  </div>
                  <span className="text-[8px] text-slate-500 self-start">Just now</span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 2 TRUST SECTION */}
        <section className="py-12 border-y border-slate-200 bg-white">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
              Empowering Skills-First Growth Across Ecosystems
            </h2>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60">
              {['Students', 'Recruiters', 'Universities', 'Startups', 'Growing Organizations'].map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 font-bold text-slate-500 text-base md:text-lg">
                  <div className="w-2 h-2 bg-slate-900 rounded-full" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3 PLATFORM STATISTICS */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="landing-container text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-4">Talvix By The Numbers</h2>
            <p className="text-slate-600 mb-12 max-w-md mx-auto text-sm leading-relaxed">
              Accelerating hiring velocity and quality, backed by a unified recruiting pipeline.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <StatCard value={10000} label="Candidates Active" suffix="+" />
              <StatCard value={250} label="Partner Organizations" suffix="+" />
              <StatCard value={50000} label="Applications Processed" suffix="+" />
              <StatCard value={95} label="Hiring Success Rate" suffix="%" />
            </div>
          </div>
        </section>

        {/* 4 WHY TALVIX */}
        <section id="why-talvix" className="py-16 md:py-24 bg-white scroll-mt-16">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Core Value Proposition</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Why Modern Teams Choose Talvix</h3>
            <p className="text-slate-600 max-w-xl mx-auto mb-20 text-sm md:text-base leading-relaxed">
              Traditional resume filtering is biased and broken. Talvix designs hiring around proof of work, automating scheduling, tests, and compliance out of the box.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 max-w-5xl mx-auto">
              <FeatureCard
                icon={<Brain size={24} />}
                title="AI Resume Parsing"
                description="Extract verified experiences and structure profiles without parsing errors or formatting bias."
              />
              <FeatureCard
                icon={<Sparkles size={24} />}
                title="Skills-first Matching"
                description="Connect candidate evaluation directly to technical competencies and role expectations, not degrees."
              />
              <FeatureCard
                icon={<Activity size={24} />}
                title="Recruitment Automation"
                description="Coordinate document requests, assessments, slot notifications, and status checks programmatically."
              />
              <FeatureCard
                icon={<FileText size={24} />}
                title="Coding Assessments"
                description="Conduct secure code evaluations in sandboxed terminals with customized test suites and score charts."
              />
              <FeatureCard
                icon={<Clock size={24} />}
                title="Interview Management"
                description="Design evaluation rubrics, schedule slot pools, and aggregate reviewer scorecards in real-time."
              />
              <FeatureCard
                icon={<CheckCircle2 size={24} />}
                title="Offer Workflow"
                description="Track offer letters from preparation, internally delegated approvals, to candidate revisions."
              />
              <FeatureCard
                icon={<Shield size={24} />}
                title="Secure Documents"
                description="Upload files inside transactional database states with automated malware screening and owner locks."
              />
              <FeatureCard
                icon={<TrendingUp size={24} />}
                title="Analytics Dashboard"
                description="Monitor applicant funnel stages, time-to-hire velocity, cohort metrics, and compliance exports."
              />
            </div>
          </div>
        </section>

        {/* 5 PLATFORM MODULES */}
        <section id="modules" className="py-16 md:py-24 bg-slate-50 border-y border-slate-200 scroll-mt-16">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Enterprise Capabilities</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 mb-4">Complete Engine Architecture</h3>
            <p className="text-slate-600 max-w-xl mx-auto mb-12 text-sm leading-relaxed">
              Every step of candidate and recruiter engagement is structured into specialized modules.
            </p>
            <ModuleGrid />
          </div>
        </section>

        {/* 6 & 7 JOURNEYS */}
        <section id="journey" className="py-16 md:py-24 bg-white scroll-mt-16">
          <div className="landing-container text-center flex flex-col gap-20">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Platform Timelines</h2>
              <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Structured Journeys</h3>
              <p className="text-slate-600 max-w-lg mx-auto text-sm leading-relaxed">
                Clear, linear progression routes for candidates proving skill, and recruiters locking talent.
              </p>
            </div>

            {/* Candidate Journey */}
            <JourneyTimeline
              title="Candidate Journey"
              steps={[
                { label: 'Create Profile', desc: 'Securely register profile details' },
                { label: 'Complete Skills', desc: 'Add verified skills and tools' },
                { label: 'Apply', desc: 'Select and match with open roles' },
                { label: 'Assessment', desc: 'Submit coding and skills evaluations' },
                { label: 'Interview', desc: 'Coordinate availability and discuss specs' },
                { label: 'Offer', desc: 'Review, comment, and revise letters' },
                { label: 'Hired', desc: 'Successfully join team systems' },
              ]}
            />

            {/* Recruiter Journey */}
            <JourneyTimeline
              title="Recruiter Journey"
              steps={[
                { label: 'Create Company', desc: 'Submit organization profile details' },
                { label: 'Post Job', desc: 'Define skill criteria and test rails' },
                { label: 'Review Candidates', desc: 'Compare matching scores instantly' },
                { label: 'Assessment', desc: 'Trigger secure evaluations' },
                { label: 'Interview', desc: 'Evaluate responses with team slots' },
                { label: 'Offer', desc: 'Submit letters for internal approvals' },
                { label: 'Hire', desc: 'Onboard candidates dynamically' },
              ]}
            />
          </div>
        </section>

        {/* 8 AI CAPABILITIES */}
        <section className="py-16 md:py-24 bg-slate-50 border-t border-slate-200">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Intelligence Layer</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 mb-4">AI Capabilities Grid</h3>
            <p className="text-slate-600 max-w-md mx-auto mb-20 text-sm leading-relaxed">
              Intelligent algorithms embedded into your hiring workflows to eliminate guess work.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 max-w-5xl mx-auto">
              {[
                { title: 'Resume Analysis', desc: 'Audit structural timelines and automatically spot discrepancy details.', icon: <FileText size={20} /> },
                { title: 'Skill Extraction', desc: 'Parse work transcripts, codebases, and projects to index concrete competencies.', icon: <Brain size={20} /> },
                { title: 'AI Matching', desc: 'Generate a numeric matching index against job specs without demographic bias.', icon: <TrendingUp size={20} /> },
                { title: 'Question Generation', desc: 'Draft customized interview questions mapping to a candidate\'s test response.', icon: <Bot size={20} /> },
                { title: 'Performance Analysis', desc: 'Aggregate evaluation metrics across cohorts to optimize threshold settings.', icon: <Activity size={20} /> },
                { title: 'Career Recommendation', desc: 'Recommend next-step skill certificates or open projects to candidate profiles.', icon: <Award size={20} /> },
                { title: 'Fraud Detection', desc: 'Audit test compilation cycles, clipboard resets, and execution routes.', icon: <Shield size={20} /> },
                { title: 'Future AI Recruiter', desc: 'Intelligent conversational agents that pre-screen and schedule slots securely.', icon: <Sparkles size={20} /> },
              ].map((ai, idx) => (
                <div key={idx} className="glass-card p-6 pt-12 text-left flex flex-col justify-between badge-overlapped">
                  <div className="dark-badge scale-90">{ai.icon}</div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-2 mt-2">{ai.title}</h4>
                    <p className="text-slate-500 text-xs leading-relaxed">{ai.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9 PRODUCT SHOWCASE */}
        <section id="showcase" className="py-16 md:py-24 bg-white border-y border-slate-200 scroll-mt-16">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Interactive Tour</h2>
            <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Experience the Platform</h3>
            <p className="text-slate-600 max-w-xl mx-auto mb-12 text-sm leading-relaxed">
              Explore custom-built interfaces tailored to each unique role in the hiring ecosystem.
            </p>

            {/* Showcase Tabs */}
            <div className="flex justify-center border-b border-slate-200 max-w-lg mx-auto mb-10">
              {([
                { id: 'candidate', label: 'Candidate' },
                { id: 'recruiter', label: 'Recruiter' },
                { id: 'org', label: 'Organization' },
                { id: 'admin', label: 'Admin' },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveShowcaseTab(tab.id)}
                  className={`showcase-tab px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-slate-900 ${
                    activeShowcaseTab === tab.id
                      ? 'active text-slate-900'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Mocked Showcase Workspace Content */}
            <div className="elevated-card bg-slate-950 text-slate-100 max-w-4xl mx-auto overflow-hidden shadow-2xl text-left border border-slate-800">
              <div className="mockup-header bg-slate-900 border-b border-slate-800">
                <span className="mockup-dot bg-red-500" />
                <span className="mockup-dot bg-yellow-500" />
                <span className="mockup-dot bg-green-500" />
                <span className="text-xs text-slate-500 ml-4 font-mono">Talvix - {activeShowcaseTab.toUpperCase()} WORKSPACE</span>
              </div>

              <div className="p-6 md:p-8 min-h-[300px] font-sans">
                {activeShowcaseTab === 'candidate' && (
                  <div className="animate-fade-in flex flex-col gap-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xl font-bold text-white">Hello, Asha Rao</div>
                        <p className="text-xs text-slate-400">Manage your skills profile and applications</p>
                      </div>
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full border border-green-500/30">
                        Profile Complete
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Matching Jobs</span>
                        <div className="text-2xl font-bold text-white mt-1">14 Roles</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Active Assessments</span>
                        <div className="text-2xl font-bold text-slate-200 mt-1">1 Pending</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Offers Received</span>
                        <div className="text-2xl font-bold text-green-400 mt-1">1 Unresolved</div>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                      <div className="font-bold text-xs text-white uppercase tracking-wider mb-3">Skills Competency Grid</div>
                      <div className="space-y-2">
                        {[
                          { skill: 'React / Frontend Architecture', level: '92%' },
                          { skill: 'TypeScript / State Logic', level: '88%' },
                          { skill: 'Node.js Systems', level: '75%' },
                        ].map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-slate-300">{s.skill}</span>
                            <span className="font-mono text-slate-200 font-bold">{s.level}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'recruiter' && (
                  <div className="animate-fade-in flex flex-col gap-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xl font-bold text-white">Recruiter Workspace</div>
                        <p className="text-xs text-slate-400">Northstar recruiting overview</p>
                      </div>
                      <span className="px-3 py-1 bg-slate-800 text-slate-200 text-xs font-semibold rounded-full border border-slate-700">
                        Verified Recruiter
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Open Jobs</span>
                        <div className="text-2xl font-bold text-white mt-1">6 Jobs</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Total Applicants</span>
                        <div className="text-2xl font-bold text-white mt-1">142 Candidates</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Avg Skill Score</span>
                        <div className="text-2xl font-bold text-slate-200 mt-1">82% Match</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Hires this month</span>
                        <div className="text-2xl font-bold text-green-400 mt-1">4 Hired</div>
                      </div>
                    </div>

                    <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-xs">
                      <div className="font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Applicants</div>
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500">
                            <th className="pb-2">Name</th>
                            <th className="pb-2">Role</th>
                            <th className="pb-2">Match Score</th>
                            <th className="pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-850">
                            <td className="py-2 text-white font-semibold">Asha Rao</td>
                            <td className="py-2 text-slate-200 font-mono font-bold">94%</td>
                            <td className="py-2"><span className="text-amber-400">Interview Pending</span></td>
                          </tr>
                          <tr>
                            <td className="py-2 text-white font-semibold">Ethan Vance</td>
                            <td className="py-2 text-slate-300">Product Designer</td>
                            <td className="py-2 text-slate-200 font-mono font-bold">89%</td>
                            <td className="py-2"><span className="text-green-400">Offer Generated</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'org' && (
                  <div className="animate-fade-in flex flex-col gap-6">
                    <div>
                      <div className="text-xl font-bold text-white">Organization Settings</div>
                      <p className="text-xs text-slate-400">Manage your company policies and recruitment parameters</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="font-bold text-xs text-white mb-2">Northstar Company Info</div>
                        <div className="space-y-1.5 text-xs text-slate-300">
                          <p><span className="text-slate-500">Status:</span> Verified</p>
                          <p><span className="text-slate-500">Domain:</span> northstar.io</p>
                          <p><span className="text-slate-500">Verified By:</span> System Admin</p>
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <div className="font-bold text-xs text-white mb-2">Team Access Control</div>
                        <div className="space-y-1.5 text-xs text-slate-300">
                          <p>4 Recruiters • 2 Hiring Managers</p>
                          <p className="text-slate-500 text-xxs">Permissions: assessments.view, interviews.manage, offers.approve</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeShowcaseTab === 'admin' && (
                  <div className="animate-fade-in flex flex-col gap-6">
                    <div>
                      <div className="text-xl font-bold text-white">Talvix Admin Dashboard</div>
                      <p className="text-xs text-slate-400">Platform-wide operation health metrics</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Active Companies</span>
                        <div className="text-2xl font-bold text-white mt-1">112 Verified</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">Security Rule Alerts</span>
                        <div className="text-2xl font-bold text-green-400 mt-1">0 Flagged</div>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-xs text-slate-500">MALWARE FILTER</span>
                        <div className="text-2xl font-bold text-white mt-1">Passed (100%)</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 10 PLATFORM FEATURES */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="landing-container text-center flex flex-col gap-16 md:gap-24">
            <div>
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Feature Focus</h2>
              <h3 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Deep Dive Inside the Modules</h3>
              <p className="text-slate-600 max-w-xl mx-auto text-sm leading-relaxed">
                Take a look at how candidate interfaces and automated tooling cooperate.
              </p>
            </div>

            {[
              {
                title: 'Candidate Portal',
                desc: 'A specialized visual workspace designed for candidates. Manage profiles securely, complete evaluations in a coding sandboxed terminal, view matching scores, review and sign offer letters, and audit verification states.',
                align: 'right',
                visual: (
                  <div className="glass-card p-6 bg-white/70 border-white/50 text-left flex flex-col gap-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900">Asha Rao Profile</span>
                      <span className="text-[10px] text-slate-800 font-semibold px-2 py-0.5 bg-slate-50 rounded">Verified Candidate</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">Email:</span> <span className="text-slate-800">asha@example.com</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Skill verified:</span> <span className="text-slate-800 font-medium">React, Typescript</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Latest stage:</span> <span className="text-slate-900 font-semibold">Interview scheduled</span></div>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Recruiter Workspace',
                desc: 'A complete applicant tracking and recruitment environment. Review applicant list cards, verify skills, configure job criteria pipelines, triggers secure sandbox assessments, schedule round slots, and request offer validations.',
                align: 'left',
                visual: (
                  <div className="glass-card p-6 bg-white/70 border-white/50 text-left flex flex-col gap-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900">Recruiter Controls</span>
                      <span className="w-2.5 h-2.5 bg-slate-900 rounded-full" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-slate-50 p-2 rounded"><span className="text-[9px] text-slate-400 block">Active Jobs</span><span className="font-bold text-slate-800">12</span></div>
                      <div className="bg-slate-50 p-2 rounded"><span className="text-[9px] text-slate-400 block">Pending Reviews</span><span className="font-bold text-slate-800">4</span></div>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Assessment Platform',
                desc: 'Assessments are securely compiled and evaluated in an environment independent of the main threads. Test specifications are mapped to assignment snapshots, preventing modification, and raw explanations remain locked to candidates.',
                align: 'right',
                visual: (
                  <div className="glass-card p-6 bg-slate-950 border border-slate-800 text-left font-mono text-[10px] text-slate-300">
                    <div className="text-slate-500 mb-2">// Run Sandbox Unit Tests</div>
                    <div>$ npm run test --env=sandboxed</div>
                    <div className="text-green-400 mt-2">✓ test_skill_match: 12 tests passed</div>
                    <div className="text-green-400">✓ test_concurrency: 4 tests passed</div>
                    <div className="text-slate-500 mt-2">Execution completed in 142ms.</div>
                  </div>
                ),
              },
              {
                title: 'Interview Platform',
                desc: 'Standardize round structures using reusable template patterns. Assign evaluation slots mapping to reviewer schedules, request feedback in specialized priority queues, and coordinate candidate availability states automatically.',
                align: 'left',
                visual: (
                  <div className="glass-card p-6 bg-white/70 border-white/50 text-left flex flex-col gap-3 text-xs">
                    <div className="font-bold text-slate-900">Interview Template</div>
                    <div className="space-y-1.5">
                      <div className="p-2 bg-slate-50 border border-slate-100 rounded text-slate-800 font-medium">Round 1: Tech Architecture Check (45m)</div>
                      <div className="p-2 bg-slate-50 rounded text-slate-700">Round 2: System Coding Live (60m)</div>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Offers & Agreements',
                desc: 'Generate legally binding offer packages using secure dynamic rendering templates. Track approvals in chronological logs, enforce organizational sign-off chains, and support secure feedback/revision requests.',
                align: 'right',
                visual: (
                  <div className="glass-card p-6 bg-white/70 border-white/50 text-left flex flex-col gap-3">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Approval Status</span>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 p-2 rounded">
                      <CheckCircle2 size={14} />
                      <span>Approved by VP of Engineering</span>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Document Center',
                desc: 'All file assets are registered inside transactional database states, guaranteeing that quota reservations and entity links synchronize atomically. Suspicious, failed, or malware-infected files are quarantined instantly.',
                align: 'left',
                visual: (
                  <div className="glass-card p-6 bg-white/70 border-white/50 text-left flex flex-col gap-3 text-xs">
                    <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-slate-800">
                      <Shield size={14} />
                      <span>Resume_AshaRao.pdf - Safe</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-800">
                      <Shield size={14} />
                      <span>Unverified_Config.exe - Quarantined</span>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Analytics & Insights',
                desc: 'Audit conversion steps and cohort performance ratios across customizable date filters. Ensure all exports contain proper escaping logic to prevent CSV injections, maintaining strict user privacy policies.',
                align: 'right',
                visual: (
                  <div className="glass-card p-6 bg-white/70 border-white/50 text-left flex flex-col gap-3">
                    <div className="text-xs font-bold text-slate-800">Funnel Conversion Rate</div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div className="bg-slate-900 h-full w-[72%]" />
                    </div>
                    <span className="text-[10px] text-slate-500">72% candidates proceed to assessments</span>
                  </div>
                ),
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${
                  feature.align === 'left' ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={`lg:col-span-6 text-left flex flex-col items-start ${
                  feature.align === 'left' ? 'lg:order-2' : ''
                }`}>
                  {/* Decorative horizontal line above section headings to style them as overlined */}
                  <div className="w-12 h-0.5 bg-slate-900 mb-6" />
                  <h4 className="text-2xl font-bold text-slate-900 mb-4">{feature.title}</h4>
                  <p className="text-slate-500 text-sm md:text-base leading-relaxed mb-4">
                    {feature.desc}
                  </p>
                </div>
                <div className={`lg:col-span-6 ${
                  feature.align === 'left' ? 'lg:order-1' : ''
                }`}>
                  <div className="p-4 bg-slate-100 rounded-3xl border border-slate-200 max-w-md mx-auto">
                    {feature.visual}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 11 COMPARISON */}
        <section id="comparison" className="py-16 md:py-24 bg-white border-y border-slate-200 scroll-mt-16">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">ATS Comparison</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 mb-4">Traditional ATS vs Talvix</h3>
            <p className="text-slate-600 max-w-xl mx-auto mb-16 text-sm leading-relaxed">
              Discover how shifting to a skills-first platform transforms hiring conversion rates and saves recruiter time.
            </p>

            <div className="glass-card overflow-hidden max-w-4xl mx-auto border border-slate-200/50">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-sm font-semibold">
                      <th className="p-4 md:p-5">Feature Layer</th>
                      <th className="p-4 md:p-5">Traditional ATS</th>
                      <th className="p-4 md:p-5 bg-slate-850">Talvix Platform</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-200">
                    {[
                      { layer: 'Candidate Evaluation', traditional: 'Keyword-based resume filtering', talvix: 'Skills-first validated assessments' },
                      { layer: 'Workflows', traditional: 'Manual scheduling and email pings', talvix: 'Unified pipelines and automated slots' },
                      { layer: 'System Cooperation', traditional: 'Disconnected external test trackers', talvix: 'Integrated sandbox, templates & letters' },
                      { layer: 'AI Capabilities', traditional: 'Basic parser or no AI assistance', talvix: 'Resume audits, question drafts & scoring' },
                      { layer: 'Data Visibility', traditional: 'Opaque candidate stages & feedback', talvix: 'Transparent revision histories & status' },
                    ].map((row, idx) => (
                      <tr key={idx} className="compare-row bg-white/40">
                        <td className="p-4 md:p-5 font-bold text-slate-900">{row.layer}</td>
                        <td className="p-4 md:p-5 text-slate-500">{row.traditional}</td>
                        <td className="p-4 md:p-5 text-slate-900 font-semibold bg-slate-50/20">{row.talvix}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* 12 TESTIMONIALS */}
        <section className="py-16 md:py-24 bg-slate-50">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Feedback</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 mb-4">What Our Users Say</h3>
            <p className="text-slate-600 max-w-md mx-auto mb-16 text-sm leading-relaxed">
              Join thousands of professionals securing roles through skills verification.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <TestimonialCard
                jobTitle="Software Developer"
                name="Asha Rao"
                quote="Completing my skills matrix on Talvix allowed recruiters to bypass standard resume filtering. Within a week of finishing my coding assessment, I had received a transparent offer."
                company="Independent Engineer"
              />
              <TestimonialCard
                jobTitle="Lead Talent Partner"
                name="Rina Shah"
                quote="We eliminated over 80% of our manual screening overhead. The custom templates and integrated sandboxed assessments make coordinating multiple candidate pipelines incredibly smooth."
                company="Northstar Technology"
              />
              <TestimonialCard
                jobTitle="VP of Human Resources"
                name="Marcus Vance"
                quote="The transactional offer drafting and security screening features give our compliance teams peace of mind. We have completely replaced our traditional disconnected ATS."
                company="Aperture Inc."
              />
            </div>
          </div>
        </section>

        {/* 13 FAQ */}
        <section id="faq" className="py-16 md:py-24 bg-white scroll-mt-16">
          <div className="landing-container text-center">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Help Center</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 mb-4">Frequently Asked Questions</h3>
            <p className="text-slate-600 max-w-md mx-auto mb-16 text-sm leading-relaxed">
              Got questions? We have compiled responses to common inquiries.
            </p>
            <FAQAccordion />
          </div>
        </section>

        {/* 14 FINAL CTA */}
        <section className="py-20 md:py-28 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute -inset-10 bg-slate-800 opacity-30 filter blur-3xl -z-10 rounded-full" />
          <div className="landing-container max-w-4xl text-center flex flex-col items-center">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-none mb-6">
              Ready to Transform Hiring?
            </h2>
            <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-xl mb-10">
              Shift to a skills-first verification workflow. Build company profiles or candidate portfolios in minutes and connect with recruiters immediately.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={handleCTA}
                className="tvx-button tvx-button--primary tvx-button--md px-8"
              >
                {authenticated ? 'Go to Dashboard' : 'Create Account'}
              </button>
              {!authenticated && (
                <button
                  onClick={handleLogin}
                  className="tvx-button tvx-button--secondary tvx-button--md bg-transparent border-white/20 text-white hover:bg-white/10 px-8 font-bold"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 15 FOOTER */}
      <footer className="bg-white text-slate-500 py-12 md:py-16 border-t border-slate-100 w-full">
        <div className="landing-container grid grid-cols-2 md:grid-cols-6 gap-8 text-left mb-12">
          {/* Logo & Info column */}
          <div className="col-span-2 flex flex-col items-start gap-4">
            <div className="flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="50" fill="black" />
                <path d="M30 45 L50 25 L70 45 L55 45 L55 75 L45 75 L45 45 Z" fill="white" />
              </svg>
              <span className="font-extrabold text-lg text-slate-800 tracking-tight">TALVIX</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              AI-Powered Skills-First Recruitment Platform. Bridging candidates and organizations through verifiable technical proof of work.
            </p>
          </div>

          {/* Links column 1 */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Product</h3>
            <ul className="space-y-2.5 text-xs">
              <li><a href="#why-talvix" className="hover:text-slate-900 transition-colors">Features</a></li>
              <li><a href="#modules" className="hover:text-slate-900 transition-colors">Modules</a></li>
              <li><a href="#comparison" className="hover:text-slate-900 transition-colors">ATS vs Talvix</a></li>
            </ul>
          </div>

          {/* Links column 2 */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Resources</h3>
            <ul className="space-y-2.5 text-xs">
              <li><button type="button" className="hover:text-slate-900 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs text-left text-slate-400" onClick={() => alert("Docs are coming soon!")}>Documentation</button></li>
              <li><a href="#faq" className="hover:text-slate-900 transition-colors">Help FAQ</a></li>
            </ul>
          </div>

          {/* Links column 3 */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-2.5 text-xs">
              <li><button type="button" className="hover:text-slate-900 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs text-left text-slate-400" onClick={() => alert("About page coming soon!")}>About Us</button></li>
              <li><button type="button" className="hover:text-white transition-colors bg-transparent border-none p-0 cursor-pointer text-xs text-left text-slate-400" onClick={() => alert("Contact details: support@talvix.app")}>Contact</button></li>
            </ul>
          </div>

          {/* Links column 4 */}
          <div>
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-2.5 text-xs">
              <li><button type="button" className="hover:text-slate-900 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs text-left text-slate-400" onClick={() => alert("Privacy Policy coming soon!")}>Privacy Policy</button></li>
              <li><button type="button" className="hover:text-slate-900 transition-colors bg-transparent border-none p-0 cursor-pointer text-xs text-left text-slate-400" onClick={() => alert("Terms of Service coming soon!")}>Terms of Service</button></li>
            </ul>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="landing-container pt-8 border-t border-slate-100 text-xs flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500">
          <div>
            &copy; {new Date().getFullYear()} Talvix Inc. All rights reserved. Made for next-gen teams.
          </div>
          <div className="flex gap-6 items-center">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-slate-900 rounded"
            >
              <svg className="w-4 h-4 fill-current text-slate-500 hover:text-slate-900" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.193 22 16.44 22 12.017 22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
