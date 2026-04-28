import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Download, FileText, ArrowLeft, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Card, CardContent } from '../components/ui/card'
import ProgressTracker from '../components/ProgressTracker'
import StreamingText from '../components/StreamingText'

const PHASE2_STEPS = [
  'conduct_interview',
  'write_report',
  'write_introduction',
  'write_conclusion',
  'finalize_report',
]
const WRITING_NODES = new Set(['write_report', 'write_introduction', 'write_conclusion'])

interface ReportResult {
  docx_path: string
  pdf_path:  string
}

export default function ReportProgress() {
  const { state }  = useLocation()
  const navigate   = useNavigate()
  const [feedback, setFeedback]       = useState('')
  const [streamPhase, setStreamPhase] = useState<'idle' | 'streaming' | 'done'>('idle')
  const [completed, setCompleted]     = useState<Set<string>>(new Set())
  const [tokenBuffer, setTokenBuffer] = useState({ node: '', content: '' })
  const [tokenDone, setTokenDone]     = useState(false)
  const [error, setError]             = useState('')
  const [result, setResult]           = useState<ReportResult | null>(null)

  const topic:    string = state?.topic
  const threadId: string = state?.threadId

  if (!topic || !threadId) {
    navigate('/dashboard')
    return null
  }

  async function handleFeedback(e: React.FormEvent) {
    e.preventDefault()
    setStreamPhase('streaming')
    setError('')
    setCompleted(new Set())
    setTokenBuffer({ node: '', content: '' })
    setTokenDone(false)

    try {
      for await (const event of api.streamFeedback(threadId, feedback)) {
        if (event.type === 'node_complete') {
          setCompleted((prev) => new Set([...prev, event.node]))
          if (WRITING_NODES.has(event.node)) setTokenDone(true)
        } else if (event.type === 'token') {
          setTokenBuffer((prev) =>
            prev.node === event.node
              ? { node: event.node, content: prev.content + event.content }
              : { node: event.node, content: event.content }
          )
          setTokenDone(false)
        } else if (event.type === 'complete') {
          const status = await api.getStatus(threadId)
          if (status.docx_path && status.pdf_path) {
            setResult({ docx_path: status.docx_path, pdf_path: status.pdf_path })
          }
          setStreamPhase('done')
          return
        } else if (event.type === 'error') {
          setError(event.message)
          setStreamPhase('idle')
          return
        }
      }
    } catch (err) {
      setError((err as Error).message)
      setStreamPhase('idle')
    }
  }

  function filename(p: string) {
    return p?.split('/').pop() ?? p
  }

  const isStreaming = streamPhase === 'streaming'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-sky-100 flex items-start justify-center p-10">
      <Card className="w-full max-w-xl">
        <CardContent className="p-10">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>

          <div className="flex items-center gap-2.5 text-primary mb-6">
            <FileText size={22} />
            <h1 className="text-xl text-foreground">{topic}</h1>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 mb-4">
              {error}
            </div>
          )}

          {result ? (
            <div className="text-center py-6">
              <CheckCircle size={56} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-xl mb-2">Report Ready</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your AI-generated report has been compiled successfully.
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button variant="outline" asChild>
                  <a href={`/download/${filename(result.docx_path)}`} download>
                    <Download size={16} /> Download DOCX
                  </a>
                </Button>
                <Button asChild>
                  <a href={`/download/${filename(result.pdf_path)}`} download>
                    <Download size={16} /> Download PDF
                  </a>
                </Button>
              </div>
            </div>
          ) : isStreaming ? (
            <div className="py-2">
              <p className="text-sm text-muted-foreground mb-1">Generating your report…</p>
              <ProgressTracker steps={PHASE2_STEPS} completed={completed} />
              <StreamingText node={tokenBuffer.node} content={tokenBuffer.content} done={tokenDone} />
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-5">
                Your draft report is ready. Provide feedback below to refine it, then click submit.
              </p>
              <form onSubmit={handleFeedback} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="feedback" className="text-sm font-medium">Feedback</label>
                  <Textarea
                    id="feedback"
                    placeholder="e.g. Add more technical depth, include case studies, focus on 2024–2025 data…"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    rows={5}
                    required
                  />
                </div>
                <div className="text-xs text-muted-foreground bg-muted border border-border rounded-md px-3 py-2.5">
                  Specific feedback like "Add real-world examples" or "Expand the market analysis section"
                  produces the best results.
                </div>
                <Button type="submit" className="w-full" disabled={isStreaming || !feedback.trim()}>
                  Submit Feedback
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
