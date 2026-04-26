const NODE_LABELS: Record<string, string> = {
  write_report:      'Writing main report',
  write_introduction:'Writing introduction',
  write_conclusion:  'Writing conclusion',
}

interface StreamingTextProps {
  node: string
  content: string
  done: boolean
}

export default function StreamingText({ node, content, done }: StreamingTextProps) {
  if (!content) return null
  return (
    <div className="mt-4 p-4 bg-slate-900 rounded-lg font-mono text-sm text-slate-200 max-h-56 overflow-y-auto leading-relaxed">
      <div className="text-xs uppercase tracking-widest text-slate-500 mb-2 font-sans">
        {NODE_LABELS[node] ?? node}
      </div>
      <div className={done ? '' : 'streaming-cursor'}>{content}</div>
    </div>
  )
}
