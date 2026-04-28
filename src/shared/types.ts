// src/shared/types.ts

export type Role = 'admin' | 'cuerpo_tecnico' | 'jugador'

export interface UserProfile {
  uid: string
  email: string
  name: string
  role: Role
  clubId: string
  position?: string
  number?: number
  avatarUrl?: string
  createdAt: Date
}

export interface Player {
  id: string
  name: string
  position: string
  number: number
  role: Role
  status: 'Disponible' | 'Lesionado' | 'Duda' | 'Suspendido'
  avatarUrl?: string
  birthDate?: string
  weight?: number
  height?: number
  clubId: string
}

export interface NewsItem {
  id: string
  type: 'citacion' | 'resultado' | 'entrenamiento' | 'gimnasio' | 'general'
  title: string
  body?: string
  authorId: string
  authorName: string
  clubId: string
  urgent: boolean
  createdAt: Date
}

// ── Gimnasio ──────────────────────────────────────────────────

export interface SetDetail {
  reps: number
  weight: number | null
}

export interface Exercise {
  name: string
  sets: number
  reps: number
  weight: number | null
  unit: 'kg' | 'lb' | 'min' | 'seg' | 'm' | 'km'
  notes: string | null
  // Series individualizadas — si existe, tiene prioridad sobre sets/reps
  setDetails: SetDetail[] | null
}

export type BlockType = 'entrada_calor' | 'principal' | 'circuito' | 'skills' | 'vuelta_calma'

export interface ExerciseBlock {
  blockType: BlockType
  exercises: Exercise[]
  circuitRounds: number | null
  circuitRestSecs: number | null
}

export interface RoutineDay {
  day: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo'
  type: 'Fuerza' | 'Potencia' | 'Resistencia' | 'Velocidad' | 'Técnica' | 'Descanso'
  blocks: ExerciseBlock[]
  completed: boolean
  completedAt: Date | null
}

export interface Routine {
  id: string
  playerId: string
  clubId: string
  week: number
  year: number
  days: RoutineDay[]
  createdBy: string
  createdAt: Date
}

// ── Nutrición ─────────────────────────────────────────────────

