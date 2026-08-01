import { useState, useRef } from 'react';

interface RoleSelectorProps {
  error?: string | undefined;
  defaultValue?: 'candidate' | 'recruiter';
  onChange?: (value: 'candidate' | 'recruiter') => void;
}

export function RoleSelector({ error, defaultValue = 'candidate', onChange }: RoleSelectorProps) {
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
    <div className="flex flex-col gap-1.5 w-full mb-4">
      <label 
        htmlFor="register-role" 
        className="text-[11px] font-bold text-slate-500 tracking-wider uppercase select-none"
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

      <div 
        className="relative flex p-1 bg-slate-100 rounded-xl w-full select-none" 
        role="presentation"
      >
        {/* Sliding Indicator Card */}
        <div 
          className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm transition-all duration-300 ease-out"
          style={{
            left: selected === 'candidate' ? '4px' : '50%',
            width: 'calc(50% - 8px)',
          }}
        />

        <button
          type="button"
          onClick={() => select('candidate')}
          className={`relative z-10 w-1/2 py-2.5 text-center text-sm font-semibold rounded-lg transition-colors focus:outline-none ${
            selected === 'candidate' ? 'text-slate-800' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Candidate
        </button>

        <button
          type="button"
          onClick={() => select('recruiter')}
          className={`relative z-10 w-1/2 py-2.5 text-center text-sm font-semibold rounded-lg transition-colors focus:outline-none ${
            selected === 'recruiter' ? 'text-slate-800' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Recruiter
        </button>
      </div>

      {error && (
        <span className="text-xs text-rose-500 font-medium mt-1 px-1" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
