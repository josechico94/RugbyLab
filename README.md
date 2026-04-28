# 🏉 RugbyLab — Setup Guide

## Requisitos
- Node.js 18+
- Cuenta de Firebase (gratis)

---

## 1. Instalación

```bash
# Instalar dependencias
npm install

# Arrancar en desarrollo
npm run dev
```

La app corre en `http://localhost:5173`

---

## 2. Configurar Firebase

### Paso 1 — Crear proyecto
1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Crear proyecto: **rugbylab**
3. Ir a **Configuración del proyecto** → **Agregar app** → Web (`</>`)
4. Copiar el objeto `firebaseConfig`

### Paso 2 — Pegar credenciales
Abrir `src/shared/firebase/config.ts` y reemplazar los valores:

```ts
const firebaseConfig = {
  apiKey:            "tu-api-key",
  authDomain:        "tu-proyecto.firebaseapp.com",
  projectId:         "tu-proyecto-id",
  storageBucket:     "tu-proyecto.appspot.com",
  messagingSenderId: "tu-sender-id",
  appId:             "tu-app-id",
}
```

### Paso 3 — Activar servicios en Firebase Console

| Servicio | Ubicación | Configuración |
|----------|-----------|---------------|
| **Authentication** | Build → Authentication → Sign-in method | Activar **Email/Password** |
| **Firestore** | Build → Firestore Database | Crear en modo **producción** |
| **Storage** | Build → Storage | Activar con reglas por defecto |

### Paso 4 — Copiar reglas de Firestore
1. Ir a **Firestore → Reglas**
2. Copiar el contenido de `firestore.rules`
3. Publicar

---

## 3. Crear el primer usuario Admin

1. Registrarte en la app (`/login` → pestaña Registrarse)
2. Tu usuario se crea con rol **jugador** por defecto
3. En Firebase Console → Firestore → colección `users` → tu documento
4. Cambiar `role: "jugador"` → `role: "admin"`
5. Recargar la app — ya tenés acceso de administrador

---

## 4. Estructura del proyecto

```
src/
├── modules/
│   ├── auth/           ← Login y registro
│   ├── home/           ← Dashboard principal
│   ├── plantel/        ← Gestión de jugadores
│   ├── gimnasio/       ← Rutinas y evolución física
│   ├── nutricion/      ← Planes alimentarios
│   ├── entrenamientos/ ← Biblioteca de videos
│   └── comunicacion/   ← Feed del club
└── shared/
    ├── components/     ← UI reutilizable (ui.tsx, Layout, Sidebar)
    ├── firebase/       ← Configuración Firebase
    ├── hooks/          ← useAuth
    ├── store/          ← Zustand (authStore)
    ├── styles/         ← global.css + design tokens
    └── types.ts        ← Tipos TypeScript
```

---

## 5. Deploy a producción

```bash
# Build
npm run build

# Deploy en Firebase Hosting (opcional)
npm install -g firebase-tools
firebase login
firebase init hosting   # apuntar a carpeta "dist"
firebase deploy
```

También podés deployar en **Vercel** conectando el repo de GitHub — detecta Vite automáticamente.

---

## 6. Próximos pasos (Fase 2)

- [ ] Módulo Estadísticas de partido
- [ ] Módulo Médico / Lesiones
- [ ] Calendario con Google Calendar sync
- [ ] Integración RugbyBoardPro
- [ ] Integración LogisticApp
- [ ] PWA (instalable en celular)
- [ ] Notificaciones push

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS + CSS custom tokens |
| Router | React Router v6 |
| Estado | Zustand |
| Backend | Firebase (Firestore + Auth + Storage) |
| Gráficos | Recharts |
| Deploy | Vercel / Firebase Hosting |
