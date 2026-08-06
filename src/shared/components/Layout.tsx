// src/shared/components/Layout.tsx
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuthStore } from '../store/authStore'

const META: Record<string, { title: string; sub: string }> = {
  '/':                { title: 'Dashboard',         sub: 'Resumen general del club' },
  '/plantel':         { title: 'Plantel',            sub: 'Estado y perfiles del equipo' },
  '/gimnasio':        { title: 'Gimnasio',           sub: 'Planificación física y evolución' },
  '/nutricion':       { title: 'Nutrición',          sub: 'Plan alimentario personalizado' },
  '/entrenamientos':  { title: 'Entrenamientos',     sub: 'Biblioteca de videos y drills' },
  '/comunicacion':    { title: 'Comunicación',       sub: 'Canal oficial del club' },
  '/estadisticas':    { title: 'Estadísticas',       sub: 'Partidos y rendimiento del equipo' },
  '/medico':          { title: 'Médico / Lesiones',  sub: 'Seguimiento de lesiones del plantel' },
  '/calendario':      { title: 'Calendario',         sub: 'Eventos, partidos y entrenamientos' },
  '/tactica':         { title: 'Táctica',            sub: 'Pizarra táctica — RugbyBoard Pro' },
  '/logistica':       { title: 'Logística',          sub: 'Convocatorias y gestión del equipo' },
  '/admin/usuarios':  { title: 'Usuarios y roles',  sub: 'Gestión de accesos al club' },
}

export default function Layout() {
  const { pathname } = useLocation()
  const meta = META[pathname] ?? { title: '', sub: '' }

  // Táctica ocupa toda la pantalla sin padding
  const isTactica = pathname === '/tactica'

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F0F2F0' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ height: 58, background: '#fff', borderBottom: '1px solid #E4EBE7', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0D1F14', letterSpacing: '-0.01em' }}>{meta.title}</div>
            <div style={{ fontSize: 11, color: '#7A9485', marginTop: 1 }}>{meta.sub}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#F0F6F2', border: '1px solid #DDE9E3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, position: 'relative', cursor: 'pointer' }}>
              🔔
              <div style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: '#E8A020', border: '1.5px solid #fff' }} />
            </div>
          </div>
        </header>

        {/* Content — táctica sin padding para que el iframe llene todo */}
        <main style={{ flex: 1, overflowY: isTactica ? 'hidden' : 'auto', padding: isTactica ? 0 : '24px 28px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
