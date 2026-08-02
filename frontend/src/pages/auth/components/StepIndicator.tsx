import { User, FileText, Mail, Check } from 'lucide-react';

export function StepIndicator() {
  const steps = [
    { label: 'Account', icon: User, active: true },
    { label: 'Details', icon: FileText, active: false },
    { label: 'Verify', icon: Mail, active: false },
    { label: 'Complete', icon: Check, active: false },
  ];

  return (
    <div className="w-full flex items-center justify-between mb-8 select-none">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        return (
          <div key={idx} className="flex-1 flex items-center relative">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5 relative z-10 mx-auto">
              <div 
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step.active 
                    ? 'bg-slate-900 border-slate-900 text-white shadow-[0_0_12px_rgba(15,23,42,0.15)]' 
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span 
                className={`text-[9px] font-bold tracking-wider uppercase ${
                  step.active ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting dashed line to the next step */}
            {idx < steps.length - 1 && (
              <div 
                className="absolute left-1/2 right-[-50%] h-px border-t border-dashed border-slate-200" 
                style={{ top: '18px', transform: 'translateY(-50%)', zIndex: 0 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
