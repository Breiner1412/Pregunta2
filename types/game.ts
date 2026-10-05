export interface Categoria {
  id: string
  nombre: string
  slug: string
  grupo: string
}

export interface Pregunta {
  id: string
  categoria_id: string
  pregunta: string
  opciones: string[]
  respuesta_correcta: number
  dificultad: number
}

// Versión que viaja al navegador DURANTE el juego: nunca incluye la
// respuesta correcta, para que no se pueda ver antes de responder.
export interface PreguntaJuego {
  id: string
  categoria_id: string
  pregunta: string
  opciones: string[]
  dificultad: number
}

export type EstadoJuego = 'seleccion' | 'jugando' | 'resultado'

// La partida vive en el servidor: estas son sus respuestas a cada paso.
export interface ResultadoPartida {
  correctas: number
  puntaje: number
  total_respondidas: number
}

export type PasoPartida =
  | { terminada: false; pregunta: PreguntaJuego; numero: number; vidas: number; puntaje: number }
  | { terminada: true; resultado: ResultadoPartida }

export type PartidaIniciada = PasoPartida & { partida_id: string }

export interface RespuestaVerificada {
  correcta: boolean
  respuesta_correcta: number
  vidas: number
  puntaje: number
  terminada: boolean
  resultado: ResultadoPartida | null
}

export interface PerfilRanking {
  usuario_id: string
  nombre_usuario: string
  mejor_puntaje: number
  partidas_jugadas: number
}
