// Las tablas y funciones de la app viven en un esquema propio, no en public,
// porque la base de datos se comparte con otra app.
export const ESQUEMA_DB = 'trivia' as const
