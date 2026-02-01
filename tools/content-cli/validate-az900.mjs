import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const base = path.join(ROOT, "packages", "content", "exams", "az-900");
const questionsDir = path.join(base, "questions");
const simsDir = path.join(base, "fixed-simulations");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✅ " + msg);
}

if (!fs.existsSync(base)) fail(`Base não encontrada: ${base}`);
if (!fs.existsSync(questionsDir)) fail(`Pasta questions não encontrada: ${questionsDir}`);
if (!fs.existsSync(simsDir)) fail(`Pasta fixed-simulations não encontrada: ${simsDir}`);

const questionFiles = fs.readdirSync(questionsDir).filter((f) => f.endsWith(".json"));
if (questionFiles.length === 0) fail("Nenhuma questão encontrada em questions/");

const questionIds = new Set();

for (const f of questionFiles) {
  const full = path.join(questionsDir, f);
  const q = readJson(full);

  // Aceita pt-BR.json ou en-US.json; remove o sufixo para comparar com q.id
  const expectedId = f
    .replace(".pt-BR.json", "")
    .replace(".en-US.json", "")
    .replace(".json", "");

  if (!q.id) fail(`Questão sem campo "id": ${f}`);
  if (q.id !== expectedId) fail(`ID interno não bate com arquivo: ${f} (id=${q.id})`);

  if (questionIds.has(q.id)) fail(`ID de questão duplicado: ${q.id}`);
  questionIds.add(q.id);
}

ok(`Questões ok: ${questionFiles.length}`);

const simFiles = fs.readdirSync(simsDir).filter((f) => f.endsWith(".json"));
if (simFiles.length === 0) fail("Nenhum simulado encontrado em fixed-simulations/");

for (const f of simFiles) {
  const full = path.join(simsDir, f);
  const sim = readJson(full);

  if (!sim.id) fail(`Simulado sem campo "id": ${f}`);
  if (!Array.isArray(sim.questionIds)) fail(`Simulado ${sim.id}: "questionIds" deve ser array`);

  for (const qid of sim.questionIds) {
    const filePt = path.join(questionsDir, `${qid}.pt-BR.json`);
    const fileEn = path.join(questionsDir, `${qid}.en-US.json`);

    if (!fs.existsSync(filePt) && !fs.existsSync(fileEn)) {
      fail(`Simulado ${sim.id}: questão não encontrada: ${qid}`);
    }
  }
}

ok(`Simulados ok: ${simFiles.length}`);
console.log("✅ Validação concluída.");
