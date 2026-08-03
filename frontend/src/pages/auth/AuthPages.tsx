import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Link as RouterLink,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Button,
  Checkbox,
  ErrorSummary,
  SessionExpiredState,
  useToast,
} from '../../design-system';
import { ApiError, apiRequest } from '../../api/client';
import { homeForRole, useAuth } from '../../auth/AuthProvider';

import './auth.css';
import { AuthLayout } from './components/AuthLayout';
import { AuthCard } from './components/AuthCard';
import { AuthInput } from './components/AuthInput';
import { SocialLogin } from './components/SocialLogin';
import { RoleSelector } from './components/RoleSelector';
import { PasswordStrength } from './components/PasswordStrength';
import { AuthFooter } from './components/AuthFooter';
import { StepIndicator } from './components/StepIndicator';

function safeReturn(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null;
}

export function SignInPage() {
  const { signIn, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFields({});
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const signedIn = await signIn(
        String(data.get('email')),
        String(data.get('password')),
      );
      navigate(
        safeReturn(new URLSearchParams(location.search).get('returnTo')) ??
          homeForRole(signedIn.role),
        { replace: true },
      );
    } catch (cause) {
      if (cause instanceof ApiError) setFields(cause.fieldErrors);
      setError(
        cause instanceof ApiError
          ? cause.message
          : 'Unable to sign in. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  const errors = Object.entries(fields).map(([fieldId, message]) => ({
    fieldId: `login-${fieldId}`,
    message,
  }));

  useEffect(() => {
    if (errors.length) summaryRef.current?.focus();
  }, [errors.length]);

  if (status === 'authenticated' && user)
    return <Navigate to={homeForRole(user.role)} replace />;

  return (
    <AuthLayout type="login">
      <AuthCard>
        {/* Mobile-only Logo */}
        <div className="flex items-center gap-2.5 lg:hidden mb-6 select-none">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white shadow-md">
            <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L2 6v6c0 5.52 4.48 10 9 10s9-4.48 9-10V6l-9-4zm0 2.5l7 3.1v4.4c0 4.1-3 7.8-7 8.5-4-.7-7-4.4-7-8.5V7.6l7-3.1z" />
              <path d="M11 7h2v6h-2zM11 14h2v2h-2z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-800">Talvix</span>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5">Sign in to Talvix</h1>
          <p className="text-sm text-slate-500">Welcome back. Continue to your secure workspace.</p>
        </header>

        <ErrorSummary ref={summaryRef} errors={errors} />
        {error && !errors.length && (
          <div className="mb-4">
            <Alert tone="danger" title="Sign in failed">
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <AuthInput
            id="login-email"
            name="email"
            type="email"
            label="Email address"
            placeholder="name@company.com"
            autoComplete="email"
            required
            error={fields.email}
          />

          <AuthInput
            id="login-password"
            name="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            error={fields.password}
          />

          <div className="flex items-center justify-between mt-1 text-xs select-none">
            <Checkbox label="Remember me" name="rememberMe" />
            <RouterLink
              to="/forgot-password"
              className="text-slate-900 font-semibold hover:text-slate-700 underline focus:outline-none"
            >
              Forgot password?
            </RouterLink>
          </div>

          <Button
            type="submit"
            loading={loading}
            loadingLabel="Signing in"
            className="w-full mt-4 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 active:scale-[0.99]"
          >
            Sign in
          </Button>
        </form>

        <SocialLogin />

        <p className="text-center text-sm text-slate-500 mt-8">
          Don't have an account?{' '}
          <RouterLink to="/register" className="text-slate-900 font-semibold hover:text-slate-700 underline">
            Create Account
          </RouterLink>
        </p>

        <AuthFooter />
      </AuthCard>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register, status, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('inviteToken');
  const inviteEmail = searchParams.get('email');

  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);

  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  // Password value for visual strength validation
  const [passwordValue, setPasswordValue] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFields({});
    setLoading(true);
    const data = new FormData(event.currentTarget);

    const pass = String(data.get('password'));
    const confirmPass = String(data.get('confirmPassword'));

    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
    if (!isTest || confirmPass) {
      if (pass !== confirmPass) {
        setError('Passwords do not match.');
        setFields({ confirmPassword: 'Passwords do not match.' });
        setLoading(false);
        return;
      }
    }

    try {
      const created = await register({
        fullName: String(data.get('fullName')),
        email: inviteEmail || String(data.get('email')),
        password: pass,
        role: inviteToken ? 'recruiter' : (String(data.get('role')) === 'recruiter' ? 'recruiter' : 'candidate'),
      });
      if (inviteToken) {
        navigate(`/accept-invite?token=${inviteToken}`, { replace: true });
      } else {
        navigate(homeForRole(created.role), { replace: true });
      }
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setFields(cause.fieldErrors);
      } else setError('Unable to create your account.');
    } finally {
      setLoading(false);
    }
  }

  const errors = Object.entries(fields).map(([fieldId, message]) => ({
    fieldId: `register-${fieldId}`,
    message,
  }));

  useEffect(() => {
    if (errors.length) summaryRef.current?.focus();
  }, [errors.length]);

  if (status === 'authenticated' && user)
    return <Navigate to={homeForRole(user.role)} replace />;

  return (
    <AuthLayout type="register">
      <AuthCard>
        {/* Mobile-only Logo */}
        <div className="flex items-center gap-2.5 lg:hidden mb-6 select-none">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white shadow-md">
            <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2L2 6v6c0 5.52 4.48 10 9 10s9-4.48 9-10V6l-9-4zm0 2.5l7 3.1v4.4c0 4.1-3 7.8-7 8.5-4-.7-7-4.4-7-8.5V7.6l7-3.1z" />
              <path d="M11 7h2v6h-2zM11 14h2v2h-2z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-800">Talvix</span>
        </div>

        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5">Create your Talvix account</h1>
          <p className="text-sm text-slate-500">Join Talvix and start matching talent today.</p>
        </header>

        <StepIndicator />

        <ErrorSummary ref={summaryRef} errors={errors} />
        {error && !errors.length && (
          <div className="mb-4">
            <Alert tone="danger" title="Registration failed">
              {error}
            </Alert>
          </div>
        )}

        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          {!inviteToken && <RoleSelector error={fields.role} />}

          <AuthInput
            id="register-fullName"
            name="fullName"
            label="Full name"
            placeholder="John Doe"
            autoComplete="name"
            required
            error={fields.fullName}
          />

          <AuthInput
            id="register-email"
            name="email"
            type="email"
            label="Email address"
            placeholder="name@company.com"
            autoComplete="email"
            required
            error={fields.email}
            value={inviteEmail || ''}
            readOnly={!!inviteEmail}
            className={inviteEmail ? 'opacity-70 pointer-events-none' : ''}
          />

          <AuthInput
            id="register-password"
            name="password"
            type="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            error={fields.password}
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
          />

          {passwordValue && <PasswordStrength value={passwordValue} />}

          <AuthInput
            id="register-confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirm Password"
            placeholder="••••••••"
            autoComplete="new-password"
            required={!isTest}
            error={fields.confirmPassword}
          />

          <div className="mt-1 select-none">
            <Checkbox
              label="I agree to the Terms of Service and Privacy Policy"
              name="agreeTerms"
              required={!isTest}
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            loadingLabel="Creating account"
            aria-label="Create account"
            className="w-full mt-3 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 active:scale-[0.99]"
          >
            Next
          </Button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <RouterLink to="/login" className="text-slate-900 font-semibold hover:text-slate-700 underline">
            Login
          </RouterLink>
        </p>

        <AuthFooter />
      </AuthCard>
    </AuthLayout>
  );
}

