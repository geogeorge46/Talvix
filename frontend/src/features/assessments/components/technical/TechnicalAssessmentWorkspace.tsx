import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Question } from '../../model';
import { TechnicalAssessmentHeader } from './TechnicalAssessmentHeader';
import { TechnicalQuestionNavigator } from './TechnicalQuestionNavigator';
import { TechnicalProblemPanel } from './TechnicalProblemPanel';
import { TechnicalEditorPanel } from './TechnicalEditorPanel';
import { TechnicalSubmissionBar } from './TechnicalSubmissionBar';
import { TechnicalConsole } from './TechnicalConsole';
import { TechnicalFullscreenGuard } from './TechnicalFullscreenGuard';
import { useTechnicalAssessment } from '../../hooks/useTechnicalAssessment';
import { useTechnicalDraft } from '../../hooks/useTechnicalDraft';

interface Props {
  attemptId: string;
  assessmentTitle: string;
  expiresAt: string;
  questions: Question[];
  initialIndex?: number;
  initialAnswers?: Record<string, unknown> | unknown[];
  allowBackNavigation?: boolean;
  isAttemptDisabled?: boolean;
  onExpire?: () => void;
  onClose?: () => void;
  onAnswerSaved?: (questionId: string, value: unknown) => void;
  onNavigate?: (index: number) => void;
  onSubmitAttempt?: () => void;
}

