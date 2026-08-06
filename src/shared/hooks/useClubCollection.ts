// src/shared/hooks/useClubCollection.ts
//
// Reemplaza el bloque de ~60 líneas que se repite en cada módulo:
//   useState(items) + useState(loading) + useEffect(getDocs where clubId)
//   + handleSave (addDoc/updateDoc + re-sort optimista) + handleDelete
//
// Uso:
//   const { items, loading, create, update, remove } =
//     useClubCollection<Evento>('eventos', { sortBy: e => e.fecha })
//
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/shared/firebase/config'
import { useAuthStore } from '@/shared/store/authStore'

interface WithId { id: string }

interface Options<T> {
  /** Clave de orden. Se compara con localeCompare si es string. */
  sortBy?: (item: T) => string | number
  /** true = descendente. Por defecto ascendente. */
  desc?: boolean
  /** No cargar hasta que esto sea true (para tabs perezosas). */
  enabled?: boolean
}

// Caché en memoria por (clubId, colección). Evita re-fetchear
// la colección completa cada vez que se vuelve a montar el módulo.
const cache = new Map<string, unknown[]>()

export function invalidateClubCache(collectionName?: string) {
  if (!collectionName) return cache.clear()
  for (const key of cache.keys()) {
    if (key.endsWith(`::${collectionName}`)) cache.delete(key)
  }
}

export function useClubCollection<T extends WithId>(
  collectionName: string,
  options: Options<T> = {},
) {
  const { sortBy, desc = false, enabled = true } = options
  const user = useAuthStore((s) => s.user)
  const clubId = user?.clubId

  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Guardamos sortBy en un ref para que cambiar la lambda inline
  // en cada render no dispare el efecto de nuevo.
  const sortRef = useRef(sortBy)
  sortRef.current = sortBy

  const sortItems = useCallback((list: T[]) => {
    const fn = sortRef.current
    if (!fn) return list
    return [...list].sort((a, b) => {
      const va = fn(a), vb = fn(b)
      const cmp = typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb as string)
        : Number(va) - Number(vb)
      return desc ? -cmp : cmp
    })
  }, [desc])

  useEffect(() => {
    if (!clubId || !enabled) return
    const cacheKey = `${clubId}::${collectionName}`

    const cached = cache.get(cacheKey) as T[] | undefined
    if (cached) {
      setItems(sortItems(cached))
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    getDocs(query(collection(db, collectionName), where('clubId', '==', clubId)))
      .then((snap) => {
        if (cancelled) return
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as T[]
        cache.set(cacheKey, data)
        setItems(sortItems(data))
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        console.error(`[${collectionName}] error al cargar:`, e)
        setError('No se pudieron cargar los datos')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [clubId, collectionName, enabled, sortItems])

  // Mantiene el caché sincronizado con el estado optimista
  const commit = useCallback((next: T[]) => {
    if (clubId) cache.set(`${clubId}::${collectionName}`, next)
    setItems(sortItems(next))
  }, [clubId, collectionName, sortItems])

  const create = useCallback(async (data: Omit<T, 'id'>) => {
    if (!clubId) throw new Error('Sin club asignado')
    const payload = { ...data, clubId, createdAt: serverTimestamp() }
    const ref = await addDoc(collection(db, collectionName), payload)
    const created = { ...data, id: ref.id, clubId } as unknown as T
    commit([...items, created])
    return created
  }, [clubId, collectionName, items, commit])

  const update = useCallback(async (id: string, data: Partial<T>) => {
    await updateDoc(doc(db, collectionName, id), data as Record<string, unknown>)
    commit(items.map((it) => (it.id === id ? { ...it, ...data } : it)))
  }, [collectionName, items, commit])

  const remove = useCallback(async (id: string) => {
    await deleteDoc(doc(db, collectionName, id))
    commit(items.filter((it) => it.id !== id))
  }, [collectionName, items, commit])

  const refresh = useCallback(() => {
    if (clubId) cache.delete(`${clubId}::${collectionName}`)
    setLoading(true)
    setItems([])
  }, [clubId, collectionName])

  return { items, loading, error, create, update, remove, refresh }
}
