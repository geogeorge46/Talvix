import { Check } from 'lucide-react';

interface PasswordStrengthProps {
  value: string;
}

export function PasswordStrength({ value }: PasswordStrengthProps) {
  const requirements = [
    { label: 'At least 8 characters', valid: value.length >= 8 },
    { label: 'Include an uppercase letter', valid: /[A-Z]/.test(value) },
    { label: 'Include a number', valid: /[0-9]/.test(value) },
    { label: 'Include a special character', valid: /[^A-Za-z0-9]/.test(value) },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl">
      {requirements.map((req, index) => (
        <div 
          key={index} 
          className="flex items-center gap-2 transition-all duration-200"
        >
          <div 
            className={`flex items-center justify-center w-4.5 h-4.5 rounded-full border transition-all duration-200 ${
              req.valid 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : 'border-slate-300 text-transparent'
            }`}
            aria-hidden="true"
          >
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
          <span className={`text-xs ${req.valid ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
            {req.label}
          </span>
        </div>
      ))}
    </div>
  );
}
