import { useToast } from '../../../design-system';

export function SocialLogin() {
  const toast = useToast();

  const handleOAuthClick = (provider: string) => {
    toast.push({
      title: 'OAuth Signing In',
      message: `${provider} login is not available yet. Please use your credentials to sign in.`,
      tone: 'info',
      duration: 4000,
    });
  };

  return (
    <div className="w-full flex flex-col gap-4 mt-6">
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-slate-200"></div>
        <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">
          Or continue with
        </span>
        <div className="flex-grow border-t border-slate-200"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Google */}
        <button
          type="button"
          onClick={() => handleOAuthClick('Google')}
          className="flex items-center justify-center gap-2 py-2.5 px-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-xl font-semibold text-xs text-slate-700 transition-all shadow-sm active:scale-[0.97] duration-150 focus:outline-none"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="var(--ref-google-red)" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 0 12 0 7.31 0 3.25 2.69 1.25 6.63l3.87 3C6.06 6.88 8.81 5.04 12 5.04z"/>
            <path fill="var(--ref-google-blue)" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58v3l3.87 3c2.26-2.09 3.56-5.17 3.56-8.73z"/>
            <path fill="var(--ref-google-green)" d="M5.12 14.37c-.24-.72-.37-1.49-.37-2.37s.13-1.65.37-2.37V6.63H1.25C.45 8.24 0 10.06 0 12s.45 3.76 1.25 5.37l3.87-3z"/>
            <path fill="var(--ref-google-yellow)" d="M12 18.96c-3.19 0-5.94-1.84-6.88-4.59l-3.87 3C3.25 21.31 7.31 24 12 24c3.24 0 6.13-1.07 8.17-2.91l-3.87-3c-1.13.75-2.6 1.17-4.3 1.17z"/>
          </svg>
          <span>Google</span>
        </button>

        {/* Microsoft */}
        <button
          type="button"
          onClick={() => handleOAuthClick('Microsoft')}
          className="flex items-center justify-center gap-2 py-2.5 px-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-xl font-semibold text-xs text-slate-700 transition-all shadow-sm active:scale-[0.97] duration-150 focus:outline-none"
        >
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 23 23" aria-hidden="true">
            <rect x="0" y="0" width="10" height="10" fill="var(--ref-microsoft-red)" />
            <rect x="11" y="0" width="10" height="10" fill="var(--ref-microsoft-green)" />
            <rect x="0" y="11" width="10" height="10" fill="var(--ref-microsoft-blue)" />
            <rect x="11" y="11" width="10" height="10" fill="var(--ref-microsoft-yellow)" />
          </svg>
          <span>Microsoft</span>
        </button>

        {/* GitHub */}
        <button
          type="button"
          onClick={() => handleOAuthClick('GitHub')}
          className="flex items-center justify-center gap-2 py-2.5 px-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-xl font-semibold text-xs text-slate-700 transition-all shadow-sm active:scale-[0.97] duration-150 focus:outline-none"
        >
          <svg className="w-4 h-4 fill-current text-slate-800 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>GitHub</span>
        </button>
      </div>
    </div>
  );
}
