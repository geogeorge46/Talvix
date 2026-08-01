import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';

interface AuthInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label: string;
  error?: string | undefined;
  icon?: 'email' | 'password' | 'name';
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput({ label, error, icon, type = 'text', id, required, ...props }, ref) {
    const uid = useId();
    const cid = id ?? uid;
    const [showPassword, setShowPassword] = useState(false);

    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    // Pick a prefix icon based on icon prop or field name
    let PrefixIcon = null;
    if (icon === 'email' || props.name === 'email') {
      PrefixIcon = Mail;
    } else if (icon === 'password' || isPassword) {
      PrefixIcon = Lock;
    } else if (icon === 'name' || props.name === 'fullName') {
      PrefixIcon = User;
    }

    return (
      <div className="tvx-form-field flex flex-col gap-1.5 w-full">
        <div className="flex justify-between items-center">
          <label htmlFor={cid} className="text-[11px] font-bold text-slate-500 tracking-wider uppercase select-none">
            {label}
            {required && <span> (required)</span>}
          </label>
        </div>

        <div className={`relative flex items-center rounded-xl border ${error ? 'border-rose-400 bg-rose-50/10' : 'border-slate-200'} bg-white transition-all duration-200 auth-input-focus shadow-sm h-12 px-3.5`}>
          {PrefixIcon && (
            <PrefixIcon className={`w-5 h-5 ${error ? 'text-rose-400' : 'text-slate-400'} mr-3 shrink-0`} />
          )}

          <input
            {...props}
            ref={ref}
            id={cid}
            type={inputType}
            required={required}
            className="w-full h-full bg-transparent border-0 outline-none text-slate-800 placeholder-slate-400 text-sm focus:ring-0 focus:outline-none"
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors focus:outline-none ml-2 shrink-0"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          )}
        </div>

        {error && (
          <span className="text-xs text-rose-500 font-medium mt-1 px-1 transition-all" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }
);