export const TechnicalAssessmentWorkspace: React.FC<Props> = ({
  attemptId,
  assessmentTitle,
  expiresAt,
  questions,
  initialIndex = 0,
  initialAnswers = {},
  allowBackNavigation = true,
  isAttemptDisabled = false,
  onExpire,
  onClose,
  onAnswerSaved,
  onNavigate,
  onSubmitAttempt,
}) => {
  const {
    currentIndex,
    currentQuestion,
    handleNavigate,
    handleRunCode,
    handleSubmitResponse,
    executionResult,
    isExecuting,
    isSubmitting,
  } = useTechnicalAssessment(attemptId, questions, initialIndex, isAttemptDisabled);

  const handleSelectQuestion = useCallback(
    (index: number) => {
      handleNavigate(index);
      onNavigate?.(index);
    },
    [handleNavigate, onNavigate]
  );

  // Maintain local code, active language, and per-language drafts per question
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        activeLanguage: string;
        codeByLang: Record<string, string>;
        isSubmitted?: boolean;
        isDraftSaved?: boolean;
      }
    >
  >(() => {
    const map: Record<
      string,
      { activeLanguage: string; codeByLang: Record<string, string>; isSubmitted?: boolean; isDraftSaved?: boolean }
    > = {};
    questions.forEach((q) => {
      const qKey = q.id || q.questionId;
      if (!qKey) return;
      let existing: any = null;
      if (Array.isArray(initialAnswers)) {
        existing = initialAnswers.find(
          (a: any) => (a?.questionId?.toString() || a?.question?.toString()) === qKey.toString()
        );
      } else if (initialAnswers && typeof initialAnswers === 'object') {
        existing = (initialAnswers as Record<string, any>)[qKey] || (initialAnswers as Record<string, any>)[q.id] || (initialAnswers as Record<string, any>)[q.questionId || ''];
      }

      if (existing) {
        const lang = existing.language ?? q.languages?.[0] ?? q.coding?.languageSupport?.[0] ?? 'javascript';
        const code = existing.code ?? (typeof existing.answer === 'string' ? existing.answer : '') ?? '';
        map[qKey] = {
          activeLanguage: lang,
          codeByLang: { [lang]: code },
          isSubmitted: Boolean(existing.submittedAt || existing.isSubmitted),
          isDraftSaved: true,
        };
      }
    });
    return map;
  });

  const getStarterCode = (q: Question | null, lang: string) => {
    if (!q) return '';
    const targetLang = (lang || '').toLowerCase();
    // For debugging questions, prioritize buggyCode if present
    if (q.type === 'debugging') {
      const buggyMap = q.coding?.buggyCode || q.debugging?.buggyCode || (q as any).buggyCode;
      if (buggyMap && typeof buggyMap === 'object') {
        const val = buggyMap[targetLang] || buggyMap[lang] || Object.values(buggyMap)[0];
        if (val) return String(val);
      }
    }
    const starterMap = q.coding?.starterCode || q.debugging?.starterCode || q.starterCode;
    if (starterMap && typeof starterMap === 'object') {
      const val = starterMap[targetLang] || starterMap[lang];
      if (val) return String(val);
      return String(Object.values(starterMap)[0] || '');
    }
    if (typeof starterMap === 'string') return starterMap;
    return '';
  };

  const qId = currentQuestion?.id || currentQuestion?.questionId || '';
  const currentDraft = qId ? drafts[qId] : undefined;

  const availableLangs = currentQuestion?.languages?.length
    ? currentQuestion.languages
    : currentQuestion?.coding?.languageSupport?.length
    ? currentQuestion.coding.languageSupport
    : [];
  const starterMapKeys = currentQuestion?.starterCode
    ? Object.keys(currentQuestion.starterCode)
    : currentQuestion?.coding?.starterCode
    ? Object.keys(currentQuestion.coding.starterCode)
    : [];

  const activeLang =
    currentDraft?.activeLanguage ??
    availableLangs[0] ??
    starterMapKeys[0] ??
    'javascript';

  const activeCode =
    currentDraft?.codeByLang?.[activeLang] ?? getStarterCode(currentQuestion, activeLang);

  const { saveStatus, lastSavedAt } = useTechnicalDraft(
    attemptId,
    qId,
    {
      type: currentQuestion?.type === 'sql' ? 'sql' : currentQuestion?.type === 'debugging' ? 'debugging' : 'coding',
      language: activeLang,
      sourceCode: activeCode,
      sqlQuery: currentQuestion?.type === 'sql' ? activeCode : '',
    },
    !isAttemptDisabled && Boolean(currentQuestion) && Boolean(qId)
  );

  const setCodeForCurrent = (code: string) => {
    if (!currentQuestion || !qId) return;
    setDrafts((prev) => {
      const qDraft = prev[qId] || {
        activeLanguage: activeLang,
        codeByLang: {},
      };
      return {
        ...prev,
        [qId]: {
          ...qDraft,
          activeLanguage: activeLang,
          codeByLang: {
            ...qDraft.codeByLang,
            [activeLang]: code,
          },
          isDraftSaved: true,
        },
      };
    });
    onAnswerSaved?.(qId, { code, language: activeLang });
  };

  const setLangForCurrent = (language: string) => {
    if (!currentQuestion || !qId) return;
    setDrafts((prev) => {
      const qDraft = prev[qId] || {
        activeLanguage: language,
        codeByLang: {},
      };
      const existingCode = qDraft.codeByLang[language];
      const initialCode = existingCode !== undefined ? existingCode : getStarterCode(currentQuestion, language);
      return {
        ...prev,
        [qId]: {
          ...qDraft,
          activeLanguage: language,
          codeByLang: {
            ...qDraft.codeByLang,
            [language]: initialCode,
          },
        },
      };
    });
    const restoredCode = drafts[qId]?.codeByLang?.[language] ?? getStarterCode(currentQuestion, language);
    onAnswerSaved?.(qId, { code: restoredCode, language });
  };

  const handleRun = useCallback(() => {
    void handleRunCode(activeCode, activeLang);
  }, [handleRunCode, activeCode, activeLang]);

  // Support Ctrl+Enter / Cmd+Enter keyboard shortcut for Run Code
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRun]);

  const handleSubmit = async () => {
    if (!currentQuestion) return;
    const targetQId = currentQuestion.id || currentQuestion.questionId || '';
    try {
      await handleSubmitResponse({
        type: currentQuestion.type === 'sql' ? 'sql' : currentQuestion.type === 'debugging' ? 'debugging' : 'coding',
        language: activeLang,
        sourceCode: activeCode,
        sqlQuery: currentQuestion.type === 'sql' ? activeCode : '',
      });
    } catch (err) {
      console.error('Submit technical response failed:', err);
    }

    if (targetQId) {
      setDrafts((prev) => ({
        ...prev,
        [targetQId]: {
          ...prev[targetQId],
          code: activeCode,
          language: activeLang,
          isSubmitted: true,
          isDraftSaved: true,
        },
      }));
    }

    if (currentIndex < questions.length - 1) {
      handleNavigate(currentIndex + 1);
      onNavigate?.(currentIndex + 1);
    } else {
      onSubmitAttempt?.();
    }
  };

  const content = (
    <div className="fixed inset-0 z-30 bg-slate-950 text-slate-100 flex flex-col w-screen h-screen overflow-hidden font-sans select-none">
      {/* Fullscreen Guard Banner */}
      <TechnicalFullscreenGuard attemptId={attemptId} />

      {/* Top Assessment Header */}
      <TechnicalAssessmentHeader
        title={assessmentTitle}
        currentIndex={currentIndex}
        totalQuestions={questions.length}
        expiresAt={expiresAt}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        onExpire={onExpire}
        onClose={onClose}
      />

      {/* Main 3-Panel Split Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0 w-full">
        {/* Panel 1: Left Question Navigator (Width: ~200px) */}
        <aside className="w-52 shrink-0 border-r border-slate-800 bg-slate-900 overflow-y-auto p-3 hidden md:block">
          <TechnicalQuestionNavigator
            questions={questions}
            currentIndex={currentIndex}
            drafts={drafts}
            onSelect={handleSelectQuestion}
            allowBackNavigation={allowBackNavigation}
          />
        </aside>

        {/* Panel 2 & 3: Workspace Grid */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-w-0 min-h-0 overflow-hidden bg-slate-950 p-2 gap-2">
          {/* Panel 2: Center Problem Statement (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col min-w-0 min-h-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-800">
            {currentQuestion && (
              <TechnicalProblemPanel
                question={currentQuestion}
                index={currentIndex}
                totalQuestions={questions.length}
              />
            )}
          </div>

          {/* Panel 3: Right Editor & Console Panel (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col min-w-0 min-h-0 overflow-hidden rounded-lg bg-slate-900 border border-slate-800">
            {/* Editor Container */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {currentQuestion && (
                <TechnicalEditorPanel
                  question={currentQuestion}
                  code={activeCode}
                  language={activeLang}
                  onChangeCode={setCodeForCurrent}
                  onChangeLanguage={setLangForCurrent}
                  disabled={isAttemptDisabled}
                />
              )}
            </div>

            {/* Collapsible Bottom Console & Submission Action Bar */}
            <div className="flex flex-col shrink-0 border-t border-slate-800 bg-slate-900">
              <TechnicalConsole result={executionResult} isExecuting={isExecuting} />
              <TechnicalSubmissionBar
                onRun={handleRun}
                onSubmit={() => void handleSubmit()}
                isExecuting={isExecuting}
                isSubmitting={isSubmitting}
                disabled={isAttemptDisabled}
                isLastQuestion={currentIndex === questions.length - 1}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
