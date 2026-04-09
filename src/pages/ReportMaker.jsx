import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import NavBar from '../components/NavBar'
import { Plus, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Geo helpers ───────────────────────────────────────────────────────────────
function polar(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
function arc(cx, cy, r, a1, a2) {
  if (a2 - a1 >= 360) a2 = a1 + 359.99
  const s = polar(cx, cy, r, a1), e = polar(cx, cy, r, a2)
  return `M${s.x.toFixed(2)},${s.y.toFixed(2)} A${r},${r} 0 ${a2 - a1 > 180 ? 1 : 0},1 ${e.x.toFixed(2)},${e.y.toFixed(2)}`
}
function fmtCur(n, cur = '€') {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M${cur}`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k${cur}`
  return `${n}${cur}`
}

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'jira_sprint',    label: 'Jira Sprint',        desc: 'Tickets completados, en progreso y bloqueados por sprint', icon: '◎', accent: '#64d2ff' },
  { id: 'profitability',  label: 'Rentabilidad',        desc: 'Presupuesto, costes, ingresos y margen neto del proyecto',  icon: '◈', accent: '#30d158' },
  { id: 'hours',          label: 'Horas invertidas',    desc: 'Distribución de horas por fase o disciplina',              icon: '◷', accent: '#bf5af2' },
  { id: 'client_health',  label: 'Client Health',       desc: 'NPS, SLA, tickets abiertos y riesgo de churn',            icon: '◉', accent: '#ff453a' },
  { id: 'velocity',       label: 'Sprint Velocity',     desc: 'Story points comprometidos vs completados por sprint',     icon: '◬', accent: '#ff9f0a' },
  { id: 'project_status', label: 'Estado del proyecto', desc: 'Milestones, avance por fase y estado RAG del proyecto',   icon: '◫', accent: '#f5f5f7' },
]

// ── Shared styles ─────────────────────────────────────────────────────────────
const INPUT = {
  width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '8px 11px', fontSize: 13, color: '#f5f5f7',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}
const LABEL = { fontSize: 11, fontWeight: 600, color: '#6e6e73', display: 'block', marginBottom: 4 }
const SEC   = { fontSize: 9, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 12, ...style }}>
      {label && <label style={LABEL}>{label}</label>}
      {children}
    </div>
  )
}

// ── Visualizations ────────────────────────────────────────────────────────────

