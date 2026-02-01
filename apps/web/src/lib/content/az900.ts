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

export function loadAz900ManifestPtBr(): Az900Manifest {
  // process.cwd() aqui vai ser: D:\Projetos\mvp-ms-cert-simulator\apps\web
  const filePath = path.join(
    process.cwd(),
    "..",
    "..",
    "packages",
    "content",
    "exams",
    "az-900",
    "manifests",
    "pt-BR.json"
  );

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Az900Manifest;
}
