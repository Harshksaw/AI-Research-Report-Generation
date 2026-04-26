import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { api, type ReportRecord } from '../api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'

interface ReportModalProps {
  record: ReportRecord | null
  onClose: () => void
}

function filename(p: string) {
  return p?.split('/').pop() ?? p
}

export default function ReportModal({ record, onClose }: ReportModalProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!record) { setContent(''); return }
    setLoading(true)
    api.getReportContent(record.thread_id)
      .then((d) => setContent(d.content))
      .catch(() => setContent('Failed to load report content.'))
      .finally(() => setLoading(false))
  }, [record?.thread_id])

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{record?.topic ?? 'Report'}</DialogTitle>
          <DialogDescription>
            Generated {record ? new Date(record.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-foreground">
              {content || 'No content available.'}
            </pre>
          )}
        </div>

        {record?.docx_path && record?.pdf_path && (
          <DialogFooter>
            <Button variant="outline" asChild>
              <a href={`/download/${filename(record.docx_path)}`} download>
                <Download size={15} /> Download DOCX
              </a>
            </Button>
            <Button asChild>
              <a href={`/download/${filename(record.pdf_path)}`} download>
                <Download size={15} /> Download PDF
              </a>
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
