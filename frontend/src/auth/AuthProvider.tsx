/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  apiRequest,
  restoreAccessToken,
  setForbiddenHandler,
  setSessionExpiredHandler,
  tokenStore,
} from '../api/client';
import type {
  AuthStatus,
  CapabilityStatus,
  RecruiterContext,
  User,
  UserRole,
} from './types';

interface AuthValue {
  status: AuthStatus;
  user: User | null;
  recruiter: RecruiterContext | null;
  capabilityStatus: CapabilityStatus;
  signIn: (email: string, password: string) => Promise<User>;
  register: (input: {
    fullName: string;
    email: string;
    password: string;
    role: Exclude<UserRole, 'admin'>;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshCapabilities: () => Promise<void>;
  completeAuth: (data: { user: User; accessToken: string }) => Promise<User>;
}
const AuthContext = createContext<AuthValue | null>(null);
interface AuthResponse {
  user: User;
  accessToken: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [user, setUser] = useState<User | null>(null);
  const [recruiter, setRecruiter] = useState<RecruiterContext | null>(null);
  const [capabilityStatus, setCapabilityStatus] =
    useState<CapabilityStatus>('idle');
  const capabilityLoading = useRef(false);
  const clear = useCallback(
    (next: AuthStatus) => {
      tokenStore.clear();
      setUser(null);
      setRecruiter(null);
      setCapabilityStatus('idle');
      queryClient.clear();
      setStatus(next);
    },
    [queryClient],
  );
  const loadRecruiter = useCallback(async (candidate: User) => {
    if (candidate.role !== 'recruiter') {
      setRecruiter(null);
      setCapabilityStatus('idle');
      return;
    }
    if (capabilityLoading.current) return;
    capabilityLoading.current = true;
    setCapabilityStatus('loading');
    try {
      const transport = await apiRequest<{ profile: RecruiterContext }>(
        '/recruiters/me',
      );
      setRecruiter(transport.profile);
      setCapabilityStatus('resolved');
    } catch {
      setRecruiter(null);
      setCapabilityStatus('error');
    } finally {
      capabilityLoading.current = false;
    }
  }, []);
  useEffect(() => {
    setSessionExpiredHandler(() => clear('session-expired'));
    return () => setSessionExpiredHandler(null);
  }, [clear]);
  useEffect(() => {
    const refresh = () => {
      if (user?.role === 'recruiter' && !capabilityLoading.current)
        void loadRecruiter(user);
    };
    setForbiddenHandler(refresh);
    window.addEventListener('focus', refresh);
    return () => {
      setForbiddenHandler(null);
      window.removeEventListener('focus', refresh);
    };
  }, [loadRecruiter, user]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const token = await restoreAccessToken();
      if (!live) return;
      if (!token) {
        clear('anonymous');
        return;
      }
      try {
        const restored = await apiRequest<unknown>('/auth/me', {
          retry401: false,
        });
        if (!live) return;
        const currentUser = restored && typeof restored === 'object' && 'user' in restored
          ? (restored as { user: User }).user
          : (restored as User);
        setUser(currentUser);
        await loadRecruiter(currentUser);
        if (live) setStatus('authenticated');
      } catch {
        if (live) clear('anonymous');
      }
    })();
    return () => {
      live = false;
    };
  }, [clear, loadRecruiter]);
  const accept = useCallback(
    async (data: AuthResponse) => {
      queryClient.clear();
      tokenStore.set(data.accessToken);
      setUser(data.user);
      await loadRecruiter(data.user);
      setStatus('authenticated');
      return data.user;
    },
    [loadRecruiter, queryClient],
  );
  const completeAuth = useCallback(
    async (data: { user: User; accessToken: string }) => accept(data),
    [accept]
  );
  const signIn = useCallback(
    async (email: string, password: string) =>
      accept(
        await apiRequest<AuthResponse>('/auth/login', {
          method: 'POST',
          body: { email, password },
          auth: false,
        }),
      ),
    [accept],
  );
  const register = useCallback(
    async (input: {
      fullName: string;
      email: string;
      password: string;
      role: 'candidate' | 'recruiter';
    }) =>
      accept(
        await apiRequest<AuthResponse>('/auth/register', {
          method: 'POST',
          body: input,
          auth: false,
        }),
      ),
    [accept],
  );
  const logout = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST', auth: false });
    } finally {
      clear('anonymous');
    }
  }, [clear]);
  const refreshCapabilities = useCallback(async () => {
    if (user) await loadRecruiter(user);
  }, [loadRecruiter, user]);
  const value = useMemo(
    () => ({
      status,
      user,
      recruiter,
      capabilityStatus,
      signIn,
      register,
      logout,
      refreshCapabilities,
      completeAuth,
    }),
    [
      status,
      user,
      recruiter,
      capabilityStatus,
      signIn,
      register,
      logout,
      refreshCapabilities,
      completeAuth,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be inside AuthProvider');
  return value;
}
export function homeForRole(role: UserRole) {
  return role === 'candidate'
    ? '/candidate'
    : role === 'recruiter'
      ? '/org'
      : '/admin';
}
