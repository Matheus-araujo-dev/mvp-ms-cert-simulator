import FixedSimulationRunner from "@/components/FixedSimulationRunner";
import {
  loadAz900FixedSimulation,
  loadAz900QuestionsPublicPtBr,
} from "@/lib/content/az900-fixed";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ simulationId: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { simulationId } = await params;
  const sp = searchParams ? await searchParams : undefined;

  const sim = loadAz900FixedSimulation(simulationId);

  if (!sim) {
    return <div className="p-6">Simulado não encontrado.</div>;
  }

  const { questions, missing } = loadAz900QuestionsPublicPtBr(sim.questionIds);

  if (missing.length > 0) {
    return (
      <div className="p-6 space-y-2">
        <div className="font-semibold">Conteúdo incompleto</div>
        <div className="text-sm text-gray-600">
          Este simulado referencia questões que não foram encontradas:
        </div>
        <pre className="rounded border p-3 text-sm whitespace-pre-wrap">
          {missing.join("\n")}
        </pre>
      </div>
    );
  }

  const modeParam = (sp?.mode ?? "").toLowerCase();
  const runMode: "study" | "exam" = modeParam === "study" ? "study" : "exam";

  return (
    <FixedSimulationRunner
      examCode="az-900"
      locale="pt-BR"
      simulationId={sim.id}
      title={sim.title}
      runMode={runMode}
      timeLimitMinutes={sim.timeLimitMinutes}
      questions={questions}
    />
  );
}
