import Link from "next/link";
import { loadAz900ManifestPtBr } from "@/lib/content/az900";

export default function Home() {
  const manifest = loadAz900ManifestPtBr();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Simulador Microsoft</h1>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">{manifest.examCode}</h2>
        <p className="text-sm text-gray-600">Locale: {manifest.locale}</p>

        <h3 className="mt-4 text-lg font-semibold">Simulados fixos</h3>

        <ul className="mt-3 space-y-3">
          {manifest.fixedSimulations.map((s) => (
            <li key={s.id} className="rounded border p-3">
              <div className="font-semibold">{s.title}</div>
              <div className="text-sm text-gray-600">
                {s.timeLimitMinutes} min • {s.questionCount} questões
              </div>

              {/* Link provisório (vamos criar essa rota depois) */}
              <div className="mt-2">
                <Link className="underline" href={`/az-900/${s.id}`}>
                  Abrir
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
