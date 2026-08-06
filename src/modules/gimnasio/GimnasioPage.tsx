// src/modules/gimnasio/GimnasioPage.tsx
import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { StatCard, EmptyState } from '@/shared/components/ui'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Routine, RoutineDay, Exercise, ExerciseBlock, BlockType, SetDetail } from '@/shared/types'

// ── Constants ──────────────────────────────────────────────────
const DAYS    = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'] as const
const SESSION_TYPES = ['Fuerza','Potencia','Resistencia','Velocidad','Técnica','Descanso'] as const
type DayName     = typeof DAYS[number]
type SessionType = typeof SESSION_TYPES[number]

const BLOCK_TYPES: { id: BlockType; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'entrada_calor', label: 'Entrada en calor', icon: '🔥', color: '#B45309', bg: '#FEF3DC' },
  { id: 'principal',     label: 'Bloque principal', icon: '💪', color: '#1B6B3A', bg: '#E8F5EE' },
  { id: 'circuito',      label: 'Circuito intermitente', icon: '⚡', color: '#5047E5', bg: '#F0EFFE' },
  { id: 'skills',        label: 'Skills / Técnica',   icon: '🏉', color: '#1D5FAD', bg: '#EBF4FF' },
  { id: 'vuelta_calma',  label: 'Vuelta a la calma',  icon: '🧘', color: '#5F5E5A', bg: '#F1EFE8' },
]

const TYPE_COLOR: Record<SessionType, { bg: string; color: string }> = {
  Fuerza:     { bg: '#E8F5EE', color: '#1B6B3A' },
  Potencia:   { bg: '#EBF4FF', color: '#1D5FAD' },
  Resistencia:{ bg: '#F0EFFE', color: '#5047E5' },
  Velocidad:  { bg: '#FEF3DC', color: '#B45309' },
  Técnica:    { bg: '#EEEDFE', color: '#534AB7' },
  Descanso:   { bg: '#F1EFE8', color: '#5F5E5A' },
}

const MOCK_EVOLUTION = [
  { week: 'S8',  squat: 100, bench: 85,  dead: 120 },
  { week: 'S9',  squat: 105, bench: 87,  dead: 125 },
  { week: 'S10', squat: 110, bench: 90,  dead: 130 },
  { week: 'S11', squat: 115, bench: 95,  dead: 130 },
  { week: 'S12', squat: 120, bench: 100, dead: 135 },
]

// ── Helpers ────────────────────────────────────────────────────
function blockMeta(id: BlockType) {
  return BLOCK_TYPES.find(b => b.id === id) ?? BLOCK_TYPES[1]
}

function TypePill({ type }: { type: string }) {
  const s = TYPE_COLOR[type as SessionType] ?? { bg: '#F1EFE8', color: '#5F5E5A' }
  return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>{type}</span>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 6 }}>{children}</label>
}

function SmallInput({ value, onChange, type = 'text', placeholder = '', style = {} }: { value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string; style?: React.CSSProperties }) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ padding: '7px 8px', ...style }}
    />
  )
}

// ── Empty factories ─────────────────────────────────────────────
const emptyExercise = (): Exercise => ({
  name: '', sets: 3, reps: 8, weight: null, unit: 'kg', notes: null, setDetails: null,
})

const emptyBlock = (blockType: BlockType): ExerciseBlock => ({
  blockType,
  exercises: [emptyExercise()],
  circuitRounds: blockType === 'circuito' ? 4 : null,
  circuitRestSecs: blockType === 'circuito' ? 30 : null,
})

const emptyDay = (day: DayName): RoutineDay => ({
  day, type: 'Fuerza',
  blocks: [emptyBlock('entrada_calor'), emptyBlock('principal')],
  completed: false, completedAt: null,
})

// ── Sanitize for Firestore ──────────────────────────────────────
function sanitizeDays(days: RoutineDay[]) {
  return days.map(d => ({
    day:         d.day,
    type:        d.type,
    completed:   d.completed ?? false,
    completedAt: d.completedAt ?? null,
    blocks: d.blocks.map(b => ({
      blockType:       b.blockType,
      circuitRounds:   b.circuitRounds ?? null,
      circuitRestSecs: b.circuitRestSecs ?? null,
      exercises: b.exercises.map(ex => ({
        name:  ex.name  ?? '',
        sets:  ex.sets  ?? 0,
        reps:  ex.reps  ?? 0,
        weight: ex.weight ?? null,
        unit:  ex.unit  ?? 'kg',
        notes: ex.notes ?? null,
        setDetails: ex.setDetails
          ? ex.setDetails.map(s => ({ reps: s.reps ?? 0, weight: s.weight ?? null }))
          : null,
      })),
    })),
  }))
}

