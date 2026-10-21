import { User, FileText, Mail, Check } from 'lucide-react';

export function StepIndicator() {
  const steps = [
    { label: 'Account', icon: User, active: true },
    { label: 'Role & Profile', icon: FileText, active: false },
    { label: 'Verification', icon: Mail, active: false },
    { label: 'Ready', icon: Check, active: false },
  ];

  return (
    <div className="w-full flex items-center justify-between mb-4 select-none px-1">
      {steps.map((step, idx) => {
        const Icon = step.icon;
        return (
          <div key={idx} className="flex-1 flex items-center relative">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1 relative z-10 mx-auto">
              <div
                className={`w-7.5 h-7.5 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                  step.active
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-white border-slate-300 text-slate-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span
                className={`text-[9px] font-bold tracking-wider uppercase ${
                  step.active ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connecting dashed line to the next step */}
            {idx < steps.length - 1 && (
              <div
                className="absolute left-1/2 right-[-50%] h-px border-t border-dashed border-slate-300"
                style={{ top: '15px', transform: 'translateY(-50%)', zIndex: 0 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
