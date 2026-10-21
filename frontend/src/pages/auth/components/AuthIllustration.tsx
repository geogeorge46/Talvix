import {
  Sparkles,
  Zap,
  CheckCircle2,
  ShieldCheck,
  Code2,
  Star,
  Users,
} from 'lucide-react';

interface AuthIllustrationProps {
  type: 'login' | 'register';
}

export function AuthIllustration({ type }: AuthIllustrationProps) {
  const isLogin = type === 'login';

  return (
    <div className="relative flex h-full w-full select-none flex-col justify-between overflow-hidden p-6 text-slate-800 lg:p-8">
      {/* Background Decorative Mesh & Radial Glows */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(16, 185, 129, 0.18) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div className="pointer-events-none absolute top-1/4 left-1/4 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-200/50 blur-[90px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-80 w-80 translate-x-1/2 translate-y-1/2 rounded-full bg-cyan-200/40 blur-[100px]" />

      {/* Top Header Row: Exact h-10 to match right form header row */}
      <div className="relative z-10 flex h-10 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
            <svg
              width="20"
              height="20"
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
          <div>
            <span className="text-xl font-black tracking-tight text-slate-900 block leading-tight">
              Talvix
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Talent Intelligence
            </span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-white/95 px-3 py-1 text-xs font-bold text-emerald-800 shadow-sm backdrop-blur-sm">
          <Sparkles size={12} className="text-emerald-600" />
          <span>{isLogin ? 'Skills-First Portal' : 'Fast Onboarding'}</span>
        </span>
      </div>

      {/* Middle Visual Section: DUAL-IMAGE COMPOSITION */}
      <div className="relative z-10 my-auto flex w-full flex-col items-center justify-center py-4">
        {isLogin ? (
          /* ========================================================
             LOGIN: Dual-Image Staggered Bento (Portrait + Team Session)
             ======================================================== */
          <div className="relative w-full max-w-[370px]">
            {/* IMAGE 1: Primary Featured Talent Portrait */}
            <div className="relative w-[78%] aspect-[4/3.8] overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=700&h=700&q=85"
                alt="Sarah Jenkins - Verified Software Engineer"
                className="h-full w-full object-cover object-top transition-transform duration-700 hover:scale-105"
                loading="eager"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
              
              <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase backdrop-blur-sm">
                  <CheckCircle2 size={10} /> Verified Talent
                </span>
                <div className="text-xs font-bold tracking-tight text-white mt-1">
                  Sarah Jenkins — Top 2%
                </div>
              </div>
            </div>

            {/* IMAGE 2: Secondary Companion Image (Live Interview Session) */}
            <div className="relative -mt-16 ml-auto w-[62%] aspect-[4/3.2] overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-2xl z-20">
              <img
                src="https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=600&h=480&q=85"
                alt="Technical Interview Session in progress"
                className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
              
              <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-bold text-white tracking-wide">
                    Live Assessment
                  </span>
                </div>
              </div>
            </div>

            {/* Floating Live Fit Score Pill */}
            <div className="animate-float-slow absolute top-2 right-0 z-30 flex items-center gap-2 rounded-xl border-2 border-white bg-white/95 px-3 py-1.5 shadow-xl backdrop-blur-md">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                <Zap size={14} className="fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-black text-slate-900 leading-none">98%</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded">Fit</span>
                </div>
                <div className="text-[9px] font-bold text-slate-500 leading-tight">AI Matching</div>
              </div>
            </div>

            {/* Floating Avatar Stack Pill */}
            <div className="animate-float-medium absolute -bottom-3 left-2 z-30 flex items-center gap-2 rounded-full border-2 border-white bg-white/95 py-1 px-3 shadow-lg">
              <div className="flex -space-x-1.5">
                <img
                  className="inline-block h-5 w-5 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80"
                  alt="Member"
                />
                <img
                  className="inline-block h-5 w-5 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80"
                  alt="Member"
                />
              </div>
              <span className="text-[10px] font-bold text-slate-700">2,400+ Hired</span>
            </div>
          </div>
        ) : (
          /* ========================================================
             REGISTER: Dual-Image Staggered Bento (Engineer + Team Collaboration)
             ======================================================== */
          <div className="relative w-full max-w-[370px]">
            {/* IMAGE 1: Primary Featured Talent Portrait */}
            <div className="relative w-[78%] aspect-[4/3.8] overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&h=700&q=85"
                alt="Candidate completing skills verification"
                className="h-full w-full object-cover object-top transition-transform duration-700 hover:scale-105"
                loading="eager"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
              
              <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/90 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase backdrop-blur-sm">
                  <Code2 size={10} /> Sandboxed VM
                </span>
                <div className="text-xs font-bold tracking-tight text-white mt-1">
                  Verified Proof of Work
                </div>
              </div>
            </div>

            {/* IMAGE 2: Secondary Companion Image (Team Collaboration) */}
            <div className="relative -mt-16 ml-auto w-[62%] aspect-[4/3.2] overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-2xl z-20">
              <img
                src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&h=480&q=85"
                alt="Engineering team reviewing code benchmarks"
                className="h-full w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
              
              <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                <div className="flex items-center gap-1.5">
                  <Users size={12} className="text-emerald-400" />
                  <span className="text-[10px] font-bold text-white tracking-wide">
                    500+ Tech Teams
                  </span>
                </div>
              </div>
            </div>

            {/* Floating SOC-2 Security Pill */}
            <div className="animate-float-slow absolute top-2 right-0 z-30 flex items-center gap-2 rounded-xl border-2 border-white bg-white/95 px-3 py-1.5 shadow-xl backdrop-blur-md">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <ShieldCheck size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-none">SOC-2</div>
                <div className="text-[9px] font-bold text-slate-500 mt-0.5">Type II Certified</div>
              </div>
            </div>

            {/* Floating Rating Pill */}
            <div className="animate-float-medium absolute -bottom-3 left-2 z-30 flex items-center gap-1.5 rounded-full border-2 border-white bg-white/95 py-1 px-3 shadow-lg">
              <Star size={12} className="fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-extrabold text-slate-900">4.9/5</span>
              <span className="text-[9px] font-medium text-slate-500">(1,200+ reviews)</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Customer Endorsement with Portrait */}
      <div className="relative z-10 rounded-2xl border-2 border-white/90 bg-white/90 p-3.5 shadow-md backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img
            src={
              isLogin
                ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80'
                : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
            }
            alt="Customer portrait"
            className="h-9 w-9 shrink-0 rounded-full border-2 border-emerald-400 object-cover shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium leading-snug text-slate-700 italic">
              {isLogin
                ? '“Talvix cut our engineering hiring cycles from three weeks to 48 hours with objective skill benchmarking.”'
                : '“I skipped 4 rounds of resume screening and was hired directly from my technical assessment score.”'}
            </p>
            <div className="mt-0.5 text-[10px] font-bold text-slate-900">
              {isLogin
                ? 'Marcus Vance — VP Engineering, Fintech Leader'
                : 'Elena Rostova — Staff Frontend Engineer'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
