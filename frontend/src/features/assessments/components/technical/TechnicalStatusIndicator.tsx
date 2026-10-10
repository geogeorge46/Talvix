import React from 'react';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: string | null;
  error?: string | null;
}

export const TechnicalStatusIndicator: React.FC<Props> = ({ status, lastSavedAt, error }) => {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Saving draft...
      </span>
    );
  }

  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-rose-600 font-medium" title={error ?? 'Save failed'}>
        <AlertCircle className="w-3.5 h-3.5" />
        Autosave failed
      </span>
    );
  }

  if (status === 'saved' || lastSavedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {lastSavedAt ? `Saved ${lastSavedAt}` : 'Draft saved'}
      </span>
    );
  }

  return <span className="text-xs text-slate-400">Ready</span>;
};
