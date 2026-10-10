import { useState, useCallback, useEffect } from 'react';
import { Question } from '../model';
import { technicalAssessmentApi, CodeExecutionResult } from '../services/technicalAssessmentApi';

export function useTechnicalAssessment(
  attemptId: string,
  questions: Question[],
  initialIndex = 0,
  isAttemptDisabled = false
) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < questions.length) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, questions.length]);
  const [executionResult, setExecutionResult] = useState<CodeExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentQuestion = questions[currentIndex] ?? null;

  const handleNavigate = useCallback(
    (index: number) => {
      if (index >= 0 && index < questions.length) {
        setCurrentIndex(index);
        setExecutionResult(null);
      }
    },
    [questions.length]
  );

  const handleRunCode = useCallback(
    async (code: string, language: string) => {
      const qId = currentQuestion?.id || currentQuestion?.questionId || '';
      if (!currentQuestion || !qId || isAttemptDisabled) return;
      setIsExecuting(true);
      try {
        const result = currentQuestion.type === 'debugging'
          ? await technicalAssessmentApi.runDebuggingQuestion(
              attemptId,
              qId,
              { code, language }
            )
          : await technicalAssessmentApi.runCodingQuestion(
              attemptId,
              qId,
              { code, language }
            );
        setExecutionResult(result);
      } catch (err: unknown) {
        setExecutionResult({
          status: 'error',
          message: err instanceof Error ? err.message : 'Execution failed',
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [attemptId, currentQuestion, isAttemptDisabled]
  );

  const handleSubmitResponse = useCallback(
    async (data: { type: 'coding' | 'debugging' | 'sql'; language?: string; sourceCode?: string; sqlQuery?: string }) => {
      const qId = currentQuestion?.id || currentQuestion?.questionId || '';
      if (!currentQuestion || !qId || isAttemptDisabled) return;
      setIsSubmitting(true);
      try {
        await technicalAssessmentApi.submitTechnicalResponse(
          attemptId,
          qId,
          data
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [attemptId, currentQuestion, isAttemptDisabled]
  );

  return {
    currentIndex,
    currentQuestion,
    handleNavigate,
    handleRunCode,
    handleSubmitResponse,
    executionResult,
    isExecuting,
    isSubmitting,
  };
}
