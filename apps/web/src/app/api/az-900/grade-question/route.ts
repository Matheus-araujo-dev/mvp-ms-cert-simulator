import { NextResponse } from "next/server";
import { loadAz900QuestionPtBr } from "@/lib/content/az900-fixed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  questionId: string;
  answerOptionIds: string[];
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

  const questionId = (body?.questionId ?? "").trim();
  const answerOptionIds = Array.isArray(body?.answerOptionIds)
    ? body.answerOptionIds
    : [];

  if (!questionId) {
    return NextResponse.json(
      { error: "questionId é obrigatório." },
      { status: 400 },
    );
  }

  const q = loadAz900QuestionPtBr(questionId);

  if (!q) {
    return NextResponse.json(
      { error: "Questão não encontrada." },
      { status: 404 },
    );
  }

  const user = answerOptionIds.map(String);
  const correct = setsEqual(user, q.correctOptionIds);

  return NextResponse.json({
    questionId,
    correct,
    correctOptionIds: q.correctOptionIds,
    answeredOptionIds: user,
    explanation: q.explanation ?? "",
  });
}
