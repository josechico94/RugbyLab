// src/modules/admin/UsersPage.tsx
import { useEffect, useState } from 'react'
import {
  collection, query, where, getDocs,
  doc, updateDoc, deleteDoc
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { Avatar, Pill, StatCard, EmptyState } from '@/shared/components/ui'
import type { UserProfile, Role } from '@/shared/types'

type RoleOption = { value: Role; label: string; variant: 'amber' | 'blue' | 'green' }

const ROLES: RoleOption[] = [
  { value: 'admin',          label: 'Administrador', variant: 'amber' },
  { value: 'cuerpo_tecnico', label: 'Cuerpo Técnico', variant: 'blue' },
  { value: 'jugador',        label: 'Jugador',        variant: 'green' },
]

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const AV_COLORS: Record<Role, { bg: string; color: string }> = {
  admin:          { bg: '#FEF3DC', color: '#B45309' },
  cuerpo_tecnico: { bg: '#EBF4FF', color: '#1D5FAD' },
  jugador:        { bg: '#E8F5EE', color: '#1B6B3A' },
}

function timeAgo(date: any): string {
  try {
    const d = date?.toDate ? date.toDate() : new Date(date)
    const diff = Date.now() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Ayer'
    return `Hace ${days} días`
  } catch {
    return '—'
  }
}

type ModalState =
  | { type: 'none' }
  | { type: 'edit'; user: UserProfile }
  | { type: 'delete'; user: UserProfile }

export default function UsersPage() {
  const currentUser = useAuthStore(s => s.user)
  const [users, setUsers]   = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [modal, setModal]   = useState<ModalState>({ type: 'none' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast]   = useState<string | null>(null)

  // Edit form state
  const [editName,  setEditName]  = useState('')
  const [editRole,  setEditRole]  = useState<Role>('jugador')
  const [editClub,  setEditClub]  = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchUsers() {
    if (!currentUser) return
    try {
      const snap = await getDocs(collection(db, 'users'))
      const all = snap.docs.map(d => ({ ...d.data(), uid: d.id }) as UserProfile)
      setUsers(all)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [currentUser])

  function openEdit(u: UserProfile) {
    setEditName(u.name)
    setEditRole(u.role)
    setEditClub(u.clubId)
    setModal({ type: 'edit', user: u })
  }

  async function handleSave() {
    if (modal.type !== 'edit') return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', modal.user.uid), {
        name:   editName.trim(),
        role:   editRole,
        clubId: editClub.trim() || 'rugbylab',
      })
      setUsers(prev => prev.map(u =>
        u.uid === modal.user.uid
          ? { ...u, name: editName.trim(), role: editRole, clubId: editClub.trim() || 'rugbylab' }
          : u
      ))
      setModal({ type: 'none' })
      showToast('Usuario actualizado correctamente')
    } catch (err) {
      console.error(err)
      showToast('Error al guardar — revisá los permisos')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (modal.type !== 'delete') return
    if (modal.user.uid === currentUser?.uid) {
      showToast('No podés eliminar tu propio usuario')
      setModal({ type: 'none' })
      return
    }
    setSaving(true)
    try {
      await deleteDoc(doc(db, 'users', modal.user.uid))
      setUsers(prev => prev.filter(u => u.uid !== modal.user.uid))
      setModal({ type: 'none' })
      showToast('Usuario eliminado')
    } catch (err) {
      console.error(err)
      showToast('Error al eliminar — revisá los permisos')
    } finally {
      setSaving(false)
    }
  }

  const filtered = users.filter(u => {
    const matchSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  const admins   = users.filter(u => u.role === 'admin').length
  const tecnicos = users.filter(u => u.role === 'cuerpo_tecnico').length
  const jugadores = users.filter(u => u.role === 'jugador').length

  return (
    <div className="fade-in">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 1000,
          background: '#0A2218', color: '#fff',
          padding: '12px 20px', borderRadius: 10,
          fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total usuarios"  value={String(users.length)}   accentColor="#1B6B3A" />
        <StatCard label="Administradores" value={String(admins)}          accentColor="#E8A020" />
        <StatCard label="Cuerpo Técnico"  value={String(tecnicos)}        accentColor="#1D5FAD" />
        <StatCard label="Jugadores"       value={String(jugadores)}       accentColor="#1B6B3A" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: 300 }}
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {([['all', 'Todos'], ['admin', 'Admin'], ['cuerpo_tecnico', 'Técnico'], ['jugador', 'Jugador']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setRoleFilter(val)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: '1px solid #DDE9E3',
                background: roleFilter === val ? '#0A2218' : '#fff',
                color: roleFilter === val ? '#fff' : '#4A6358',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={fetchUsers}
          style={{ marginLeft: 'auto', padding: '7px 14px', border: '1px solid #DDE9E3', borderRadius: 8, background: '#fff', color: '#4A6358', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Table */}
      <div className="card">
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 120px', gap: 12, padding: '10px 20px', background: '#F8FAF9', borderBottom: '1px solid #E4EBE7' }}>
          {['Usuario', 'Email', 'Rol', 'Club', 'Acciones'].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#7A9485', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9AB5A8', fontSize: 13 }}>Cargando usuarios...</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon="👥" title="Sin resultados" desc="Probá con otro nombre o filtro" />
        ) : filtered.map((u, i) => {
          const av = AV_COLORS[u.role] ?? AV_COLORS.jugador
          const isSelf = u.uid === currentUser?.uid
          return (
            <div
              key={u.uid}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 120px',
                gap: 12, padding: '12px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid #F4F7F5' : 'none',
                alignItems: 'center',
                background: isSelf ? '#FAFFF9' : undefined,
              }}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initials={getInitials(u.name || u.email || '?')} size={34} bg={av.bg} color={av.color} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1F14' }}>
                    {u.name || '—'}
                    {isSelf && <span style={{ marginLeft: 6, fontSize: 10, background: '#E8F5EE', color: '#1B6B3A', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>vos</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#9AB5A8', marginTop: 1 }}>{timeAgo(u.createdAt)}</div>
                </div>
              </div>

              {/* Email */}
              <div style={{ fontSize: 12, color: '#4A6358', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.email}
              </div>

              {/* Role */}
              <div>
                <Pill variant={ROLES.find(r => r.value === u.role)?.variant ?? 'gray'}>
                  {ROLES.find(r => r.value === u.role)?.label ?? u.role}
                </Pill>
              </div>

              {/* Club */}
              <div style={{ fontSize: 12, color: '#4A6358' }}>{u.clubId || '—'}</div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => openEdit(u)}
                  style={{ padding: '5px 12px', border: '1px solid #DDE9E3', borderRadius: 7, background: '#fff', color: '#1B6B3A', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Editar
                </button>
                <button
                  onClick={() => !isSelf && setModal({ type: 'delete', user: u })}
                  style={{ padding: '5px 10px', border: '1px solid #FEECEC', borderRadius: 7, background: '#FEECEC', color: '#B91C1C', fontSize: 12, fontWeight: 600, cursor: isSelf ? 'not-allowed' : 'pointer', opacity: isSelf ? 0.4 : 1 }}
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── EDIT MODAL ── */}
      {modal.type === 'edit' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 440, animation: 'fadeIn 0.15s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0D1F14' }}>Editar usuario</h2>
              <button onClick={() => setModal({ type: 'none' })} style={{ border: 'none', background: 'none', fontSize: 20, color: '#7A9485', cursor: 'pointer' }}>×</button>
            </div>

            {/* User preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#F8FAF9', borderRadius: 10, marginBottom: 20 }}>
              <Avatar initials={getInitials(modal.user.name || modal.user.email || '?')} size={40} bg={AV_COLORS[modal.user.role]?.bg} color={AV_COLORS[modal.user.role]?.color} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1F14' }}>{modal.user.name}</div>
                <div style={{ fontSize: 12, color: '#7A9485' }}>{modal.user.email}</div>
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Nombre completo</label>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre del usuario" />
            </div>

            {/* Role */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 8 }}>Rol</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setEditRole(r.value)}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 9,
                      border: `2px solid ${editRole === r.value ? '#1B6B3A' : '#DDE9E3'}`,
                      background: editRole === r.value ? '#E8F5EE' : '#fff',
                      cursor: 'pointer', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: editRole === r.value ? '#1B6B3A' : '#4A6358' }}>{r.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Club */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>Club ID</label>
              <input className="input" value={editClub} onChange={e => setEditClub(e.target.value)} placeholder="rugbylab" />
              <div style={{ fontSize: 11, color: '#9AB5A8', marginTop: 4 }}>Identificador del club al que pertenece el usuario</div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal({ type: 'none' })} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                style={{ flex: 2, padding: 12, border: 'none', borderRadius: 10, background: saving ? '#C5D5C9' : '#1B6B3A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {modal.type === 'delete' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,34,24,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 380, animation: 'fadeIn 0.15s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEECEC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22 }}>⚠️</div>
              <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0D1F14' }}>Eliminar usuario</h2>
              <p style={{ margin: 0, fontSize: 13, color: '#7A9485', lineHeight: 1.5 }}>
                ¿Seguro que querés eliminar a <strong style={{ color: '#0D1F14' }}>{modal.user.name}</strong>?
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal({ type: 'none' })} style={{ flex: 1, padding: 12, border: '1px solid #DDE9E3', borderRadius: 10, background: '#fff', color: '#4A6358', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                style={{ flex: 1, padding: 12, border: 'none', borderRadius: 10, background: '#B91C1C', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {saving ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
