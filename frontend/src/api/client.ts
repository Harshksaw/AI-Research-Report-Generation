const BASE = '/api'

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail ?? data.error ?? 'Request failed')
  return data as T
}

export type SSEEvent =
  | { type: 'thread_id';    thread_id: string }
  | { type: 'node_complete'; node: string }
  | { type: 'token';        node: string; content: string }
  | { type: 'interrupt' }
  | { type: 'complete' }
  | { type: 'error';        message: string }

async function* streamSSE(path: string, options: RequestOptions = {}): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail ?? data.error ?? 'Request failed')
  }
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop()!
    for (const part of parts) {
      const line = part.trim()
      if (line.startsWith('data: ')) yield JSON.parse(line.slice(6)) as SSEEvent
    }
  }
}

export const api = {
  login:  (username: string, password: string) =>
    request<{ username: string }>('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  signup: (username: string, password: string) =>
    request<{ message: string }>('/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),

  logout: () => request<{ message: string }>('/logout', { method: 'POST' }),

  me: () => request<{ username: string }>('/me'),

  streamGenerate: (topic: string) =>
    streamSSE('/generate_report', { method: 'POST', body: JSON.stringify({ topic }) }),

  streamFeedback: (threadId: string, feedback: string) =>
    streamSSE('/submit_feedback', { method: 'POST', body: JSON.stringify({ thread_id: threadId, feedback }) }),

  getStatus: (threadId: string) =>
    request<{ status: string; docx_path?: string; pdf_path?: string }>(`/report_status/${threadId}`),
}
