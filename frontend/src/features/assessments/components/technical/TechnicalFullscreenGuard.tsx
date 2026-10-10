import React, { useEffect, useState } from 'react';
import { Maximize2, AlertTriangle } from 'lucide-react';
import { technicalAssessmentApi } from '../../services/technicalAssessmentApi';
import { apiRequest } from '../../../../api/client';

interface Props {
  attemptId: string;
}

export const TechnicalFullscreenGuard: React.FC<Props> = ({ attemptId }) => {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) {
        setShowWarning(true);
        // Log telemetry event to backend
        void apiRequest(`/assessments/attempts/me/${attemptId}/suspicious-event`, {
          method: 'POST',
          body: { type: 'fullscreen-exit', detail: 'Candidate exited fullscreen mode' },
        }).catch(() => {
          // ignore telemetry network errors
        });
      } else {
        setShowWarning(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [attemptId]);

  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen request may be blocked by browser policy without direct gesture
    }
  };

  if (!showWarning && isFullscreen) return null;

  return (
    <div className="bg-amber-950/90 border-b border-amber-800 text-amber-200 px-4 py-2 text-xs flex items-center justify-between gap-3 shrink-0 z-50">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong>Proctoring Notice:</strong> Fullscreen mode exited. Please return to fullscreen for optimal assessment environment.
        </span>
      </div>
      <button
        type="button"
        onClick={() => void requestFullscreen()}
        className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded shadow-sm transition-all"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Enter Fullscreen</span>
      </button>
    </div>
  );
};
