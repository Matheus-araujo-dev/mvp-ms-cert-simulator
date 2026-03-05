import { NextResponse } from "next/server";
import {
  loadAz900FixedSimulation,
  loadAz900QuestionPtBr,
} from "@/lib/content/az900-fixed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  simulationId: string;
  answers: Record<string, string[]>;
};

function setsEqual(a: string[], b: string[]) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const v of sa) if (!sb.has(v)) return false;
  return true;
}

export async function POST(req: Request) {
  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const simulationId = (body?.simulationId ?? "").trim();
  const answers = body?.answers ?? {};

  if (!simulationId) {
    return NextResponse.json(
      { error: "simulationId é obrigatório." },
      { status: 400 },
    );
  }

  const sim = loadAz900FixedSimulation(simulationId);
  if (!sim) {
    return NextResponse.json(
      { error: "Simulado não encontrado." },
      { status: 404 },
    );
  }

  const byQuestion: any[] = [];
  let correctCount = 0;

  for (const qid of sim.questionIds) {
    const q = loadAz900QuestionPtBr(qid);
    if (!q) {
      byQuestion.push({
        id: qid,
        answered: false,
        correct: false,
        userAnswerOptionIds: [],
        correctOptionIds: [],
        explanation: "",
        error: "Questão não encontrada no conteúdo.",
      });
      continue;
    }

    const user = Array.isArray(answers[qid]) ? answers[qid].map(String) : [];
    const answered = user.length > 0;
    const correct = answered && setsEqual(user, q.correctOptionIds);

    if (correct) correctCount++;

    byQuestion.push({
      id: qid,
      answered,
      correct,
      userAnswerOptionIds: user,
      correctOptionIds: q.correctOptionIds,
      explanation: q.explanation ?? "",
    });
  }

  return NextResponse.json({
    simulationId,
    total: sim.questionIds.length,
    correct: correctCount,
    byQuestion,
  });
}
