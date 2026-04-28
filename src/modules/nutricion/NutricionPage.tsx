// src/modules/nutricion/NutricionPage.tsx
import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { StatCard, EmptyState } from '@/shared/components/ui'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { NutritionPlan, Meal, MealItem } from '@/shared/types'

// ── Constants ─────────────────────────────────────────────────
const MEAL_TYPES = ['Desayuno','Almuerzo','Pre-entreno','Merienda','Cena'] as const
type MealType = typeof MEAL_TYPES[number]

const MEAL_ICONS: Record<MealType, string> = {
  Desayuno: '☀️', Almuerzo: '🍽', 'Pre-entreno': '⚡', Merienda: '🍎', Cena: '🌙',
}

const WEIGHT_HISTORY = [
  { week: 'S8', peso: 86.5 }, { week: 'S9', peso: 87.0 },
  { week: 'S10', peso: 87.3 }, { week: 'S11', peso: 87.8 },
  { week: 'S12', peso: 88.0 },
]

// ── Helpers ───────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 6 }}>{children}</label>
}

function ProgressBar({ label, current, total, unit = 'g', fill = '#1B6B3A', track = '#E8F5EE' }: { label: string; current: number; total: number; unit?: string; fill?: string; track?: string }) {
  const pct = Math.min(Math.round((current / total) * 100), 100)
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0D1F14' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#7A9485' }}>{current}{unit} / {total}{unit} <span style={{ color: pct >= 100 ? '#1B6B3A' : '#B45309', fontWeight: 700 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 8, background: track, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: fill, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

const emptyItem = (): MealItem => ({ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0 })
const emptyMeal = (type: MealType): Meal => ({ type, items: [emptyItem()] })

// ── Component ─────────────────────────────────────────────────
export default function NutricionPage() {
  const user    = useAuthStore(s => s.user)
  const canEdit = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  const [plans, setPlans]       = useState<NutritionPlan[]>([])
  const [players, setPlayers]   = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading]   = useState(true)
  const [activePlan, setActivePlan] = useState<NutritionPlan | null>(null)
  const [expandedMeal, setExpandedMeal] = useState<string | null>('Desayuno')
  const [modal, setModal]       = useState<'none' | 'form' | 'delete'>('none')
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  // Form state
  const [fPlayerID, setFPlayerID]   = useState('')
  const [fTargetCal, setFTargetCal] = useState('2800')
  const [fTargetProt, setFTargetProt] = useState('200')
  const [fTargetCarbs, setFTargetCarbs] = useState('350')
  const [fTargetFat, setFTargetFat] = useState('70')
  const [fMeals, setFMeals]         = useState<Meal[]>(MEAL_TYPES.map(t => emptyMeal(t)))
  const [fNotes, setFNotes]         = useState('')

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    async function load() {
      const [plSnap, pySnap] = await Promise.all([
        getDocs(query(collection(db, 'nutrition_plans'), where('clubId', '==', user!.clubId))),
        getDocs(query(collection(db, 'players'), where('clubId', '==', user!.clubId))),
      ])
      const ps = plSnap.docs.map(d => ({ id: d.id, ...d.data() }) as NutritionPlan)
      setPlans(ps)
      setPlayers(pySnap.docs.map(d => ({ id: d.id, name: (d.data() as any).name })))
      if (user!.role === 'jugador') {
        const mine = ps.find(p => p.playerId === user!.uid)
        if (mine) setActivePlan(mine)
      }
      setLoading(false)
    }
    load().catch(() => setLoading(false))
  }, [user])

  // ── Open form ─────────────────────────────────────────────
  function openCreate() {
    setFPlayerID(players[0]?.id ?? '')
    setFTargetCal('2800'); setFTargetProt('200')
    setFTargetCarbs('350'); setFTargetFat('70')
    setFMeals(MEAL_TYPES.map(t => emptyMeal(t)))
    setFNotes('')
    setActivePlan(null)
    setModal('form')
  }

  function openEdit(p: NutritionPlan) {
    setFPlayerID(p.playerId)
    setFTargetCal(String(p.targetCalories))
    setFTargetProt(String(p.targetProtein))
    setFTargetCarbs(String(p.targetCarbs))
    setFTargetFat(String(p.targetFat))
    setFMeals(JSON.parse(JSON.stringify(p.meals)))
    setFNotes((p as any).notes ?? '')
    setActivePlan(p)
    setModal('form')
  }

  // ── Meal management ───────────────────────────────────────
  function addItem(mealIdx: number) {
    setFMeals(prev => prev.map((m, i) => i === mealIdx ? { ...m, items: [...m.items, emptyItem()] } : m))
  }

  function removeItem(mealIdx: number, itemIdx: number) {
    setFMeals(prev => prev.map((m, i) => i === mealIdx ? { ...m, items: m.items.filter((_, j) => j !== itemIdx) } : m))
  }

  function updateItem(mealIdx: number, itemIdx: number, patch: Partial<MealItem>) {
    setFMeals(prev => prev.map((m, i) => i === mealIdx
      ? { ...m, items: m.items.map((it, j) => j === itemIdx ? { ...it, ...patch } : it) }
      : m
    ))
  }

  function toggleMealInForm(type: MealType) {
    setFMeals(prev =>
      prev.some(m => m.type === type)
        ? prev.filter(m => m.type !== type)
        : [...prev, emptyMeal(type)]
    )
  }

  // ── Sanitize undefined → null for Firestore ──────────────
  function sanitizeMeals(meals: Meal[]) {
    return meals.map(m => ({
      type:  m.type,
      items: m.items.map(it => ({
        name:     it.name     ?? '',
        quantity: it.quantity ?? '',
        calories: it.calories ?? 0,
        protein:  it.protein  ?? 0,
        carbs:    it.carbs    ?? 0,
        fat:      it.fat      ?? 0,
      })),
    }))
  }

  // ── Save ──────────────────────────────────────────────────
  async function handleSave() {
    if (!user || !fPlayerID) return
    setSaving(true)
    const data = {
      playerId:       fPlayerID,
      clubId:         user.clubId,
      meals:          sanitizeMeals(fMeals),
      targetCalories: Number(fTargetCal),
      targetProtein:  Number(fTargetProt),
      targetCarbs:    Number(fTargetCarbs),
      targetFat:      Number(fTargetFat),
      notes:          fNotes.trim() || null,
      createdBy:      user.uid,
    }
    try {
      if (activePlan) {
        await updateDoc(doc(db, 'nutrition_plans', activePlan.id), data)
        const updated = { ...activePlan, ...data }
        setPlans(prev => prev.map(p => p.id === activePlan.id ? updated : p))
        setActivePlan(updated)
        showToast('Plan alimentario actualizado')
      } else {
        const ref = await addDoc(collection(db, 'nutrition_plans'), { ...data, createdAt: serverTimestamp() })
        const newP = { id: ref.id, ...data } as unknown as NutritionPlan
        setPlans(prev => [...prev, newP])
        setActivePlan(newP)
        showToast('Plan alimentario creado correctamente')
      }
      setModal('none')
    } catch (e) {
      console.error(e)
      showToast('Error al guardar — revisá los permisos', false)
    } finally { setSaving(false) }
  }

  // ── Delete ────────────────────────────────────────────────
  async function handleDelete() {
    if (!activePlan) return
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'nutrition_plans', activePlan.id))
      setPlans(prev => prev.filter(p => p.id !== activePlan.id))
      setActivePlan(null); setModal('none')
      showToast('Plan eliminado')
    } catch { showToast('Error al eliminar', false) }
    finally { setSaving(false) }
  }

  // ── Computed totals ───────────────────────────────────────
  const plan = activePlan
  const totals = plan ? {
    cal:   plan.meals.reduce((a, m) => a + m.items.reduce((b, it) => b + (it.calories || 0), 0), 0),
    prot:  plan.meals.reduce((a, m) => a + m.items.reduce((b, it) => b + (it.protein || 0), 0), 0),
    carbs: plan.meals.reduce((a, m) => a + m.items.reduce((b, it) => b + (it.carbs || 0), 0), 0),
    fat:   plan.meals.reduce((a, m) => a + m.items.reduce((b, it) => b + (it.fat || 0), 0), 0),
  } : null

  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? id

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
        <StatCard label="Planes activos"   value={String(plans.length)} accentColor="#1B6B3A" />
        <StatCard label="Calorías objetivo" value={plan ? `${plan.targetCalories} kcal` : '—'} accentColor="#5047E5" />
        <StatCard label="Proteínas obj."    value={plan ? `${plan.targetProtein}g` : '—'}       accentColor="#1B6B3A" />
        <StatCard label="Peso actual"       value="88.0 kg" delta="▲ 1.5 kg" deltaType="up"    accentColor="#E8A020" />
      </div>

      {/* Admin — selector + botones */}
      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {plans.length > 0 && (
            <select className="input" style={{ maxWidth: 340 }}
              value={activePlan?.id ?? ''}
              onChange={e => setActivePlan(plans.find(p => p.id === e.target.value) ?? null)}
            >
              <option value="">— Seleccionar plan —</option>
              {plans.map(p => <option key={p.id} value={p.id}>{playerName(p.playerId)} — {p.targetCalories} kcal</option>)}
            </select>
          )}
          <button onClick={openCreate} style={{ padding: '9px 18px', border: 'none', borderRadius: 9, background: '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Nuevo plan
          </button>
          {activePlan && <>
            <button onClick={() => openEdit(activePlan)} style={{ padding: '9px 16px', border: '1px solid #DDE9E3', borderRadius: 9, background: '#fff', color: '#1B6B3A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Editar</button>
            <button onClick={() => setModal('delete')} style={{ padding: '9px 14px', border: '1px solid #FEECEC', borderRadius: 9, background: '#FEECEC', color: '#B91C1C', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
          </>}
        </div>
      )}

      {/* Empty state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9AB5A8' }}>Cargando...</div>
      ) : !plan ? (
        <EmptyState icon="🥗" title="Sin plan alimentario" desc={canEdit ? 'Hacé click en "+ Nuevo plan" para crear uno' : 'El nutricionista aún no asignó tu plan'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

          {/* Plan del día */}
          <div>
            {canEdit && (
              <div style={{ background: '#F0F6F2', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1B6B3A', fontWeight: 600 }}>
                📋 Plan de <strong>{playerName(plan.playerId)}</strong> — {plan.targetCalories} kcal / día
                {(plan as any).notes && <div style={{ fontWeight: 400, color: '#4A6358', marginTop: 4 }}>{(plan as any).notes}</div>}
              </div>
            )}

            <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1F14', marginBottom: 12 }}>Plan alimentario diario</div>

            {plan.meals.map((meal, mi) => {
              const mealCal  = meal.items.reduce((a, it) => a + (it.calories || 0), 0)
              const mealProt = meal.items.reduce((a, it) => a + (it.protein || 0), 0)
              const isOpen   = expandedMeal === meal.type
              return (
                <div key={meal.type} style={{ background: '#fff', border: '1px solid #E4EBE7', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedMeal(isOpen ? null : meal.type)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F0F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {MEAL_ICONS[meal.type as MealType] ?? '🍽'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1F14' }}>{meal.type}</div>
                      <div style={{ fontSize: 11, color: '#7A9485', marginTop: 1 }}>{meal.items.length} alimentos · {mealCal} kcal · {mealProt}g prot</div>
                    </div>
                    <span style={{ fontSize: 16, color: '#7A9485', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>›</span>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid #F0F4F2' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 60px 60px', gap: 8, padding: '8px 18px', background: '#F8FAF9' }}>
                        {['Alimento','Cantidad','Cal','Prot','CH','Grasas'].map(h => (
                          <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#7A9485', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                        ))}
                      </div>
                      {meal.items.map((item, ii) => (
                        <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 60px 60px', gap: 8, padding: '10px 18px', borderBottom: ii < meal.items.length - 1 ? '1px solid #F4F7F5' : 'none', alignItems: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#0D1F14' }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: '#7A9485' }}>{item.quantity}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1B6B3A' }}>{item.calories}</div>
                          <div style={{ fontSize: 12, color: '#4A6358' }}>{item.protein}g</div>
                          <div style={{ fontSize: 12, color: '#4A6358' }}>{item.carbs}g</div>
                          <div style={{ fontSize: 12, color: '#4A6358' }}>{item.fat}g</div>
                        </div>
                      ))}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px 60px 60px 60px', gap: 8, padding: '10px 18px', background: '#F8FAF9' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1F14' }}>Total comida</div>
                        <div />
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1B6B3A' }}>{mealCal}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4A6358' }}>{meal.items.reduce((a,it) => a+it.protein,0)}g</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4A6358' }}>{meal.items.reduce((a,it) => a+it.carbs,0)}g</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#4A6358' }}>{meal.items.reduce((a,it) => a+it.fat,0)}g</div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Macros */}
            {totals && (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1F14', marginBottom: 12 }}>Macros del día</div>
                <div style={{ background: '#fff', border: '1px solid #E4EBE7', borderRadius: 12, padding: '16px 18px' }}>
                  <ProgressBar label="Proteínas"     current={totals.prot}  total={plan.targetProtein}  unit="g"    fill="#1B6B3A" track="#E8F5EE" />
                  <ProgressBar label="Carbohidratos" current={totals.carbs} total={plan.targetCarbs}    unit="g"    fill="#1D5FAD" track="#EBF4FF" />
                  <ProgressBar label="Grasas"        current={totals.fat}   total={plan.targetFat}      unit="g"    fill="#B45309" track="#FEF3DC" />
                  <ProgressBar label="Calorías"      current={totals.cal}   total={plan.targetCalories} unit=" kcal" fill="#5047E5" track="#F0EFFE" />
                </div>
              </div>
            )}

            {/* Peso */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1F14', marginBottom: 12 }}>Evolución de peso</div>
              <div style={{ background: '#fff', border: '1px solid #E4EBE7', borderRadius: 12, padding: '16px 18px' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={WEIGHT_HISTORY} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#7A9485' }} axisLine={false} tickLine={false} />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11, fill: '#7A9485' }} axisLine={false} tickLine={false} unit=" kg" />
                    <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E4EBE7', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v} kg`, 'Peso']} />
                    <Area type="monotone" dataKey="peso" stroke="#1B6B3A" strokeWidth={2} fill="#E8F5EE" dot={{ r: 3, fill: '#1B6B3A' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Indicadores */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1F14', marginBottom: 12 }}>Indicadores corporales</div>
              <div style={{ background: '#fff', border: '1px solid #E4EBE7', borderRadius: 12 }}>
                {[['Peso actual','88.0 kg'],['% Grasa corporal','14.2 %'],['Masa muscular','72.8 kg'],['Hidratación','2.8 L / día'],['IMC','24.1']].map(([l,v],i,arr) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px', borderBottom: i < arr.length-1 ? '1px solid #F4F7F5' : 'none', fontSize: 13 }}>
                    <span style={{ color: '#7A9485' }}>{l}</span>
                    <span style={{ fontWeight: 700, color: '#0D1F14' }}>{v}</span>
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
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 780, animation: 'fadeIn 0.15s ease', marginTop: 20, marginBottom: 20 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px 16px', borderBottom: '1px solid #F0F4F2', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>
                  {activePlan ? 'Editar plan alimentario' : 'Nuevo plan alimentario'}
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7A9485' }}>Diseñá el plan nutricional del jugador</p>
              </div>
              <button onClick={() => setModal('none')} style={{ width: 32, height: 32, border: 'none', background: '#F0F4F2', borderRadius: '50%', fontSize: 18, color: '#7A9485', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ padding: '22px 28px 28px' }}>

              {/* Jugador + Objetivos */}
              <div style={{ marginBottom: 22 }}>
                <Label>Jugador *</Label>
                <select className="input" style={{ maxWidth: 340, marginBottom: 16 }} value={fPlayerID} onChange={e => setFPlayerID(e.target.value)}>
                  <option value="">— Seleccionar jugador —</option>
                  {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                <div style={{ fontSize: 11, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Objetivos diarios</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                  {[
                    { l: 'Calorías (kcal)', val: fTargetCal, set: setFTargetCal },
                    { l: 'Proteínas (g)',   val: fTargetProt, set: setFTargetProt },
                    { l: 'Carbohidratos (g)', val: fTargetCarbs, set: setFTargetCarbs },
                    { l: 'Grasas (g)',      val: fTargetFat, set: setFTargetFat },
                  ].map(f => (
                    <div key={f.l}>
                      <div style={{ fontSize: 11, color: '#7A9485', marginBottom: 4 }}>{f.l}</div>
                      <input className="input" type="number" min={0} value={f.val} onChange={e => f.set(e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Seleccionar comidas */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Label>Comidas del plan</Label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {MEAL_TYPES.map(t => {
                      const active = fMeals.some(m => m.type === t)
                      return (
                        <button key={t} onClick={() => toggleMealInForm(t)} style={{
                          padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${active ? '#1B6B3A' : '#DDE9E3'}`,
                          background: active ? '#E8F5EE' : '#fff', color: active ? '#1B6B3A' : '#4A6358',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}>
                          {MEAL_ICONS[t]} {t}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Cada comida */}
                {fMeals.map((meal, mi) => (
                  <div key={meal.type} style={{ border: '1px solid #E4EBE7', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: '#F8FAF9', borderBottom: '1px solid #E4EBE7' }}>
                      <span style={{ fontSize: 18 }}>{MEAL_ICONS[meal.type as MealType]}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1F14' }}>{meal.type}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12, color: '#7A9485' }}>
                        {meal.items.reduce((a,it) => a+(it.calories||0),0)} kcal · {meal.items.reduce((a,it) => a+(it.protein||0),0)}g prot
                      </span>
                    </div>

                    <div style={{ padding: '12px 16px' }}>
                      {/* Header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 70px 70px 70px 30px', gap: 8, marginBottom: 8 }}>
                        {['Alimento','Cantidad','Cal','Prot(g)','CH(g)','Gras(g)',''].map((h,i) => (
                          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#9AB5A8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                        ))}
                      </div>

                      {meal.items.map((item, ii) => (
                        <div key={ii} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px 70px 70px 70px 30px', gap: 8, marginBottom: 7, alignItems: 'center' }}>
                          <input className="input" style={{ padding: '7px 10px' }} placeholder="Ej: Pollo" value={item.name} onChange={e => updateItem(mi, ii, { name: e.target.value })} />
                          <input className="input" style={{ padding: '7px 8px' }} placeholder="200g" value={item.quantity} onChange={e => updateItem(mi, ii, { quantity: e.target.value })} />
                          <input className="input" style={{ padding: '7px 8px' }} type="number" min={0} placeholder="0" value={item.calories || ''} onChange={e => updateItem(mi, ii, { calories: Number(e.target.value) })} />
                          <input className="input" style={{ padding: '7px 8px' }} type="number" min={0} placeholder="0" value={item.protein || ''} onChange={e => updateItem(mi, ii, { protein: Number(e.target.value) })} />
                          <input className="input" style={{ padding: '7px 8px' }} type="number" min={0} placeholder="0" value={item.carbs || ''} onChange={e => updateItem(mi, ii, { carbs: Number(e.target.value) })} />
                          <input className="input" style={{ padding: '7px 8px' }} type="number" min={0} placeholder="0" value={item.fat || ''} onChange={e => updateItem(mi, ii, { fat: Number(e.target.value) })} />
                          <button onClick={() => removeItem(mi, ii)} style={{ width: 28, height: 28, border: '1px solid #FEECEC', borderRadius: 6, background: '#FEECEC', color: '#B91C1C', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>
                      ))}
                      <button onClick={() => addItem(mi)} style={{ padding: '6px 14px', border: '1px dashed #C5D5C9', borderRadius: 7, background: 'transparent', color: '#1B6B3A', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
                        + Agregar alimento
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notas */}
              <div style={{ marginBottom: 20 }}>
                <Label>Notas del nutricionista <span style={{ fontWeight: 400, color: '#9AB5A8' }}>(opcional)</span></Label>
                <textarea className="input" rows={2} placeholder="Indicaciones especiales, restricciones, suplementos..." value={fNotes} onChange={e => setFNotes(e.target.value)} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 12, borderTop: '1px solid #F0F4F2' }}>
                <button onClick={() => setModal('none')} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSave} disabled={saving || !fPlayerID} style={{ flex: 2, padding: 12, border: 'none', borderRadius: 10, background: saving ? '#C5D5C9' : '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Guardando...' : activePlan ? 'Guardar cambios' : 'Crear plan alimentario'}
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
              <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#0D1F14' }}>Eliminar plan</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#7A9485', lineHeight: 1.6 }}>
                Se eliminará el plan de <strong style={{ color: '#0D1F14' }}>{playerName(activePlan?.playerId ?? '')}</strong>. Esta acción no se puede deshacer.
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
