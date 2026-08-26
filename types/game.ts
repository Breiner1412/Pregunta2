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

export interface RespuestaUsuario {
  pregunta_id: string
  respuesta_dada: number | null
  correcta: boolean
  tiempo_respuesta_ms: number
  dificultad_en_momento: number
}

export interface PerfilRanking {
  usuario_id: string
  nombre_usuario: string
  mejor_puntaje: number
  partidas_jugadas: number
}
