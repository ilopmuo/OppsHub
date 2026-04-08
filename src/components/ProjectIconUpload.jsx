import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ImagePlus, Loader2, X } from 'lucide-react'

export default function ProjectIconUpload({ iconUrl, onChange, size = 56 }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(iconUrl || null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setUploading(true)

    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error } = await supabase.storage
      .from('project-icons')
      .upload(path, file, { contentType: file.type })

    if (error) {
      setPreview(iconUrl || null)
      URL.revokeObjectURL(objectUrl)
    } else {
      const { data: { publicUrl } } = supabase.storage
        .from('project-icons')
        .getPublicUrl(path)
      setPreview(publicUrl)
      onChange(publicUrl)
      URL.revokeObjectURL(objectUrl)
    }
    setUploading(false)
  }

  function handleRemove(e) {
    e.stopPropagation()
    setPreview(null)
    onChange(null)
  }

  const radius = Math.round(size * 0.25)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => !uploading && inputRef.current?.click()}
        className="w-full h-full flex items-center justify-center transition-all group"
        style={{
          borderRadius: radius,
          backgroundColor: preview ? '#000' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${preview ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)'}`,
          overflow: 'hidden',
          cursor: uploading ? 'wait' : 'pointer',
        }}
        title="Cambiar icono"
      >
        {uploading ? (
          <Loader2 className="animate-spin" style={{ width: size * 0.35, height: size * 0.35, color: '#6e6e73' }} />
        ) : preview ? (
          <>
            <img src={preview} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius }}>
              <ImagePlus style={{ width: size * 0.3, height: size * 0.3, color: '#f5f5f7' }} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-40 group-hover:opacity-70 transition-opacity">
            <ImagePlus style={{ width: size * 0.35, height: size * 0.35, color: '#f5f5f7' }} />
            {size >= 56 && <span style={{ fontSize: 9, color: '#f5f5f7', letterSpacing: '0.05em' }}>ICONO</span>}
          </div>
        )}
      </button>

      {preview && !uploading && (
        <button
          type="button"
          onClick={handleRemove}
          className="absolute flex items-center justify-center transition-all"
          style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#ff453a', top: -4, right: -4,
            opacity: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.parentElement.querySelector('button').dispatchEvent(new MouseEvent('mouseenter')) }}
          onFocus={e => e.currentTarget.style.opacity = '1'}
          onBlur={e => e.currentTarget.style.opacity = '0'}
          title="Quitar icono"
        >
          <X style={{ width: 9, height: 9, color: '#fff' }} />
        </button>
      )}

      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  )
}
