import { notFound } from "next/navigation";
import FixedSimulationRunner from "@/components/FixedSimulationRunner";
import {
  loadAz900FixedSimulation,
  loadAz900QuestionPtBr,
} from "@/lib/content/az900-fixed";

export default async function Page({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}) {
  const { simulationId } = await params;

  if (!simulationId) {
    notFound();
  }

  const sim = loadAz900FixedSimulation(simulationId);
  const questions = sim.questionIds.map((id) => loadAz900QuestionPtBr(id));

  return (
    <FixedSimulationRunner
      title={sim.title}
      timeLimitMinutes={sim.timeLimitMinutes}
      questions={questions}
    />
  );
}
