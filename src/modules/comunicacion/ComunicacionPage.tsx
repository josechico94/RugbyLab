// src/modules/comunicacion/ComunicacionPage.tsx
import { useEffect, useState, useRef } from 'react'
import {
  collection, query, where, orderBy, limit,
  getDocs, addDoc, serverTimestamp, onSnapshot
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { Avatar, Pill, StatCard } from '@/shared/components/ui'
import type { Message } from '@/shared/types'

const TYPE_OPTIONS = [
  { value: 'general',       label: 'General',       variant: 'gray'   },
  { value: 'citacion',      label: 'Citación',      variant: 'blue'   },
  { value: 'entrenamiento', label: 'Entrenamiento', variant: 'purple' },
  { value: 'resultado',     label: 'Resultado',     variant: 'green'  },
] as const

// Mock messages para demostración
const MOCK_MSGS: Message[] = [
  {
    id: '1',
    authorId: 'lf',
    authorName: 'Lucas Fernández',
    body: 'Viernes entrenamos a las 19hs. Presencia obligatoria para todos los forwards. Llevar botines y protector bucal.',
    clubId: 'default',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '2',
    authorId: 'pp',
    authorName: 'Preparador Físico',
    body: 'La semana 12 de fuerza ya está disponible en el módulo de gimnasio. Recuerden registrar las cargas después de cada sesión.',
    clubId: 'default',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: '3',
    authorId: 'jc',
    authorName: 'José Chico',
    body: 'Confirmados 22 jugadores para el sábado. Lista de citados en el módulo de plantel. Concentración a las 13hs en el club.',
    clubId: 'default',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
]

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Ahora'
  if (mins < 60)  return `Hace ${mins} min`
  if (hours < 24) return `Hace ${hours}h`
  return `Hace ${days}d`
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('')
}

const AV_COLORS = [
  { bg: '#EBF4FF', color: '#1D5FAD' },
  { bg: '#F0EFFE', color: '#5047E5' },
  { bg: '#E8F5EE', color: '#1B6B3A' },
  { bg: '#FEF3DC', color: '#B45309' },
  { bg: '#FEECEC', color: '#B91C1C' },
]

function avColor(name: string) {
  const idx = name.charCodeAt(0) % AV_COLORS.length
  return AV_COLORS[idx]
}

export default function ComunicacionPage() {
  const user = useAuthStore((s) => s.user)
  const [messages, setMessages] = useState<Message[]>(MOCK_MSGS)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canPost = user?.role === 'admin' || user?.role === 'cuerpo_tecnico'

  // Real-time listener (when Firebase is configured)
  useEffect(() => {
    if (!user) return
    try {
      const q = query(
        collection(db, 'messages'),
        where('clubId', '==', user.clubId),
        limit(30)
      )
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) {
          setMessages(snap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            createdAt: d.data().createdAt?.toDate() ?? new Date(),
          }) as Message))
        }
      })
      return unsub
    } catch {
      // Firestore not configured yet — use mock data
    }
  }, [user])

  async function handleSend() {
    if (!body.trim() || !user) return
    setSending(true)

    // Optimistic update
    const newMsg: Message = {
      id: String(Date.now()),
      authorId: user.uid,
      authorName: user.name,
      body: body.trim(),
      clubId: user.clubId,
      createdAt: new Date(),
    }
    setMessages(prev => [newMsg, ...prev])
    setBody('')

    try {
      await addDoc(collection(db, 'messages'), {
        authorId:   user.uid,
        authorName: user.name,
        body:       body.trim(),
        clubId:     user.clubId,
        createdAt:  serverTimestamp(),
      })
    } catch {
      // Firebase not configured — optimistic update already shown
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Mensajes hoy"   value="4"  accentColor="#1B6B3A" />
        <StatCard label="Miembros"       value="27" accentColor="#5047E5" />
        <StatCard label="Sin leer"       value="2"  delta="Nuevos" deltaType="up" accentColor="#E8A020" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Feed */}
        <div>
          {/* Composer */}
          {canPost && (
            <div className="card" style={{ padding: '16px 18px', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <Avatar
                  initials={getInitials(user?.name ?? '')}
                  size={36}
                  bg={avColor(user?.name ?? '').bg}
                  color={avColor(user?.name ?? '').color}
                />
                <div style={{ flex: 1 }}>
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribí una novedad para el equipo..."
                    rows={3}
                    style={{
                      width: '100%', border: 'none', outline: 'none',
                      resize: 'none', fontSize: 13, color: '#0D1F14',
                      fontFamily: 'inherit', lineHeight: 1.5,
                      background: 'transparent',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F4F2' }}>
                    <span style={{ fontSize: 11, color: '#9AB5A8' }}>⌘ + Enter para publicar · Visible para todo el club</span>
                    <button
                      onClick={handleSend}
                      disabled={!body.trim() || sending}
                      style={{
                        padding: '8px 18px', border: 'none', borderRadius: 8,
                        background: body.trim() ? '#1B6B3A' : '#DDE9E3',
                        color: '#fff', fontSize: 12, fontWeight: 700,
                        cursor: body.trim() ? 'pointer' : 'not-allowed',
                        transition: 'background 0.15s',
                      }}
                    >
                      {sending ? 'Publicando...' : 'Publicar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="card">
            {messages.map((m, i) => {
              const av = avColor(m.authorName)
              return (
                <div
                  key={m.id}
                  className="feed-item"
                  style={{ borderBottom: i < messages.length - 1 ? '1px solid #F4F7F5' : 'none' }}
                >
                  <Avatar initials={getInitials(m.authorName)} size={36} bg={av.bg} color={av.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0D1F14' }}>{m.authorName}</span>
                      <span style={{ fontSize: 11, color: '#9AB5A8' }}>{timeAgo(m.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#4A6358', lineHeight: 1.55 }}>{m.body}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Members */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0D1F14', marginBottom: 12 }}>Miembros del club</div>
          <div className="card">
            {[
              { name: 'Lucas Fernández',  role: 'cuerpo_tecnico', status: 'online'  },
              { name: 'José Chico',       role: 'admin',          status: 'online'  },
              { name: 'Preparador F.',    role: 'cuerpo_tecnico', status: 'online'  },
              { name: 'Tomás Ríos',       role: 'jugador',        status: 'offline' },
              { name: 'Andrés Costa',     role: 'jugador',        status: 'offline' },
              { name: 'Valentina Ruiz',   role: 'jugador',        status: 'offline' },
              { name: 'Diego Torres',     role: 'jugador',        status: 'offline' },
              { name: 'Luciana Méndez',   role: 'jugador',        status: 'offline' },
            ].map((m, i, arr) => {
              const av = avColor(m.name)
              const roleLabel: Record<string, string> = { admin: 'admin', cuerpo_tecnico: 'técnico', jugador: 'jugador' }
              const rolePillV: Record<string, 'amber' | 'blue' | 'green'> = { admin: 'amber', cuerpo_tecnico: 'blue', jugador: 'green' }
              return (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid #F4F7F5' : 'none' }}>
                  <div style={{ position: 'relative' }}>
                    <Avatar initials={getInitials(m.name)} size={32} bg={av.bg} color={av.color} />
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 9, height: 9, borderRadius: '50%',
                      background: m.status === 'online' ? '#4ADE80' : '#D1D5DB',
                      border: '1.5px solid #fff',
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0D1F14', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                  </div>
                  <Pill variant={rolePillV[m.role]}>{roleLabel[m.role]}</Pill>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