// ── Component ──────────────────────────────────────────────────
export default function GimnasioPage() {
  const user    = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  const [routines, setRoutines]         = useState<Routine[]>([])
  const [players, setPlayers]           = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading]           = useState(true)
  const [activeRoutine, setActiveRoutine] = useState<Routine | null>(null)
  const [activeDay, setActiveDay]       = useState<RoutineDay | null>(null)
  const [activeBlock, setActiveBlock]   = useState<BlockType | null>(null)
  const [tab, setTab]                   = useState<'rutina' | 'evolucion'>('rutina')
  const [modal, setModal]               = useState<'none' | 'form' | 'delete'>('none')
  const [saving, setSaving]             = useState(false)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  // Form
  const [fPlayerID, setFPlayerID] = useState('')
  const [fWeek, setFWeek]         = useState(String(getCurrentWeek()))
  const [fYear, setFYear]         = useState(String(new Date().getFullYear()))
  const [fDays, setFDays]         = useState<RoutineDay[]>([emptyDay('Lunes'), emptyDay('Miércoles'), emptyDay('Viernes')])

  function getCurrentWeek() {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Fetch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      const [rSnap, pSnap] = await Promise.all([
        getDocs(query(collection(db, 'routines'), where('clubId', '==', user!.clubId))),
        getDocs(query(collection(db, 'players'),  where('clubId', '==', user!.clubId))),
      ])
      const rs = rSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Routine)
      setRoutines(rs)
      setPlayers(pSnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name })))
      if (user!.role === 'jugador') {
        const mine = rs.find(r => r.playerId === user!.uid)
        if (mine) { setActiveRoutine(mine); setActiveDay(mine.days[0] ?? null) }
      }
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user])

  // ── Form helpers ────────────────────────────────────────────
  function openCreate() {
    setFPlayerID(players[0]?.id ?? '')
    setFWeek(String(getCurrentWeek()))
    setFYear(String(new Date().getFullYear()))
    setFDays([emptyDay('Lunes'), emptyDay('Miércoles'), emptyDay('Viernes')])
    setActiveRoutine(null)
    setModal('form')
  }

  function openEdit(r: Routine) {
    setFPlayerID(r.playerId)
    setFWeek(String(r.week))
    setFYear(String(r.year))
    // Migrar días viejos (con exercises plano) a bloques
    const days = r.days.map(d => ({
      ...d,
      blocks: (d.blocks && d.blocks.length > 0) ? d.blocks : [
        { blockType: 'principal' as BlockType, exercises: (d as any).exercises ?? [], circuitRounds: null, circuitRestSecs: null },
      ],
    }))
    setFDays(JSON.parse(JSON.stringify(days)))
    setActiveRoutine(r)
    setModal('form')
  }

  // Day operations
  function addDay() {
    const used = new Set(fDays.map(d => d.day))
    const next = DAYS.find(d => !used.has(d))
    if (next) setFDays(prev => [...prev, emptyDay(next)])
  }
  function removeDay(di: number) { setFDays(prev => prev.filter((_, i) => i !== di)) }
  function updateDay(di: number, patch: Partial<RoutineDay>) {
    setFDays(prev => prev.map((d, i) => i === di ? { ...d, ...patch } : d))
  }

  // Block operations
  function addBlock(di: number, bt: BlockType) {
    setFDays(prev => prev.map((d, i) => i === di ? { ...d, blocks: [...d.blocks, emptyBlock(bt)] } : d))
  }
  function removeBlock(di: number, bi: number) {
    setFDays(prev => prev.map((d, i) => i === di ? { ...d, blocks: d.blocks.filter((_, j) => j !== bi) } : d))
  }
  function updateBlock(di: number, bi: number, patch: Partial<ExerciseBlock>) {
    setFDays(prev => prev.map((d, i) => i === di
      ? { ...d, blocks: d.blocks.map((b, j) => j === bi ? { ...b, ...patch } : b) }
      : d
    ))
  }

  // Exercise operations
  function addExercise(di: number, bi: number) {
    setFDays(prev => prev.map((d, i) => i === di
      ? { ...d, blocks: d.blocks.map((b, j) => j === bi ? { ...b, exercises: [...b.exercises, emptyExercise()] } : b) }
      : d
    ))
  }
  function removeExercise(di: number, bi: number, ei: number) {
    setFDays(prev => prev.map((d, i) => i === di
      ? { ...d, blocks: d.blocks.map((b, j) => j === bi ? { ...b, exercises: b.exercises.filter((_, k) => k !== ei) } : b) }
      : d
    ))
  }
  function updateExercise(di: number, bi: number, ei: number, patch: Partial<Exercise>) {
    setFDays(prev => prev.map((d, i) => i === di
      ? { ...d, blocks: d.blocks.map((b, j) => j === bi
          ? { ...b, exercises: b.exercises.map((e, k) => k === ei ? { ...e, ...patch } : e) }
          : b
        )}
      : d
    ))
  }

  // SetDetail operations
  function toggleSetDetails(di: number, bi: number, ei: number, ex: Exercise) {
    if (ex.setDetails) {
      updateExercise(di, bi, ei, { setDetails: null })
    } else {
      const sets: SetDetail[] = Array.from({ length: ex.sets || 3 }, () => ({ reps: ex.reps || 8, weight: ex.weight ?? null }))
      updateExercise(di, bi, ei, { setDetails: sets })
    }
  }
  function updateSetDetail(di: number, bi: number, ei: number, si: number, patch: Partial<SetDetail>) {
    setFDays(prev => prev.map((d, i) => i === di
      ? { ...d, blocks: d.blocks.map((b, j) => j === bi
          ? { ...b, exercises: b.exercises.map((e, k) => k === ei
              ? { ...e, setDetails: e.setDetails?.map((s, l) => l === si ? { ...s, ...patch } : s) ?? null }
              : e
            )}
          : b
        )}
      : d
    ))
  }
  function addSetDetail(di: number, bi: number, ei: number, ex: Exercise) {
    const last = ex.setDetails?.[ex.setDetails.length - 1]
    const newSet: SetDetail = { reps: last?.reps ?? 6, weight: last?.weight ?? null }
    updateExercise(di, bi, ei, { setDetails: [...(ex.setDetails ?? []), newSet], sets: (ex.setDetails?.length ?? 0) + 1 })
  }
  function removeSetDetail(di: number, bi: number, ei: number, si: number, ex: Exercise) {
    const updated = ex.setDetails?.filter((_, l) => l !== si) ?? []
    updateExercise(di, bi, ei, { setDetails: updated.length > 0 ? updated : null, sets: updated.length || ex.sets })
  }

  // ── Save ────────────────────────────────────────────────────
  async function handleSave() {
    if (!user || !fPlayerID) return
    setSaving(true)
    const data = {
      playerId:  fPlayerID,
      clubId:    user.clubId,
      week:      Number(fWeek),
      year:      Number(fYear),
      days:      sanitizeDays(fDays),
      createdBy: user.uid,
    }
    try {
      if (activeRoutine) {
        await updateDoc(doc(db, 'routines', activeRoutine.id), data)
        setRoutines(prev => prev.map(r => r.id === activeRoutine.id ? { ...r, ...data } : r))
        showToast('Rutina actualizada correctamente')
      } else {
        const ref = await addDoc(collection(db, 'routines'), { ...data, createdAt: serverTimestamp() })
        const newR = { id: ref.id, ...data } as unknown as Routine
        setRoutines(prev => [...prev, newR])
        setActiveRoutine(newR); setActiveDay(newR.days[0] ?? null)
        showToast('Rutina creada correctamente')
      }
      setModal('none')
    } catch (e) {
      console.error(e)
      showToast('Error al guardar — revisá los permisos', false)
    } finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!activeRoutine) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'routines', activeRoutine.id))
      setRoutines(prev => prev.filter(r => r.id !== activeRoutine.id))
      setActiveRoutine(null); setActiveDay(null)
      setModal('none'); showToast('Rutina eliminada')
    } catch { showToast('Error al eliminar', false) }
    finally { setSaving(false) }
  }

  async function markDayComplete(dayName: string) {
    if (!activeRoutine) return
    const updated = {
      ...activeRoutine,
      days: activeRoutine.days.map(d =>
        d.day === dayName ? { ...d, completed: !d.completed } : d
      ),
    }
    setActiveRoutine(updated)
    setActiveDay(updated.days.find(d => d.day === dayName) ?? null)
    try { await updateDoc(doc(db, 'routines', activeRoutine.id), { days: updated.days }) } catch {}
  }

  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? '—'
  const displayed  = activeDay ?? activeRoutine?.days[0] ?? null
  const completedN = activeRoutine?.days.filter(d => d.completed).length ?? 0

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="fade-in">

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 1000, background: toast.ok ? '#0A2218' : '#B91C1C', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, animation: 'fadeIn 0.2s ease' }}>
          {toast.msg}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Rutinas activas"  value={String(routines.length)} accentColor="#1B6B3A" />
        <StatCard label="Sesiones semana"  value={activeRoutine ? `${completedN} / ${activeRoutine.days.length}` : '—'} accentColor="#B45309" deltaType="warn" />
        <StatCard label="1RM Sentadilla"   value="120 kg" delta="▲ 5 kg" deltaType="up" accentColor="#5047E5" />
        <StatCard label="Peso corporal"    value="88 kg"  delta="▲ 0.5 kg" deltaType="up" accentColor="#1B6B3A" />
      </div>

      {/* Admin toolbar */}
      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {routines.length > 0 && (
            <select className="input" style={{ maxWidth: 340 }}
              value={activeRoutine?.id ?? ''}
              onChange={e => {
                const r = routines.find(r => r.id === e.target.value) ?? null
                setActiveRoutine(r); setActiveDay(r?.days[0] ?? null)
              }}
            >
              <option value="">— Seleccionar rutina —</option>
              {routines.map(r => <option key={r.id} value={r.id}>{playerName(r.playerId)} — Semana {r.week} / {r.year}</option>)}
            </select>
          )}
          <button onClick={openCreate} style={{ padding: '9px 18px', border: 'none', borderRadius: 9, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Nueva rutina</button>
          {activeRoutine && <>
            <button onClick={() => openEdit(activeRoutine)} style={{ padding: '9px 16px', border: '1px solid #DDE9E3', borderRadius: 9, background: '#fff', color: '#1B6B3A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
            <button onClick={() => setModal('delete')} style={{ padding: '9px 14px', border: '1px solid #FEECEC', borderRadius: 9, background: '#FEECEC', color: '#B91C1C', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
          </>}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#fff', border: '1px solid #E4EBE7', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['rutina','evolucion'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 20px', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: tab === t ? '#0A2218' : 'transparent', color: tab === t ? '#fff' : '#7A9485', transition: 'all 0.15s' }}>
            {t === 'rutina' ? 'Rutina semanal' : 'Evolución de cargas'}
          </button>
        ))}
      </div>

      {/* ── TAB RUTINA ── */}
      {tab === 'rutina' && (
        loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9AB5A8' }}>Cargando...</div>
        : !activeRoutine ? (
          <EmptyState icon="🏋️" title="Sin rutina asignada" desc={canEdit ? 'Hacé click en "+ Nueva rutina"' : 'El preparador físico aún no asignó tu rutina'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
            {/* Day list */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#7A9485', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Semana {activeRoutine.week} — {playerName(activeRoutine.playerId)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {activeRoutine.days.map(d => {
                  const isActive = displayed?.day === d.day
                  return (
                    <button key={d.day} onClick={() => setActiveDay(d)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 10, border: isActive ? 'none' : '1px solid #E4EBE7', background: isActive ? '#0A2218' : '#fff', color: isActive ? '#fff' : '#0D1F14', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' } as React.CSSProperties}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{d.day}</div>
                        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 1 }}>{d.type} · {d.blocks?.reduce((a,b) => a + b.exercises.length, 0) ?? 0} ej.</div>
                      </div>
                      {d.completed ? <span style={{ fontSize: 13, color: isActive ? '#4ADE80' : '#1B6B3A' }}>✓</span> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E4EBE7', display: 'block' }} />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Day detail */}
            {displayed && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0D1F14' }}>{displayed.day}</h2>
                    <TypePill type={displayed.type} />
                  </div>
                  {displayed.completed
                    ? <span style={{ background: '#E8F5EE', color: '#1B6B3A', fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 20 }}>✓ Completado</span>
                    : <button onClick={() => markDayComplete(displayed.day)} style={{ padding: '7px 16px', border: 'none', borderRadius: 8, background: '#1B6B3A', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Marcar completado</button>
                  }
                </div>

                {/* Blocks */}
                {(displayed.blocks ?? []).map((block, bi) => {
                  const bm = blockMeta(block.blockType)
                  return (
                    <div key={bi} style={{ marginBottom: 16, border: '1px solid #E4EBE7', borderRadius: 12, overflow: 'hidden' }}>
                      {/* Block header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: bm.bg, borderBottom: '1px solid #E4EBE7' }}>
                        <span style={{ fontSize: 16 }}>{bm.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: bm.color }}>{bm.label}</span>
                        {block.blockType === 'circuito' && block.circuitRounds && (
                          <span style={{ fontSize: 11, color: bm.color, opacity: 0.8 }}>{block.circuitRounds} rondas · {block.circuitRestSecs}seg descanso</span>
                        )}
                      </div>
                      {/* Exercises */}
                      <div style={{ background: '#fff' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 12, padding: '8px 16px', background: '#F8FAF9', borderBottom: '1px solid #F0F4F2' }}>
                          {['Ejercicio', 'Series / Carga', 'Notas'].map(h => (
                            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#7A9485', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                          ))}
                        </div>
                        {block.exercises.map((ex, ei) => (
                          <div key={ei} style={{ padding: '12px 16px', borderBottom: ei < block.exercises.length - 1 ? '1px solid #F4F7F5' : 'none' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', gap: 12, alignItems: 'start' }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1F14' }}>{ex.name}</div>
                              <div>
                                {ex.setDetails ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    {ex.setDetails.map((s, si) => (
                                      <div key={si} style={{ fontSize: 12, color: '#4A6358', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#E8F5EE', color: '#1B6B3A', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{si + 1}</span>
                                        <span>{s.reps} reps {s.weight ? `· ${s.weight} ${ex.unit ?? 'kg'}` : ''}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span style={{ fontSize: 12, color: '#4A6358' }}>
                                    {ex.sets} × {ex.reps} rep{ex.weight ? ` · ${ex.weight} ${ex.unit ?? 'kg'}` : ''}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 12, color: '#9AB5A8' }}>{ex.notes || '—'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      )}

      {/* ── TAB EVOLUCIÓN ── */}
      {tab === 'evolucion' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #E4EBE7', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F4F2', fontSize: 13, fontWeight: 700, color: '#0D1F14' }}>Evolución de cargas — últimas 5 semanas</div>
            <div style={{ padding: '16px 18px' }}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={MOCK_EVOLUTION} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: '#7A9485' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#7A9485' }} axisLine={false} tickLine={false} unit=" kg" />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4EBE7', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, n: string) => [`${v} kg`, n === 'squat' ? 'Sentadilla' : n === 'bench' ? 'Press banca' : 'Peso muerto']} />
                  <Line type="monotone" dataKey="squat" stroke="#1B6B3A" strokeWidth={2.5} dot={{ r: 4, fill: '#1B6B3A' }} />
                  <Line type="monotone" dataKey="bench" stroke="#5047E5" strokeWidth={2.5} dot={{ r: 4, fill: '#5047E5' }} />
                  <Line type="monotone" dataKey="dead"  stroke="#E8A020" strokeWidth={2.5} dot={{ r: 4, fill: '#E8A020' }} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
                {[['#1B6B3A','Sentadilla'],['#5047E5','Press banca'],['#E8A020','Peso muerto']].map(([c,l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                    <span style={{ fontSize: 12, color: '#4A6358' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal === 'form' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 500, padding: 20, overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 800, animation: 'fadeIn 0.15s ease', marginTop: 20, marginBottom: 20 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px 16px', borderBottom: '1px solid #F0F4F2', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>{activeRoutine ? 'Editar rutina' : 'Nueva rutina de entrenamiento'}</h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7A9485' }}>Organizá por bloques: entrada en calor, principal, circuito y skills</p>
              </div>
              <button onClick={() => setModal('none')} style={{ width: 32, height: 32, border: 'none', background: '#F0F4F2', borderRadius: '50%', fontSize: 18, color: '#7A9485', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '22px 28px 28px' }}>
              {/* Jugador + semana */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px', gap: 14, marginBottom: 24 }}>
                <div>
                  <Label>Jugador *</Label>
                  <select className="input" value={fPlayerID} onChange={e => setFPlayerID(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><Label>Semana</Label><SmallInput value={fWeek} onChange={setFWeek} type="number" /></div>
                <div><Label>Año</Label><SmallInput value={fYear} onChange={setFYear} type="number" /></div>
              </div>

              {/* Días */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Label>Días de entrenamiento</Label>
                {fDays.length < 7 && (
                  <button onClick={addDay} style={{ padding: '6px 14px', border: '1px solid #1B6B3A', borderRadius: 7, background: '#E8F5EE', color: '#1B6B3A', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Día</button>
                )}
              </div>

              {fDays.map((d, di) => (
                <div key={di} style={{ border: '1.5px solid #E4EBE7', borderRadius: 14, marginBottom: 20, overflow: 'hidden' }}>
                  {/* Day header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '150px 180px 1fr auto', gap: 10, padding: '12px 16px', background: '#F8FAF9', alignItems: 'center' }}>
                    <select className="input" style={{ padding: '7px 10px' }} value={d.day} onChange={e => updateDay(di, { day: e.target.value as DayName })}>
                      {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <select className="input" style={{ padding: '7px 10px' }} value={d.type} onChange={e => updateDay(di, { type: e.target.value as SessionType })}>
                      {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {/* Add block buttons */}
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {BLOCK_TYPES.filter(bt => !d.blocks.some(b => b.blockType === bt.id)).map(bt => (
                        <button key={bt.id} onClick={() => addBlock(di, bt.id)} style={{ padding: '4px 10px', border: `1px solid ${bt.color}`, borderRadius: 6, background: bt.bg, color: bt.color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          {bt.icon} {bt.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => removeDay(di)} style={{ width: 28, height: 28, border: '1px solid #FEECEC', borderRadius: 7, background: '#FEECEC', color: '#B91C1C', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>

                  {/* Blocks */}
                  {d.blocks.map((block, bi) => {
                    const bm = blockMeta(block.blockType)
                    return (
                      <div key={bi} style={{ borderTop: '1px solid #E4EBE7' }}>
                        {/* Block subheader */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: bm.bg }}>
                          <span style={{ fontSize: 14 }}>{bm.icon}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: bm.color, flex: 1 }}>{bm.label}</span>
                          {block.blockType === 'circuito' && (
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: bm.color }}>Rondas:</span>
                              <input className="input" type="number" min={1} max={20} value={block.circuitRounds ?? 4} onChange={e => updateBlock(di, bi, { circuitRounds: Number(e.target.value) })} style={{ width: 60, padding: '4px 8px' }} />
                              <span style={{ fontSize: 11, color: bm.color }}>Descanso (seg):</span>
                              <input className="input" type="number" min={0} max={300} value={block.circuitRestSecs ?? 30} onChange={e => updateBlock(di, bi, { circuitRestSecs: Number(e.target.value) })} style={{ width: 70, padding: '4px 8px' }} />
                            </div>
                          )}
                          <button onClick={() => removeBlock(di, bi)} style={{ padding: '3px 8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 5, background: 'rgba(0,0,0,0.05)', color: bm.color, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Quitar bloque</button>
                        </div>

                        {/* Exercise rows */}
                        <div style={{ padding: '10px 16px', background: '#fff' }}>
                          {/* Column headers */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 70px 1fr auto', gap: 8, marginBottom: 8 }}>
                            {['Ejercicio','Series','Reps','Carga','Unidad','Notas',''].map((h,i) => (
                              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                            ))}
                          </div>

                          {block.exercises.map((ex, ei) => (
                            <div key={ei} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: ei < block.exercises.length - 1 ? '1px dashed #F0F4F2' : 'none' }}>
                              {/* Main row */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 70px 1fr auto', gap: 8, alignItems: 'center', marginBottom: ex.setDetails ? 8 : 0 }}>
                                <input className="input" style={{ padding: '7px 10px' }} placeholder="Ej: Sentadilla" value={ex.name} onChange={e => updateExercise(di, bi, ei, { name: e.target.value })} />
                                <input className="input" style={{ padding: '7px 8px' }} type="number" min={1} max={20} value={ex.sets} onChange={e => {
                                  const n = Number(e.target.value)
                                  updateExercise(di, bi, ei, { sets: n, setDetails: ex.setDetails ? Array.from({ length: n }, (_, i) => ex.setDetails![i] ?? { reps: ex.reps, weight: ex.weight ?? null }) : null })
                                }} />
                                <input className="input" style={{ padding: '7px 8px' }} type="number" min={1} value={ex.reps} onChange={e => updateExercise(di, bi, ei, { reps: Number(e.target.value) })} />
                                <input className="input" style={{ padding: '7px 8px' }} type="number" min={0} placeholder="0" value={ex.weight ?? ''} onChange={e => updateExercise(di, bi, ei, { weight: e.target.value ? Number(e.target.value) : null })} />
                                <select className="input" style={{ padding: '7px 6px' }} value={ex.unit ?? 'kg'} onChange={e => updateExercise(di, bi, ei, { unit: e.target.value as any })}>
                                  {['kg','lb','min','seg','m','km'].map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                                <input className="input" style={{ padding: '7px 10px' }} placeholder="Notas..." value={ex.notes ?? ''} onChange={e => updateExercise(di, bi, ei, { notes: e.target.value || null })} />
                                <button onClick={() => removeExercise(di, bi, ei)} style={{ width: 28, height: 28, border: '1px solid #FEECEC', borderRadius: 6, background: '#FEECEC', color: '#B91C1C', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                              </div>

                              {/* Toggle series individuales */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: ex.setDetails ? 8 : 0 }}>
                                <button
                                  onClick={() => toggleSetDetails(di, bi, ei, ex)}
                                  style={{ padding: '4px 12px', border: `1px solid ${ex.setDetails ? '#1B6B3A' : '#DDE9E3'}`, borderRadius: 20, background: ex.setDetails ? '#E8F5EE' : '#fff', color: ex.setDetails ? '#1B6B3A' : '#7A9485', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                >
                                  {ex.setDetails ? '✓ Series individualizadas' : '+ Individualizar series'}
                                </button>
                                {ex.setDetails && <span style={{ fontSize: 11, color: '#9AB5A8' }}>Cada serie tiene sus propias reps y carga</span>}
                              </div>

                              {/* Series individuales */}
                              {ex.setDetails && (
                                <div style={{ marginLeft: 16, padding: '10px 14px', background: '#F8FAF9', borderRadius: 9, border: '1px solid #E8F5EE' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '32px 80px 100px auto', gap: 8, marginBottom: 6 }}>
                                    {['#','Reps','Carga',''].map((h,i) => (
                                      <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                                    ))}
                                  </div>
                                  {ex.setDetails.map((s, si) => (
                                    <div key={si} style={{ display: 'grid', gridTemplateColumns: '32px 80px 100px auto', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1B6B3A', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{si + 1}</div>
                                      <input className="input" type="number" min={1} value={s.reps} onChange={e => updateSetDetail(di, bi, ei, si, { reps: Number(e.target.value) })} style={{ padding: '6px 8px' }} />
                                      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                        <input className="input" type="number" min={0} placeholder="kg" value={s.weight ?? ''} onChange={e => updateSetDetail(di, bi, ei, si, { weight: e.target.value ? Number(e.target.value) : null })} style={{ padding: '6px 8px' }} />
                                        <span style={{ fontSize: 11, color: '#7A9485', flexShrink: 0 }}>{ex.unit ?? 'kg'}</span>
                                      </div>
                                      <button onClick={() => removeSetDetail(di, bi, ei, si, ex)} style={{ width: 24, height: 24, border: '1px solid #FEECEC', borderRadius: 5, background: '#FEECEC', color: '#B91C1C', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                    </div>
                                  ))}
                                  <button onClick={() => addSetDetail(di, bi, ei, ex)} style={{ padding: '5px 12px', border: '1px dashed #C5D5C9', borderRadius: 6, background: 'transparent', color: '#1B6B3A', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 2 }}>+ Agregar serie</button>
                                </div>
                              )}
                            </div>
                          ))}

                          <button onClick={() => addExercise(di, bi)} style={{ padding: '6px 14px', border: '1px dashed #C5D5C9', borderRadius: 7, background: 'transparent', color: bm.color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            + Agregar ejercicio
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #F0F4F2' }}>
                <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving || !fPlayerID} style={{ flex: 2, padding: 12, border: 'none', borderRadius: 10, background: saving ? '#C5D5C9' : '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : 'Guardar rutina'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {modal === 'delete' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 380, animation: 'fadeIn 0.15s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEECEC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>🗑</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>Eliminar rutina</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#7A9485', lineHeight: 1.6 }}>
                Se eliminará la rutina semana {activeRoutine?.week} de <strong style={{ color: '#0D1F14' }}>{playerName(activeRoutine?.playerId ?? '')}</strong>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={saving} style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
