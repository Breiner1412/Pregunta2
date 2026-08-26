import Link from "next/link";

const CATEGORIAS_DESTACADAS = [
  "Cultura General",
  "Ciencia",
  "Deportes",
  "Música",
  "Anime y Manga",
  "Películas",
  "Cómics",
  "Series",
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-lg">
        <p className="font-mono text-xs tracking-[0.3em] text-accent uppercase mb-4">
          15s por pregunta · 3 vidas · sin límite
        </p>
        <h1 className="font-display text-4xl sm:text-5xl leading-tight mb-4 text-paper [text-shadow:0_0_35px_rgba(255,61,113,0.35)]">
          ANIME
          <br />
          TRIVIA
        </h1>
        <p className="text-ink-soft mb-8">
          Preguntas de anime, manga y cultura geek — potenciadas por IA, cada vez más difíciles,
          cada vez más nuevas.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto mb-8">
          <Link
            href="/jugar"
            className="p-3 rounded-xl bg-brand text-paper font-bold hover:brightness-110 transition shadow-[0_0_25px_-8px_rgba(255,61,113,0.6)]"
          >
            ▶ Jugar ahora
          </Link>
          <Link
            href="/login"
            className="p-3 rounded-xl border border-white/15 text-paper font-medium hover:bg-white/5 transition"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/ranking"
            className="p-3 rounded-xl border border-white/15 text-paper font-medium hover:bg-white/5 transition"
          >
            🏆 Ver ranking
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIAS_DESTACADAS.map((c) => (
            <span
              key={c}
              className="text-xs font-mono uppercase tracking-wide px-3 py-1 rounded-full border border-white/10 text-ink-soft"
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
