import { getDeviceId } from '../lib/fingerprint'

const BASE = '/api'

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>
}

function deviceHeaders(): Record<string, string> {
  return { 'X-Device-ID': getDeviceId() }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...deviceHeaders(), ...options.headers },
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

export interface ReportRecord {
  thread_id:  string
  topic:      string
  status:     'in_progress' | 'completed'
  created_at: string
  docx_path:  string | null
  pdf_path:   string | null
}

async function* streamSSE(path: string, options: RequestOptions = {}): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...deviceHeaders(), ...options.headers },
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
  streamGenerate: (topic: string) =>
    streamSSE('/generate_report', { method: 'POST', body: JSON.stringify({ topic }) }),

  streamFeedback: (threadId: string, feedback: string) =>
    streamSSE('/submit_feedback', { method: 'POST', body: JSON.stringify({ thread_id: threadId, feedback }) }),

  getStatus: (threadId: string) =>
    request<{ status: string; content?: string; docx_path?: string; pdf_path?: string }>(`/report_status/${threadId}`),

  getReports: () =>
    request<ReportRecord[]>('/reports'),

  getReportContent: (threadId: string) =>
    request<{ content: string; topic: string }>(`/report_content/${threadId}`),
}
