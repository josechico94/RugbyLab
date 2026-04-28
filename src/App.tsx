// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/shared/components/ProtectedRoute'
import Layout from '@/shared/components/Layout'
import LoginPage from '@/modules/auth/LoginPage'
import HomePage from '@/modules/home/HomePage'
import PlantelPage from '@/modules/plantel/PlantelPage'
import GimnasioPage from '@/modules/gimnasio/GimnasioPage'
import NutricionPage from '@/modules/nutricion/NutricionPage'
import EntrenamientosPage from '@/modules/entrenamientos/EntrenamientosPage'
import ComunicacionPage from '@/modules/comunicacion/ComunicacionPage'
import EstadisticasPage from '@/modules/estadisticas/EstadisticasPage'
import MedicoPage from '@/modules/medico/MedicoPage'
import CalendarioPage from '@/modules/calendario/CalendarioPage'
import TacticaPage from '@/modules/tactica/TacticaPage'
import LogisticaPage from '@/modules/logistica/LogisticaPage'
import UsersPage from '@/modules/admin/UsersPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
          <Route path="admin/usuarios" element={<ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
