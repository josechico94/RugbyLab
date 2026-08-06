// src/modules/tactica/TacticaPage.tsx
// La pizarra táctica se carga desde /boardpro.html via iframe fullscreen.
// El archivo boardpro.html debe estar en la carpeta /public del proyecto.

import { useState } from 'react'
import { useAuthStore } from '@/shared/store/authStore'

export default function TacticaPage() {
  const user = useAuthStore(s => s.user)
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 58px - 48px)', display: 'flex', flexDirection: 'column' }}>

      {/* Topbar de la pizarra */}
      {!fullscreen && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: '#4A6358', lineHeight: 1.5 }}>
              Dibujá jugadas, mové jugadores y anotaciones. Los cambios se guardan localmente en el navegador.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setFullscreen(true)}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 8,
                background: '#0A2218', color: '#fff', fontSize: 13,
                fontWeight: 700, cursor: 'pointer', display: 'flex',
                alignItems: 'center', gap: 6,
              }}
            >
              ⛶ Pantalla completa
            </button>
          </div>
        </div>
      )}

      {/* Iframe container */}
      <div style={{
        flex: 1, borderRadius: fullscreen ? 0 : 14,
        overflow: 'hidden',
        border: fullscreen ? 'none' : '1px solid #E4EBE7',
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 9999 : undefined,
        background: '#0b1720',
      }}>
        {/* Exit fullscreen button */}
        {fullscreen && (
          <button
            onClick={() => setFullscreen(false)}
            style={{
              position: 'absolute', top: 14, right: 14, zIndex: 10000,
              padding: '8px 14px', border: 'none', borderRadius: 8,
              background: 'rgba(0,0,0,0.6)', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          >
            ✕ Salir
          </button>
        )}

        <iframe
          src="/boardpro.html"
          title="RugbyBoard Pro — Pizarra táctica"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allow="fullscreen"
        />
      </div>
    </div>
  )
}
