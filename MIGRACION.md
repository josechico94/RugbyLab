# RugbyLab — Ronda 1 de optimización

## Qué se cambió

| Archivo | Cambio |
|---|---|
| `firestore.rules` | Reescrito: valida rol, aísla por club, protege `lesiones` |
| `.gitignore` | Nuevo — faltaba por completo |
| `src/shared/auth/initAuth.ts` | Nuevo — suscripción única a Firebase Auth |
| `src/shared/components/ProtectedRoute.tsx` | Lee del store en vez de suscribirse |
| `src/main.tsx` | Llama `initAuth()` una vez al arrancar |
| `src/shared/hooks/useAuth.ts` | Eliminado (reemplazado por `initAuth`) |
| `src/App.tsx` | `React.lazy` + `Suspense` en los 12 módulos |
| `vite.config.ts` | `manualChunks` para separar react / firebase / recharts |
| `src/shared/types.ts` | Eliminado bloque duplicado de 58 líneas |
| `src/shared/hooks/useClubCollection.ts` | Nuevo — hook CRUD reutilizable |
| `tsconfig.json` | Quitado `baseUrl` (deprecado en TS 7) |

**El build estaba roto.** `npm run build` fallaba con 29 errores de TypeScript: `types.ts` declaraba
dos veces las interfaces `Match` y las stats de partido (una versión en inglés sin usar y otra en
español, que es la que consume `EstadisticasPage`). Se eliminó la versión muerta.

## Resultados medidos

- Bundle único antes: **1251 KB** → carga inicial ahora: **663 KB** (−47%)
- `recharts` (414 KB) ya no se descarga hasta entrar a Estadísticas o Gimnasio
- Cada módulo es un chunk propio de 5–27 KB
- `npm run build` vuelve a pasar

---

## 1. Aplicar los cambios

Descomprimí el ZIP encima de `C:\Users\j.chico\Desktop\RugbyLabPro\rugbylab`, sobrescribiendo.
Después:

```powershell
npm install
npm run build
```

Acordate de **borrar** `src\shared\hooks\useAuth.ts` si sigue ahí.

## 2. Publicar las reglas de Firestore

Las reglas nuevas no se aplican solas. En [console.firebase.google.com](https://console.firebase.google.com)
→ proyecto `rugbylab-86cf0` → **Firestore Database** → pestaña **Reglas** → pegá el contenido de
`firestore.rules` → **Publicar**.

> ⚠️ Antes de publicar, revisá en la colección `users` que tu propio documento tenga
> `role: "admin"` (o `super_admin`) y el `clubId` correcto. Con las reglas nuevas ya no vas a poder
> cambiarte el rol vos mismo desde la app — que es justamente el punto.

## 3. Limpiar el repo

Hay 19.742 archivos de `node_modules` versionados y un `RugbyLab_FINAL (18).zip`. Sacarlos del
seguimiento:

```powershell
git rm -r --cached node_modules
git rm --cached "RugbyLab_FINAL (18).zip"
git add .gitignore
git commit -m "chore: dejar de versionar node_modules y zips"
git push
```

Esto deja de rastrearlos de acá en adelante, pero **el historial sigue pesando 341 MB**. Para
achicarlo de verdad hay que reescribir el historial:

```powershell
pip install git-filter-repo
git filter-repo --path node_modules --invert-paths --force
git remote add origin https://github.com/josechico94/RugbyLab.git
git push origin main --force
```

Esto reescribe todos los commits. Si trabajás solo en el repo no hay problema; si hay alguien más,
avisale porque tendrá que volver a clonar.

## 4. Dejar de subir por la web de GitHub

Todos los commits dicen *"Add files via upload"*. Desde la carpeta local:

```powershell
git add .
git commit -m "descripción del cambio"
git push
```

---

## Cómo usar `useClubCollection`

Reemplaza el bloque de estado + fetch + guardado que se repite en cada módulo:

```tsx
// antes: ~60 líneas de useState/useEffect/getDocs/addDoc/updateDoc/deleteDoc
const { items: eventos, loading, create, update, remove } =
  useClubCollection<Evento>('eventos', { sortBy: e => e.fecha })

// crear
await create({ titulo, tipo, fecha, createdBy: user.uid })
// editar
await update(evento.id, { titulo: nuevoTitulo })
// borrar
await remove(evento.id)
```

Filtra por `clubId` solo, cachea en memoria (no re-fetchea al volver al módulo) y actualiza el
estado local de forma optimista. Los 12 módulos todavía usan el patrón viejo — migrarlos es la
ronda siguiente.

## Qué queda pendiente

1. Migrar los 12 módulos a `useClubCollection` (~30-40% menos código)
2. Decidir Tailwind vs tokens CSS — hay ~940 `style={{}}` inline y Tailwind sin usar
3. Borrar `public/logisticapp_original.html` (136 KB muertos)
4. `useMemo` en las tablas grandes (Plantel, Gimnasio)
5. Tests y CI
