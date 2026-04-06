const STATUS_CONFIG = {
  on_track: {
    label: 'On track',
    bg: 'rgba(16, 185, 129, 0.1)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.25)',
  },
  at_risk: {
    label: 'At risk',
    bg: 'rgba(245, 158, 11, 0.1)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  blocked: {
    label: 'Blocked',
    bg: 'rgba(239, 68, 68, 0.1)',
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.25)',
  },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.on_track

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}` }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  )
}
