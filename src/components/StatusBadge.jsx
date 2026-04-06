const STATUS_CONFIG = {
  on_track: {
    label: 'On track',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-400',
  },
  at_risk: {
    label: 'At risk',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    dot: 'bg-amber-400',
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-red-500/15 text-red-400 border-red-500/20',
    dot: 'bg-red-400',
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.on_track

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}
