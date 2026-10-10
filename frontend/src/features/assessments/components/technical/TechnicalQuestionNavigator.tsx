import React from 'react';
import { Question } from '../../model';
import { Check, Circle } from 'lucide-react';

interface Props {
  questions: Question[];
  currentIndex: number;
  drafts: Record<string, unknown>;
  onSelect: (index: number) => void;
  allowBackNavigation?: boolean;
}

export const TechnicalQuestionNavigator: React.FC<Props> = ({
  questions,
  currentIndex,
  drafts,
  onSelect,
  allowBackNavigation = true,
}) => {
  return (
    <div className="flex flex-col bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Questions Navigator</h3>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => {
          const isCurrent = i === currentIndex;
          const draftEntry = drafts[q.id] as { code?: string; isSubmitted?: boolean; isDraftSaved?: boolean } | undefined;
          const isSubmitted = Boolean(draftEntry?.isSubmitted);
          const hasDraft = Boolean(draftEntry?.isDraftSaved || (draftEntry?.code && draftEntry.code.trim().length > 0));
          const isDisabled = !allowBackNavigation && i < currentIndex;

          let badgeStyle = 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100';
          if (isCurrent) {
            badgeStyle = 'bg-blue-600 text-white border-blue-600 shadow-sm ring-2 ring-blue-200';
          } else if (isSubmitted) {
            badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100';
          } else if (hasDraft) {
            badgeStyle = 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100';
          }

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelect(i)}
              disabled={isDisabled}
              aria-label={`Question ${i + 1}${isSubmitted ? ', completed' : hasDraft ? ', in progress' : ''}`}
              className={`w-9 h-9 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-0.5 border ${badgeStyle} ${
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {isSubmitted && !isCurrent ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : i + 1}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-4 border-t border-slate-100 pt-3 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Current
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Submitted
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Draft
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block" /> Remaining
        </span>
      </div>
    </div>
  );
};
