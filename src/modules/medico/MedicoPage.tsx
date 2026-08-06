// src/modules/medico/MedicoPage.tsx
import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { StatCard, EmptyState } from '@/shared/components/ui'
import type { Lesion, LesionEstado, LesionZona } from '@/shared/types'

// ── Constants ──────────────────────────────────────────────────
const ZONAS: { id: LesionZona; label: string; grupo: string }[] = [
  { id:'cabeza',       label:'Cabeza / Cuello',    grupo:'Superior' },
  { id:'cuello',       label:'Cuello',              grupo:'Superior' },
  { id:'hombro_der',   label:'Hombro derecho',      grupo:'Superior' },
  { id:'hombro_izq',   label:'Hombro izquierdo',    grupo:'Superior' },
  { id:'codo_der',     label:'Codo derecho',         grupo:'Superior' },
  { id:'codo_izq',     label:'Codo izquierdo',       grupo:'Superior' },
  { id:'muneca_der',   label:'Muñeca derecha',       grupo:'Superior' },
  { id:'muneca_izq',   label:'Muñeca izquierda',     grupo:'Superior' },
  { id:'espalda_alta', label:'Espalda alta',          grupo:'Tronco'   },
  { id:'espalda_baja', label:'Espalda baja / Lumbar', grupo:'Tronco'   },
  { id:'cadera',       label:'Cadera / Ingle',        grupo:'Inferior' },
  { id:'muslo_der',    label:'Muslo derecho',          grupo:'Inferior' },
  { id:'muslo_izq',    label:'Muslo izquierdo',        grupo:'Inferior' },
  { id:'rodilla_der',  label:'Rodilla derecha',        grupo:'Inferior' },
  { id:'rodilla_izq',  label:'Rodilla izquierda',      grupo:'Inferior' },
  { id:'tobillo_der',  label:'Tobillo derecho',        grupo:'Inferior' },
  { id:'tobillo_izq',  label:'Tobillo izquierdo',      grupo:'Inferior' },
  { id:'otro',         label:'Otro',                   grupo:'Otro'     },
]

const ESTADOS: { id: LesionEstado; label: string; bg: string; color: string }[] = [
  { id:'activa',          label:'Activa',           bg:'#FEECEC', color:'#B91C1C' },
  { id:'en_recuperacion', label:'En recuperación',  bg:'#FEF3DC', color:'#B45309' },
  { id:'alta_medica',     label:'Alta médica',      bg:'#E8F5EE', color:'#1B6B3A' },
]

function estadoStyle(e: LesionEstado) {
  return ESTADOS.find(x => x.id === e) ?? ESTADOS[0]
}
function zonaLabel(z: LesionZona) {
  return ZONAS.find(x => x.id === z)?.label ?? z
}
function diasDesde(fecha: string) {
  const d = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
  return d === 0 ? 'Hoy' : d === 1 ? 'Ayer' : `Hace ${d} días`
}
function diasHasta(fecha: string | null) {
  if (!fecha) return '—'
  const d = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (d < 0) return 'Vencido'
  if (d === 0) return 'Hoy'
  return `${d} días`
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>{children}</label>
}
function EstadoPill({ estado }: { estado: LesionEstado }) {
  const s = estadoStyle(estado)
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{s.label}</span>
}

const EMPTY_FORM = () => ({
  playerId: '', playerName: '', zona: 'rodilla_der' as LesionZona,
  descripcion: '', fechaLesion: new Date().toISOString().slice(0, 10),
  fechaAltaEstimada: '', fechaAltaReal: '',
  estado: 'activa' as LesionEstado,
  mecanismo: '', tratamiento: '', observaciones: '',
})

type Modal = 'none' | 'form' | 'delete' | 'detail'

