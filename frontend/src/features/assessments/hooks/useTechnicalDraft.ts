import { useEffect, useRef, useState } from 'react';
import { technicalAssessmentApi, TechnicalDraftData } from '../services/technicalAssessmentApi';

export function useTechnicalDraft(
  attemptId: string,
  questionId: string,
  initialData?: TechnicalDraftData,
  enabled = true
) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prevQuestionIdRef = useRef<string>(questionId);
  const lastSavedCodeRef = useRef<string>('');
  const initializedRef = useRef<boolean>(false);

  const currentCode = (initialData?.sourceCode || initialData?.sqlQuery) ?? '';

  // Reset/sync tracking when questionId changes or on first mount
  useEffect(() => {
    if (prevQuestionIdRef.current !== questionId || !initializedRef.current) {
      prevQuestionIdRef.current = questionId;
      lastSavedCodeRef.current = currentCode;
      initializedRef.current = true;
      setSaveStatus('idle');
    }
  }, [questionId, currentCode]);

  useEffect(() => {
    if (!enabled || !attemptId || !questionId || !initialData) return;

    if (currentCode === lastSavedCodeRef.current) return;

    setSaveStatus('saving');
    setError(null);

    const timer = setTimeout(async () => {
      try {
        await technicalAssessmentApi.saveTechnicalDraft(attemptId, questionId, initialData);
        lastSavedCodeRef.current = currentCode;
        setSaveStatus('saved');
        setLastSavedAt(new Date().toLocaleTimeString());
      } catch (err: unknown) {
        setSaveStatus('error');
        setError(err instanceof Error ? err.message : 'Autosave failed');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [initialData, currentCode, attemptId, questionId, enabled]);

  return {
    saveStatus,
    lastSavedAt,
    error,
  };
}
