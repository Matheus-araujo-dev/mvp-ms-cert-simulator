import fs from "node:fs";
import path from "node:path";

export type Az900Manifest = {
  examCode: string;
  locale: string;
  fixedSimulations: {
    id: string;
    title: string;
    questionCount: number;
    timeLimitMinutes: number;
  }[];
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

  // Fallback (mantém o comportamento antigo, mas com mensagem melhor depois)
  return path.join(fromWeb, ...parts);
}

export function loadAz900ManifestPtBr(): Az900Manifest {
  const filePath = contentBasePath(
    "exams",
    "az-900",
    "manifests",
    "pt-BR.json",
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Manifest AZ-900 não encontrado em: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Az900Manifest;
}
