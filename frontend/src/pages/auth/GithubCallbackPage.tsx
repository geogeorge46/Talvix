import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../../auth/AuthProvider';
import { apiRequest, ApiError } from '../../api/client';
import { useToast, Alert } from '../../design-system';
import { AuthLayout } from './components/AuthLayout';
import { AuthCard } from './components/AuthCard';

interface GitHubAuthResponse {
  onboardingRequired?: boolean;
  onboardingSessionId?: string;
  email?: string;
  fullName?: string;
  user?: any;
  accessToken?: string;
}

export function GithubCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { completeAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const params = new URLSearchParams(location.search);
    const code = params.get('code');

    if (!code) {
      setError('Authorization code is missing. Please try signing in again.');
      return;
    }

    const authenticate = async () => {
      try {
        const response = await apiRequest<GitHubAuthResponse>('/auth/github', {
          method: 'POST',
          body: { code },
          auth: false,
        });

        if (response.onboardingRequired && response.onboardingSessionId) {
          navigate('/onboarding', {
            state: {
              onboardingSessionId: response.onboardingSessionId,
              email: response.email,
              fullName: response.fullName,
              provider: 'github',
            },
            replace: true,
          });
          return;
        }

        if (response.user && response.accessToken) {
          await completeAuth({
            user: response.user,
            accessToken: response.accessToken,
          });

          toast.push({
            title: 'Welcome to Talvix',
            message: 'Signed in successfully with GitHub.',
            tone: 'success',
          });

          navigate(homeForRole(response.user.role), { replace: true });
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Authentication failed. Please try again.');
      }
    };

    void authenticate();
  }, [location, navigate, completeAuth, toast]);

  return (
    <AuthLayout type="login">
      <AuthCard>
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5">GitHub Authentication</h1>
          <p className="text-sm text-slate-500">
            {error ? 'An error occurred during authentication.' : 'Completing sign-in with GitHub...'}
          </p>
        </header>

        {error ? (
          <div className="flex flex-col gap-4">
            <Alert tone="danger">{error}</Alert>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full mt-2 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 active:scale-[0.99]"
            >
              Back to Sign in
            </button>
          </div>
        ) : (
          <div className="flex justify-center p-6">
            <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
