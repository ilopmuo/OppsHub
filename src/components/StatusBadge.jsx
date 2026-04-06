const STATUS_CONFIG = {
  on_track: {
    label: 'On track',
    bg: 'rgba(48, 209, 88, 0.12)',
    color: '#30d158',
    border: 'rgba(48, 209, 88, 0.2)',
  },
  at_risk: {
    label: 'At risk',
    bg: 'rgba(255, 159, 10, 0.12)',
    color: '#ff9f0a',
    border: 'rgba(255, 159, 10, 0.2)',
  },
  blocked: {
    label: 'Blocked',
    bg: 'rgba(255, 69, 58, 0.12)',
    color: '#ff453a',
    border: 'rgba(255, 69, 58, 0.2)',
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.on_track
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  )
}
