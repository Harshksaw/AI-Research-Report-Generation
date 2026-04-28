import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Sparkles, Eye, Download, Clock } from 'lucide-react'
import { api, type ReportRecord } from '../api/client'
import { getDeviceId } from '../lib/fingerprint'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import ProgressTracker from '../components/ProgressTracker'
import ReportModal from '../components/ReportModal'

const PHASE1_STEPS = ['create_analyst']

const SUGGESTIONS = [
  'Generative AI in Healthcare',
  'Quantum Computing Trends 2025',
  'Climate Tech Investment Landscape',
  'Future of Autonomous Vehicles',
]

function filename(p: string) {
  return p?.split('/').pop() ?? p
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [topic, setTopic]             = useState('')
  const [phase, setPhase]             = useState<'idle' | 'streaming'>('idle')
  const [completed, setCompleted]     = useState<Set<string>>(new Set())
  const [error, setError]             = useState('')
  const [reports, setReports]         = useState<ReportRecord[]>([])
  const [modalRecord, setModalRecord] = useState<ReportRecord | null>(null)

  const deviceId = getDeviceId()
  const shortId  = deviceId.slice(-8).toUpperCase()

  useEffect(() => {
    api.getReports().then(setReports).catch(() => {})
  }, [])

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
          api.getReports().then(setReports).catch(() => {})
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

  const isStreaming = phase === 'streaming'

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b shadow-sm px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Sparkles size={20} />
          <span>ResearchAI</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono" title={deviceId}>
          Device #{shortId}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center py-14 px-6">
        <div className="w-full max-w-2xl">

          {/* Generate section */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2">Generate a Research Report</h1>
            <p className="text-muted-foreground">
              Enter a topic and our AI analysts will research and write a comprehensive report.
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

          {/* Recent Reports */}
          {reports.length > 0 && (
            <div className="mt-14">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock size={18} className="text-muted-foreground" /> Recent Reports
              </h2>
              <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Topic</th>
                      <th className="text-left px-4 py-3 font-medium">Date</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {reports.map((r) => (
                      <tr key={r.thread_id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground max-w-[220px] truncate">
                          {r.topic}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={r.status === 'completed' ? 'success' : 'secondary'}>
                            {r.status === 'completed' ? 'Completed' : 'In Progress'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {r.status === 'completed' && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => setModalRecord(r)}
                              >
                                <Eye size={13} /> View
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
                                <a href={`/download/${filename(r.docx_path!)}`} download>
                                  <Download size={13} /> DOCX
                                </a>
                              </Button>
                              <Button size="sm" className="h-7 px-2 text-xs" asChild>
                                <a href={`/download/${filename(r.pdf_path!)}`} download>
                                  <Download size={13} /> PDF
                                </a>
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <ReportModal record={modalRecord} onClose={() => setModalRecord(null)} />
    </div>
  )
}
