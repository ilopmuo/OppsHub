import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
} from 'recharts'

/* ── palette ── */
const STATUS_COLOR = { on_track: '#30d158', at_risk: '#ff9f0a', blocked: '#ff453a' }
const STATUS_LABEL = { on_track: 'On track', at_risk: 'En riesgo', blocked: 'Bloqueado' }
const PRIORITY_COLOR = { high: '#ff453a', medium: '#ff9f0a', low: '#6e6e73' }
const TASK_STATUS_COLOR = { backlog: '#3a3a3a', todo: '#6e6e73', in_progress: '#64d2ff', done: '#30d158' }
const TASK_STATUS_LABEL = { backlog: 'Backlog', todo: 'Por hacer', in_progress: 'En progreso', done: 'Hecho' }

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1a1a',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  color: '#f5f5f7',
  fontSize: 12,
  padding: '6px 10px',
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#3a3a3a' }}>
      {children}
    </h3>
  )
}

function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {children}
    </div>
  )
}

/* ── Custom donut label ── */
function DonutLabel({ cx, cy, total, label }) {
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#f5f5f7" fontSize={22} fontWeight={700}>
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#6e6e73" fontSize={11}>
        {label}
      </text>
    </g>
  )
}

/* ── Custom tooltip ── */
function CustomTooltip({ active, payload, labelKey }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={TOOLTIP_STYLE}>
      <span style={{ color: '#6e6e73' }}>{labelKey ? labelKey[name] || name : name} </span>
      <span style={{ color: '#f5f5f7', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

export default function ProjectReports({ projects }) {
  if (!projects || projects.length === 0) return null

  const allTasks = projects.flatMap(p => p.tasks || [])

  /* ── 1. Estado de proyectos ── */
  const statusData = ['on_track', 'at_risk', 'blocked']
    .map(s => ({ name: s, value: projects.filter(p => p.status === s).length }))
    .filter(d => d.value > 0)

  /* ── 2. Tipo de proyecto ── */
  const impl  = projects.filter(p => p.type !== 'maintenance').length
  const maint = projects.filter(p => p.type === 'maintenance').length
  const typeData = [
    { name: 'Implementación', value: impl,  color: '#64d2ff' },
    { name: 'Mantenimiento',  value: maint, color: '#bf5af2' },
  ].filter(d => d.value > 0)

  /* ── 3. Tareas por estado ── */
  const taskStatusData = ['backlog', 'todo', 'in_progress', 'done'].map(s => ({
    name: s,
    value: allTasks.filter(t => t.status === s).length,
  })).filter(d => d.value > 0)

  /* ── 4. Prioridad de tareas ── */
  const priorityData = ['high', 'medium', 'low'].map(p => ({
    name: p,
    Tareas: allTasks.filter(t => t.priority === p && t.status !== 'done').length,
  })).filter(d => d.Tareas > 0)

  /* ── 5. Progreso por proyecto (top 8) ── */
  const progressData = projects
    .map(p => {
      const total = (p.tasks || []).length
      const done  = (p.tasks || []).filter(t => t.status === 'done').length
      return { name: p.name.length > 20 ? p.name.slice(0, 18) + '…' : p.name, pct: total ? Math.round(done / total * 100) : 0, total }
    })
    .filter(p => p.total > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8)

  /* ── 6. Completion rate radial ── */
  const globalDone    = allTasks.filter(t => t.status === 'done').length
  const globalTotal   = allTasks.length
  const globalPct     = globalTotal > 0 ? Math.round(globalDone / globalTotal * 100) : 0
  const radialData    = [{ name: 'Completadas', value: globalPct, fill: globalPct === 100 ? '#30d158' : '#64d2ff' }]

  /* ── 7. Overdue ── */
  const today = new Date()
  const overdueCount = projects.filter(p => {
    const d = p.deadline || p.renewal_date
    return d && new Date(d + 'T00:00:00') < today
  }).length

  const onTrackCount  = projects.filter(p => p.status === 'on_track').length
  const healthPct     = projects.length ? Math.round(onTrackCount / projects.length * 100) : 0

  return (
    <div className="mt-16">
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#3a3a3a' }}>Analíticas</p>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: '#f5f5f7', letterSpacing: '-0.02em' }}>
            Project Reports
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: '#6e6e73' }}>
          <span>{allTasks.length} tareas en total</span>
          <span style={{ color: '#3a3a3a' }}>·</span>
          <span>{projects.length} proyecto{projects.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Row 1 — KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {[
          { label: 'Completación global', value: `${globalPct}%`, color: globalPct >= 75 ? '#30d158' : globalPct >= 40 ? '#ff9f0a' : '#ff453a' },
          { label: 'Salud del portfolio', value: `${healthPct}%`, color: healthPct >= 75 ? '#30d158' : healthPct >= 50 ? '#ff9f0a' : '#ff453a' },
          { label: 'Tareas completadas', value: `${globalDone}/${globalTotal}`, color: '#f5f5f7' },
          { label: 'Proyectos vencidos',  value: overdueCount, color: overdueCount > 0 ? '#ff453a' : '#30d158' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <p className="text-xs mb-2" style={{ color: '#6e6e73' }}>{label}</p>
            <p className="text-2xl font-bold tracking-tight" style={{ color, letterSpacing: '-0.02em' }}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Row 2 — Donuts + progress bar */}
      <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-3 mb-3">

        {/* Donut estado */}
        <Card>
          <SectionTitle>Estado de proyectos</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={72}
                dataKey="value" paddingAngle={3} stroke="none">
                {statusData.map(d => <Cell key={d.name} fill={STATUS_COLOR[d.name]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip labelKey={STATUS_LABEL} />} />
              {statusData.length > 0 && (
                <DonutLabel cx="50%" cy="50%" total={projects.length} label="proyectos" />
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {statusData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: '#6e6e73' }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[d.name] }} />
                {STATUS_LABEL[d.name]} <strong style={{ color: '#f5f5f7' }}>{d.value}</strong>
              </span>
            ))}
          </div>
        </Card>

        {/* Donut tipo */}
        <Card>
          <SectionTitle>Tipo de proyecto</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={typeData} cx="50%" cy="50%" innerRadius={52} outerRadius={72}
                dataKey="value" paddingAngle={3} stroke="none">
                {typeData.map(d => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              {typeData.length > 0 && (
                <DonutLabel cx="50%" cy="50%" total={projects.length} label="total" />
              )}
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {typeData.map(d => (
              <span key={d.name} className="flex items-center gap-1.5 text-xs" style={{ color: '#6e6e73' }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name} <strong style={{ color: '#f5f5f7' }}>{d.value}</strong>
              </span>
            ))}
          </div>
        </Card>

        {/* Completion radial */}
        <Card className="flex flex-col items-center justify-center">
          <SectionTitle>Tasa de completación</SectionTitle>
          <div className="relative flex items-center justify-center" style={{ height: 180 }}>
            <ResponsiveContainer width={180} height={180}>
              <RadialBarChart cx="50%" cy="50%" innerRadius={55} outerRadius={75}
                startAngle={90} endAngle={-270} data={radialData} barSize={12}>
                <RadialBar background={{ fill: 'rgba(255,255,255,0.05)' }} dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold" style={{ color: radialData[0].fill, letterSpacing: '-0.03em' }}>{globalPct}%</span>
              <span className="text-xs mt-0.5" style={{ color: '#6e6e73' }}>completado</span>
            </div>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: '#3a3a3a' }}>
            {globalDone} de {globalTotal} tareas finalizadas
          </p>
        </Card>
      </div>

      {/* Row 3 — Bar charts */}
      <div className="grid grid-cols-2 gap-3 mb-3">

        {/* Tareas por estado */}
        {taskStatusData.length > 0 && (
          <Card>
            <SectionTitle>Tareas por estado</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={taskStatusData} barSize={28} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#6e6e73', fontSize: 11 }}
                  tickFormatter={v => TASK_STATUS_LABEL[v] || v} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a3a3a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip labelKey={TASK_STATUS_LABEL} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {taskStatusData.map(d => <Cell key={d.name} fill={TASK_STATUS_COLOR[d.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Prioridad de tareas pendientes */}
        {priorityData.length > 0 && (
          <Card>
            <SectionTitle>Tareas pendientes por prioridad</SectionTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={priorityData} barSize={36} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: '#6e6e73', fontSize: 11 }}
                  tickFormatter={v => ({ high: 'Alta', medium: 'Media', low: 'Baja' }[v] || v)}
                  axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#3a3a3a', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="Tareas" radius={[5, 5, 0, 0]}>
                  {priorityData.map(d => <Cell key={d.name} fill={PRIORITY_COLOR[d.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {/* Row 4 — Progreso por proyecto */}
      {progressData.length > 0 && (
        <Card>
          <SectionTitle>Progreso por proyecto</SectionTitle>
          <ResponsiveContainer width="100%" height={progressData.length * 44 + 16}>
            <BarChart data={progressData} layout="vertical" barSize={10}
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#3a3a3a', fontSize: 10 }}
                tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={140}
                tick={{ fill: '#6e6e73', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                formatter={v => [`${v}%`, 'Progreso']}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: '#f5f5f7' }}
              />
              <Bar dataKey="pct" radius={[0, 5, 5, 0]} background={{ fill: 'rgba(255,255,255,0.04)', radius: [0, 5, 5, 0] }}>
                {progressData.map(d => (
                  <Cell key={d.name} fill={d.pct === 100 ? '#30d158' : d.pct >= 60 ? '#64d2ff' : d.pct >= 30 ? '#ff9f0a' : '#ff453a'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
