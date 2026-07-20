import { ApiError, apiRequest, restoreAccessToken, tokenStore } from './client';

describe('HTTP client', () => {
  afterEach(() => {
    tokenStore.clear();
    vi.unstubAllGlobals();
  });

  it('normalizes backend validation errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: 'Invalid input',
            details: [{ field: 'email', message: 'Enter a valid email' }],
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const error = await apiRequest('/auth/login', {
      method: 'POST',
      auth: false,
      body: {},
    }).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).fieldErrors).toEqual({
      email: 'Enter a valid email',
    });
  });

  it('keeps restored access tokens in memory', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { accessToken: 'memory-token' } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );
    expect(await restoreAccessToken()).toBe('memory-token');
    expect(tokenStore.get()).toBe('memory-token');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('uses one refresh for concurrent 401 responses and replays once', async () => {
    let refreshes = 0;
    let protectedCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/auth/refresh')) {
          refreshes += 1;
          return Promise.resolve(
            new Response(JSON.stringify({ data: { accessToken: 'fresh' } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        protectedCalls += 1;
        return Promise.resolve(
          protectedCalls <= 2
            ? new Response('{}', { status: 401 })
            : new Response(JSON.stringify({ data: { ok: true } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }),
        );
      }),
    );
    await Promise.all([apiRequest('/resource'), apiRequest('/resource')]);
    expect(refreshes).toBe(1);
    expect(protectedCalls).toBe(4);
  });

  it('signals session expiry when refresh fails', async () => {
    const expired = vi.fn();
    const { setSessionExpiredHandler } = await import('./client');
    setSessionExpiredHandler(expired);
    tokenStore.set('expired');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) =>
        String(input).endsWith('/auth/refresh')
          ? Promise.resolve(new Response('{}', { status: 401 }))
          : Promise.resolve(new Response('{}', { status: 401 })),
      ),
    );
    await expect(apiRequest('/private')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    expect(tokenStore.get()).toBeNull();
    setSessionExpiredHandler(null);
  });

  it('does not refresh again when the single replay also returns 401', async () => {
    let refreshes = 0;
    let protectedCalls = 0;
    tokenStore.set('expired');
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        if (String(input).endsWith('/auth/refresh')) {
          refreshes += 1;
          return Promise.resolve(
            new Response(JSON.stringify({ data: { accessToken: 'new' } }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }
        protectedCalls += 1;
        return Promise.resolve(new Response('{}', { status: 401 }));
      }),
    );
    await expect(apiRequest('/private')).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(1);
    expect(protectedCalls).toBe(2);
  });
});
