import React from 'react';
import { Question } from '../../model';
import { StatusTag } from '../../../../design-system';

interface Props {
  question: Question;
  index: number;
  totalQuestions: number;
}

export const TechnicalProblemPanel: React.FC<Props> = ({ question, index, totalQuestions }) => {
  const publicTestCases = (question.coding?.testCases ?? []).filter((tc: { isHidden?: boolean }) => !tc.isHidden);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 bg-white border border-slate-200 rounded-lg shadow-xs space-y-4">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Task {index + 1} of {totalQuestions}
          </span>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5">
            {question.title || question.prompt || `Technical Problem ${index + 1}`}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {question.difficulty && (
            <StatusTag
              tone={
                question.difficulty === 'easy'
                  ? 'success'
                  : question.difficulty === 'hard'
                  ? 'danger'
                  : 'warning'
              }
            >
              {question.difficulty.toUpperCase()}
            </StatusTag>
          )}
          <StatusTag tone="neutral">{question.marks} MARKS</StatusTag>
        </div>
      </div>

      {/* Skills / Category Tags */}
      {(question.skills?.length || question.category) && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {question.category && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-medium rounded-full">
              {question.category}
            </span>
          )}
          {question.skills?.map((skill, i) => (
            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 font-medium rounded-full">
              {skill}
            </span>
          ))}
        </div>
      )}

      {/* Problem Description */}
      <div className="prose prose-slate max-w-none text-sm text-slate-700 leading-relaxed whitespace-pre-line">
        {question.prompt}
      </div>

      {question.description && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 whitespace-pre-line">
          {question.description}
        </div>
      )}

      {/* Public Sample Test Cases */}
      {publicTestCases.length > 0 && (
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Sample Test Cases</h4>
          <div className="space-y-2">
            {publicTestCases.map((tc, i) => (
              <div key={i} className="p-3 bg-slate-900 text-slate-100 rounded-md font-mono text-xs space-y-1">
                <div className="text-slate-400 font-semibold">Sample #{i + 1}</div>
                {tc.input !== undefined && (
                  <div>
                    <span className="text-slate-400">Input:</span>{' '}
                    <span className="text-amber-300">{typeof tc.input === 'object' ? JSON.stringify(tc.input) : String(tc.input)}</span>
                  </div>
                )}
                {tc.expectedOutput !== undefined && (
                  <div>
                    <span className="text-slate-400">Expected Output:</span>{' '}
                    <span className="text-emerald-300">
                      {typeof tc.expectedOutput === 'object' ? JSON.stringify(tc.expectedOutput) : String(tc.expectedOutput)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
