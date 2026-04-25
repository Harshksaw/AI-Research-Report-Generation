import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Download, FileText, ArrowLeft, CheckCircle } from 'lucide-react'
import { api } from '../api/client'
import Spinner from '../components/Spinner'

export default function ReportProgress() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const topic = state?.topic
  const threadId = state?.threadId

  if (!topic || !threadId) {
    navigate('/dashboard')
    return null
  }

  async function handleFeedback(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const data = await api.submitFeedback(threadId, feedback)
      if (data.pdf_path) {
        setResult(data)
      } else {
        setError('Report still processing. Please try again in a moment.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function filename(path) {
    return path?.split('/').pop() ?? path
  }

  return (
    <div className="progress-page">
      {loading && <Spinner message="Processing your feedback…" />}

      <div className="progress-card">
        <Link to="/dashboard" className="back-link">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>

        <div className="progress-topic">
          <FileText size={22} />
          <h1>{topic}</h1>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {result ? (
          <div className="report-ready">
            <div className="ready-icon">
              <CheckCircle size={48} color="var(--color-success)" />
            </div>
            <h2>Report Ready</h2>
            <p className="subtitle">Your AI-generated report has been compiled successfully.</p>
            <div className="download-row">
              <a
                href={`/download/${filename(result.docx_path)}`}
                className="btn btn-outline"
                download
              >
                <Download size={16} />
                Download DOCX
              </a>
              <a
                href={`/download/${filename(result.pdf_path)}`}
                className="btn btn-primary"
                download
              >
                <Download size={16} />
                Download PDF
              </a>
            </div>
          </div>
        ) : (
          <div className="feedback-section">
            <p className="subtitle">
              Your draft report is ready. Provide feedback below to refine it, then click submit.
            </p>

            <form onSubmit={handleFeedback} className="form">
              <div className="field">
                <label htmlFor="feedback">Feedback</label>
                <textarea
                  id="feedback"
                  placeholder="e.g. Add more technical depth, include case studies, focus on 2024–2025 data…"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={5}
                  required
                />
              </div>

              <div className="feedback-tip">
                Specific feedback like "Add real-world examples" or "Expand the market analysis section"
                produces the best results.
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading || !feedback.trim()}>
                Submit Feedback
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