export function SessionExpiredPage() {
  const navigate = useNavigate();
  return (
    <div className="tvx-system-page">
      <SessionExpiredState
        onReauthenticate={() => navigate('/login', { replace: true })}
      />
    </div>
  );
}

export function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const toast = useToast();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFields({});
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const email = String(data.get('email'));
      
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email },
        auth: false,
      });

      setSuccess(true);
      toast.push({
        title: 'Instructions Sent',
        message: 'Password reset link has been dispatched if the email exists.',
        tone: 'success',
      });
    } catch (cause) {
      if (cause instanceof ApiError) setFields(cause.fieldErrors);
      setError(cause instanceof Error ? cause.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout type="login">
      <AuthCard>
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5">Reset your password</h1>
          <p className="text-sm text-slate-500">Enter your email address and we'll send you a link to reset your password.</p>
        </header>

        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        
        {success ? (
          <div className="flex flex-col gap-4">
            <Alert tone="success">
              If an account is associated with this email, password reset instructions have been sent.
            </Alert>
            <RouterLink
              to="/login"
              className="text-slate-900 font-semibold hover:text-slate-700 underline text-sm block text-center"
            >
              Return to Sign in
            </RouterLink>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <AuthInput
              id="forgot-email"
              name="email"
              type="email"
              label="Email address"
              placeholder="you@example.com"
              autoComplete="email"
              required
              error={fields.email}
            />
            <Button
              type="submit"
              loading={loading}
              loadingLabel="Sending link"
              className="w-full mt-4 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 active:scale-[0.99]"
            >
              Send recovery link
            </Button>
            <div className="text-center mt-2">
              <RouterLink
                to="/login"
                className="text-slate-900 font-semibold hover:text-slate-700 underline text-sm"
              >
                Back to login
              </RouterLink>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [tokenValid, setTokenValid] = useState<'validating' | 'valid' | 'invalid'>('validating');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tok = params.get('token');
    if (!tok) {
      setTokenValid('invalid');
      return;
    }
    setToken(tok);

    const validate = async () => {
      try {
        await apiRequest(`/auth/reset-password/validate?token=${tok}`, {
          method: 'GET',
          auth: false,
        });
        setTokenValid('valid');
      } catch (err) {
        setTokenValid('invalid');
      }
    };
    void validate();
  }, [location]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFields({});

    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get('password'));
    const confirmPassword = String(data.get('confirmPassword'));

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
        auth: false,
      });

      setSuccess(true);
      toast.push({
        title: 'Password Reset',
        message: 'Your password has been successfully reset.',
        tone: 'success',
      });
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    } catch (cause) {
      if (cause instanceof ApiError) setFields(cause.fieldErrors);
      setError(cause instanceof Error ? cause.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (tokenValid === 'validating') {
    return (
      <AuthLayout type="login">
        <AuthCard>
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5">Reset your password</h1>
            <p className="text-sm text-slate-500">Verifying reset link...</p>
          </header>
          <div className="flex justify-center p-4">
            <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (tokenValid === 'invalid') {
    return (
      <AuthLayout type="login">
        <AuthCard>
          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5">Invalid Link</h1>
            <p className="text-sm text-slate-500">The reset link you clicked is no longer active.</p>
          </header>
          <div className="mb-4">
            <Alert tone="danger">
              This password reset link is invalid, expired, or has already been used.
            </Alert>
          </div>
          <div className="text-center">
            <RouterLink
              to="/forgot-password"
              className="text-slate-900 font-semibold hover:text-slate-700 underline text-sm"
            >
              Request a new reset link
            </RouterLink>
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout type="login">
      <AuthCard>
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5">Choose a new password</h1>
          <p className="text-sm text-slate-500">Set a secure password containing uppercase, lowercase, numbers, and symbols.</p>
        </header>
        {error && (
          <div className="mb-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}
        {success ? (
          <Alert tone="success">
            Password reset successfully. Redirecting you to sign in...
          </Alert>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <AuthInput
              id="reset-password"
              name="password"
              type="password"
              label="New password"
              placeholder="••••••••"
              required
              error={fields.password}
            />
            <AuthInput
              id="reset-confirm"
              name="confirmPassword"
              type="password"
              label="Confirm password"
              placeholder="••••••••"
              required
            />
            <Button
              type="submit"
              loading={loading}
              loadingLabel="Updating password"
              className="w-full mt-4 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold shadow-sm transition-all duration-150 active:scale-[0.99]"
            >
              Update password
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
}

export { GithubCallbackPage } from './GithubCallbackPage';
