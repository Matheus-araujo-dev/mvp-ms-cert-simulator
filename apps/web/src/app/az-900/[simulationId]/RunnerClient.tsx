"use client";

import dynamic from "next/dynamic";

type PromptRich = {
  intro: string;
  observation?: string;
  statementsTitle?: string;
  statements?: string[];
  attention?: string;
};

type QuestionPublic = {
  id: string;
  type: "single" | "multi";
  prompt: string | PromptRich;
  options: { id: string; text: string }[];
  explanation: string;
};

const FixedSimulationRunner = dynamic(
  () => import("@/components/FixedSimulationRunner"),
  { ssr: false }
);

export default function RunnerClient(props: {
  examCode: string;
  locale: string;
  simulationId: string;
  title: string;
  timeLimitMinutes: number;
  questions: QuestionPublic[];
  runMode: "study" | "exam";
}) {
  return <FixedSimulationRunner {...props} />;
}
