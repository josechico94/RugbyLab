// src/modules/entrenamientos/EntrenamientosPage.tsx
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import { StatCard, Pill, EmptyState } from '@/shared/components/ui'
import type { Video } from '@/shared/types'

const POSITIONS = ['Todos', 'Forwards', 'Backs', 'Pilares', 'Hookers', 'Apertura', 'Todos los puestos']
const CATEGORIES = ['Todas', 'Scrum', 'Lineout', 'Tackle', 'Ataque', 'Defensa', 'Patadas', 'Fitness']

const CAT_PILL: Record<string, React.ReactNode> = {
  Scrum:    <Pill variant="green">Scrum</Pill>,
  Lineout:  <Pill variant="blue">Lineout</Pill>,
  Tackle:   <Pill variant="red">Tackle</Pill>,
  Ataque:   <Pill variant="purple">Ataque</Pill>,
  Defensa:  <Pill variant="amber">Defensa</Pill>,
  Patadas:  <Pill variant="gray">Patadas</Pill>,
  Fitness:  <Pill variant="green">Fitness</Pill>,
}

// Mock videos para cuando Firestore aún no tiene datos
const MOCK_VIDEOS = [
  { id: '1', title: 'Técnica de tackle — fundamentos',        position: ['Todos'],    category: 'Tackle',  duration: '8:24',  uploadedBy: 'Lucas F.' },
  { id: '2', title: 'Scrum — posición y empuje del pilar',   position: ['Pilares'],  category: 'Scrum',   duration: '12:10', uploadedBy: 'Lucas F.' },
  { id: '3', title: 'Lineout ofensivo — señas y variantes',  position: ['Forwards'], category: 'Lineout', duration: '15:33', uploadedBy: 'Lucas F.' },
  { id: '4', title: 'Backs — switch & loop en el 10',        position: ['Backs'],    category: 'Ataque',  duration: '6:45',  uploadedBy: 'Lucas F.' },
  { id: '5', title: 'Defensa en sistema 1-3-3-1',            position: ['Todos'],    category: 'Defensa', duration: '10:20', uploadedBy: 'Lucas F.' },
  { id: '6', title: 'Patada de penal — técnica y presión',   position: ['Apertura'], category: 'Patadas', duration: '7:55',  uploadedBy: 'Lucas F.' },
  { id: '7', title: 'Hooker — lanzamiento de lineout',       position: ['Hookers'],  category: 'Lineout', duration: '9:40',  uploadedBy: 'Lucas F.' },
  { id: '8', title: 'Cardio específico rugby — intervalos',  position: ['Todos'],    category: 'Fitness', duration: '18:00', uploadedBy: 'Preparador' },
]

const VIDEO_ICONS: Record<string, string> = {
  Tackle: '🏉', Scrum: '💪', Lineout: '✋', Ataque: '⚡',
  Defensa: '🛡', Patadas: '🎯', Fitness: '🔥',
}

export default function EntrenamientosPage() {
  const user = useAuthStore((s) => s.user)
  const [videos, setVideos] = useState(MOCK_VIDEOS)
  const [posFilter, setPosFilter] = useState('Todos')
  const [catFilter, setCatFilter] = useState('Todas')
  const [search, setSearch] = useState('')
  const [activeVideo, setActiveVideo] = useState<typeof MOCK_VIDEOS[0] | null>(null)

  const filtered = videos.filter(v => {
    const matchPos = posFilter === 'Todos' || v.position.includes(posFilter) || v.position.includes('Todos') || v.position.includes('Todos los puestos')
    const matchCat = catFilter === 'Todas' || v.category === catFilter
    const matchSearch = v.title.toLowerCase().includes(search.toLowerCase())
    return matchPos && matchCat && matchSearch
  })

  if (activeVideo) {
    return (
      <div className="fade-in">
        <button
          onClick={() => setActiveVideo(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, border: 'none', background: 'transparent', color: '#1B6B3A', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          ← Volver a la biblioteca
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          {/* Player area */}
          <div>
            <div style={{ background: '#0A2218', borderRadius: 12, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>{VIDEO_ICONS[activeVideo.category] ?? '🎬'}</div>
                <div style={{ fontSize: 14 }}>Reproducir video</div>
                <div style={{ fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.25)' }}>
                  Conectá con tu servicio de video (YouTube / Storage)
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0D1F14' }}>{activeVideo.title}</h2>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {activeVideo.position.map(p => <Pill key={p} variant="green">{p}</Pill>)}
                    {CAT_PILL[activeVideo.category]}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#0D1F14' }}>{activeVideo.duration}</div>
                  <div style={{ fontSize: 11, color: '#7A9485' }}>duración</div>
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0F4F2', fontSize: 12, color: '#7A9485' }}>
                Subido por {activeVideo.uploadedBy}
              </div>
            </div>
          </div>

          {/* Sidebar — related */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1F14', marginBottom: 12 }}>Más videos de {activeVideo.category}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {videos.filter(v => v.category === activeVideo.category && v.id !== activeVideo.id).map(v => (
                <button
                  key={v.id}
                  onClick={() => setActiveVideo(v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #E4EBE7', borderRadius: 10, background: '#fff', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: '#E8F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {VIDEO_ICONS[v.category] ?? '🎬'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0D1F14', lineHeight: 1.3 }}>{v.title}</div>
                    <div style={{ fontSize: 10, color: '#7A9485', marginTop: 2 }}>{v.duration}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in">
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Videos disponibles" value={String(videos.length)} accentColor="#1B6B3A" />
        <StatCard label="Categorías"         value={String(CATEGORIES.length - 1)} accentColor="#5047E5" />
        <StatCard label="Nuevos esta semana" value="3" delta="Lineout · Tackles" deltaType="up" accentColor="#E8A020" />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="input"
          style={{ maxWidth: 340, marginBottom: 12 }}
          placeholder="Buscar video..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7A9485', alignSelf: 'center', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Puesto</span>
          {POSITIONS.map(p => (
            <button
              key={p}
              onClick={() => setPosFilter(p)}
              style={{ padding: '5px 13px', borderRadius: 20, border: '1px solid #DDE9E3', background: posFilter === p ? '#0A2218' : '#fff', color: posFilter === p ? '#fff' : '#4A6358', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#7A9485', alignSelf: 'center', marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Categoría</span>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              style={{ padding: '5px 13px', borderRadius: 20, border: '1px solid #DDE9E3', background: catFilter === c ? '#1B6B3A' : '#fff', color: catFilter === c ? '#fff' : '#4A6358', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon="🎥" title="Sin videos" desc="Probá con otro filtro o búsqueda" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {filtered.map(v => (
            <div
              key={v.id}
              onClick={() => setActiveVideo(v)}
              className="card"
              style={{ cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#A3C4B0'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E4EBE7'; (e.currentTarget as HTMLElement).style.transform = '' }}
            >
              {/* Thumb */}
              <div style={{ background: '#E8F5EE', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <span style={{ fontSize: 36 }}>{VIDEO_ICONS[v.category] ?? '🎬'}</span>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s', background: 'rgba(10,34,24,0.3)', borderRadius: '12px 12px 0 0' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1B6B3A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>▶</div>
                </div>
                <div style={{ position: 'absolute', bottom: 7, right: 8, background: 'rgba(10,34,24,0.8)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5 }}>
                  {v.duration}
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1F14', lineHeight: 1.4, marginBottom: 8 }}>{v.title}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <Pill variant="green">{v.position[0]}</Pill>
                  {CAT_PILL[v.category]}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
