export interface ApiErrorBody {
  success?: false;
  message?: string;
  details?: unknown;
}
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get fieldErrors(): Record<string, string> {
    if (!this.details || typeof this.details !== 'object') return {};
    if (Array.isArray(this.details)) {
      return Object.fromEntries(
        this.details.flatMap((issue) => {
          if (!issue || typeof issue !== 'object') return [];
          const { field, message } = issue as {
            field?: unknown;
            message?: unknown;
          };
          return typeof field === 'string' && typeof message === 'string'
            ? [[field, message] as const]
            : [];
        }),
      );
    }
    const source =
      'fieldErrors' in this.details
        ? (this.details as { fieldErrors?: unknown }).fieldErrors
        : this.details;
    if (!source || typeof source !== 'object' || Array.isArray(source))
      return {};
    return Object.fromEntries(
      Object.entries(source).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  }
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1';
let accessToken: string | null = null;
let refreshRequest: Promise<string | null> | null = null;
let onSessionExpired: (() => void) | null = null;
let onForbidden: (() => void) | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}
export function setForbiddenHandler(handler: (() => void) | null) {
  onForbidden = handler;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody = {};
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    /* non-JSON server response */
  }
  return new ApiError(
    response.status,
    body.message ?? `Request failed (${response.status})`,
    body.details,
  );
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshRequest) {
    refreshRequest = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const body = (await response.json()) as {
          data?: { accessToken?: string };
          accessToken?: string;
        };
        const token = body.data?.accessToken ?? body.accessToken ?? null;
        tokenStore.set(token);
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

export async function restoreAccessToken() {
  return refreshAccessToken();
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
  retry401?: boolean;
}
const REPLAY_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function canReplayAfterRefresh(method?: string) {
  return REPLAY_SAFE_METHODS.has((method ?? 'GET').toUpperCase());
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, retry401 = true, headers, ...init } = options;
  const replayAfterRefresh = retry401 && canReplayAfterRefresh(init.method);
  const requestHeaders = new Headers(headers);
  requestHeaders.set('Accept', 'application/json');
  if (body !== undefined)
    requestHeaders.set('Content-Type', 'application/json');
  const token = tokenStore.get();
  if (auth && token) requestHeaders.set('Authorization', `Bearer ${token}`);
  const requestInit: RequestInit = {
    ...init,
    headers: requestHeaders,
    credentials: auth ? 'omit' : (init.credentials ?? 'include'),
  };
  if (body !== undefined) requestInit.body = JSON.stringify(body);
  const response = await fetch(`${API_BASE_URL}${path}`, requestInit);
  if (response.status === 401 && auth && replayAfterRefresh) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest<T>(path, { ...options, retry401: false });
    tokenStore.clear();
    onSessionExpired?.();
  } else if (response.status === 401 && auth && retry401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) throw await parseError(response);
    tokenStore.clear();
    onSessionExpired?.();
  }
  if (response.status === 403 && auth) onForbidden?.();
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const result = (await response.json()) as { data?: T } | T;
  return typeof result === 'object' && result !== null && 'data' in result
    ? (result as { data: T }).data
    : (result as T);
}
