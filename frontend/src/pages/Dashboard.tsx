import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, LogOut, Sparkles } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import ProgressTracker from '../components/ProgressTracker'

const PHASE1_STEPS = ['create_analyst']

const SUGGESTIONS = [
  'Generative AI in Healthcare',
  'Quantum Computing Trends 2025',
  'Climate Tech Investment Landscape',
  'Future of Autonomous Vehicles',
]

export default function Dashboard() {
  const navigate = useNavigate()
  const [username, setUsername]   = useState('')
  const [topic, setTopic]         = useState('')
  const [phase, setPhase]         = useState<'idle' | 'streaming'>('idle')
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [error, setError]         = useState('')

  useEffect(() => {
    api.me().then((d) => setUsername(d.username)).catch(() => navigate('/login'))
  }, [navigate])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setPhase('streaming')
    setError('')
    setCompleted(new Set())
    let capturedThreadId: string | null = null

    try {
      for await (const event of api.streamGenerate(topic.trim())) {
        if (event.type === 'thread_id') {
          capturedThreadId = event.thread_id
        } else if (event.type === 'node_complete') {
          setCompleted((prev) => new Set([...prev, event.node]))
        } else if (event.type === 'interrupt') {
          navigate('/report', { state: { topic: topic.trim(), threadId: capturedThreadId } })
          return
        } else if (event.type === 'error') {
          setError(event.message)
          setPhase('idle')
          return
        }
      }
    } catch (err) {
      setError((err as Error).message)
      setPhase('idle')
    }
  }

  async function handleLogout() {
    await api.logout().catch(() => {})
    navigate('/login')
  }

  const isStreaming = phase === 'streaming'

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="bg-card border-b shadow-sm px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Sparkles size={20} />
          <span>AI Report Generator</span>
        </div>
        {username && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Hello, {username}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut size={16} />
              Sign out
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col items-center py-16 px-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl mb-2">Generate a Research Report</h1>
            <p className="text-muted-foreground">
              Enter a topic and our AI analysts will research and write a comprehensive report for you.
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleGenerate} className="mb-7">
            <div className="flex items-center gap-3 bg-card border-2 border-border rounded-xl px-4 py-3 shadow-md focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
              <FileText size={20} className="text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="e.g. Generative AI in Healthcare"
                value={topic}
                onChange={(e) => { setTopic(e.target.value); setError('') }}
                required
                disabled={isStreaming}
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground"
              />
              <Button type="submit" disabled={isStreaming || !topic.trim()}>
                {isStreaming
                  ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : 'Generate'}
              </Button>
            </div>
          </form>

          {isStreaming ? (
            <ProgressTracker steps={PHASE1_STEPS} completed={completed} />
          ) : (
            <div>
              <p className="text-xs text-muted-foreground mb-2 text-center">Try a suggestion:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setTopic(s)}
                    className="bg-blue-50 text-primary border border-blue-200 rounded-full px-4 py-1.5 text-xs font-medium hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
