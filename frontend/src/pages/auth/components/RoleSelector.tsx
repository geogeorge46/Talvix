import { useState, useRef } from 'react';
import { User, Briefcase } from 'lucide-react';

interface RoleSelectorProps {
  error?: string | undefined;
  defaultValue?: 'candidate' | 'recruiter';
  onChange?: (value: 'candidate' | 'recruiter') => void;
}

export function RoleSelector({
  error,
  defaultValue = 'candidate',
  onChange,
}: RoleSelectorProps) {
  const [selected, setSelected] = useState<'candidate' | 'recruiter'>(defaultValue);
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as 'candidate' | 'recruiter';
    setSelected(val);
    onChange?.(val);
  };

  const select = (role: 'candidate' | 'recruiter') => {
    setSelected(role);
    if (selectRef.current) {
      selectRef.current.value = role;
      selectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  return (
    <div className="flex w-full flex-col gap-1.5 mb-1">
      <label
        htmlFor="register-role"
        className="text-xs font-bold tracking-wider text-slate-700 uppercase select-none"
      >
        I am joining as
      </label>

      {/* Visually hidden select for test runner compatibility & screen readers */}
      <select
        ref={selectRef}
        id="register-role"
        name="role"
        value={selected}
        onChange={handleSelectChange}
        className="sr-only"
        required
      >
        <option value="candidate">Candidate</option>
        <option value="recruiter">Recruiter</option>
      </select>

      <div className="grid grid-cols-2 gap-2.5 w-full select-none" role="presentation">
        <button
          type="button"
          onClick={() => select('candidate')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-center text-sm font-bold transition-all focus:outline-none border-2 shadow-sm ${
            selected === 'candidate'
              ? 'bg-slate-900 border-slate-900 text-white shadow-slate-900/10'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <User size={16} className={selected === 'candidate' ? 'text-emerald-400' : 'text-slate-500'} />
          <span>Candidate</span>
        </button>

        <button
          type="button"
          onClick={() => select('recruiter')}
          className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-center text-sm font-bold transition-all focus:outline-none border-2 shadow-sm ${
            selected === 'recruiter'
              ? 'bg-slate-900 border-slate-900 text-white shadow-slate-900/10'
              : 'bg-white border-slate-300 text-slate-700 hover:border-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Briefcase size={16} className={selected === 'recruiter' ? 'text-emerald-400' : 'text-slate-500'} />
          <span>Recruiter</span>
        </button>
      </div>

      {error && <span className="text-xs font-semibold text-rose-500 mt-1">{error}</span>}
    </div>
  );
}
