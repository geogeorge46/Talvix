import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export function FaqSection() {
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
    <section
      id="faq"
      className="border-t border-slate-200/80 bg-slate-50/70 py-16 md:py-24"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700">
            <HelpCircle size={13} className="text-emerald-500" />
            <span>Got Questions?</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Everything you need to know about the Talvix recruitment ecosystem.
          </p>
        </div>

        {/* Accordion list */}
        <div className="flex flex-col gap-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition-all duration-200"
              >
                <button
                  type="button"
                  id={`faq-trigger-${idx}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-slate-900 transition-colors hover:text-emerald-600 sm:text-base"
                >
                  <span>{faq.q}</span>
                  <div
                    className={`ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-50 transition-transform duration-200 ${isOpen ? 'rotate-180 bg-emerald-50 text-emerald-600' : 'text-slate-400'}`}
                  >
                    <ChevronDown size={16} />
                  </div>
                </button>
                {isOpen && (
                  <div
                    id={`faq-answer-${idx}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${idx}`}
                    className="border-t border-slate-100 px-5 pt-1 pb-5 text-xs leading-relaxed text-slate-600 sm:text-sm"
                  >
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
