// Generado con: supabase gen types typescript --schema trivia (ver README).
// No editar a mano: regenerar cuando cambie supabase/schema.sql.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  trivia: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          usuario_id?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          activa: boolean | null
          created_at: string | null
          grupo: string
          id: string
          nombre: string
          orden: number | null
          slug: string
        }
        Insert: {
          activa?: boolean | null
          created_at?: string | null
          grupo?: string
          id?: string
          nombre: string
          orden?: number | null
          slug: string
        }
        Update: {
          activa?: boolean | null
          created_at?: string | null
          grupo?: string
          id?: string
          nombre?: string
          orden?: number | null
          slug?: string
        }
        Relationships: []
      }
      mejores_puntajes: {
        Row: {
          categoria_clave: string
          categoria_id: string | null
          id: string
          mejor_puntaje: number
          partidas_jugadas: number
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          categoria_clave?: never
          categoria_id?: string | null
          id?: string
          mejor_puntaje?: number
          partidas_jugadas?: number
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          categoria_clave?: never
          categoria_id?: string | null
          id?: string
          mejor_puntaje?: number
          partidas_jugadas?: number
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'mejores_puntajes_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'mejores_puntajes_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      partidas: {
        Row: {
          categoria_id: string | null
          created_at: string
          finalizada: boolean
          finalizada_at: string | null
          id: string
          modo: string
          pregunta_actual_id: string | null
          pregunta_servida_at: string | null
          preguntas_correctas: number
          preguntas_totales: number
          puntaje: number
          usuario_id: string | null
          vidas: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          finalizada?: boolean
          finalizada_at?: string | null
          id?: string
          modo?: string
          pregunta_actual_id?: string | null
          pregunta_servida_at?: string | null
          preguntas_correctas?: number
          preguntas_totales?: number
          puntaje?: number
          usuario_id?: string | null
          vidas?: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          finalizada?: boolean
          finalizada_at?: string | null
          id?: string
          modo?: string
          pregunta_actual_id?: string | null
          pregunta_servida_at?: string | null
          preguntas_correctas?: number
          preguntas_totales?: number
          puntaje?: number
          usuario_id?: string | null
          vidas?: number
        }
        Relationships: [
          {
            foreignKeyName: 'partidas_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'partidas_pregunta_actual_id_fkey'
            columns: ['pregunta_actual_id']
            isOneToOne: false
            referencedRelation: 'preguntas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'partidas_usuario_id_fkey'
            columns: ['usuario_id']
            isOneToOne: false
            referencedRelation: 'perfiles'
            referencedColumns: ['id']
          },
        ]
      }
      perfiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nombre_usuario: string
          partidas_jugadas: number
          puntaje_total: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          nombre_usuario: string
          partidas_jugadas?: number
          puntaje_total?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nombre_usuario?: string
          partidas_jugadas?: number
          puntaje_total?: number
        }
        Relationships: []
      }
      preguntas: {
        Row: {
          activa: boolean
          categoria_id: string | null
          created_at: string
          dificultad: number
          generada_por_ia: boolean
          id: string
          opciones: NonNullable<Json>
          pregunta: string
          respuesta_correcta: number
          revisada: boolean
          veces_usada: number
        }
        Insert: {
          activa?: boolean
          categoria_id?: string | null
          created_at?: string
          dificultad?: number
          generada_por_ia?: boolean
          id?: string
          opciones: NonNullable<Json>
          pregunta: string
          respuesta_correcta: number
          revisada?: boolean
          veces_usada?: number
        }
        Update: {
          activa?: boolean
          categoria_id?: string | null
          created_at?: string
          dificultad?: number
          generada_por_ia?: boolean
          id?: string
          opciones?: NonNullable<Json>
          pregunta?: string
          respuesta_correcta?: number
          revisada?: boolean
          veces_usada?: number
        }
        Relationships: [
          {
            foreignKeyName: 'preguntas_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
        ]
      }
      respuestas_partida: {
        Row: {
          correcta: boolean
          created_at: string
          dificultad_en_momento: number
          id: string
          partida_id: string | null
          pregunta_id: string | null
          respuesta_dada: number | null
          tiempo_respuesta_ms: number
        }
        Insert: {
          correcta: boolean
          created_at?: string
          dificultad_en_momento: number
          id?: string
          partida_id?: string | null
          pregunta_id?: string | null
          respuesta_dada?: number | null
          tiempo_respuesta_ms: number
        }
        Update: {
          correcta?: boolean
          created_at?: string
          dificultad_en_momento?: number
          id?: string
          partida_id?: string | null
          pregunta_id?: string | null
          respuesta_dada?: number | null
          tiempo_respuesta_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: 'respuestas_partida_partida_id_fkey'
            columns: ['partida_id']
            isOneToOne: false
            referencedRelation: 'partidas'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'respuestas_partida_pregunta_id_fkey'
            columns: ['pregunta_id']
            isOneToOne: false
            referencedRelation: 'preguntas'
            referencedColumns: ['id']
          },
        ]
      }
      uso_ia: {
        Row: {
          cantidad_pedida: number
          categoria_id: string | null
          created_at: string
          estado: string
          finalizada_at: string | null
          id: string
          insertadas: number
          usuario_id: string
        }
        Insert: {
          cantidad_pedida: number
          categoria_id?: string | null
          created_at?: string
          estado?: string
          finalizada_at?: string | null
          id?: string
          insertadas?: number
          usuario_id: string
        }
        Update: {
          cantidad_pedida?: number
          categoria_id?: string | null
          created_at?: string
          estado?: string
          finalizada_at?: string | null
          id?: string
          insertadas?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'uso_ia_categoria_id_fkey'
            columns: ['categoria_id']
            isOneToOne: false
            referencedRelation: 'categorias'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _bloquear_partida: {
        Args: { p_partida: string; p_usuario: string }
        Returns: {
          categoria_id: string | null
          created_at: string
          finalizada: boolean
          finalizada_at: string | null
          id: string
          modo: string
          pregunta_actual_id: string | null
          pregunta_servida_at: string | null
          preguntas_correctas: number
          preguntas_totales: number
          puntaje: number
          usuario_id: string | null
          vidas: number
        }
        SetofOptions: {
          from: '*'
          to: 'partidas'
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _finalizar_partida: { Args: { p_partida: string }; Returns: Json }
      cerrar_uso_ia: { Args: { p_insertadas: number; p_uso: string }; Returns: undefined }
      es_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      iniciar_partida: { Args: { p_categoria?: string; p_usuario?: string }; Returns: string }
      obtener_posicion_categoria: {
        Args: { p_categoria?: string; p_usuario: string }
        Returns: number
      }
      reservar_uso_ia: {
        Args: {
          p_cantidad: number
          p_categoria: string
          p_limite_diario: number
          p_usuario: string
        }
        Returns: string
      }
      responder_pregunta: {
        Args: { p_partida: string; p_pregunta: string; p_respuesta?: number; p_usuario?: string }
        Returns: Json
      }
      servir_siguiente_pregunta: { Args: { p_partida: string; p_usuario?: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  trivia: {
    Enums: {},
  },
} as const