export default function MedicoPage() {
  const user    = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  const [lesiones,  setLesiones]  = useState<Lesion[]>([])
  const [players,   setPlayers]   = useState<{ id: string; name: string; position: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState<Modal>('none')
  const [active,    setActive]    = useState<Lesion | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const [filterE,   setFilterE]   = useState<LesionEstado | 'all'>('all')
  const [search,    setSearch]    = useState('')
  const [form,      setForm]      = useState(EMPTY_FORM())

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      const [lSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'lesiones'), where('clubId', '==', user!.clubId))),
        getDocs(query(collection(db, 'players'),  where('clubId', '==', user!.clubId))),
      ])
      setLesiones(lSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Lesion)
        .sort((a, b) => new Date(b.fechaLesion).getTime() - new Date(a.fechaLesion).getTime()))
      setPlayers(pSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name, position: (d.data() as any).position ?? '' })))
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user])

  function openCreate() {
    setForm({ ...EMPTY_FORM(), playerId: players[0]?.id ?? '', playerName: players[0]?.name ?? '' })
    setActive(null); setModal('form')
  }

  function openEdit(l: Lesion) {
    setForm({
      playerId: l.playerId, playerName: l.playerName, zona: l.zona,
      descripcion: l.descripcion, fechaLesion: l.fechaLesion,
      fechaAltaEstimada: l.fechaAltaEstimada ?? '',
      fechaAltaReal: l.fechaAltaReal ?? '',
      estado: l.estado, mecanismo: l.mecanismo ?? '',
      tratamiento: l.tratamiento ?? '', observaciones: l.observaciones ?? '',
    })
    setActive(l); setModal('form')
  }

  function selectPlayer(id: string) {
    const p = players.find(p => p.id === id)
    setForm(f => ({ ...f, playerId: id, playerName: p?.name ?? '' }))
  }

  async function handleSave() {
    if (!user || !form.playerId || !form.descripcion.trim()) return showToast('Completá jugador y descripción', false)
    setSaving(true)
    const data = {
      playerId: form.playerId, playerName: form.playerName, clubId: user.clubId,
      zona: form.zona, descripcion: form.descripcion.trim(),
      fechaLesion: form.fechaLesion,
      fechaAltaEstimada: form.fechaAltaEstimada || null,
      fechaAltaReal: form.fechaAltaReal || null,
      estado: form.estado,
      mecanismo: form.mecanismo.trim() || null,
      tratamiento: form.tratamiento.trim() || null,
      observaciones: form.observaciones.trim() || null,
      createdBy: user.uid,
    }
    try {
      if (active) {
        await updateDoc(doc(db, 'lesiones', active.id), data)
        setLesiones(prev => prev.map(l => l.id === active.id ? { ...l, ...data } : l))
        showToast('Lesión actualizada')
      } else {
        const ref = await addDoc(collection(db, 'lesiones'), { ...data, createdAt: serverTimestamp() })
        setLesiones(prev => [{ id: ref.id, ...data, createdAt: new Date() } as unknown as Lesion, ...prev])
        showToast('Lesión registrada')
      }
      setModal('none')
    } catch (e) { console.error(e); showToast('Error al guardar', false) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!active) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'lesiones', active.id))
      setLesiones(prev => prev.filter(l => l.id !== active.id))
      setModal('none'); setActive(null); showToast('Lesión eliminada')
    } catch { showToast('Error al eliminar', false) }
    finally { setSaving(false) }
  }

  async function quickEstado(l: Lesion, estado: LesionEstado) {
    try {
      const patch: Partial<Lesion> = { estado }
      if (estado === 'alta_medica' && !l.fechaAltaReal) patch.fechaAltaReal = new Date().toISOString().slice(0, 10)
      await updateDoc(doc(db, 'lesiones', l.id), patch)
      setLesiones(prev => prev.map(x => x.id === l.id ? { ...x, ...patch } : x))
      showToast('Estado actualizado')
    } catch { showToast('Error', false) }
  }

  const filtered = lesiones.filter(l => {
    const matchE = filterE === 'all' || l.estado === filterE
    const matchS = l.playerName.toLowerCase().includes(search.toLowerCase()) ||
                   zonaLabel(l.zona).toLowerCase().includes(search.toLowerCase())
    return matchE && matchS
  })

  const activas       = lesiones.filter(l => l.estado === 'activa').length
  const recuperando   = lesiones.filter(l => l.estado === 'en_recuperacion').length
  const altas         = lesiones.filter(l => l.estado === 'alta_medica').length

  return (
    <div className="fade-in">
      {toast && <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: toast.ok ? '#0A2218' : '#B91C1C', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast.msg}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total lesiones"     value={String(lesiones.length)} accentColor="#7A9485" />
        <StatCard label="Lesiones activas"   value={String(activas)}          accentColor="#B91C1C" deltaType="warn" />
        <StatCard label="En recuperación"    value={String(recuperando)}      accentColor="#B45309" deltaType="warn" />
        <StatCard label="Altas médicas"      value={String(altas)}            accentColor="#1B6B3A" deltaType="up" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar jugador o zona..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 6 }}>
          {([['all','Todos'],['activa','Activas'],['en_recuperacion','Recuperación'],['alta_medica','Altas']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterE(val as any)} style={{ padding: '6px 13px', borderRadius: 20, border: '1px solid #DDE9E3', background: filterE === val ? '#0A2218' : '#fff', color: filterE === val ? '#fff' : '#4A6358', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>
        {canEdit && <button onClick={openCreate} style={{ marginLeft: 'auto', padding: '9px 18px', border: 'none', borderRadius: 9, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Registrar lesión</button>}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9AB5A8' }}>Cargando...</div>
      : lesiones.length === 0 ? <EmptyState icon="🏥" title="Sin lesiones registradas" desc={canEdit ? 'Hacé click en "+ Registrar lesión"' : 'No hay lesiones registradas'} />
      : (
        <div className="card">
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 160px 110px 110px 120px 130px 140px', gap: 12, padding: '10px 18px', background: '#F8FAF9', borderBottom: '1px solid #E4EBE7' }}>
            {['Jugador','Zona','Lesión','Alta est.','Días lesión','Estado','Acciones'].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#7A9485', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 ? <EmptyState icon="🔍" title="Sin resultados" desc="Probá con otro filtro" />
          : filtered.map((l, i) => {
            const es = estadoStyle(l.estado)
            return (
              <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '180px 160px 110px 110px 120px 130px 140px', gap: 12, padding: '12px 18px', borderBottom: i < filtered.length - 1 ? '1px solid #F4F7F5' : 'none', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFCFA')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1F14' }}>{l.playerName}</div>
                  <div style={{ fontSize: 11, color: '#9AB5A8', marginTop: 1 }}>
                    {players.find(p => p.id === l.playerId)?.position ?? ''}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#4A6358' }}>{zonaLabel(l.zona)}</div>
                <div style={{ fontSize: 12, color: '#7A9485' }}>{diasDesde(l.fechaLesion)}</div>
                <div style={{ fontSize: 12, color: l.fechaAltaEstimada && diasHasta(l.fechaAltaEstimada) === 'Vencido' ? '#B91C1C' : '#4A6358' }}>
                  {diasHasta(l.fechaAltaEstimada)}
                </div>
                <div style={{ fontSize: 11, color: '#7A9485' }}>
                  {Math.floor((Date.now() - new Date(l.fechaLesion).getTime()) / 86400000)} días
                </div>
                <div>
                  {canEdit ? (
                    <select
                      value={l.estado}
                      onChange={e => quickEstado(l, e.target.value as LesionEstado)}
                      style={{ background: es.bg, color: es.color, border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {ESTADOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                  ) : <EstadoPill estado={l.estado} />}
                </div>
                <div style={{ display: 'flex', gap: 5 }}>
                  <button onClick={() => { setActive(l); setModal('detail') }} style={{ padding: '5px 10px', border: '1px solid #DDE9E3', borderRadius: 7, background: '#fff', color: '#4A6358', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Ver</button>
                  {canEdit && <>
                    <button onClick={() => openEdit(l)} style={{ padding: '5px 10px', border: '1px solid #C5E3D1', borderRadius: 7, background: '#E8F5EE', color: '#1B6B3A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => { setActive(l); setModal('delete') }} style={{ padding: '5px 9px', border: '1px solid #FEECEC', borderRadius: 7, background: '#FEECEC', color: '#B91C1C', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                  </>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── DETAIL MODAL ── */}
      {modal === 'detail' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'hidden', animation: 'fadeIn 0.15s ease' }}>
            <div style={{ background: '#0A2218', padding: '22px 24px', position: 'relative' }}>
              <button onClick={() => setModal('none')} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, border: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', color: 'rgba(255,255,255,0.6)', fontSize: 16, cursor: 'pointer' }}>×</button>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{active.playerName}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{zonaLabel(active.zona)}</div>
              <div style={{ marginTop: 10 }}><EstadoPill estado={active.estado} /></div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {[
                ['Descripción', active.descripcion],
                ['Fecha lesión', active.fechaLesion],
                ['Alta estimada', active.fechaAltaEstimada ?? '—'],
                ['Alta real', active.fechaAltaReal ?? '—'],
                ['Mecanismo', active.mecanismo ?? '—'],
                ['Tratamiento', active.tratamiento ?? '—'],
              ].map(([l, v], i, arr) => (
                <div key={l} style={{ padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid #F4F7F5' : 'none' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13, color: '#0D1F14' }}>{v}</div>
                </div>
              ))}
              {active.observaciones && (
                <div style={{ marginTop: 12, padding: '12px 14px', background: '#F8FAF9', borderRadius: 9, borderLeft: '3px solid #1B6B3A' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Observaciones</div>
                  <div style={{ fontSize: 13, color: '#4A6358', lineHeight: 1.55 }}>{active.observaciones}</div>
                </div>
              )}
              {canEdit && (
                <button onClick={() => { setModal('none'); setTimeout(() => openEdit(active!), 80) }} style={{ width: '100%', marginTop: 16, padding: 12, border: 'none', borderRadius: 10, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Editar lesión
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal === 'form' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 500, padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 580, animation: 'fadeIn 0.15s ease', marginTop: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px 16px', borderBottom: '1px solid #F0F4F2', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>{active ? 'Editar lesión' : 'Registrar lesión'}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7A9485' }}>Completá los datos de la lesión</p>
              </div>
              <button onClick={() => setModal('none')} style={{ width: 32, height: 32, border: 'none', background: '#F0F4F2', borderRadius: '50%', fontSize: 18, color: '#7A9485', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '22px 28px 28px' }}>

              {/* Jugador */}
              <div style={{ marginBottom: 16 }}>
                <Label>Jugador *</Label>
                <select className="input" value={form.playerId} onChange={e => selectPlayer(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Zona */}
              <div style={{ marginBottom: 16 }}>
                <Label>Zona afectada *</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                  {ZONAS.map(z => {
                    const active2 = form.zona === z.id
                    return (
                      <button key={z.id} onClick={() => setForm(f => ({ ...f, zona: z.id }))} style={{ padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${active2 ? '#1B6B3A' : '#DDE9E3'}`, background: active2 ? '#E8F5EE' : '#fff', color: active2 ? '#1B6B3A' : '#4A6358', fontSize: 12, fontWeight: active2 ? 700 : 400, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${active2 ? '#1B6B3A' : '#C5D5C9'}`, background: active2 ? '#1B6B3A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', flexShrink: 0 }}>{active2 ? '✓' : ''}</span>
                        {z.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: 16 }}>
                <Label>Descripción de la lesión *</Label>
                <textarea className="input" rows={2} placeholder="Ej: Esguince grado II ligamento lateral externo" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* Fechas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
                <div><Label>Fecha de lesión</Label><input className="input" type="date" value={form.fechaLesion} onChange={e => setForm(f => ({ ...f, fechaLesion: e.target.value }))} /></div>
                <div><Label>Alta estimada</Label><input className="input" type="date" value={form.fechaAltaEstimada} onChange={e => setForm(f => ({ ...f, fechaAltaEstimada: e.target.value }))} /></div>
                <div><Label>Alta real</Label><input className="input" type="date" value={form.fechaAltaReal} onChange={e => setForm(f => ({ ...f, fechaAltaReal: e.target.value }))} /></div>
              </div>

              {/* Estado */}
              <div style={{ marginBottom: 16 }}>
                <Label>Estado</Label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {ESTADOS.map(e => {
                    const active2 = form.estado === e.id
                    return <button key={e.id} onClick={() => setForm(f => ({ ...f, estado: e.id }))} style={{ padding: '10px 8px', borderRadius: 9, border: `2px solid ${active2 ? e.color : '#DDE9E3'}`, background: active2 ? e.bg : '#fff', color: active2 ? e.color : '#7A9485', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{e.label}</button>
                  })}
                </div>
              </div>

              {/* Mecanismo + Tratamiento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <Label>Mecanismo <span style={{ fontWeight: 400, color: '#9AB5A8' }}>(cómo ocurrió)</span></Label>
                  <input className="input" placeholder="Ej: Tackle, caída, sobrecarga..." value={form.mecanismo} onChange={e => setForm(f => ({ ...f, mecanismo: e.target.value }))} />
                </div>
                <div>
                  <Label>Tratamiento</Label>
                  <input className="input" placeholder="Ej: Kinesiología 3x semana, hielo..." value={form.tratamiento} onChange={e => setForm(f => ({ ...f, tratamiento: e.target.value }))} />
                </div>
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: 20 }}>
                <Label>Observaciones <span style={{ fontWeight: 400, color: '#9AB5A8' }}>(opcional)</span></Label>
                <textarea className="input" rows={2} placeholder="Notas adicionales del médico o kinesiólogo..." value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #F0F4F2' }}>
                <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, border: 'none', borderRadius: 10, background: saving ? '#C5D5C9' : '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? 'Guardando...' : active ? 'Guardar cambios' : 'Registrar lesión'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {modal === 'delete' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 380 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEECEC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>🗑</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>Eliminar lesión</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#7A9485', lineHeight: 1.6 }}>¿Eliminar la lesión de <strong style={{ color: '#0D1F14' }}>{active.playerName}</strong>?</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={saving} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Eliminando...' : 'Sí, eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
