const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || data.error || 'Request failed')
  return data
}

export const api = {
  login: (username, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  signup: (username, password) =>
    request('/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),

  logout: () => request('/logout', { method: 'POST' }),

  me: () => request('/me'),

  generateReport: (topic) =>
    request('/generate_report', { method: 'POST', body: JSON.stringify({ topic }) }),

  submitFeedback: (threadId, feedback) =>
    request('/submit_feedback', { method: 'POST', body: JSON.stringify({ thread_id: threadId, feedback }) }),

  getStatus: (threadId) =>
    request(`/report_status/${threadId}`),
}
