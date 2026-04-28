// src/shared/hooks/useAuth.ts
import { useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { useAuthStore } from '../store/authStore'
import type { UserProfile } from '../types'

export function useAuth() {
  const { user, loading, setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (snap.exists()) {
            const data = snap.data()
            // Normalize role: super_admin → admin
            const role = data.role === 'super_admin' ? 'admin' : (data.role ?? 'jugador')
            // Fallback: name → displayName → email
            const name = data.name || data.displayName || firebaseUser.email || 'Usuario'
            // Fallback: clubId null → 'rugbylab'
            const clubId = data.clubId || 'rugbylab'
            setUser({ uid: firebaseUser.uid, ...data, name, role, clubId } as UserProfile)
          } else {
            // Documento no existe aún — crearlo con datos básicos
            const name = firebaseUser.displayName || firebaseUser.email || 'Usuario'
            const profile: UserProfile = {
              uid:       firebaseUser.uid,
              email:     firebaseUser.email ?? '',
              name,
              role:      'jugador',
              clubId:    'rugbylab',
              createdAt: new Date(),
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), profile)
            setUser(profile)
          }
        } catch (err) {
          console.error('Error loading user profile:', err)
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return { user, loading }
}
