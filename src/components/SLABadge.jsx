const SLA_CONFIG = {
  ok:       { label: 'SLA cumpliendo', bg: 'rgba(48,209,88,0.12)',  color: '#30d158', border: 'rgba(48,209,88,0.2)' },
  at_risk:  { label: 'SLA en riesgo',  bg: 'rgba(255,159,10,0.12)', color: '#ff9f0a', border: 'rgba(255,159,10,0.2)' },
  breach:   { label: 'SLA incumpliendo', bg: 'rgba(255,69,58,0.12)', color: '#ff453a', border: 'rgba(255,69,58,0.2)' },
}

export default function SLABadge({ status }) {
  if (!status) return null
  const config = SLA_CONFIG[status] || SLA_CONFIG.ok
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
