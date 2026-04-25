import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, LogOut, Sparkles } from 'lucide-react'
import { api } from '../api/client'

export default function Dashboard() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.me().then((d) => setUsername(d.username)).catch(() => navigate('/login'))
  }, [navigate])

  async function handleGenerate(e) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    try {
      const { thread_id } = await api.generateReport(topic.trim())
      navigate('/report', { state: { topic: topic.trim(), threadId: thread_id } })
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  async function handleLogout() {
    await api.logout().catch(() => {})
    navigate('/login')
  }

  const suggestions = [
    'Generative AI in Healthcare',
    'Quantum Computing Trends 2025',
    'Climate Tech Investment Landscape',
    'Future of Autonomous Vehicles',
  ]

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <div className="topbar-brand">
          <Sparkles size={20} />
          <span>AI Report Generator</span>
        </div>
        {username && (
          <div className="topbar-right">
            <span className="topbar-user">Hello, {username}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </header>

      <main className="dashboard-main">
        <div className="dashboard-hero">
          <h1>Generate a Research Report</h1>
          <p className="subtitle">
            Enter a topic and our AI analysts will research and write a comprehensive report for you.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleGenerate} className="generate-form">
          <div className="generate-input-row">
            <FileText size={20} className="generate-icon" />
            <input
              type="text"
              placeholder="e.g. Generative AI in Healthcare"
              value={topic}
              onChange={(e) => { setTopic(e.target.value); setError('') }}
              required
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={loading || !topic.trim()}>
              {loading ? <span className="btn-spinner" /> : 'Generate'}
            </button>
          </div>
        </form>

        <div className="suggestions">
          <p className="suggestions-label">Try a suggestion:</p>
          <div className="suggestions-list">
            {suggestions.map((s) => (
              <button key={s} className="suggestion-chip" onClick={() => setTopic(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
