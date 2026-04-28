// src/modules/plantel/PlantelPage.tsx
import { useEffect, useState, useRef } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { StatCard, EmptyState } from '@/shared/components/ui'
import type { Player } from '@/shared/types'

// ── Constants ─────────────────────────────────────────────────
const POSITIONS = [
  'Pilar izquierdo', 'Pilar derecho', 'Hooker',
  'Segunda línea', 'Flanker abierto', 'Flanker ciego', 'Octavo (N°8)',
  'Scrum-half', 'Apertura',
  'Centro', 'Ala izquierdo', 'Ala derecho', 'Fullback',
]

const STATUS_OPTIONS = ['Disponible', 'Lesionado', 'Duda', 'Suspendido'] as const
const STATUS_FILTER  = ['Todos', ...STATUS_OPTIONS]
type PlayerStatus = typeof STATUS_OPTIONS[number]

const STATUS_STYLE: Record<PlayerStatus, { bg: string; color: string }> = {
  Disponible: { bg: '#E8F5EE', color: '#1B6B3A' },
  Lesionado:  { bg: '#FEECEC', color: '#B91C1C' },
  Duda:       { bg: '#FEF3DC', color: '#B45309' },
  Suspendido: { bg: '#F1EFE8', color: '#5F5E5A' },
}

// ── Helpers ───────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status as PlayerStatus] ?? { bg: '#F1EFE8', color: '#5F5E5A' }
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{status}</span>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 6 }}>{children}</label>
}

function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string; size?: number }) {
  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#E8F5EE', color: '#1B6B3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.33, fontWeight: 700, flexShrink: 0 }}>
      {initials(name || '?')}
    </div>
  )
}

// ── Form state ────────────────────────────────────────────────
const emptyForm = () => ({
  name:       '',
  number:     '',
  positions:  [] as string[],   // multi-position
  status:     'Disponible' as PlayerStatus,
  birthDate:  '',
  weight:     '',
  height:     '',
  notes:      '',
  photoUrl:   '',
})
type FormData = ReturnType<typeof emptyForm>

type Modal =
  | { type: 'none' }
  | { type: 'form'; player: Player | null }
  | { type: 'delete'; player: Player }
  | { type: 'profile'; player: Player }

