// src/modules/home/HomePage.tsx
import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { StatCard, Card, SectionHeader, Avatar, Pill, statusPill } from '@/shared/components/ui'
import type { NewsItem, Player, Event } from '@/shared/types'

const TIPO_PILL: Record<string, React.ReactNode> = {
  citacion:      <Pill variant="blue">Citación</Pill>,
  resultado:     <Pill variant="green">Resultado</Pill>,
  entrenamiento: <Pill variant="purple">Entrenamiento</Pill>,
  gimnasio:      <Pill variant="amber">Gimnasio</Pill>,
  general:       <Pill variant="gray">General</Pill>,
}

const EVENT_PILL: Record<string, React.ReactNode> = {
  partido:        <Pill variant="green">partido</Pill>,
  entrenamiento:  <Pill variant="blue">entreno</Pill>,
  concentracion:  <Pill variant="amber">concentración</Pill>,
  otro:           <Pill variant="gray">otro</Pill>,
}

export default function HomePage() {
  const user = useAuthStore((s) => s.user)
  const [news, setNews]     = useState<NewsItem[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function fetchAll() {
      const clubId = user!.clubId
      try {
        const [newsSnap, playersSnap] = await Promise.all([
          getDocs(query(
            collection(db, 'news'),
            where('clubId', '==', clubId),
            limit(5)
          )),
          getDocs(query(
            collection(db, 'players'),
            where('clubId', '==', clubId),
            limit(5)
          )),
        ])
        const fetchedNews = newsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as NewsItem)
        const fetchedPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Player)
        if (fetchedNews.length > 0) setNews(fetchedNews)
        if (fetchedPlayers.length > 0) setPlayers(fetchedPlayers)
      } catch (err) {
        console.warn('Firestore fetch error (usando datos de ejemplo):', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [user])

  const available = players.filter(p => p.status === 'Disponible').length
  const injured   = players.filter(p => p.status === 'Lesionado' || p.status === 'Duda').length

  const firstName = user?.name ? user.name.split(' ')[0] : ''

  return (
    <div className="fade-in">
      {/* Greeting */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0D1F14', letterSpacing: '-0.02em', margin: 0 }}>
          Buen día, {firstName} 👋
        </h1>
        <p style={{ color: '#7A9485', fontSize: 13, margin: '4px 0 0' }}>
          Todo lo del club en un solo lugar.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Jugadores activos" value={String(players.length || 24)} delta="▲ 2 este mes" deltaType="up" accentColor="#1B6B3A" />
        <StatCard label="Disponibles"       value={String(available || 21)}       delta={`${injured} en duda/lesión`} deltaType="warn" accentColor="#E8A020" />
        <StatCard label="Próximo partido"   value="Sáb 26" delta="vs RC Belgrano" accentColor="#5047E5" />
        <StatCard label="Sesión de hoy"     value="19:00"  delta="Presencia obligatoria" deltaType="warn" accentColor="#B45309" />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>

        {/* Feed */}
        <div>
          <SectionHeader title="Novedades del club" />
          <Card>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9AB5A8', fontSize: 13 }}>Cargando...</div>
            ) : news.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9AB5A8', fontSize: 13 }}>Sin novedades aún</div>
            ) : news.map((n) => (
              <div key={n.id} className="feed-item" style={{ borderLeft: n.urgent ? '3px solid #E8A020' : undefined }}>
                <Avatar
                  initials={n.authorName.split(' ').map(w => w[0]).slice(0,2).join('')}
                  size={34} bg="#EBF4FF" color="#1D5FAD"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0D1F14' }}>{n.authorName}</span>
                    {TIPO_PILL[n.type]}
                    {n.urgent && <Pill variant="gold">urgente</Pill>}
                  </div>
                  <div style={{ fontSize: 13, color: '#4A6358', lineHeight: 1.45 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: '#9AB5A8', marginTop: 4 }}>
                    {n.createdAt instanceof Date
                      ? n.createdAt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : 'Reciente'}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Events */}
          <div>
            <SectionHeader title="Próximos eventos" />
            <Card>
              {[
                { d: 26, m: 'ABR', t: 'vs RC Belgrano', sub: 'Cancha local · 15:00h', tipo: 'partido' },
                { d: 29, m: 'ABR', t: 'Entrenamiento pesos', sub: 'Gimnasio · 19:00h', tipo: 'entrenamiento' },
                { d: 3,  m: 'MAY', t: 'vs CASI', sub: 'Cancha visitante · 16:00h', tipo: 'partido' },
              ].map((e) => (
                <div key={e.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #F4F7F5' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 9, background: '#F0F6F2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1B6B3A', lineHeight: 1 }}>{e.d}</div>
                    <div style={{ fontSize: 9, color: '#7A9485', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{e.m}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1F14' }}>{e.t}</div>
                    <div style={{ fontSize: 11, color: '#7A9485', marginTop: 1 }}>{e.sub}</div>
                  </div>
                  {EVENT_PILL[e.tipo]}
                </div>
              ))}
            </Card>
          </div>

          {/* Player status */}
          <div>
            <SectionHeader title="Estado del plantel" />
            <Card>
              {players.slice(0, 5).map((p) => (
                <div key={p.id} className="player-row">
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0A2218', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.number}
                  </div>
                  <Avatar initials={p.name.split(' ').map(w => w[0]).slice(0,2).join('')} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0D1F14' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: '#7A9485' }}>{p.position}</div>
                  </div>
                  {statusPill(p.status)}
                </div>
              ))}
              {players.length === 0 && (
                <div style={{ padding: '16px 18px', fontSize: 12, color: '#9AB5A8', textAlign: 'center' }}>
                  Sin jugadores cargados
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
