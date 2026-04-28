import { Check, Loader2 } from 'lucide-react'

const NODE_LABELS: Record<string, string> = {
  create_analyst:    'Creating research analysts',
  conduct_interview: 'Conducting interviews',
  write_report:      'Writing main report',
  write_introduction:'Writing introduction',
  write_conclusion:  'Writing conclusion',
  finalize_report:   'Finalizing report',
}

interface ProgressTrackerProps {
  steps: string[]
  completed: Set<string>
}

export default function ProgressTracker({ steps, completed }: ProgressTrackerProps) {
  const firstPending = steps.find((s) => !completed.has(s))

  return (
    <div className="flex flex-col gap-2.5 my-5 p-5 bg-slate-50 border border-border rounded-xl">
      {steps.map((stepId) => {
        const isDone   = completed.has(stepId)
        const isActive = stepId === firstPending && !isDone
        return (
          <div
            key={stepId}
            className={`flex items-center gap-3 text-sm transition-colors ${
              isDone   ? 'text-green-600' :
              isActive ? 'text-primary font-medium' :
                         'text-muted-foreground'
            }`}
          >
            <span className={`flex items-center justify-center w-5 h-5 rounded-full shrink-0 transition-colors ${
              isDone   ? 'bg-green-500 text-white' :
              isActive ? 'bg-primary text-white' :
                         'bg-border'
            }`}>
              {isDone   && <Check size={11} strokeWidth={3} />}
              {isActive && <Loader2 size={11} className="animate-spin" />}
            </span>
            <span>{NODE_LABELS[stepId] ?? stepId}</span>
          </div>
        )
      })}
    </div>
  )
}