// ── Component ─────────────────────────────────────────────────
export default function PlantelPage() {
  const user    = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  const [players, setPlayers]   = useState<Player[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('Todos')
  const [modal, setModal]       = useState<Modal>({ type: 'none' })
  const [form, setForm]         = useState<FormData>(emptyForm())
  const [errors, setErrors]     = useState<Record<string, string>>({})
  const [saving, setSaving]     = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview]     = useState<string | null>(null)
  const [photoFile, setPhotoFile]           = useState<File | null>(null)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Fetch ─────────────────────────────────────────────────
  async function fetchPlayers() {
    if (!user) return
    try {
      const snap = await getDocs(query(collection(db, 'players'), where('clubId', '==', user.clubId)))
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Player))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPlayers() }, [user])

  // ── Photo picker ──────────────────────────────────────────
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('La foto debe pesar menos de 5MB', false); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(playerId: string): Promise<string | null> {
    if (!photoFile) return form.photoUrl || null
    setUploadingPhoto(true)
    try {
      const storageRef = ref(storage, `players/${playerId}/avatar.jpg`)
      await uploadBytes(storageRef, photoFile)
      const url = await getDownloadURL(storageRef)
      return url
    } catch (e) {
      console.error('Error subiendo foto:', e)
      showToast('No se pudo subir la foto — se guardó sin imagen', false)
      return null
    } finally {
      setUploadingPhoto(false)
    }
  }

  // ── Open modals ───────────────────────────────────────────
  function openCreate() {
    setForm(emptyForm()); setErrors({})
    setPhotoPreview(null); setPhotoFile(null)
    setModal({ type: 'form', player: null })
  }

  function openEdit(p: Player) {
    const positions = Array.isArray((p as any).positions)
      ? (p as any).positions
      : p.position ? [p.position] : []
    setForm({
      name: p.name, number: String(p.number),
      positions, status: p.status as PlayerStatus,
      birthDate: p.birthDate ?? '', weight: p.weight ? String(p.weight) : '',
      height: p.height ? String(p.height) : '',
      notes: (p as any).notes ?? '', photoUrl: p.avatarUrl ?? '',
    })
    setErrors({})
    setPhotoPreview(p.avatarUrl ?? null); setPhotoFile(null)
    setModal({ type: 'form', player: p })
  }

  // ── Toggle position ───────────────────────────────────────
  function togglePosition(pos: string) {
    setForm(f => ({
      ...f,
      positions: f.positions.includes(pos)
        ? f.positions.filter(p => p !== pos)
        : [...f.positions, pos],
    }))
  }

  // ── Validate ─────────────────────────────────────────────
  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.name.trim())         e.name      = 'El nombre es requerido'
    if (!form.number.trim())       e.number    = 'El número es requerido'
    else if (isNaN(Number(form.number)) || Number(form.number) < 1 || Number(form.number) > 99)
                                   e.number    = 'Entre 1 y 99'
    if (form.positions.length === 0) e.positions = 'Seleccioná al menos una posición'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    if (!validate() || !user) return
    setSaving(true)
    try {
      const isEdit   = modal.type === 'form' && modal.player
      const playerId = isEdit ? modal.player!.id : `player_${Date.now()}`
      const photoUrl = await uploadPhoto(playerId)

      const data: Record<string, any> = {
        name:      form.name.trim(),
        number:    Number(form.number),
        position:  form.positions[0],       // primera posición como principal (compatibilidad)
        positions: form.positions,           // todas las posiciones
        status:    form.status,
        birthDate: form.birthDate || null,
        weight:    form.weight  ? Number(form.weight)  : null,
        height:    form.height  ? Number(form.height)  : null,
        notes:     form.notes.trim() || null,
        avatarUrl: photoUrl,
        clubId:    user.clubId,
        role:      'jugador',
      }

      if (isEdit) {
        await updateDoc(doc(db, 'players', modal.player!.id), data)
        setPlayers(prev => prev.map(p => p.id === modal.player!.id ? { ...p, ...data } : p))
        showToast('Jugador actualizado correctamente')
      } else {
        const ref2 = await addDoc(collection(db, 'players'), { ...data, createdAt: serverTimestamp() })
        setPlayers(prev => [...prev, { id: ref2.id, ...data } as unknown as Player])
        showToast('Jugador creado correctamente')
      }
      setModal({ type: 'none' })
    } catch (e) {
      console.error(e)
      showToast('Error al guardar — revisá los permisos', false)
    } finally { setSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────
  async function handleDelete() {
    if (modal.type !== 'delete') return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'players', modal.player.id))
      setPlayers(prev => prev.filter(p => p.id !== modal.player.id))
      setModal({ type: 'none' })
      showToast('Jugador eliminado')
    } catch (e) {
      showToast('Error al eliminar', false)
    } finally { setSaving(false) }
  }

  // ── Filter & sort ─────────────────────────────────────────
  const filtered = players
    .filter(p => {
      const q = search.toLowerCase()
      return (p.name?.toLowerCase().includes(q) || p.position?.toLowerCase().includes(q) || String(p.number).includes(q))
        && (statusF === 'Todos' || p.status === statusF)
    })
    .sort((a, b) => a.number - b.number)

  const stats = {
    total:     players.length,
    available: players.filter(p => p.status === 'Disponible').length,
    injured:   players.filter(p => p.status === 'Lesionado').length,
    doubt:     players.filter(p => p.status === 'Duda').length,
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fade-in">

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: toast.ok ? '#0A2218' : '#B91C1C', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, animation: 'fadeIn 0.2s ease' }}>
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total jugadores" value={String(stats.total)}     accentColor="#1B6B3A" />
        <StatCard label="Disponibles"     value={String(stats.available)} accentColor="#1B6B3A" deltaType="up" />
        <StatCard label="Lesionados"      value={String(stats.injured)}   accentColor="#B91C1C" deltaType="warn" />
        <StatCard label="En duda"         value={String(stats.doubt)}     accentColor="#B45309" deltaType="warn" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 300 }}
          placeholder="Buscar por nombre, posición o número..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {STATUS_FILTER.map(s => (
            <button key={s} onClick={() => setStatusF(s)} style={{
              padding: '6px 13px', borderRadius: 20, border: '1px solid #DDE9E3',
              background: statusF === s ? '#0A2218' : '#fff',
              color: statusF === s ? '#fff' : '#4A6358',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>{s}</button>
          ))}
        </div>
        {canEdit && (
          <button onClick={openCreate} style={{ marginLeft: 'auto', padding: '9px 18px', border: 'none', borderRadius: 9, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Nuevo jugador
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9AB5A8' }}>Cargando plantel...</div>
      ) : (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '44px 44px 1fr 1fr 130px 160px', gap: 12, padding: '10px 18px', background: '#F8FAF9', borderBottom: '1px solid #E4EBE7' }}>
            {['#', '', 'Jugador', 'Posición/es', 'Estado', 'Acciones'].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#7A9485', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={players.length === 0 ? '🏉' : '🔍'}
              title={players.length === 0 ? 'El plantel está vacío' : 'Sin resultados'}
              desc={players.length === 0 ? (canEdit ? 'Hacé click en "+ Nuevo jugador" para empezar' : 'Aún no hay jugadores cargados') : 'Probá con otro nombre o filtro'}
            />
          ) : filtered.map((p, i) => {
            const posArr: string[] = Array.isArray((p as any).positions) ? (p as any).positions : [p.position]
            return (
              <div key={p.id}
                style={{ display: 'grid', gridTemplateColumns: '44px 44px 1fr 1fr 130px 160px', gap: 12, padding: '11px 18px', borderBottom: i < filtered.length - 1 ? '1px solid #F4F7F5' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFCFA')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0A2218', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.number}
                </div>
                <Avatar name={p.name} photoUrl={p.avatarUrl} size={34} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1F14' }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: '#9AB5A8', marginTop: 1 }}>
                    {[p.height && `${p.height}cm`, p.weight && `${p.weight}kg`].filter(Boolean).join(' · ') || 'Sin datos físicos'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {posArr.slice(0, 2).map(pos => (
                    <span key={pos} style={{ fontSize: 11, background: '#E8F5EE', color: '#1B6B3A', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>{pos}</span>
                  ))}
                  {posArr.length > 2 && <span style={{ fontSize: 11, background: '#F1EFE8', color: '#5F5E5A', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>+{posArr.length - 2}</span>}
                </div>
                <StatusPill status={p.status} />
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => setModal({ type: 'profile', player: p })} style={{ padding: '5px 10px', border: '1px solid #DDE9E3', borderRadius: 7, background: '#fff', color: '#4A6358', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Ver</button>
                  {canEdit && <>
                    <button onClick={() => openEdit(p)} style={{ padding: '5px 10px', border: '1px solid #C5E3D1', borderRadius: 7, background: '#E8F5EE', color: '#1B6B3A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => setModal({ type: 'delete', player: p })} style={{ padding: '5px 9px', border: '1px solid #FEECEC', borderRadius: 7, background: '#FEECEC', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal.type === 'form' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, maxHeight: '92vh', overflowY: 'auto', animation: 'fadeIn 0.15s ease' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px 16px', borderBottom: '1px solid #F0F4F2', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>
                  {modal.player ? 'Editar jugador' : 'Nuevo jugador'}
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7A9485' }}>
                  {modal.player ? `Editando: ${modal.player.name}` : 'Completá los datos del jugador'}
                </p>
              </div>
              <button onClick={() => setModal({ type: 'none' })} style={{ width: 32, height: 32, border: 'none', background: '#F0F4F2', borderRadius: '50%', fontSize: 18, color: '#7A9485', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '22px 28px 28px' }}>

              {/* ── FOTO DE PERFIL ── */}
              <div style={{ marginBottom: 22 }}>
                <Label>Foto de perfil</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Preview */}
                  <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', background: '#E8F5EE', flexShrink: 0, border: '2px solid #DDE9E3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 24, fontWeight: 700, color: '#1B6B3A' }}>{form.name ? initials(form.name) : '?'}</span>
                    }
                  </div>
                  <div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '8px 16px', border: '1.5px solid #1B6B3A', borderRadius: 8, background: '#fff', color: '#1B6B3A', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 4 }}
                    >
                      {photoPreview ? '📷 Cambiar foto' : '📷 Subir foto'}
                    </button>
                    {photoPreview && (
                      <button
                        onClick={() => { setPhotoPreview(null); setPhotoFile(null); setForm(f => ({ ...f, photoUrl: '' })) }}
                        style={{ marginLeft: 8, padding: '8px 12px', border: '1px solid #FEECEC', borderRadius: 8, background: '#FEECEC', color: '#B91C1C', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Quitar
                      </button>
                    )}
                    <div style={{ fontSize: 11, color: '#9AB5A8', marginTop: 2 }}>JPG o PNG · Máx. 5MB</div>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: 'none' }} />
                  </div>
                </div>
              </div>

              {/* ── NOMBRE + NÚMERO ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14, marginBottom: 16 }}>
                <div>
                  <Label>Nombre completo *</Label>
                  <input className="input" placeholder="Ej: Martín García" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  {errors.name && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 3 }}>{errors.name}</div>}
                </div>
                <div>
                  <Label>Nro. de camiseta *</Label>
                  <input className="input" type="number" min={1} max={99} placeholder="10" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} />
                  {errors.number && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 3 }}>{errors.number}</div>}
                </div>
              </div>

              {/* ── POSICIONES (multi-select) ── */}
              <div style={{ marginBottom: 16 }}>
                <Label>
                  Posición/es * &nbsp;
                  <span style={{ fontWeight: 400, color: '#9AB5A8' }}>
                    {form.positions.length > 0 ? `${form.positions.length} seleccionada${form.positions.length > 1 ? 's' : ''}` : 'Seleccioná una o más'}
                  </span>
                </Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {POSITIONS.map(pos => {
                    const active = form.positions.includes(pos)
                    return (
                      <button
                        key={pos}
                        onClick={() => togglePosition(pos)}
                        style={{
                          padding: '8px 10px', borderRadius: 8, textAlign: 'left',
                          border: `1.5px solid ${active ? '#1B6B3A' : '#DDE9E3'}`,
                          background: active ? '#E8F5EE' : '#fff',
                          color: active ? '#1B6B3A' : '#4A6358',
                          fontSize: 12, fontWeight: active ? 700 : 400,
                          cursor: 'pointer', transition: 'all 0.12s',
                          display: 'flex', alignItems: 'center', gap: 7,
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${active ? '#1B6B3A' : '#C5D5C9'}`, background: active ? '#1B6B3A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, color: '#fff' }}>
                          {active ? '✓' : ''}
                        </span>
                        {pos}
                      </button>
                    )
                  })}
                </div>
                {errors.positions && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 5 }}>{errors.positions}</div>}
              </div>

              {/* ── ESTADO ── */}
              <div style={{ marginBottom: 16 }}>
                <Label>Estado</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {STATUS_OPTIONS.map(s => {
                    const st = STATUS_STYLE[s]
                    const active = form.status === s
                    return (
                      <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} style={{
                        padding: '10px 6px', borderRadius: 9,
                        border: `2px solid ${active ? st.color : '#DDE9E3'}`,
                        background: active ? st.bg : '#fff',
                        color: active ? st.color : '#7A9485',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s',
                      }}>{s}</button>
                    )
                  })}
                </div>
              </div>

              {/* ── DATOS FÍSICOS ── */}
              <div style={{ borderTop: '1px solid #F0F4F2', paddingTop: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Datos físicos <span style={{ fontWeight: 400 }}>(opcional)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#7A9485', marginBottom: 4 }}>Fecha de nacimiento</div>
                    <input className="input" type="date" value={form.birthDate} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#7A9485', marginBottom: 4 }}>Peso (kg)</div>
                    <input className="input" type="number" min={40} max={200} placeholder="88" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#7A9485', marginBottom: 4 }}>Altura (cm)</div>
                    <input className="input" type="number" min={140} max={230} placeholder="182" value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* ── NOTAS ── */}
              <div style={{ marginBottom: 20 }}>
                <Label>
                  Notas &nbsp;<span style={{ fontWeight: 400, color: '#9AB5A8' }}>(opcional)</span>
                </Label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Ej: Capitán del equipo. Experiencia en la selección provincial. Lesión de rodilla derecha en 2023 — totalmente recuperado."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 11, color: '#9AB5A8', marginTop: 3 }}>{form.notes.length} / 500 caracteres</div>
              </div>

              {/* ── BUTTONS ── */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #F0F4F2' }}>
                <button onClick={() => setModal({ type: 'none' })} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || uploadingPhoto} style={{ flex: 2, padding: 12, border: 'none', borderRadius: 10, background: saving || uploadingPhoto ? '#C5D5C9' : '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving || uploadingPhoto ? 'not-allowed' : 'pointer' }}>
                  {uploadingPhoto ? 'Subiendo foto...' : saving ? 'Guardando...' : modal.player ? 'Guardar cambios' : 'Crear jugador'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {modal.type === 'delete' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 380, animation: 'fadeIn 0.15s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEECEC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>🗑</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>Eliminar jugador</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#7A9485', lineHeight: 1.6 }}>
                ¿Seguro que querés eliminar a <strong style={{ color: '#0D1F14' }}>{modal.player.name}</strong>?<br />Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal({ type: 'none' })} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={saving} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {modal.type === 'profile' && (() => {
        const p = modal.player
        const posArr: string[] = Array.isArray((p as any).positions) ? (p as any).positions : [p.position]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>

              {/* Header */}
              <div style={{ background: '#0A2218', padding: '28px 24px 24px', position: 'relative' }}>
                <button onClick={() => setModal({ type: 'none' })} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, border: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Avatar grande */}
                  <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
                    {p.avatarUrl
                      ? <img src={p.avatarUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', background: '#E8A020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#0A2218' }}>{initials(p.name ?? '?')}</div>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                      {posArr.join(' · ')}
                    </div>
                    <div style={{ marginTop: 8 }}><StatusPill status={p.status} /></div>
                  </div>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#E8A020', flexShrink: 0 }}>
                    {p.number}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  {[
                    { l: 'Altura',     v: p.height    ? `${p.height} cm` : '—' },
                    { l: 'Peso',       v: p.weight    ? `${p.weight} kg` : '—' },
                    { l: 'Nacimiento', v: p.birthDate ?? '—' },
                    { l: 'Club',       v: p.clubId ?? '—' },
                  ].map((r, i, arr) => (
                    <div key={r.l} style={{ padding: '10px 0', borderBottom: i < arr.length - 2 ? '1px solid #F4F7F5' : 'none' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{r.l}</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1F14' }}>{r.v}</div>
                    </div>
                  ))}
                </div>

                {/* Notas */}
                {(p as any).notes && (
                  <div style={{ marginTop: 14, padding: '12px 14px', background: '#F8FAF9', borderRadius: 9, borderLeft: '3px solid #1B6B3A' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Notas</div>
                    <div style={{ fontSize: 13, color: '#4A6358', lineHeight: 1.55 }}>{(p as any).notes}</div>
                  </div>
                )}

                {canEdit && (
                  <button
                    onClick={() => { setModal({ type: 'none' }); setTimeout(() => openEdit(p), 80) }}
                    style={{ width: '100%', marginTop: 16, padding: 12, border: 'none', borderRadius: 10, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Editar jugador
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
