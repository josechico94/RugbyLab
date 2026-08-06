// src/modules/auth/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/shared/firebase/config'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/')
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, 'users', user.uid), {
        uid:      user.uid,
        email,
        name,
        displayName: name,
        role:     'jugador',
        clubId:   'rugbylab',
        createdAt: new Date(),
      })
      navigate('/')
    } catch {
      setError('Error al crear la cuenta. Intentá con otro email.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0A2218',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', padding: 24,
    }}>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16,
          background: '#E8A020', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 14px',
        }}>🏉</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 30, letterSpacing: '-0.03em' }}>RugbyLab</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>Laboratorio integral de rugby</div>
      </div>

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 16,
        padding: '28px 32px', width: '100%', maxWidth: 380,
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 24, background: '#F0F2F0', borderRadius: 9, padding: 3 }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              style={{
                flex: 1, padding: '8px', border: 'none', borderRadius: 7,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#0D1F14' : '#7A9485',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
          {mode === 'register' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>
                Nombre completo
              </label>
              <input
                className="input"
                type="text"
                placeholder="Ej: Martín García"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>
              Email
            </label>
            <input
              className="input"
              type="email"
              placeholder="tumail@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4A6358', display: 'block', marginBottom: 5 }}>
              Contraseña
            </label>
            <input
              className="input"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div style={{ background: '#FEECEC', color: '#B91C1C', fontSize: 12, padding: '8px 12px', borderRadius: 7, marginBottom: 14, fontWeight: 500 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 12, border: 'none', borderRadius: 10,
              background: loading ? '#C5D5C9' : '#1B6B3A',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar a RugbyLab →' : 'Crear cuenta →'}
          </button>
        </form>
      </div>
    </div>
  )
}
