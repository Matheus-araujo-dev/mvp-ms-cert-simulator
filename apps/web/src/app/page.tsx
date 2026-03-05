import Link from "next/link";
import { loadAz900ManifestPtBr } from "@/lib/content/az900";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Az900HomePage() {
  const manifest = loadAz900ManifestPtBr();

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">AZ-900</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manifest.fixedSimulations.map((sim) => (
          <div key={sim.id} className="rounded border p-4 space-y-2">
            <div className="font-semibold">{sim.title}</div>

            <div className="text-sm text-gray-600">
              {sim.questionCount} questões • {sim.timeLimitMinutes} min (modo
              prova)
            </div>

            <div className="pt-2 flex gap-2">
              <Link
                className="rounded border px-3 py-2 text-sm"
                href={`/az-900/${sim.id}?mode=study`}
              >
                Modo estudo
              </Link>

              <Link
                className="rounded border px-3 py-2 text-sm"
                href={`/az-900/${sim.id}?mode=exam`}
              >
                Modo prova
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
