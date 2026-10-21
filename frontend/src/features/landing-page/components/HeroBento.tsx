import { useState } from 'react';
import {
  Sparkles,
  Bot,
  Mic,
  ArrowRight,
  Send,
  FileCheck,
  Lock,
} from 'lucide-react';

export function HeroBento() {
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const query = chatInput.toLowerCase();
    setChatInput('');
    if (
      query.includes('job') ||
      query.includes('role') ||
      query.includes('react') ||
      query.includes('frontend')
    ) {
      setChatResponse(
        'Matched 3 open Senior Frontend positions with 94%+ skill alignment!',
      );
    } else if (query.includes('interview')) {
      setChatResponse(
        'Your next AI-proctored interview slot is ready for scheduling.',
      );
    } else {
      setChatResponse(
        'Talvix AI has analyzed your skills profile and recommended 4 vetted opportunities!',
      );
    }
  };

  const handleVoiceToggle = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => {
        setIsRecording(false);
      }, 3000);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:max-w-none">
      {/* COLUMN 1: INTERVIEWS & LIVE CHAT ASSISTANT */}
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* CARD 1: AI Interview in Progress (Bright Daylight Office) */}
        <div className="group relative aspect-[4/4.2] overflow-hidden rounded-3xl border border-white/80 bg-emerald-50/50 shadow-md transition-all hover:shadow-xl sm:aspect-[4/4.5]">
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&h=900&q=85"
            alt="Candidate participating in live AI Interview"
            className="h-full w-full object-cover object-top brightness-105 transition-transform duration-700 group-hover:scale-105"
            loading="eager"
          />
          {/* Subtle light vignette for natural daylight feel */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

          {/* Bottom Frosted Light Glass Badge */}
          <div className="absolute right-3 bottom-3 left-3 sm:right-4 sm:bottom-4 sm:left-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/90 bg-white/90 px-3.5 py-2.5 text-slate-900 shadow-lg backdrop-blur-md transition-all group-hover:bg-white">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold tracking-wide text-slate-800 sm:text-sm">
                  AI Interview in Progress
                </span>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={13} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: Candidate Specialist & Interactive AI Chat (Bright & Friendly) */}
        <div className="group relative aspect-[4/4.4] overflow-hidden rounded-3xl border border-white/80 bg-emerald-50/50 shadow-md transition-all hover:shadow-xl sm:aspect-[4/4.6]">
          <img
            src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&h=900&q=85"
            alt="Talvix Talent Specialist with headset"
            className="h-full w-full object-cover object-top brightness-105 transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent pointer-events-none" />

          {/* Interactive Assistant Frosted Light Card Overlay */}
          <div className="absolute right-3 bottom-3 left-3 flex flex-col gap-2 sm:right-4 sm:bottom-4 sm:left-4">
            <div className="rounded-2xl border border-white/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-xl transition-all sm:p-4">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <Sparkles size={14} className="text-emerald-500" />
                <span>How can I help you today?</span>
              </div>
              <p className="mb-2.5 text-[11px] leading-snug text-slate-600 sm:text-xs">
                {chatResponse ||
                  'Get matched with the best opportunities based on proven skills.'}
              </p>

              {/* Functional Mini Chat Form */}
              <form
                onSubmit={handleSendChat}
                className="flex items-center rounded-full border border-slate-200 bg-slate-50 py-1 pr-1 pl-3 transition-all focus-within:border-emerald-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-100"
              >
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="w-full border-none bg-transparent text-xs text-slate-800 placeholder:text-slate-400 outline-none"
                  aria-label="Ask Talvix assistant"
                />
                <button
                  type="submit"
                  className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-colors hover:bg-emerald-500"
                  aria-label="Send message"
                >
                  <Send size={11} strokeWidth={2.5} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 2: AI MATCH SCORE, CODING SKILL ASSESSMENT, FUTURE CAREER */}
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* CARD 2: AI Match Score Card (Crisp White & Luminous) */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-4 shadow-md backdrop-blur-xl transition-all duration-300 hover:border-emerald-300 hover:shadow-xl sm:p-5">
          <div>
            {/* Top Bar */}
            <div className="mb-3.5 flex items-center justify-between text-xs font-bold text-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Sparkles size={12} />
                </span>
                <span className="tracking-tight text-slate-900">
                  AI Match Score
                </span>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200">
                <ArrowRight size={12} />
              </div>
            </div>

            {/* Score Radial Ring & Feedback */}
            <div className="mb-3 flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-slate-50/80 p-2.5">
              {/* Radial Score Gauge */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                <svg
                  className="h-full w-full -rotate-90 transform"
                  viewBox="0 0 36 36"
                >
                  <path
                    className="text-slate-200"
                    strokeWidth="3.2"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 transition-all duration-1000 ease-out"
                    strokeDasharray="92, 100"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-xs font-extrabold text-slate-900">
                  92%
                </span>
              </div>

              <div>
                <span className="block text-xs font-bold text-emerald-600">
                  Great match!
                </span>
                <span className="block text-[11px] leading-tight text-slate-500">
                  Your skills align exceptionally well with this role.
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Voice/Prompt Pill */}
          <button
            type="button"
            onClick={handleVoiceToggle}
            className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition-all ${
              isRecording
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                : 'border-slate-200 bg-slate-50/60 text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Bot size={13} />
              </span>
              <span className="truncate text-[11px] font-medium">
                {isRecording
                  ? 'Listening to voice response...'
                  : 'Tell us about your problem-solving approach...'}
              </span>
            </div>
            <span
              className={`ml-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                isRecording
                  ? 'animate-pulse bg-red-500 text-white'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Mic size={12} />
            </span>
          </button>
        </div>

        {/* CARD 3: Skill Assessment (Warm, Bright Daylight Portrait) */}
        <div className="group relative aspect-[4/3.4] overflow-hidden rounded-3xl border border-white/80 bg-emerald-50/50 shadow-md transition-all hover:shadow-xl">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&h=700&q=85"
            alt="Candidate taking live skill assessment"
            className="h-full w-full object-cover object-top brightness-105 transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

          {/* Light Frosted Glass Badge */}
          <div className="absolute right-3 bottom-3 left-3 sm:right-4 sm:bottom-4 sm:left-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/90 bg-white/90 px-3.5 py-2.5 text-slate-900 shadow-lg backdrop-blur-md transition-all group-hover:bg-white">
              <div className="flex items-center gap-2">
                <FileCheck size={16} className="text-emerald-600" />
                <span className="text-xs font-bold tracking-wide text-slate-800 sm:text-sm">
                  Skill Assessment
                </span>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={13} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>

        {/* CARD 5: Build Your Future (Bright Tech Campus/Daylight) */}
        <div className="group relative aspect-[4/3.4] overflow-hidden rounded-3xl border border-white/80 bg-emerald-50/50 shadow-md transition-all hover:shadow-xl">
          <img
            src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=800&h=700&q=85"
            alt="Young professional embarking on career with Talvix"
            className="h-full w-full object-cover object-center brightness-105 transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

          {/* Light Frosted Glass Badge */}
          <div className="absolute right-3 bottom-3 left-3 sm:right-4 sm:bottom-4 sm:left-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/90 bg-white/90 px-3.5 py-2.5 text-slate-900 shadow-lg backdrop-blur-md transition-all group-hover:bg-white">
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-emerald-600" />
                <span className="text-xs font-bold tracking-wide text-slate-800 sm:text-sm">
                  Build Your Future
                </span>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-transform group-hover:translate-x-0.5">
                <ArrowRight size={13} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
