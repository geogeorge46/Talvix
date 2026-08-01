const endpoints = (process.env.TALVIX_HEALTH_URLS ?? 'http://127.0.0.1:5000/api/v1/health,http://127.0.0.1:8080/healthz')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const timeoutMs = Number(process.env.TALVIX_HEALTH_TIMEOUT_MS ?? 5000);

const check = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal });
    return { url, ok: response.ok, status: response.status, latencyMs: Date.now() - started };
  } catch (error) {
    return { url, ok: false, error: error.name === 'AbortError' ? 'timeout' : 'request_failed', latencyMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
};

const results = await Promise.all(endpoints.map(check));
for (const result of results) console.log(JSON.stringify(result));
if (results.some((result) => !result.ok)) process.exit(1);