function JiraViz({ data }) {
  const total = data.total || 0
  const done  = Math.min(data.completed  || 0, total)
  const prog  = Math.min(data.in_progress|| 0, total - done)
  const block = Math.min(data.blocked    || 0, total - done - prog)
  const pct   = total > 0 ? Math.round(done / total * 100) : 0
  const C     = 2 * Math.PI * 38

  const segs = [
    { val: done,  color: '#30d158' },
    { val: prog,  color: '#ff9f0a' },
    { val: block, color: '#ff453a' },
  ]
  let off = 0
  const cats = [
    { label: 'Features',   val: data.features  || 0, color: '#64d2ff' },
    { label: 'Bugs',       val: data.bugs       || 0, color: '#ff453a' },
    { label: 'Tech debt',  val: data.tech_debt  || 0, color: '#bf5af2' },
    { label: 'Tareas',     val: data.tasks      || 0, color: '#f5f5f7' },
  ].filter(c => c.val > 0)
  const cTotal = cats.reduce((a, c) => a + c.val, 0) || 1

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0 }}>
        <svg width="96" height="96">
          <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
          {total > 0 && segs.map((s, i) => {
            const len = (s.val / total) * C
            const el = (
              <circle key={i} cx="48" cy="48" r="38" fill="none"
                stroke={s.color} strokeWidth="11"
                strokeDasharray={`${len} ${C}`}
                strokeDashoffset={-off}
                transform="rotate(-90 48 48)"
              />
            )
            off += len
            return el
          })}
          <circle cx="48" cy="48" r="28" fill="#111" />
          <text x="48" y="44" textAnchor="middle" fontSize="17" fontWeight="800" fill="#f5f5f7">{pct}%</text>
          <text x="48" y="56" textAnchor="middle" fontSize="7" fill="#6e6e73">completado</text>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {[
          { label: 'Completados', val: done,  color: '#30d158' },
          { label: 'En progreso', val: prog,  color: '#ff9f0a' },
          { label: 'Bloqueados',  val: block, color: '#ff453a' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#6e6e73' }}>{label}</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f7' }}>{val}</span>
          </div>
        ))}

        {cats.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p style={SEC}>Por tipo</p>
            {cats.map(c => (
              <div key={c.label} style={{ marginBottom: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 10, color: '#4a4a4a' }}>{c.label}</span>
                  <span style={{ fontSize: 10, color: '#4a4a4a', fontWeight: 600 }}>{c.val}</span>
                </div>
                <div style={{ height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <div style={{ height: '100%', width: `${c.val / cTotal * 100}%`, borderRadius: 2, backgroundColor: c.color, opacity: 0.7, transition: 'width 0.4s' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProfitabilityViz({ data }) {
  const { currency = '€', budget = 0, revenue = 0, cost_team = 0, cost_tools = 0, cost_other = 0 } = data
  const cost      = cost_team + cost_tools + cost_other
  const margin    = revenue - cost
  const mPct      = revenue > 0 ? Math.round(margin / revenue * 100) : 0
  const bPct      = budget > 0 ? Math.min(Math.round(cost / budget * 100), 100) : 0
  const mColor    = margin >= 0 ? '#30d158' : '#ff453a'
  const costItems = [
    { label: 'Equipo', val: cost_team, color: '#64d2ff' },
    { label: 'Herramientas', val: cost_tools, color: '#bf5af2' },
    { label: 'Otros', val: cost_other, color: '#6e6e73' },
  ].filter(c => c.val > 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Ingresos', val: fmtCur(revenue, currency), color: '#f5f5f7' },
          { label: 'Costes',   val: fmtCur(cost, currency),    color: '#f5f5f7' },
          { label: 'Margen',   val: (margin >= 0 ? '+' : '') + fmtCur(margin, currency), color: mColor },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
            <p style={{ fontSize: 9, color: '#4a4a4a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: 800, color, lineHeight: 1 }}>{val}</p>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <p style={SEC}>Margen neto</p>
          <span style={{ fontSize: 9, color: '#4a4a4a' }}>Presupuesto usado {bPct}%</span>
        </div>
        <div style={{ height: 5, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(Math.abs(mPct), 100)}%`, borderRadius: 5, backgroundColor: mColor, opacity: 0.8, transition: 'width 0.5s' }} />
        </div>
        <p style={{ fontSize: 10, color: '#6e6e73', marginTop: 3 }}>{mPct}% de margen</p>
      </div>

      {costItems.length > 0 && (
        <div>
          <p style={SEC}>Desglose de costes</p>
          {costItems.map(c => (
            <div key={c.label} style={{ marginBottom: 7 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: '#6e6e73' }}>{c.label}</span>
                <span style={{ fontSize: 11, color: '#f5f5f7', fontWeight: 600 }}>{fmtCur(c.val, currency)}</span>
              </div>
              <div style={{ height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <div style={{ height: '100%', width: `${c.val / Math.max(cost, 1) * 100}%`, borderRadius: 3, backgroundColor: c.color, opacity: 0.75, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HoursViz({ data }) {
  const PHASES = [
    { key: 'discovery',   label: 'Discovery',    color: '#64d2ff' },
    { key: 'design',      label: 'Diseño',        color: '#bf5af2' },
    { key: 'development', label: 'Desarrollo',    color: '#30d158' },
    { key: 'qa',          label: 'QA / Testing',  color: '#ff9f0a' },
    { key: 'meetings',    label: 'Reuniones',     color: '#ff453a' },
    { key: 'management',  label: 'Gestión',       color: '#f5f5f7' },
    { key: 'other',       label: 'Otros',         color: '#6e6e73' },
  ]
  const items = PHASES.map(p => ({ ...p, val: data[p.key] || 0 })).filter(p => p.val > 0)
  const total = items.reduce((a, p) => a + p.val, 0)
  const max   = Math.max(...items.map(p => p.val), 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: '#f5f5f7', letterSpacing: '-0.03em', lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: 12, color: '#4a4a4a', fontWeight: 500 }}>horas totales</span>
      </div>

      {items.length === 0 && <p style={{ fontSize: 11, color: '#3a3a3a', textAlign: 'center', padding: '12px 0' }}>Sin horas registradas</p>}
      {items.map(p => (
        <div key={p.key} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: p.color }} />
              <span style={{ fontSize: 11, color: '#6e6e73' }}>{p.label}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#f5f5f7', fontWeight: 600 }}>{p.val}h</span>
              <span style={{ fontSize: 10, color: '#3a3a3a' }}>{Math.round(p.val / total * 100)}%</span>
            </div>
          </div>
          <div style={{ height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <div style={{ height: '100%', width: `${p.val / max * 100}%`, borderRadius: 3, backgroundColor: p.color, opacity: 0.8, transition: 'width 0.5s' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ClientHealthViz({ data }) {
  const { nps = 0, sla = 0, open_tickets = 0, escalations = 0, churn_risk = 'Bajo' } = data
  const npsColor   = nps >= 50 ? '#30d158' : nps >= 0 ? '#ff9f0a' : '#ff453a'
  const slaColor   = sla >= 95 ? '#30d158' : sla >= 80 ? '#ff9f0a' : '#ff453a'
  const churnColor = churn_risk === 'Bajo' ? '#30d158' : churn_risk === 'Medio' ? '#ff9f0a' : '#ff453a'

  // NPS semi-arc: left=-100, right=+100 → 180° sweep
  const CX = 60, CY = 54, R = 42
  const npsAngle  = ((nps + 100) / 200) * 180 // 0–180
  const bgPath    = arc(CX, CY, R, 180, 360)
  const fillAngle = 180 + Math.min(npsAngle, 179.99)
  const fillPath  = npsAngle > 0 ? arc(CX, CY, R, 180, fillAngle) : null

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <svg width="120" height="66" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
          <path d={bgPath} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" strokeLinecap="round" />
          {fillPath && <path d={fillPath} fill="none" stroke={npsColor} strokeWidth="9" strokeLinecap="round" />}
          <text x={CX} y={CY + 2} textAnchor="middle" fontSize="17" fontWeight="800" fill={npsColor}>{nps}</text>
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="8" fill="#3a3a3a">NPS</text>
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'SLA',           val: `${sla}%`,      color: slaColor,                                                          sub: 'cumplimiento' },
          { label: 'Tickets',       val: open_tickets,   color: open_tickets > 10 ? '#ff453a' : open_tickets > 5 ? '#ff9f0a' : '#30d158', sub: 'abiertos' },
          { label: 'Escalaciones',  val: escalations,    color: escalations > 2 ? '#ff453a' : escalations > 0 ? '#ff9f0a' : '#30d158', sub: 'este mes' },
          { label: 'Churn risk',    val: churn_risk,     color: churnColor,                                                        sub: 'evaluación' },
        ].map(({ label, val, color, sub }) => (
          <div key={label} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px' }}>
            <p style={{ fontSize: 9, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
            <p style={{ fontSize: 15, fontWeight: 800, color, lineHeight: 1, marginBottom: 2 }}>{val}</p>
            <p style={{ fontSize: 9, color: '#3a3a3a' }}>{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function VelocityViz({ data }) {
  const sprints = data.sprints || []
  if (!sprints.length) return <p style={{ fontSize: 11, color: '#3a3a3a', textAlign: 'center', padding: '20px 0' }}>Sin sprints añadidos</p>

  const maxVal = Math.max(...sprints.flatMap(s => [s.committed || 0, s.completed || 0]), 1)
  const avgDone = Math.round(sprints.reduce((a, s) => a + (s.completed || 0), 0) / sprints.length)
  const avgRate = Math.round(sprints.reduce((a, s) => a + (s.committed > 0 ? (s.completed || 0) / s.committed : 0), 0) / sprints.length * 100)
  const rateColor = avgRate >= 80 ? '#30d158' : avgRate >= 60 ? '#ff9f0a' : '#ff453a'

  const W = 320, H = 84, PAD = { t: 8, r: 6, b: 20, l: 24 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b
  const gW = cW / sprints.length
  const bW = Math.min((gW - 6) / 2, 18)

  return (
    <div>
      <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
        <div>
          <p style={SEC}>Velocidad media</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: '#f5f5f7', lineHeight: 1 }}>{avgDone}</span>
            <span style={{ fontSize: 11, color: '#4a4a4a' }}>SP</span>
          </div>
        </div>
        <div>
          <p style={SEC}>Tasa media</p>
          <span style={{ fontSize: 24, fontWeight: 800, color: rateColor, lineHeight: 1 }}>{avgRate}%</span>
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <rect x={PAD.l} y={PAD.t} width={8} height={5} rx="1" fill="rgba(255,255,255,0.15)" />
        <text x={PAD.l + 10} y={PAD.t + 4} fontSize="7" fill="#3a3a3a">Comprometidos</text>
        <rect x={PAD.l + 88} y={PAD.t} width={8} height={5} rx="1" fill="#30d158" opacity="0.7" />
        <text x={PAD.l + 98} y={PAD.t + 4} fontSize="7" fill="#3a3a3a">Completados</text>

        {[0, Math.round(maxVal / 2), maxVal].map((v, i) => {
          const y = PAD.t + cH - (v / maxVal) * cH + 12
          return <text key={i} x={PAD.l - 4} y={y} textAnchor="end" fontSize="7" fill="#3a3a3a">{v}</text>
        })}

        {sprints.map((s, i) => {
          const cx    = PAD.l + i * gW + gW / 2
          const cH2   = (s.committed || 0) / maxVal * cH
          const dH    = (s.completed || 0) / maxVal * cH
          const ok    = (s.completed || 0) >= (s.committed || 0)
          return (
            <g key={i}>
              <rect x={cx - bW - 1} y={PAD.t + 12 + cH - cH2} width={bW} height={cH2} rx="2" fill="rgba(255,255,255,0.12)" />
              <rect x={cx + 1}      y={PAD.t + 12 + cH - dH}  width={bW} height={dH}  rx="2" fill={ok ? '#30d158' : '#ff9f0a'} opacity="0.8" />
              <text x={cx} y={H - 4} textAnchor="middle" fontSize="7" fill="#3a3a3a">
                {s.name?.replace('Sprint ', 'S') || `S${i + 1}`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ProjectStatusViz({ data }) {
  const { status = 'En marcha', milestones = [] } = data
  const sColor = status === 'En marcha' ? '#30d158' : status === 'En riesgo' ? '#ff9f0a' : '#ff453a'
  const total  = milestones.length > 0
    ? Math.round(milestones.reduce((a, m) => a + (m.pct || 0), 0) / milestones.length)
    : 0
  const msColor = s => s === 'Completado' ? '#30d158' : s === 'En marcha' ? '#64d2ff' : s === 'En riesgo' ? '#ff9f0a' : s === 'Retrasado' ? '#ff453a' : '#3a3a3a'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={SEC}>Progreso global</p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#f5f5f7', letterSpacing: '-0.02em', lineHeight: 1 }}>{total}%</span>
            <span style={{ fontSize: 11, color: '#4a4a4a' }}>{milestones.length} fases</span>
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, backgroundColor: `${sColor}14`, borderRadius: 8, padding: '5px 9px', border: `1px solid ${sColor}28` }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: sColor }} />
          <span style={{ fontSize: 10, color: sColor, fontWeight: 600 }}>{status}</span>
        </div>
      </div>

      <div style={{ height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${total}%`, borderRadius: 4, backgroundColor: sColor, opacity: 0.7, transition: 'width 0.5s' }} />
      </div>

      {milestones.length === 0 && <p style={{ fontSize: 11, color: '#3a3a3a', textAlign: 'center', padding: '8px 0' }}>Sin milestones</p>}
      {milestones.map((m, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: msColor(m.status), flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: '#f5f5f7' }}>{m.name}</span>
            </div>
            <span style={{ fontSize: 10, color: '#4a4a4a' }}>{m.pct || 0}%</span>
          </div>
          <div style={{ height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <div style={{ height: '100%', width: `${m.pct || 0}%`, borderRadius: 2, backgroundColor: msColor(m.status), opacity: 0.75 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Forms ─────────────────────────────────────────────────────────────────────

function JiraForm({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div>
      <Field label="Período (ej: Abril 2026)">
        <input style={INPUT} value={data.period || ''} onChange={e => set('period', e.target.value)} placeholder="Abril 2026" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 12 }}>
        {[['total', 'Total tickets'], ['completed', 'Completados'], ['in_progress', 'En progreso'], ['blocked', 'Bloqueados']].map(([k, l]) => (
          <div key={k}>
            <label style={LABEL}>{l}</label>
            <input style={INPUT} type="number" min="0" value={data[k] || ''} onChange={e => set(k, +e.target.value)} placeholder="0" />
          </div>
        ))}
      </div>
      <p style={SEC}>Por tipo (opcional)</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {[['features', 'Features'], ['bugs', 'Bugs'], ['tech_debt', 'Deuda técnica'], ['tasks', 'Tareas']].map(([k, l]) => (
          <div key={k}>
            <label style={LABEL}>{l}</label>
            <input style={INPUT} type="number" min="0" value={data[k] || ''} onChange={e => set(k, +e.target.value)} placeholder="0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ProfitabilityForm({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 10 }}>
        <Field label="Cliente">
          <input style={INPUT} value={data.client || ''} onChange={e => set('client', e.target.value)} placeholder="Acme Corp" />
        </Field>
        <Field label="Moneda">
          <select style={INPUT} value={data.currency || '€'} onChange={e => set('currency', e.target.value)}>
            <option>€</option><option>$</option><option>£</option>
          </select>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Presupuesto">
          <input style={INPUT} type="number" min="0" value={data.budget || ''} onChange={e => set('budget', +e.target.value)} placeholder="0" />
        </Field>
        <Field label="Ingresos">
          <input style={INPUT} type="number" min="0" value={data.revenue || ''} onChange={e => set('revenue', +e.target.value)} placeholder="0" />
        </Field>
      </div>
      <p style={SEC}>Costes</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[['cost_team', 'Equipo'], ['cost_tools', 'Herramientas'], ['cost_other', 'Otros']].map(([k, l]) => (
          <div key={k}>
            <label style={LABEL}>{l}</label>
            <input style={INPUT} type="number" min="0" value={data[k] || ''} onChange={e => set(k, +e.target.value)} placeholder="0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function HoursForm({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Cliente">
          <input style={INPUT} value={data.client || ''} onChange={e => set('client', e.target.value)} placeholder="Acme Corp" />
        </Field>
        <Field label="Período">
          <input style={INPUT} value={data.period || ''} onChange={e => set('period', e.target.value)} placeholder="Q1 2026" />
        </Field>
      </div>
      <p style={SEC}>Horas por fase</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[['discovery','Discovery'],['design','Diseño'],['development','Desarrollo'],['qa','QA / Testing'],['meetings','Reuniones'],['management','Gestión'],['other','Otros']].map(([k, l]) => (
          <div key={k}>
            <label style={LABEL}>{l} (h)</label>
            <input style={INPUT} type="number" min="0" value={data[k] || ''} onChange={e => set(k, +e.target.value)} placeholder="0" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ClientHealthForm({ data, onChange }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div>
      <Field label="Cliente">
        <input style={INPUT} value={data.client || ''} onChange={e => set('client', e.target.value)} placeholder="Acme Corp" />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={LABEL}>NPS (−100 a 100)</label>
          <input style={INPUT} type="number" min="-100" max="100" value={data.nps ?? ''} onChange={e => set('nps', +e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={LABEL}>SLA Compliance (%)</label>
          <input style={INPUT} type="number" min="0" max="100" value={data.sla ?? ''} onChange={e => set('sla', +e.target.value)} placeholder="95" />
        </div>
        <div>
          <label style={LABEL}>Tickets abiertos</label>
          <input style={INPUT} type="number" min="0" value={data.open_tickets ?? ''} onChange={e => set('open_tickets', +e.target.value)} placeholder="0" />
        </div>
        <div>
          <label style={LABEL}>Escalaciones (mes)</label>
          <input style={INPUT} type="number" min="0" value={data.escalations ?? ''} onChange={e => set('escalations', +e.target.value)} placeholder="0" />
        </div>
      </div>
      <Field label="Riesgo de churn" style={{ marginTop: 10 }}>
        <select style={INPUT} value={data.churn_risk || 'Bajo'} onChange={e => set('churn_risk', e.target.value)}>
          <option>Bajo</option><option>Medio</option><option>Alto</option>
        </select>
      </Field>
    </div>
  )
}

function VelocityForm({ data, onChange }) {
  const sprints = data.sprints || []
  const set = (k, v) => onChange({ ...data, [k]: v })
  const addSprint = () => set('sprints', [...sprints, { name: `Sprint ${sprints.length + 1}`, committed: 0, completed: 0 }])
  const remove = i => set('sprints', sprints.filter((_, j) => j !== i))
  const update = (i, k, v) => set('sprints', sprints.map((s, j) => j === i ? { ...s, [k]: v } : s))

  return (
    <div>
      <Field label="Proyecto">
        <input style={INPUT} value={data.project || ''} onChange={e => set('project', e.target.value)} placeholder="Portal B2B" />
      </Field>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={SEC}>Sprints</p>
        <button onClick={addSprint} style={{ fontSize: 11, color: '#64d2ff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>+ Añadir sprint</button>
      </div>
      {sprints.length === 0 && <p style={{ fontSize: 11, color: '#3a3a3a', textAlign: 'center', padding: '12px 0' }}>Añade al menos un sprint</p>}
      {sprints.map((s, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input style={INPUT} value={s.name} onChange={e => update(i, 'name', e.target.value)} placeholder={`Sprint ${i + 1}`} />
          <input style={{ ...INPUT, textAlign: 'center' }} type="number" min="0" value={s.committed || ''} onChange={e => update(i, 'committed', +e.target.value)} placeholder="Comp." />
          <input style={{ ...INPUT, textAlign: 'center' }} type="number" min="0" value={s.completed || ''} onChange={e => update(i, 'completed', +e.target.value)} placeholder="Compl." />
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff453a', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

function ProjectStatusForm({ data, onChange }) {
  const ms = data.milestones || []
  const set = (k, v) => onChange({ ...data, [k]: v })
  const addMs = () => set('milestones', [...ms, { name: '', pct: 0, status: 'Pendiente' }])
  const remove = i => set('milestones', ms.filter((_, j) => j !== i))
  const update = (i, k, v) => set('milestones', ms.map((m, j) => j === i ? { ...m, [k]: v } : m))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Cliente">
          <input style={INPUT} value={data.client || ''} onChange={e => set('client', e.target.value)} placeholder="Acme Corp" />
        </Field>
        <Field label="Estado general">
          <select style={INPUT} value={data.status || 'En marcha'} onChange={e => set('status', e.target.value)}>
            <option>En marcha</option><option>En riesgo</option><option>Retrasado</option>
          </select>
        </Field>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={SEC}>Milestones</p>
        <button onClick={addMs} style={{ fontSize: 11, color: '#64d2ff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>+ Añadir milestone</button>
      </div>
      {ms.length === 0 && <p style={{ fontSize: 11, color: '#3a3a3a', textAlign: 'center', padding: '12px 0' }}>Añade al menos un milestone</p>}
      {ms.map((m, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input style={INPUT} value={m.name} onChange={e => update(i, 'name', e.target.value)} placeholder="Nombre de la fase" />
          <input style={{ ...INPUT, textAlign: 'center' }} type="number" min="0" max="100" value={m.pct || ''} onChange={e => update(i, 'pct', +e.target.value)} placeholder="%" />
          <select style={INPUT} value={m.status} onChange={e => update(i, 'status', e.target.value)}>
            <option>Pendiente</option><option>En marcha</option><option>En riesgo</option><option>Retrasado</option><option>Completado</option>
          </select>
          <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff453a', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────────

function Modal({ children, onClose, wide }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        backgroundColor: '#111', borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        width: '100%', maxWidth: wide ? 660 : 480,
        maxHeight: '88vh', overflow: 'auto',
        boxShadow: '0 40px 120px rgba(0,0,0,0.9)',
      }}>
        {children}
      </div>
    </div>
  )
}

function TemplatePicker({ onSelect, onClose }) {
  return (
    <Modal onClose={onClose} wide>
      <div style={{ padding: '22px 24px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f5f5f7', marginBottom: 2 }}>Nuevo report</h2>
          <p style={{ fontSize: 12, color: '#6e6e73' }}>Elige una plantilla para empezar</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', display: 'flex' }}>
          <X size={18} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '4px 24px 24px' }}>
        {TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            style={{
              textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '16px 18px',
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = `${t.accent}44` }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${t.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
                {t.icon}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f7' }}>{t.label}</span>
            </div>
            <p style={{ fontSize: 11, color: '#4a4a4a', lineHeight: 1.45 }}>{t.desc}</p>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function DataEntryModal({ template, onClose, onSaved }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [data, setData] = useState({})
  const [saving, setSaving] = useState(false)

  const FORM = {
    jira_sprint:    <JiraForm data={data} onChange={setData} />,
    profitability:  <ProfitabilityForm data={data} onChange={setData} />,
    hours:          <HoursForm data={data} onChange={setData} />,
    client_health:  <ClientHealthForm data={data} onChange={setData} />,
    velocity:       <VelocityForm data={data} onChange={setData} />,
    project_status: <ProjectStatusForm data={data} onChange={setData} />,
  }

  async function save() {
    if (!title.trim()) { toast.error('Añade un título'); return }
    setSaving(true)
    const { error } = await supabase.from('reports').insert({
      user_id: user.id, type: template.id, title: title.trim(), data,
    })
    setSaving(false)
    if (error) { toast.error('Error al guardar'); return }
    toast.success('Report creado')
    onSaved()
    onClose()
  }

  return (
    <Modal onClose={onClose} wide>
      <div style={{ padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: `${template.accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {template.icon}
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7' }}>{template.label}</h2>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6e6e73', display: 'flex' }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: '18px 24px' }}>
        <div style={{ marginBottom: 18 }}>
          <label style={LABEL}>Título del report</label>
          <input
            style={{ ...INPUT, fontSize: 14, fontWeight: 600, padding: '9px 12px' }}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`${template.label} — ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`}
            autoFocus
          />
        </div>
        {FORM[template.id]}
      </div>

      <div style={{ padding: '14px 24px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={onClose}
          style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#6e6e73', fontSize: 13, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}
        >Cancelar</button>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: '8px 22px', borderRadius: 10, border: 'none', background: '#f5f5f7', color: '#000', fontSize: 13, cursor: saving ? 'default' : 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1, fontFamily: 'inherit' }}
        >{saving ? 'Guardando…' : 'Crear report'}</button>
      </div>
    </Modal>
  )
}

// ── Report card ───────────────────────────────────────────────────────────────

function ReportCard({ report, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const tmpl = TEMPLATES.find(t => t.id === report.type)

  const VIZ = {
    jira_sprint:    <JiraViz data={report.data} />,
    profitability:  <ProfitabilityViz data={report.data} />,
    hours:          <HoursViz data={report.data} />,
    client_health:  <ClientHealthViz data={report.data} />,
    velocity:       <VelocityViz data={report.data} />,
    project_status: <ProjectStatusViz data={report.data} />,
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: '#111', borderRadius: 16,
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
        overflow: 'hidden', transition: 'border-color 0.2s',
      }}
    >
      {/* Header */}
      <div style={{ padding: '15px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: tmpl?.accent || '#6e6e73' }} />
            <span style={{ fontSize: 9, color: '#3a3a3a', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tmpl?.label}</span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f7', lineHeight: 1.2, marginBottom: 3 }}>{report.title}</h3>
          <p style={{ fontSize: 10, color: '#3a3a3a' }}>
            {new Date(report.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => onDelete(report)}
          style={{
            width: 26, height: 26, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.06)', border: 'none', cursor: 'pointer', color: '#3a3a3a',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.15s, color 0.15s, background-color 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ff453a'; e.currentTarget.style.backgroundColor = 'rgba(255,69,58,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 18px' }}>
        {VIZ[report.type]}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportMaker() {
  const { user } = useAuth()
  const [reports, setReports]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [showPicker, setShowPicker]         = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => { fetchReports() }, []) // eslint-disable-line

  async function fetchReports() {
    setLoading(true)
    const { data } = await supabase
      .from('reports').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setReports(data || [])
    setLoading(false)
  }

  async function deleteReport(report) {
    if (!confirm(`¿Eliminar "${report.title}"?`)) return
    const { error } = await supabase.from('reports').delete().eq('id', report.id)
    if (!error) {
      setReports(p => p.filter(r => r.id !== report.id))
      toast.success('Report eliminado')
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000' }}>
      <NavBar />

      <main className="max-w-[1400px] mx-auto px-6 py-10 page-enter">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>Reports</p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>Report Maker</h1>
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
            style={{ backgroundColor: '#f5f5f7', color: '#000' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
          >
            <Plus className="w-4 h-4" /> Nuevo report
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-2xl" style={{ height: 280 }} />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-12 h-12 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ backgroundColor: '#1a1a1a' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6e6e73" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <path d="M9 9h6M9 12h6M9 15h4"/>
              </svg>
            </div>
            <p className="font-semibold mb-1.5 text-sm" style={{ color: '#f5f5f7' }}>Sin reports todavía</p>
            <p className="text-sm mb-7" style={{ color: '#6e6e73' }}>Crea tu primer report para visualizar métricas de proyecto</p>
            <button
              onClick={() => setShowPicker(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#f5f5f7', color: '#000' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fff'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f5f5f7'}
            ><Plus className="w-4 h-4" /> Crear report</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12 }}>
            {reports.map(r => (
              <ReportCard key={r.id} report={r} onDelete={deleteReport} />
            ))}
          </div>
        )}
      </main>

      {showPicker && (
        <TemplatePicker
          onSelect={t => { setSelectedTemplate(t); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {selectedTemplate && (
        <DataEntryModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onSaved={fetchReports}
        />
      )}
    </div>
  )
}
