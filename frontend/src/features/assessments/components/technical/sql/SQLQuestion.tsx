import React from 'react';
import { Question } from '../../../model';
import { TechnicalProblemPanel } from '../TechnicalProblemPanel';
import { TechnicalEditorPanel } from '../TechnicalEditorPanel';
import { Database, Table } from 'lucide-react';

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

export const SQLQuestion: React.FC<Props> = ({
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
      {/* Schema Information Banner */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-blue-900 shadow-2xs">
        <Database className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span>
          SQL Database Challenge: Construct a valid SQL query against the target database schema to return the expected result set.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[500px]">
        <TechnicalProblemPanel question={question} index={index} totalQuestions={totalQuestions} />
        <TechnicalEditorPanel
          question={question}
          code={code}
          language="sql"
          onChangeCode={onChangeCode}
          onChangeLanguage={onChangeLanguage}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
