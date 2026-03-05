import fs from "node:fs";
import path from "node:path";

export type FixedSimulation = {
  id: string;
  examCode: string;
  title: string;
  timeLimitMinutes: number;
  questionIds: string[];
};

export type PromptRich = {
  intro: string;
  observation?: string;
  statementsTitle?: string; // ex: "AFIRMAÇÕES"
  statements?: string[];
  attention?: string;
};

export type PromptBlock = string | PromptRich;

export type Question = {
  id: string;
  domainId: "cloud" | "arch" | "mgmt";
  type: "single" | "multi";
  prompt: PromptBlock;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  explanation: string;
  tags: string[];
  difficulty: number;
  locale: "pt-BR";
};

function contentBasePath(...parts: string[]) {
  const cwd = process.cwd();

  // Caso 1: quando o cwd já é a raiz do repo (tem packages/content)
  const direct = path.join(cwd, "packages", "content");
  if (fs.existsSync(direct)) {
    return path.join(direct, ...parts);
  }

  // Caso 2: quando o cwd é apps/web (subir 2 níveis até a raiz)
  const fromWeb = path.join(cwd, "..", "..", "packages", "content");
  if (fs.existsSync(fromWeb)) {
    return path.join(fromWeb, ...parts);
  }

  return path.join(fromWeb, ...parts);
}

export function loadAz900FixedSimulation(
  simulationId: string,
): FixedSimulation | null {
  const filePath = contentBasePath(
    "exams",
    "az-900",
    "fixed-simulations",
    `${simulationId}.json`,
  );

  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as FixedSimulation;
  } catch {
    return null;
  }
}

export function loadAz900QuestionPtBr(questionId: string): Question | null {
  const filePath = contentBasePath(
    "exams",
    "az-900",
    "questions",
    `${questionId}.pt-BR.json`,
  );

  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Question;
  } catch {
    return null;
  }
}

export function loadAz900QuestionsPublicPtBr(questionIds: string[]) {
  const questions: Question[] = [];
  const missing: string[] = [];

  for (const id of questionIds) {
    const q = loadAz900QuestionPtBr(id);
    if (q) questions.push(q);
    else missing.push(id);
  }

  return { questions, missing };
}
