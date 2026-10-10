import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface Props {
  isActive?: boolean;
}

export const TechnicalProctoringIndicator: React.FC<Props> = ({ isActive = true }) => {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-[11px] font-medium text-slate-200">
      <span className="relative flex h-2 w-2">
        {isActive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      </span>
      <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
      <span>Proctoring {isActive ? 'Active' : 'Monitored'}</span>
    </div>
  );
};
