interface SpinnerProps {
  message?: string
}

export default function Spinner({ message = 'Loading…' }: SpinnerProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-50">
      <div className="w-12 h-12 border-4 border-white/25 border-t-white rounded-full animate-spin" />
      <p className="text-white text-sm font-medium">{message}</p>
    </div>
  )
}
