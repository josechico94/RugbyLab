// src/App.tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/shared/components/ProtectedRoute'
import Layout from '@/shared/components/Layout'
import LoginPage from '@/modules/auth/LoginPage'
import { Spinner } from '@/shared/components/ui'

// Login y Layout van en el bundle inicial (se necesitan siempre).
// El resto se carga bajo demanda: entrar a la app ya no descarga
// recharts ni los 12 módulos de una.
const HomePage           = lazy(() => import('@/modules/home/HomePage'))
const PlantelPage        = lazy(() => import('@/modules/plantel/PlantelPage'))
const GimnasioPage       = lazy(() => import('@/modules/gimnasio/GimnasioPage'))
const NutricionPage      = lazy(() => import('@/modules/nutricion/NutricionPage'))
const EntrenamientosPage = lazy(() => import('@/modules/entrenamientos/EntrenamientosPage'))
const ComunicacionPage   = lazy(() => import('@/modules/comunicacion/ComunicacionPage'))
const EstadisticasPage   = lazy(() => import('@/modules/estadisticas/EstadisticasPage'))
const MedicoPage         = lazy(() => import('@/modules/medico/MedicoPage'))
const CalendarioPage     = lazy(() => import('@/modules/calendario/CalendarioPage'))
const TacticaPage        = lazy(() => import('@/modules/tactica/TacticaPage'))
const LogisticaPage      = lazy(() => import('@/modules/logistica/LogisticaPage'))
const UsersPage          = lazy(() => import('@/modules/admin/UsersPage'))

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index                 element={<HomePage />} />
            <Route path="plantel"        element={<PlantelPage />} />
            <Route path="gimnasio"       element={<GimnasioPage />} />
            <Route path="nutricion"      element={<NutricionPage />} />
            <Route path="entrenamientos" element={<EntrenamientosPage />} />
            <Route path="comunicacion"   element={<ComunicacionPage />} />
            <Route path="estadisticas"   element={<EstadisticasPage />} />
            <Route path="medico"         element={<MedicoPage />} />
            <Route path="calendario"     element={<CalendarioPage />} />
            <Route path="tactica"        element={<TacticaPage />} />
            <Route path="logistica"      element={<LogisticaPage />} />
            <Route
              path="admin/usuarios"
              element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>}
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
