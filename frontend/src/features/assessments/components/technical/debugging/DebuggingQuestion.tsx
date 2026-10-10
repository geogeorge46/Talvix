import React from 'react';
import { Question } from '../../../model';
import { TechnicalProblemPanel } from '../TechnicalProblemPanel';
import { TechnicalEditorPanel } from '../TechnicalEditorPanel';
import { Bug } from 'lucide-react';

interface Props {
  question: Question;
  index: number;
  totalQuestions: number;
  code: string;
  language: string;
  onChangeCode: (code: string) => void;
  onChangeLanguage: (lang: string) => void;
  disabled?: boolean;
}

export const DebuggingQuestion: React.FC<Props> = ({
  question,
  index,
  totalQuestions,
  code,
  language,
  onChangeCode,
  onChangeLanguage,
  disabled,
}) => {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-amber-900 shadow-2xs">
        <Bug className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span>
          Debugging Challenge: The code snippet provided contains logic or edge case bugs. Refactor the implementation so all test suites pass cleanly.
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[500px]">
        <TechnicalProblemPanel question={question} index={index} totalQuestions={totalQuestions} />
        <TechnicalEditorPanel
          question={question}
          code={code}
          language={language}
          onChangeCode={onChangeCode}
          onChangeLanguage={onChangeLanguage}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
