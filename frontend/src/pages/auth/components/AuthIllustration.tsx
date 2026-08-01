import { Sparkles, Check, TrendingUp, Calendar, Briefcase, Zap } from 'lucide-react';

interface AuthIllustrationProps {
  type: 'login' | 'register';
}

export function AuthIllustration({ type }: AuthIllustrationProps) {
  const isLogin = type === 'login';

  return (
    <div className="relative flex flex-col justify-between h-full w-full p-7 lg:p-10 overflow-hidden bg-transparent text-white select-none max-w-full lg:max-w-[82%]">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }} />

      {/* Decorative Glow Blobs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-blue-600/20 blur-[90px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-sky-500/15 blur-[100px] animate-pulse-slow pointer-events-none" />

      {/* Top Section: Brand Logo */}
      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
          <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
            <path d="M12 2L2 6v6c0 5.52 4.48 10 9 10s9-4.48 9-10V6l-9-4zm0 2.5l7 3.1v4.4c0 4.1-3 7.8-7 8.5-4-.7-7-4.4-7-8.5V7.6l7-3.1z" />
            <path d="M11 7h2v6h-2zM11 14h2v2h-2z" />
          </svg>
        </div>
        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
          Talvix
        </span>
      </div>

      {/* Middle Section: Illustrations */}
      <div className="relative z-10 my-auto hidden lg:flex flex-col items-center justify-center min-h-[320px] w-full">
        {isLogin ? (
          /* Login Illustration: AI Matching & Candidates */
          <div className="relative w-full max-w-[340px] h-[280px]">
            {/* Dashboard Card */}
            <div className="absolute top-4 left-0 w-72 glass-panel-dark rounded-2xl p-4.5 shadow-2xl border border-white/10 animate-float-slow">
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-semibold text-slate-300">Pipeline Status</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  +18%
                </span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-white/5 p-2 rounded-lg text-center">
                  <div className="text-[10px] text-slate-400">Sourced</div>
                  <div className="text-sm font-bold text-white mt-0.5">142</div>
                </div>
                <div className="flex-1 bg-white/5 p-2 rounded-lg text-center">
                  <div className="text-[10px] text-slate-400">Interview</div>
                  <div className="text-sm font-bold text-white mt-0.5">38</div>
                </div>
                <div className="flex-1 bg-blue-500/10 border border-blue-500/20 p-2 rounded-lg text-center">
                  <div className="text-[10px] text-blue-300">Hired</div>
                  <div className="text-sm font-bold text-blue-400 mt-0.5">9</div>
                </div>
              </div>
            </div>

            {/* Candidate Glass Card */}
            <div className="absolute bottom-2 right-0 w-64 bg-white rounded-2xl p-4 shadow-[0_20px_40px_rgba(15,23,42,0.3)] border border-slate-100 text-slate-800 animate-float-medium">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                  SJ
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">Sarah Jenkins</div>
                  <div className="text-[10px] text-slate-400 truncate">Senior Frontend Engineer</div>
                </div>
              </div>
              <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">AI Match Score</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <Zap className="w-3 h-3 fill-current" />
                  98%
                </span>
              </div>
            </div>

            {/* Matching Rings */}
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-20 h-20 rounded-full border border-dashed border-blue-500/30 flex items-center justify-center animate-spin" style={{ animationDuration: '20s' }}>
              <div className="w-14 h-14 rounded-full border border-dashed border-sky-400/40 flex items-center justify-center animate-spin" style={{ animationDuration: '10s' }} />
            </div>

            {/* Small Floating Matching Indicator */}
            <div className="absolute top-12 right-12 bg-gradient-to-r from-blue-500 to-sky-500 text-white rounded-xl p-2.5 shadow-lg animate-float-fast flex items-center gap-1.5 border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">Auto Matched</span>
            </div>
          </div>
        ) : (
          /* Register Illustration: Candidate/Recruiter Handshake / Career Path */
          <div className="relative w-full max-w-[340px] h-[280px]">
            {/* Interview Invitation Card */}
            <div className="absolute top-4 right-0 w-72 glass-panel-dark rounded-2xl p-4.5 shadow-2xl border border-white/10 animate-float-slow">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-white">Interview Confirmed</div>
                  <div className="text-[9px] text-slate-400">Software Engineer Role</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-300 bg-white/5 rounded-lg p-2 flex items-center justify-between">
                <span>Today at 2:00 PM</span>
                <span className="text-sky-400 font-semibold">Join Meeting</span>
              </div>
            </div>

            {/* Job Offer Card */}
            <div className="absolute bottom-2 left-0 w-64 bg-white rounded-2xl p-4 shadow-[0_20px_40px_rgba(15,23,42,0.3)] border border-slate-100 text-slate-800 animate-float-medium">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <Briefcase className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900">Offer Received</div>
                  <div className="text-[10px] text-slate-400 truncate">Talvix Inc.</div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full w-max">
                    <Check className="w-3 h-3 stroke-[3]" />
                    Ready to sign
                  </div>
                </div>
              </div>
            </div>

            {/* Connections & Sparkles */}
            <div className="absolute top-1/2 left-1/3 -translate-y-1/2 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 animate-pulse">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Footer Tagline */}
      <div className="relative z-10 mt-auto flex flex-col gap-1.5">
        <h2 className="text-lg lg:text-xl font-bold tracking-tight text-white leading-snug">
          {isLogin ? 'Connect Talent. Build the Future.' : 'Start your journey with Talvix.'}
        </h2>
        <p className="text-xs text-slate-300">
          {isLogin 
            ? 'Continue your hiring journey with our AI-powered workspace.' 
            : 'Find matches instantly, schedule interviews, and finalize offers.'}
        </p>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <span>Trusted AI Recruitment Platform</span>
          <span className="text-blue-500">v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
