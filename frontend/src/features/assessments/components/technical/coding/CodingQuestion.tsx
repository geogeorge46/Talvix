import React from 'react';
import { Question } from '../../../model';
import { TechnicalProblemPanel } from '../TechnicalProblemPanel';
import { TechnicalEditorPanel } from '../TechnicalEditorPanel';

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

export const CodingQuestion: React.FC<Props> = ({
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-[500px]">
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
  );
};
