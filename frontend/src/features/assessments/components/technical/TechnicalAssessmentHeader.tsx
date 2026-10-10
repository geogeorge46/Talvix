import React, { useState } from 'react';
import { Clock, ShieldCheck, LogOut } from 'lucide-react';
import { TechnicalStatusIndicator } from './TechnicalStatusIndicator';
import { TechnicalProctoringIndicator } from './TechnicalProctoringIndicator';
import { useTechnicalTimer } from '../../hooks/useTechnicalTimer';
import { Button, Dialog } from '../../../../design-system';

interface Props {
  title: string;
  currentIndex: number;
  totalQuestions: number;
  expiresAt: string;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: string | null;
  onExpire?: () => void;
  onClose?: () => void;
}

export const TechnicalAssessmentHeader: React.FC<Props> = ({
  title,
  currentIndex,
  totalQuestions,
  expiresAt,
  saveStatus,
  lastSavedAt,
  onExpire,
  onClose,
}) => {
  const { formattedTime, isExpired } = useTechnicalTimer(expiresAt, onExpire);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 border-b border-slate-800 shrink-0 text-slate-100 font-sans shadow-sm">
      {/* Brand & Assessment Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold text-xs shrink-0">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Talvix Workspace</span>
        </div>
        <div className="h-4 w-px bg-slate-800 shrink-0" />
        <div className="truncate">
          <h1 className="text-sm font-bold text-white truncate max-w-md">{title}</h1>
        </div>
      </div>

      {/* Center Task Progress Badge */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-semibold text-slate-300">
        <span>Task {currentIndex + 1} of {totalQuestions}</span>
      </div>

      {/* Right Controls: Proctoring, Save Status, Timer & Exit */}
      <div className="flex items-center gap-3 shrink-0">
        <TechnicalProctoringIndicator isActive />

        <TechnicalStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />

        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-xs font-bold transition-colors ${
            isExpired
              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
              : 'bg-slate-800/90 text-slate-100 border-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>{isExpired ? 'Time Expired' : formattedTime}</span>
        </div>

        {onClose && (
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmExitOpen(true)}
              style={{
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                borderColor: '#334155',
                fontSize: '12px',
                padding: '4px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Exit</span>
            </Button>

            <Dialog
              open={confirmExitOpen}
              onOpenChange={setConfirmExitOpen}
              title="Leave Assessment Workspace?"
              description="Your saved work is safely recorded on the server. The assessment timer will continue running until completed or expired."
            >
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="secondary" onClick={() => setConfirmExitOpen(false)}>
                  Continue Assessment
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmExitOpen(false);
                    onClose();
                  }}
                >
                  Exit Workspace
                </Button>
              </div>
            </Dialog>
          </>
        )}
      </div>
    </header>
  );
};