export interface MealItem {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface Meal {
  type: 'Desayuno' | 'Almuerzo' | 'Pre-entreno' | 'Merienda' | 'Cena'
  items: MealItem[]
}

export interface NutritionPlan {
  id: string
  playerId: string
  clubId: string
  meals: Meal[]
  targetCalories: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
  createdBy: string
  createdAt: Date
}

// ── Videos ────────────────────────────────────────────────────

export interface Video {
  id: string
  title: string
  description?: string
  url: string
  thumbnailUrl?: string
  position: string[]
  category: string
  duration?: string
  uploadedBy: string
  clubId: string
  createdAt: Date
}

export interface Message {
  id: string
  authorId: string
  authorName: string
  authorAvatar?: string
  body: string
  clubId: string
  createdAt: Date
}

export interface Event {
  id: string
  title: string
  subtitle: string
  type: 'partido' | 'entrenamiento' | 'concentracion' | 'otro'
  date: Date
  clubId: string
}

// ── Estadísticas ──────────────────────────────────────────────

export interface MatchTeamStats {
  tries: number
  conversions: number
  penaltyGoals: number
  dropGoals: number
  possession: number        // porcentaje 0-100
  territory: number         // porcentaje 0-100
  scrums: number
  scrumsWon: number
  lineouts: number
  lineoutsWon: number
  tackles: number
  tacklesMissed: number
  penalties: number
  yellowCards: number
  redCards: number
}

export interface PlayerMatchStats {
  playerId: string
  playerName: string
  playerNumber: number
  minutesPlayed: number
  tries: number
  assists: number
  tackles: number
  tacklesMissed: number
  carriesMeters: number     // metros ganados en carry
  carries: number
  passesCompleted: number
  lineoutsWon: number
  scrumsWon: number
  turnoversWon: number
  penaltiesConceded: number
  yellowCards: number
  redCards: number
  notes: string | null
}

export interface Match {
  id: string
  clubId: string
  date: string              // ISO date string
  opponent: string
  venue: 'local' | 'visitante' | 'neutral'
  competition: string       // Ej: "Torneo del Interior", "Amistoso"
  ourScore: number
  opponentScore: number
  result: 'victoria' | 'derrota' | 'empate'
  teamStats: MatchTeamStats
  playerStats: PlayerMatchStats[]
  notes: string | null
  createdBy: string
  createdAt: Date
}

// ── Estadísticas ──────────────────────────────────────────────

export interface PlayerMatchStats {
  playerId: string
  playerName: string
  position: string
  minutosJugados: number
  // Ataque
  tries: number
  asistencias: number
  metrosGanados: number
  pasesCompletados: number
  pasesTotales: number
  carreras: number
  // Defensa
  tacklesCompletados: number
  tacklesTotales: number
  tacklesFallados: number
  turnoversGanados: number
  // Set piece
  lineoutsGanados: number
  lineoutsTotales: number
  // Disciplina
  amarillas: number
  rojas: number
  penalesCometidos: number
  // Patadas
  pateadasTotal: number
  pateadasMetros: number
  // Notas
  nota: string | null
}

export interface TeamMatchStats {
  // Resultado
  puntosAFavor: number
  puntoEnContra: number
  triesAFavor: number
  triesEnContra: number
  // Posesión y territorio
  posesionPct: number
  territorioPct: number
  // Set piece
  scrumGanados: number
  scrumTotales: number
  lineoutGanados: number
  lineoutTotales: number
  // Ataque
  metrosTotales: number
  pasesTotales: number
  // Defensa
  tacklesPct: number
  // Disciplina
  penalesCometidos: number
  amarillas: number
  rojas: number
}

export interface Match {
  id: string
  clubId: string
  rival: string
  fecha: string          // ISO date string
  cancha: 'local' | 'visitante' | 'neutral'
  competicion: string
  teamStats: TeamMatchStats
  playerStats: PlayerMatchStats[]
  createdBy: string
  createdAt: Date
}

// ── Médico ────────────────────────────────────────────────────

export type LesionEstado = 'activa' | 'en_recuperacion' | 'alta_medica'
export type LesionZona =
  | 'cabeza' | 'cuello' | 'hombro_der' | 'hombro_izq'
  | 'codo_der' | 'codo_izq' | 'muneca_der' | 'muneca_izq'
  | 'espalda_alta' | 'espalda_baja'
  | 'cadera' | 'muslo_der' | 'muslo_izq'
  | 'rodilla_der' | 'rodilla_izq'
  | 'tobillo_der' | 'tobillo_izq'
  | 'otro'

export interface Lesion {
  id: string
  playerId: string
  playerName: string
  clubId: string
  zona: LesionZona
  descripcion: string
  fechaLesion: string
  fechaAltaEstimada: string | null
  fechaAltaReal: string | null
  estado: LesionEstado
  mecanismo: string | null       // cómo ocurrió
  tratamiento: string | null
  observaciones: string | null
  createdBy: string
  createdAt: Date
}

// ── Calendario ────────────────────────────────────────────────

export type EventoTipo = 'partido' | 'entrenamiento' | 'concentracion' | 'medico' | 'otro'

export interface Evento {
  id: string
  clubId: string
  titulo: string
  descripcion: string | null
  tipo: EventoTipo
  fecha: string          // YYYY-MM-DD
  horaInicio: string | null   // HH:mm
  horaFin: string | null
  lugar: string | null
  rival: string | null       // solo para partidos
  obligatorio: boolean
  createdBy: string
  createdAt: Date
}

// ── Logística ─────────────────────────────────────────────────

export type ConvocatoriaEstado = 'confirmado' | 'pendiente' | 'no_disponible'

export interface ConvocatoriaJugador {
  playerId: string
  playerName: string
  position: string
  estado: ConvocatoriaEstado
  observacion: string | null
}

export interface Convocatoria {
  id: string
  clubId: string
  eventoId: string | null   // puede linkearse a un Evento del calendario
  titulo: string
  fecha: string
  horaConcentracion: string | null
  horaPartido: string | null
  lugar: string | null
  rival: string | null
  transporte: string | null  // info de cómo van al partido
  equipamiento: string[]     // lista de items que deben traer
  notas: string | null
  jugadores: ConvocatoriaJugador[]
  createdBy: string
  createdAt: Date
}
