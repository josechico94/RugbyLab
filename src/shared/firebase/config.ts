// src/shared/firebase/config.ts
// ─────────────────────────────────────────────────────────────
//  PASO 1: Ir a https://console.firebase.google.com
//  PASO 2: Crear proyecto "rugbylab"
//  PASO 3: Ir a Configuración del proyecto → Agregar app web
//  PASO 4: Copiar tu firebaseConfig aquí abajo
//  PASO 5: En Firebase Console activar:
//    • Authentication → Email/Password
//    • Firestore Database (modo producción)
//    • Storage
// ─────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            "AIzaSyBgJGdZPC8r1gVyCpxFCavjpVr92-ZIkjY",
  authDomain:        "rugbylab-86cf0.firebaseapp.com",
  projectId:         "rugbylab-86cf0",
  storageBucket:     "rugbylab-86cf0.firebasestorage.app",
  messagingSenderId: "41099002550",
  appId:             "1:41099002550:web:315286fb9afd7752fb5c17",
  measurementId:     "G-HEWT2K2QB7",
}

const app = initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)
export default app
