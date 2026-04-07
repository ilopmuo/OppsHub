import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const COLORS = ['#30d158', '#64d2ff', '#bf5af2', '#ff9f0a', '#ff453a', '#ff6b81', '#ffd60a', '#f5f5f7']
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function NewHabitModal({ habit, onClose, onSaved }) {
  const { user } = useAuth()
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState(habit?.name || '')
  const [color, setColor] = useState(habit?.color || '#30d158')
  const [type, setType] = useState(habit?.type || 'daily')
  const [days, setDays] = useState(habit?.days_of_week || [1, 2, 3, 4, 5])
  const [goalType, setGoalType] = useState(habit?.goal_type || 'boolean')
  const [goalValue, setGoalValue] = useState(habit?.goal_value || '')
  const [goalUnit, setGoalUnit] = useState(habit?.goal_unit || '')

  function handleClose() { setClosing(true); setTimeout(onClose, 170) }

  function toggleDay(d) {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return toast.error('El nombre es obligatorio')
    if (type === 'specific_days' && days.length === 0) return toast.error('Selecciona al menos un día')

    setLoading(true)
    const payload = {
      user_id: user.id,
      name: name.trim(),
      color,
      type,
      days_of_week: type === 'specific_days' ? days : null,
      goal_type: goalType,
      goal_value: goalType === 'numeric' && goalValue ? Number(goalValue) : null,
      goal_unit: goalType === 'numeric' && goalUnit ? goalUnit.trim() : null,
    }

    let error
    if (habit) {
      const res = await supabase.from('habits').update(payload).eq('id', habit.id)
      error = res.error
    } else {
      const res = await supabase.from('habits').insert(payload).select().single()
      error = res.error
      if (!error) payload.id = res.data.id
    }

    if (error) {
      toast.error('Error al guardar hábito')
    } else {
      toast.success(habit ? 'Hábito actualizado' : 'Hábito creado')
      onSaved()
      handleClose()
    }
    setLoading(false)
  }

  const anim = closing ? 'modal-out' : 'modal-in'
  const dur  = closing ? '0.17s ease' : '0.22s cubic-bezier(0.16,1,0.3,1)'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: `${closing ? 'backdrop-out' : 'backdrop-in'} 0.17s ease both` }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)', animation: `${anim} ${dur} both` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-semibold text-sm" style={{ color: '#f5f5f7' }}>
            {habit ? 'Editar hábito' : 'Nuevo hábito'}
          </h2>
          <button onClick={handleClose} style={{ color: '#6e6e73' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Nombre</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Meditar, Leer, Ejercicio..."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.08)', color: '#f5f5f7' }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Color</label>
            <div className="flex items-center gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform"
                  style={{
                    backgroundColor: c,
                    transform: color === c ? 'scale(1.25)' : 'scale(1)',
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Frecuencia</label>
            <div className="flex gap-2 mb-3">
              {[{ v: 'daily', l: 'Cada día' }, { v: 'specific_days', l: 'Días específicos' }].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setType(v)}
                  className="px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    backgroundColor: type === v ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                    color: type === v ? '#f5f5f7' : '#6e6e73',
                    border: `1px solid ${type === v ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >{l}</button>
              ))}
            </div>
            {type === 'specific_days' && (
              <div className="flex gap-1">
                {DAYS.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className="flex-1 py-1.5 rounded-lg text-xs transition-all"
                    style={{
                      backgroundColor: days.includes(i) ? color + '33' : 'rgba(255,255,255,0.04)',
                      color: days.includes(i) ? color : '#6e6e73',
                      border: `1px solid ${days.includes(i) ? color + '66' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >{d}</button>
                ))}
              </div>
            )}
          </div>

          {/* Goal */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#6e6e73' }}>Tipo de objetivo</label>
            <div className="flex gap-2 mb-3">
              {[{ v: 'boolean', l: 'Completado / No' }, { v: 'numeric', l: 'Cantidad' }].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setGoalType(v)}
                  className="px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{
                    backgroundColor: goalType === v ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                    color: goalType === v ? '#f5f5f7' : '#6e6e73',
                    border: `1px solid ${goalType === v ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >{l}</button>
              ))}
            </div>
            {goalType === 'numeric' && (
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  value={goalValue}
                  onChange={e => setGoalValue(e.target.value)}
                  placeholder="Cantidad"
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.08)', color: '#f5f5f7' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <input
                  value={goalUnit}
                  onChange={e => setGoalUnit(e.target.value)}
                  placeholder="Unidad (ej: min)"
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.08)', color: '#f5f5f7' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl text-sm transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#6e6e73' }}
            >Cancelar</button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ backgroundColor: '#f5f5f7', color: '#000' }}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {habit ? 'Guardar' : 'Crear hábito'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
