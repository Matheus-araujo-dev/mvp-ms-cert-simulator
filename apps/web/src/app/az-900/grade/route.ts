import { NextResponse } from "next/server";
import {
  loadAz900FixedSimulation,
  loadAz900QuestionPtBr,
} from "@/lib/content/az900-fixed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GradeRequest = {
  simulationId: string;
  answers: Record<string, string[]>;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isObject(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const simulationId = body.simulationId;
  const answers = body.answers;

  if (typeof simulationId !== "string" || !simulationId) {
    return NextResponse.json({ error: "invalid_simulationId" }, { status: 400 });
  }
  if (!isObject(answers)) {
    return NextResponse.json({ error: "invalid_answers" }, { status: 400 });
  }

  let sim: { id: string; questionIds: string[]; title: string; timeLimitMinutes: number };
  try {
    sim = loadAz900FixedSimulation(simulationId);
  } catch {
    return NextResponse.json({ error: "simulation_not_found" }, { status: 404 });
  }

  let correct = 0;

  const byQuestion: Array<{
    id: string;
    answered: boolean;
    correct: boolean;
  }> = [];

  for (const qid of sim.questionIds) {
    const q = loadAz900QuestionPtBr(qid);

    // pega resposta do usuário (se existir)
    const raw = answers[qid];
    const picked = Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];

    // valida opções (evita resposta “inventada”)
    const validOptionIds = new Set(q.options.map((o) => o.id));
    const cleaned = [...new Set(picked)].filter((id) => validOptionIds.has(id));

    const answered = cleaned.length > 0;

    const a = cleaned.slice().sort().join("|");
    const c = [...new Set(q.correctOptionIds)].slice().sort().join("|");

    const isCorrect = answered && a === c;

    if (isCorrect) correct++;

    byQuestion.push({
      id: qid,
      answered,
      correct: isCorrect,
    });
  }

  return NextResponse.json({
    simulationId: sim.id,
    total: sim.questionIds.length,
    correct,
    byQuestion,
  });
}
