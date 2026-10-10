import React, { useState } from 'react';
import { Play, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Button, Dialog } from '../../../../design-system';

interface Props {
  onRun: () => void;
  onSubmit: () => void;
  isExecuting?: boolean;
  isSubmitting?: boolean;
  disabled?: boolean;
  isLastQuestion?: boolean;
}

export const TechnicalSubmissionBar: React.FC<Props> = ({
  onRun,
  onSubmit,
  isExecuting,
  isSubmitting,
  disabled,
  isLastQuestion,
}) => {
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-t border-slate-800 shrink-0">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onRun}
          disabled={disabled || isExecuting || isSubmitting}
          style={{
            backgroundColor: '#1e293b',
            color: '#f8fafc',
            borderColor: '#334155',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {isExecuting ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Play className="w-4 h-4 text-emerald-400 fill-current" />}
          <span>Run Code</span>
          <span className="hidden sm:inline text-[10px] text-slate-400 font-mono ml-1">(Ctrl+Enter)</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="primary"
          onClick={() => setConfirmSubmitOpen(true)}
          disabled={disabled || isSubmitting}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 700,
            borderRadius: '8px',
          }}
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>{isLastQuestion ? 'Submit Technical Task' : 'Save & Submit Solution'}</span>
        </Button>

        <Dialog
          open={confirmSubmitOpen}
          onOpenChange={setConfirmSubmitOpen}
          title="Submit Technical Solution?"
          description="Your final code response will be submitted and evaluated against public and hidden test cases. Saved responses will be locked for grading."
        >
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setConfirmSubmitOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leadingIcon={<CheckCircle2 className="w-4 h-4" />}
              onClick={() => {
                setConfirmSubmitOpen(false);
                onSubmit();
              }}
            >
              Confirm & Submit Solution
            </Button>
          </div>
        </Dialog>
      </div>
    </div>
  );
};
