import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Link as RouterLink,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  ErrorSummary,
  FormActions,
  Select,
  SessionExpiredState,
  TextField,
} from '../../design-system';
import { ApiError } from '../../api/client';
import { homeForRole, useAuth } from '../../auth/AuthProvider';

function safeReturn(value: string | null) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : null;
}
export function SignInPage() {
  const { signIn, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
    <Card className="tvx-auth-card">
      <header>
        <p className="tvx-eyebrow">Welcome back</p>
        <h1>Sign in to Talvix</h1>
        <p>Continue to your secure workspace.</p>
      </header>
      <ErrorSummary ref={summaryRef} errors={errors} />
      {error && !errors.length && (
        <Alert tone="danger" title="Sign in failed">
          {error}
        </Alert>
      )}
      <form onSubmit={(event) => void submit(event)}>
        <TextField
          id="login-email"
          name="email"
          type="email"
          label="Email address"
          autoComplete="email"
          required
          error={fields.email}
        />
        <TextField
          id="login-password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          error={fields.password}
        />
        <FormActions>
          <Button type="submit" loading={loading} loadingLabel="Signing in">
            Sign in
          </Button>
        </FormActions>
      </form>
      <p>
        New to Talvix? <RouterLink to="/register">Create an account</RouterLink>
      </p>
    </Card>
  );
}
export function RegisterPage() {
  const { register, status, user } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setFields({});
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const created = await register({
        fullName: String(data.get('fullName')),
        email: String(data.get('email')),
        password: String(data.get('password')),
        role:
          String(data.get('role')) === 'recruiter' ? 'recruiter' : 'candidate',
      });
      navigate(homeForRole(created.role), { replace: true });
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
    <Card className="tvx-auth-card">
      <header>
        <p className="tvx-eyebrow">Get started</p>
        <h1>Create your Talvix account</h1>
        <p>Choose the workspace that matches how you use Talvix.</p>
      </header>
      <ErrorSummary ref={summaryRef} errors={errors} />
      {error && !errors.length && (
        <Alert tone="danger" title="Registration failed">
          {error}
        </Alert>
      )}
      <form onSubmit={(event) => void submit(event)}>
        <TextField
          id="register-fullName"
          name="fullName"
          label="Full name"
          autoComplete="name"
          required
          error={fields.fullName}
        />
        <TextField
          id="register-email"
          name="email"
          type="email"
          label="Email address"
          autoComplete="email"
          required
          error={fields.email}
        />
        <TextField
          id="register-password"
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          required
          hint="Use at least 8 characters with uppercase, lowercase, a number, and a special character."
          error={fields.password}
        />
        <Select
          id="register-role"
          name="role"
          label="I am joining as"
          required
          options={[
            { value: 'candidate', label: 'Candidate' },
            { value: 'recruiter', label: 'Recruiter' },
          ]}
          error={fields.role}
        />
        <FormActions>
          <Button
            type="submit"
            loading={loading}
            loadingLabel="Creating account"
          >
            Create account
          </Button>
        </FormActions>
      </form>
      <p>
        Already registered? <RouterLink to="/login">Sign in</RouterLink>
      </p>
    </Card>
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
