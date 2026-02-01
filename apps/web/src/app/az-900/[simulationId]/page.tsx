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

  const sim = await loadAz900FixedSimulation(simulationId);

  if (!sim) {
    return <div className="p-6">Simulado não encontrado.</div>;
  }

  const questions = await loadAz900QuestionsPublicPtBr(sim.questionIds);

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
