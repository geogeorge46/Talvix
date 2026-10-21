import {
  Brain,
  Video,
  FileCheck2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { TalentCanvas3D } from './TalentCanvas3D';

export function PlatformCapabilities() {
  const capabilities = [
    {
      icon: <Brain className="text-emerald-600" size={24} />,
      title: 'AI Assessment & Sandbox Execution',
      desc: 'Candidates write code and solve realistic architectural challenges in fully sandboxed, isolated runtimes. No rote memorization quizzes — genuine skill benchmarking.',
      points: [
        'Multi-language test suite validation',
        'Anti-cheat proctoring & telemetry',
        'Automatic scoring against industry percentiles',
      ],
    },
    {
      icon: <Video className="text-teal-600" size={24} />,
      title: 'Ultra-Low Latency WebRTC Interviews',
      desc: 'Conduct real-time video conversations with synchronized live coding, structured question rubrics, and collaborative whiteboard feedback.',
      points: [
        'Built-in collaborative Monaco editor',
        'Standardized evaluator rubrics & blind review',
        'Session recording & milestone bookmarking',
      ],
    },
    {
      icon: <FileCheck2 className="text-blue-600" size={24} />,
      title: 'Multi-Stage Offer & Document Lifecycle',
      desc: 'Automate compensation approvals, multi-signatory contracts, and tamper-resistant candidate documents with transactional state tracking.',
      points: [
        'Cryptographic audit trails on all revisions',
        'Internal multi-stakeholder approval routes',
        'Immediate candidate portal delivery',
      ],
    },
  ];

  return (
    <section
      id="capabilities"
      className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white py-16 text-slate-900 md:py-24"
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-emerald-100/50 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-10 -z-10 h-[400px] w-[400px] rounded-full bg-cyan-100/40 blur-[90px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Top Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center sm:mb-16">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
            <Sparkles size={13} className="text-emerald-600" />
            <span>High-Precision Engineering</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Next-Generation{' '}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent">
              Hiring Architecture
            </span>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
            Eliminate traditional recruitment bottlenecks. Talvix blends AI
            skill extraction, live proctoring, and immutable governance into one
            unified platform.
          </p>
        </div>

        {/* 2-Column: Capabilities + Interactive 3D Model */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
          {/* Left Column: 3 Pillars (Clean Light Cards) */}
          <div className="space-y-5 sm:space-y-6 lg:col-span-7">
            {capabilities.map((cap, idx) => (
              <div
                key={idx}
                className="group rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-300 hover:border-emerald-300 hover:shadow-xl sm:p-7"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-600 transition-transform group-hover:scale-110">
                    {cap.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 text-lg font-bold text-slate-900 transition-colors group-hover:text-emerald-600 sm:text-xl">
                      {cap.title}
                    </h3>
                    <p className="mb-4 text-xs leading-relaxed text-slate-600 sm:text-sm">
                      {cap.desc}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {cap.points.map((pt, pIdx) => (
                        <div
                          key={pIdx}
                          className="flex items-center gap-2 text-xs text-slate-600"
                        >
                          <CheckCircle2
                            size={14}
                            className="shrink-0 text-emerald-500"
                          />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column: Interactive 3D Model Light Card */}
          <div className="flex flex-col items-center lg:col-span-5">
            <div className="relative flex w-full flex-col items-center rounded-3xl border border-slate-200/90 bg-white p-6 text-center text-slate-900 shadow-xl backdrop-blur-xl sm:p-8">
              <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] text-emerald-700">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                <span>3D Neural Map</span>
              </div>

              {/* 3D Canvas */}
              <div className="w-full">
                <TalentCanvas3D />
              </div>

              <div className="mt-4">
                <h3 className="mb-1 text-lg font-bold text-slate-900">
                  Autonomous Talent Constellation
                </h3>
                <p className="mx-auto max-w-xs text-xs leading-relaxed text-slate-500">
                  Interactive real-time graph mapping candidates, verifiable
                  skill benchmarks, and active job requisitions.
                </p>
              </div>

              <div className="mt-6 grid w-full grid-cols-2 gap-3 border-t border-slate-100 pt-6 text-left">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <div className="text-xs text-slate-500">Latency</div>
                  <div className="font-mono text-base font-bold text-emerald-600">
                    &lt; 45ms
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
                  <div className="text-xs text-slate-500">Security</div>
                  <div className="font-mono text-base font-bold text-blue-600">
                    AES-256 GCM
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
