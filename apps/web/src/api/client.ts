export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // ignore body parse failure, fall back to statusText
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(path).then((res) => handle<T>(res));
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((res) => handle<T>(res));
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => handle<T>(res));
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return fetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => handle<T>(res));
}

export function apiDelete<T>(path: string): Promise<T> {
  return fetch(path, { method: 'DELETE' }).then((res) => handle<T>(res));
}

export function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return fetch(path, { method: 'POST', body: form }).then((res) => handle<T>(res));
}
