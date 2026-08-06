// src/shared/auth/initAuth.ts
// Suscripción ÚNICA a onAuthStateChanged para toda la app.
// Antes esto vivía dentro de ProtectedRoute, que está montado
// más de una vez (rutas anidadas) → múltiples listeners y un
// getDoc del perfil por cada montaje.
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'
import type { UserProfile, Role } from '@/shared/types'

let started = false

function normalizeRole(raw: unknown): Role {
  if (raw === 'super_admin' || raw === 'admin') return 'admin'
  if (raw === 'cuerpo_tecnico') return 'cuerpo_tecnico'
  return 'jugador'
}

export function initAuth() {
  if (started) return
  started = true

  const { setUser, setLoading } = useAuthStore.getState()

  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const ref = doc(db, 'users', fbUser.uid)
      const snap = await getDoc(ref)

      if (snap.exists()) {
        const data = snap.data()
        setUser({
          ...data,
          uid: fbUser.uid,
          name: data.name || data.displayName || fbUser.email || 'Usuario',
          role: normalizeRole(data.role),
          clubId: data.clubId || 'rugbylab',
        } as UserProfile)
      } else {
        // Primer login sin perfil: se crea con rol 'jugador'.
        // Las reglas de Firestore rechazan cualquier otro rol acá.
        const profile: UserProfile = {
          uid: fbUser.uid,
          email: fbUser.email ?? '',
          name: fbUser.displayName || fbUser.email || 'Usuario',
          role: 'jugador',
          clubId: 'rugbylab',
          createdAt: new Date(),
        }
        await setDoc(ref, { ...profile, createdAt: serverTimestamp() })
        setUser(profile)
      }
    } catch (err) {
      console.error('[auth] no se pudo cargar el perfil:', err)
      setUser(null)
    } finally {
      setLoading(false)
    }
  })
}
