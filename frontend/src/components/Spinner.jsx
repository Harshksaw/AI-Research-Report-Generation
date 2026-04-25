export default function Spinner({ message = 'Loading…' }) {
  return (
    <div className="spinner-overlay">
      <div className="spinner" />
      <p className="spinner-text">{message}</p>
    </div>
  )
}
