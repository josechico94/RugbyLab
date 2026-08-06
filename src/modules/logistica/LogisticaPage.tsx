// src/modules/logistica/LogisticaPage.tsx
// Integra el LogisticApp (Fantasy & Puntos BRC) como iframe + convocatorias RugbyLab

import { useState } from 'react'
import { useAuthStore } from '@/shared/store/authStore'

type SubView = 'convocatorias' | 'fantasy'

export default function LogisticaPage() {
  const user = useAuthStore(s => s.user)
  const [view, setView] = useState<SubView>('convocatorias')
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 58px - 48px)', display: 'flex', flexDirection: 'column' }}>

      {/* Sub-tabs */}
      {!fullscreen && (
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#fff', border: '1px solid #E4EBE7', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          <button onClick={() => setView('convocatorias')} style={{ padding: '7px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: view === 'convocatorias' ? '#0A2218' : 'transparent', color: view === 'convocatorias' ? '#fff' : '#7A9485', transition: 'all 0.15s' }}>
            📋 Convocatorias
          </button>
          <button onClick={() => setView('fantasy')} style={{ padding: '7px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: view === 'fantasy' ? '#0A2218' : 'transparent', color: view === 'fantasy' ? '#fff' : '#7A9485', transition: 'all 0.15s' }}>
            🏉 Fantasy & Puntos
          </button>
        </div>
      )}

      {/* ── CONVOCATORIAS ── */}
      {view === 'convocatorias' && !fullscreen && (
        <ConvocatoriasView user={user} />
      )}

      {/* ── FANTASY & PUNTOS (iframe) ── */}
      {view === 'fantasy' && (
        <div style={{ flex: 1, position: fullscreen ? 'fixed' : 'relative', inset: fullscreen ? 0 : undefined, zIndex: fullscreen ? 9999 : undefined, display: 'flex', flexDirection: 'column' }}>
          {!fullscreen && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#4A6358' }}>Sistema de puntos y Fantasy Rugby del BRC — conectado a Firebase del club.</p>
              <button onClick={() => setFullscreen(true)} style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: '#0A2218', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ⛶ Pantalla completa
              </button>
            </div>
          )}
          {fullscreen && (
            <button onClick={() => setFullscreen(false)} style={{ position: 'absolute', top: 14, right: 14, zIndex: 10000, padding: '8px 14px', border: 'none', borderRadius: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✕ Salir
            </button>
          )}
          <div style={{ flex: 1, borderRadius: fullscreen ? 0 : 14, overflow: 'hidden', border: fullscreen ? 'none' : '1px solid #E4EBE7' }}>
            <iframe src="/logisticapp.html" title="Fantasy & Puntos BRC" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} allow="fullscreen" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Convocatorias sub-component ───────────────────────────────
import { useEffect, useState as useState2 } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { StatCard, EmptyState } from '@/shared/components/ui'
import type { Convocatoria, ConvocatoriaEstado } from '@/shared/types'

const ESTADOS: Record<ConvocatoriaEstado, { label: string; bg: string; color: string; icon: string }> = {
  confirmado:     { label: 'Confirmado',     bg: '#E8F5EE', color: '#1B6B3A', icon: '✓' },
  pendiente:      { label: 'Pendiente',      bg: '#FEF3DC', color: '#B45309', icon: '⏳' },
  no_disponible:  { label: 'No disponible',  bg: '#FEECEC', color: '#B91C1C', icon: '✕' },
}

const EQUIPAMIENTO_DEFAULT = [
  'Camiseta oficial', 'Short y medias', 'Botines', 'Protector bucal',
  'Vendas / Strapping', 'Ropa de entrada en calor', 'Documento de identidad',
]

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const EMPTY_CONV = () => ({
  eventoId: null as string | null,
  titulo: '', fecha: new Date().toISOString().slice(0, 10),
  horaConcentracion: '13:00' as string | null, horaPartido: '15:00' as string | null,
  lugar: '' as string | null, rival: '' as string | null,
  transporte: '' as string | null,
  equipamiento: [...EQUIPAMIENTO_DEFAULT],
  notas: null as string | null,
  jugadores: [] as Convocatoria['jugadores'],
})

type Modal = 'none' | 'form' | 'delete' | 'detail' | 'respuesta'

function ConvocatoriasView({ user }: { user: any }) {
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'
  const isJugador = user?.role === 'jugador'

  const [convocatorias, setConvocatorias] = useState2<Convocatoria[]>([])
  const [players, setPlayers]   = useState2<{ id: string; name: string; position: string }[]>([])
  const [loading, setLoading]   = useState2(true)
  const [modal, setModal]       = useState2<Modal>('none')
  const [active, setActive]     = useState2<Convocatoria | null>(null)
  const [saving, setSaving]     = useState2(false)
  const [toast, setToast]       = useState2<{ msg: string; ok: boolean } | null>(null)
  const [tab, setTab]           = useState2<'proximas' | 'historial'>('proximas')
  const [form, setForm]         = useState2(EMPTY_CONV())
  const [newItem, setNewItem]   = useState2('')
  const [miRespuesta, setMiRespuesta] = useState2<ConvocatoriaEstado>('pendiente')
  const [miObs, setMiObs]       = useState2('')

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    if (!user) return
    async function load() {
      const [cSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'convocatorias'), where('clubId', '==', user.clubId))),
        getDocs(query(collection(db, 'players'),      where('clubId', '==', user.clubId))),
      ])
      setConvocatorias(cSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Convocatoria).sort((a,b) => b.fecha.localeCompare(a.fecha)))
      setPlayers(pSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name, position: (d.data() as any).position ?? '' })))
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user])

  function openCreate() {
    const conv = EMPTY_CONV()
    conv.jugadores = players.map(p => ({ playerId: p.id, playerName: p.name, position: p.position, estado: 'pendiente', observacion: null }))
    setForm(conv); setActive(null); setModal('form')
  }

  function openEdit(c: Convocatoria) {
    setForm({ eventoId: c.eventoId, titulo: c.titulo, fecha: c.fecha, horaConcentracion: c.horaConcentracion, horaPartido: c.horaPartido, lugar: c.lugar ?? '', rival: c.rival ?? '', transporte: c.transporte ?? '', equipamiento: [...c.equipamiento], notas: c.notas, jugadores: JSON.parse(JSON.stringify(c.jugadores)) })
    setActive(c); setModal('form')
  }

  function toggleJugador(p: { id: string; name: string; position: string }) {
    const exists = form.jugadores.some(j => j.playerId === p.id)
    setForm(f => ({ ...f, jugadores: exists ? f.jugadores.filter(j => j.playerId !== p.id) : [...f.jugadores, { playerId: p.id, playerName: p.name, position: p.position, estado: 'pendiente', observacion: null }] }))
  }

  async function handleSave() {
    if (!user || !form.titulo.trim()) return showToast('Ingresá un título', false)
    setSaving(true)
    const data = { clubId: user.clubId, eventoId: form.eventoId, titulo: form.titulo.trim(), fecha: form.fecha, horaConcentracion: form.horaConcentracion || null, horaPartido: form.horaPartido || null, lugar: form.lugar?.trim() || null, rival: form.rival?.trim() || null, transporte: form.transporte?.trim() || null, equipamiento: form.equipamiento, notas: form.notas?.trim() || null, jugadores: form.jugadores, createdBy: user.uid }
    try {
      if (active) {
        await updateDoc(doc(db, 'convocatorias', active.id), data)
        setConvocatorias(prev => prev.map(c => c.id === active.id ? { ...c, ...data } as Convocatoria : c))
        showToast('Convocatoria actualizada')
      } else {
        const ref = await addDoc(collection(db, 'convocatorias'), { ...data, createdAt: serverTimestamp() })
        setConvocatorias(prev => [{ id: ref.id, ...data, createdAt: new Date() } as unknown as Convocatoria, ...prev])
        showToast('Convocatoria creada')
      }
      setModal('none')
    } catch { showToast('Error al guardar', false) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!active) return; setSaving(true)
    try { await deleteDoc(doc(db, 'convocatorias', active.id)); setConvocatorias(prev => prev.filter(c => c.id !== active.id)); setModal('none'); showToast('Eliminada') }
    catch { showToast('Error', false) }
    finally { setSaving(false) }
  }

  function openRespuesta(c: Convocatoria) {
    const mi = c.jugadores.find(j => j.playerId === user?.uid)
    setMiRespuesta(mi?.estado ?? 'pendiente'); setMiObs(mi?.observacion ?? '')
    setActive(c); setModal('respuesta')
  }

  async function handleRespuesta() {
    if (!active || !user) return; setSaving(true)
    const jugadores = active.jugadores.map(j => j.playerId === user.uid ? { ...j, estado: miRespuesta, observacion: miObs.trim() || null } : j)
    try {
      await updateDoc(doc(db, 'convocatorias', active.id), { jugadores })
      setConvocatorias(prev => prev.map(c => c.id === active.id ? { ...c, jugadores } : c))
      showToast('Respuesta enviada'); setModal('none')
    } catch { showToast('Error', false) }
    finally { setSaving(false) }
  }

  const today2 = new Date().toISOString().slice(0, 10)
  const proximas = convocatorias.filter(c => c.fecha >= today2)
  const historial = convocatorias.filter(c => c.fecha < today2)
  const confirmados = (c: Convocatoria) => c.jugadores.filter(j => j.estado === 'confirmado').length
  const pendientes  = (c: Convocatoria) => c.jugadores.filter(j => j.estado === 'pendiente').length
  const miConvocado = (c: Convocatoria) => c.jugadores.find(j => j.playerId === user?.uid)

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {toast && <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: toast.ok ? '#0A2218' : '#B91C1C', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600 }}>{toast.msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Convocatorias activas"  value={String(proximas.length)}                        accentColor="#1B6B3A" />
        <StatCard label="Confirmados (total)"    value={String(proximas.reduce((a,c)=>a+confirmados(c),0))} accentColor="#1B6B3A" deltaType="up" />
        <StatCard label="Pendientes de respuesta" value={String(proximas.reduce((a,c)=>a+pendientes(c),0))} accentColor="#B45309" deltaType="warn" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', background: '#fff', border: '1px solid #E4EBE7', borderRadius: 8, padding: 3 }}>
          {(['proximas','historial'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#0A2218' : 'transparent', color: tab === t ? '#fff' : '#7A9485' }}>
              {t === 'proximas' ? '📋 Próximas' : '🗂 Historial'}
            </button>
          ))}
        </div>
        {canEdit && <button onClick={openCreate} style={{ marginLeft: 'auto', padding: '9px 18px', border: 'none', borderRadius: 9, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nueva convocatoria</button>}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9AB5A8' }}>Cargando...</div>
      : (tab === 'proximas' ? proximas : historial).length === 0
        ? <EmptyState icon="📋" title={tab === 'proximas' ? 'Sin convocatorias activas' : 'Sin historial'} desc={canEdit ? 'Hacé click en "+ Nueva convocatoria"' : 'No hay convocatorias disponibles'} />
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(tab === 'proximas' ? proximas : historial).map(c => {
            const mi = miConvocado(c)
            return (
              <div key={c.id} className="card" style={{ opacity: tab === 'historial' ? 0.75 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #F0F4F2' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0D1F14', marginBottom: 4 }}>{c.titulo} {c.rival && <span style={{ fontSize: 13, color: '#7A9485', fontWeight: 400 }}>vs {c.rival}</span>}</div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#7A9485', flexWrap: 'wrap' }}>
                      <span>📅 {new Date(c.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}</span>
                      {c.horaConcentracion && <span>🕐 Conc: {c.horaConcentracion}h</span>}
                      {c.horaPartido && <span>🏉 Partido: {c.horaPartido}h</span>}
                      {c.lugar && <span>📍 {c.lugar}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                    {isJugador && mi && <button onClick={() => openRespuesta(c)} style={{ padding: '7px 14px', border: `1.5px solid ${ESTADOS[mi.estado].color}`, borderRadius: 8, background: ESTADOS[mi.estado].bg, color: ESTADOS[mi.estado].color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{ESTADOS[mi.estado].icon} {ESTADOS[mi.estado].label}</button>}
                    <button onClick={() => { setActive(c); setModal('detail') }} style={{ padding: '7px 13px', border: '1px solid #DDE9E3', borderRadius: 8, background: '#fff', color: '#4A6358', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Ver</button>
                    {canEdit && <>
                      <button onClick={() => openEdit(c)} style={{ padding: '7px 13px', border: '1px solid #C5E3D1', borderRadius: 8, background: '#E8F5EE', color: '#1B6B3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => { setActive(c); setModal('delete') }} style={{ padding: '7px 11px', border: '1px solid #FEECEC', borderRadius: 8, background: '#FEECEC', color: '#B91C1C', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕</button>
                    </>}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: '#F8FAF9' }}>
                  <span style={{ fontSize: 12, color: '#1B6B3A', fontWeight: 700 }}>✓ {confirmados(c)}</span>
                  <span style={{ fontSize: 12, color: '#B45309', fontWeight: 700 }}>⏳ {pendientes(c)}</span>
                  <span style={{ fontSize: 12, color: '#B91C1C', fontWeight: 700 }}>✕ {c.jugadores.filter(j=>j.estado==='no_disponible').length}</span>
                  <div style={{ flex: 1, height: 5, background: '#E4EBE7', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${c.jugadores.length ? confirmados(c)/c.jugadores.length*100 : 0}%`, background: '#1B6B3A', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#9AB5A8' }}>{c.jugadores.length} convocados</span>
                </div>
                {/* Avatars */}
                <div style={{ padding: '10px 20px', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {c.jugadores.slice(0, 15).map(j => {
                    const s = ESTADOS[j.estado]
                    return <div key={j.playerId} title={`${j.playerName} — ${s.label}`} style={{ width: 28, height: 28, borderRadius: '50%', background: '#E8F5EE', color: '#1B6B3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, border: `2px solid ${s.color}` }}>{getInitials(j.playerName)}</div>
                  })}
                </div>
              </div>
            )
          })}
        </div>
      }

      {/* Detail modal */}
      {modal === 'detail' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 500, padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560, marginTop: 20, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ background: '#0A2218', padding: '22px 24px', position: 'relative' }}>
              <button onClick={() => setModal('none')} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, border: 'none', background: 'rgba(255,255,255,.1)', borderRadius: '50%', color: 'rgba(255,255,255,.6)', fontSize: 16, cursor: 'pointer' }}>×</button>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{active.titulo}</div>
              {active.rival && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>vs {active.rival}</div>}
              <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,.6)', flexWrap: 'wrap' }}>
                <span>📅 {new Date(active.fecha).toLocaleDateString('es-AR', { weekday: 'long', day:'2-digit', month:'long' })}</span>
                {active.horaConcentracion && <span>🕐 {active.horaConcentracion}h</span>}
                {active.lugar && <span>📍 {active.lugar}</span>}
              </div>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {active.transporte && <div style={{ marginBottom: 14, padding: '10px 14px', background: '#EBF4FF', borderRadius: 9, fontSize: 13, color: '#1D5FAD', fontWeight: 600 }}>🚌 {active.transporte}</div>}
              {active.equipamiento.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1F14', marginBottom: 8 }}>🎒 Qué traer</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                    {active.equipamiento.map((item, i) => <div key={i} style={{ fontSize: 12, color: '#4A6358', display: 'flex', gap: 6, alignItems: 'center' }}><span style={{ width: 14, height: 14, borderRadius: 3, background: '#E8F5EE', color: '#1B6B3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>✓</span>{item}</div>)}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1F14', marginBottom: 10 }}>Jugadores ({active.jugadores.length})</div>
              <div style={{ border: '1px solid #E4EBE7', borderRadius: 10, overflow: 'hidden' }}>
                {active.jugadores.map((j, i) => {
                  const s = ESTADOS[j.estado]
                  return <div key={j.playerId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < active.jugadores.length-1 ? '1px solid #F4F7F5' : 'none' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#E8F5EE', color: '#1B6B3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{getInitials(j.playerName)}</div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0D1F14' }}>{j.playerName}</div>
                    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>{s.icon} {s.label}</span>
                  </div>
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Respuesta modal */}
      {modal === 'respuesta' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380 }}>
            <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid #F0F4F2' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0D1F14' }}>Tu respuesta</h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7A9485' }}>{active.titulo}</p>
            </div>
            <div style={{ padding: '18px 24px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {(Object.entries(ESTADOS) as [ConvocatoriaEstado, typeof ESTADOS[ConvocatoriaEstado]][]).map(([id, s]) => (
                  <button key={id} onClick={() => setMiRespuesta(id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 9, border: `2px solid ${miRespuesta === id ? s.color : '#DDE9E3'}`, background: miRespuesta === id ? s.bg : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: miRespuesta === id ? s.color : '#4A6358' }}>{s.label}</span>
                  </button>
                ))}
              </div>
              <input className="input" style={{ marginBottom: 16 }} placeholder="Observación opcional..." value={miObs} onChange={e => setMiObs(e.target.value)} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleRespuesta} disabled={saving} style={{ flex: 2, padding: 12, border: 'none', borderRadius: 10, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Enviando...' : 'Confirmar respuesta'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {modal === 'form' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 500, padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 600, marginTop: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 14px', borderBottom: '1px solid #F0F4F2', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0D1F14' }}>{active ? 'Editar convocatoria' : 'Nueva convocatoria'}</h2>
              <button onClick={() => setModal('none')} style={{ width: 30, height: 30, border: 'none', background: '#F0F4F2', borderRadius: '50%', fontSize: 17, color: '#7A9485', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Título *</label><input className="input" placeholder="Ej: Partido vs RC Belgrano" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Rival</label><input className="input" placeholder="Ej: RC Belgrano" value={form.rival ?? ''} onChange={e => setForm(f => ({ ...f, rival: e.target.value }))} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Fecha</label><input className="input" type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Hora conc.</label><input className="input" type="time" value={form.horaConcentracion ?? ''} onChange={e => setForm(f => ({ ...f, horaConcentracion: e.target.value }))} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Hora partido</label><input className="input" type="time" value={form.horaPartido ?? ''} onChange={e => setForm(f => ({ ...f, horaPartido: e.target.value }))} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Lugar</label><input className="input" placeholder="Campo principal" value={form.lugar ?? ''} onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} /></div>
              </div>
              <div style={{ marginBottom: 14 }}><label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Transporte</label><input className="input" placeholder="Ej: Bus sale 12:30 desde el club" value={form.transporte ?? ''} onChange={e => setForm(f => ({ ...f, transporte: e.target.value }))} /></div>

              {/* Equipamiento */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 8 }}>🎒 Qué traer</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 8 }}>
                  {form.equipamiento.map((item, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', background: '#F8FAF9', borderRadius: 6 }}><span style={{ flex: 1, fontSize: 11, color: '#4A6358' }}>{item}</span><button onClick={() => setForm(f => ({ ...f, equipamiento: f.equipamiento.filter((_,j) => j !== i) }))} style={{ border: 'none', background: 'none', color: '#B91C1C', fontSize: 12, cursor: 'pointer' }}>✕</button></div>)}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" placeholder="Agregar item..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) { setForm(f => ({ ...f, equipamiento: [...f.equipamiento, newItem.trim()] })); setNewItem('') } }} style={{ flex: 1 }} />
                  <button onClick={() => { if (newItem.trim()) { setForm(f => ({ ...f, equipamiento: [...f.equipamiento, newItem.trim()] })); setNewItem('') } }} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: '#E8F5EE', color: '#1B6B3A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+</button>
                </div>
              </div>

              {/* Jugadores */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358' }}>Jugadores ({form.jugadores.length})</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setForm(f => ({ ...f, jugadores: players.map(p => ({ playerId: p.id, playerName: p.name, position: p.position, estado: 'pendiente' as ConvocatoriaEstado, observacion: null })) }))} style={{ padding: '4px 10px', border: '1px solid #1B6B3A', borderRadius: 6, background: '#E8F5EE', color: '#1B6B3A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Todos</button>
                    <button onClick={() => setForm(f => ({ ...f, jugadores: [] }))} style={{ padding: '4px 10px', border: '1px solid #DDE9E3', borderRadius: 6, background: '#fff', color: '#7A9485', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Ninguno</button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '10px', background: '#F8FAF9', borderRadius: 9 }}>
                  {players.map(p => { const sel = form.jugadores.some(j => j.playerId === p.id); return <button key={p.id} onClick={() => toggleJugador(p)} style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${sel ? '#1B6B3A' : '#DDE9E3'}`, background: sel ? '#E8F5EE' : '#fff', color: sel ? '#1B6B3A' : '#7A9485', fontSize: 11, fontWeight: sel ? 700 : 400, cursor: 'pointer' }}>{sel ? '✓ ' : ''}{p.name}</button> })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #F0F4F2' }}>
                <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 12, border: 'none', borderRadius: 10, background: saving ? '#C5D5C9' : '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Guardando...' : active ? 'Guardar cambios' : 'Crear convocatoria'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {modal === 'delete' && active && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 360 }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEECEC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>🗑</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#0D1F14' }}>Eliminar convocatoria</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#7A9485' }}>¿Eliminar <strong style={{ color: '#0D1F14' }}>{active.titulo}</strong>?</p>
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
