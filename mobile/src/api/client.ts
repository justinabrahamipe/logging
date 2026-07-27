let baseUrl: string | null = null;
let apiKey: string | null = null;

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function setSession(url: string | null, key: string | null) {
  baseUrl = url ? normalizeBaseUrl(url) : null;
  apiKey = key;
}

export class ApiRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** True for a genuine network/offline failure (fetch never reached the server) rather than a real API rejection. */
export function isOfflineError(err: unknown): boolean {
  return !(err instanceof ApiRequestError);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!baseUrl || !apiKey) {
    throw new ApiRequestError("Not signed in", 401);
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // response body wasn't JSON; keep the generic message
    }
    throw new ApiRequestError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Checks a base URL + API key pair against a real endpoint before persisting them. */
export async function verifyCredentials(url: string, key: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeBaseUrl(url)}/api/pillars`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
