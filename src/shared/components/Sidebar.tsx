// src/shared/components/Sidebar.tsx
import { NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuthStore } from '../store/authStore'
import { Avatar } from './ui'

const MODULES = [
  { to: '/',               icon: '⌂',  label: 'Dashboard'      },
  { to: '/plantel',        icon: '◈',  label: 'Plantel'         },
  { to: '/gimnasio',       icon: '◉',  label: 'Gimnasio'        },
  { to: '/nutricion',      icon: '◍',  label: 'Nutrición'       },
  { to: '/entrenamientos', icon: '▶',  label: 'Entrenamientos'  },
  { to: '/comunicacion',   icon: '◎',  label: 'Comunicación'    },
  { to: '/estadisticas',   icon: '▣',  label: 'Estadísticas'    },
  { to: '/medico',         icon: '🏥', label: 'Médico'          },
  { to: '/calendario',     icon: '📅', label: 'Calendario'      },
  { to: '/tactica',        icon: '◆',  label: 'Táctica'         },
  { to: '/logistica',      icon: '◇',  label: 'Logística'       },
]

const roleLabel: Record<string, string> = {
  admin:          'Administrador',
  cuerpo_tecnico: 'Cuerpo Técnico',
  jugador:        'Jugador',
}

export default function Sidebar() {
  const user = useAuthStore(s => s.user)
  const initials = user?.name
    ? user.name.split(' ').filter(Boolean).map((w: string) => w[0]).slice(0, 2).join('')
    : '??'

  async function handleLogout() { await signOut(auth) }

  return (
    <aside style={{ width: 232, background: '#0A2218', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh' }}>
      {/* Brand */}
      <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: '#E8A020', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>🏉</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em' }}>RugbyLab</div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase' }}>beta v0.1</div>
        </div>
      </div>

      {/* Nav — scrollable */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        <div style={{ padding: '4px 20px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
          Módulos
        </div>
        {MODULES.map(m => (
          <NavLink key={m.to} to={m.to} end={m.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
              {m.icon}
            </div>
            <span style={{ fontSize: 12.5 }}>{m.label}</span>
          </NavLink>
        ))}

        {/* Admin */}
        {user?.role === 'admin' && (
          <>
            <div style={{ padding: '8px 20px 4px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
              Administración
            </div>
            <NavLink to="/admin/usuarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>👥</div>
              <span style={{ fontSize: 12.5 }}>Usuarios y roles</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.06)', borderRadius: 9 }}>
          <Avatar initials={initials} size={30} bg="#E8A020" color="#0A2218" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{roleLabel[user?.role ?? '']}</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ width: '100%', padding: '7px', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer', marginTop: 5, borderRadius: 6 }}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
