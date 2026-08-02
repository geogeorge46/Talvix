import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../../../auth/AuthProvider';
import { apiRequest } from '../../../api/client';
import { useToast } from '../../../design-system';

declare global {
  interface Window {
    google?: any;
  }
}

export function SocialLogin() {
  const { completeAuth } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    // Load GIS script dynamically if not present
    if (!document.getElementById('google-gsi-client')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-client';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    const initGoogle = () => {
      if (!window.google || !active) return;

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
      if (!clientId) {
        console.warn('VITE_GOOGLE_CLIENT_ID environment variable is missing.');
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          try {
            const result = await apiRequest<{
              user?: any;
              accessToken?: string;
              onboardingRequired?: boolean;
              onboardingSessionId?: string;
              email?: string;
              name?: string;
            }>('/auth/google', {
              method: 'POST',
              body: { idToken: response.credential },
              auth: false,
            });

            if (result.onboardingRequired) {
              toast.push({
                title: 'Onboarding Required',
                message: 'Please complete your profile to finish registration.',
                tone: 'info',
              });
              navigate('/onboarding', {
                state: {
                  onboardingSessionId: result.onboardingSessionId,
                  email: result.email,
                  fullName: result.name,
                },
              });
            } else if (result.user && result.accessToken) {
              await completeAuth({ user: result.user, accessToken: result.accessToken });
              toast.push({
                title: 'Welcome Back',
                message: 'Successfully signed in with Google.',
                tone: 'success',
              });
              navigate(homeForRole(result.user.role));
            }
          } catch (error: any) {
            toast.push({
              title: 'Login Failed',
              message: error?.message || 'Failed to sign in with Google.',
              tone: 'danger',
            });
          }
        },
      });

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'signin_with',
          logo_alignment: 'left',
          width: buttonRef.current.parentElement?.clientWidth || 320,
        });
      }
    };

    const interval = setInterval(() => {
      if (window.google) {
        initGoogle();
        clearInterval(interval);
      }
    }, 100);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [completeAuth, navigate, toast]);

  const handleOAuthClick = (provider: string) => {
    toast.push({
      title: 'OAuth Signing In',
      message: `${provider} login is not available yet. Please use Google, GitHub or credentials.`,
      tone: 'info',
      duration: 4000,
    });
  };

  const handleGithubClick = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      toast.push({
        title: 'GitHub Integration Required',
        message: 'Please set the VITE_GITHUB_CLIENT_ID environment variable to enable GitHub authentication.',
        tone: 'warning',
        duration: 5000,
      });
      return;
    }

    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/github/callback`);
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user%20user:email`;
  };

  const handleGoogleClickPlaceholder = () => {
    if (!buttonRef.current || buttonRef.current.children.length === 0) {
      toast.push({
        title: 'Google Integration Required',
        message: 'Please set the VITE_GOOGLE_CLIENT_ID environment variable to enable Google authentication.',
        tone: 'warning',
        duration: 5000,
      });
    }
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

      <div className="flex flex-col gap-3">
        {/* Google Native Sign-In Button with Visual Overlay */}
        <div 
          onClick={handleGoogleClickPlaceholder}
          className="relative w-full flex justify-center h-[40px] cursor-pointer"
        >
          {/* custom visual representation */}
          <div className="absolute inset-0 flex items-center justify-center gap-2 py-2.5 px-3.5 border border-slate-200 bg-white hover:bg-slate-50/50 rounded-xl font-semibold text-xs text-slate-700 shadow-sm pointer-events-none select-none">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.48 14.98 0 12 0 7.31 0 3.25 2.69 1.25 6.63l3.87 3C6.06 6.88 8.81 5.04 12 5.04z"/>
              <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58v3l3.87 3c2.26-2.09 3.56-5.17 3.56-8.73z"/>
              <path fill="#34A853" d="M5.12 14.37c-.24-.72-.37-1.49-.37-2.37s.13-1.65.37-2.37V6.63H1.25C.45 8.24 0 10.06 0 12s.45 3.76 1.25 5.37l3.87-3z"/>
              <path fill="#FBBC05" d="M12 18.96c-3.19 0-5.94-1.84-6.88-4.59l-3.87 3C3.25 21.31 7.31 24 12 24c3.24 0 6.13-1.07 8.17-2.91l-3.87-3c-1.13.75-2.6 1.17-4.3 1.17z"/>
            </svg>
            <span>Sign in with Google</span>
          </div>
          {/* real hidden native button overlay */}
          <div 
            ref={buttonRef} 
            className="absolute inset-0 opacity-[0.01] cursor-pointer w-full [&_iframe]:w-full"
          ></div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-1">
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
            onClick={handleGithubClick}
            className="flex items-center justify-center gap-2 py-2.5 px-3.5 border border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 rounded-xl font-semibold text-xs text-slate-700 transition-all shadow-sm active:scale-[0.97] duration-150 focus:outline-none"
          >
            <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 16 16" aria-hidden="true">
              <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>GitHub</span>
          </button>
        </div>
      </div>
    </div>
  );
}
