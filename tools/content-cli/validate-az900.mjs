import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const base = path.join(ROOT, "packages", "content", "exams", "az-900");
const questionsDir = path.join(base, "questions");
const simsDir = path.join(base, "fixed-simulations");
const manifestsDir = path.join(base, "manifests");

function fail(msg) {
  console.error("❌ " + msg);
  process.exit(1);
}

function ok(msg) {
  console.log("✅ " + msg);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function stripBom(s) {
  // Remove UTF-8 BOM se existir (caractere invisível no início)
  if (!s) return s;
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function readJson(p) {
  let raw;
  try {
    raw = fs.readFileSync(p, "utf-8");
  } catch (e) {
    fail(`Falha ao ler arquivo: ${p}\n${e?.message ?? e}`);
  }

  raw = stripBom(raw);

  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`JSON inválido: ${p}\n${e?.message ?? e}`);
  }
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isPositiveInt(v) {
  return Number.isInteger(v) && v > 0;
}

function listJson(dir) {
  assert(fs.existsSync(dir), `Pasta não encontrada: ${dir}`);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function unique(arr) {
  return [...new Set(arr)];
}

function validateQuestionFileName(file) {
  // aceita az900-0001.pt-BR.json ou az900-0001.en-US.json
  const re = /^az900-\d{4}\.(pt-BR|en-US)\.json$/;
  assert(re.test(file), `Nome de arquivo de questão fora do padrão: ${file}`);
}

function parseQuestionIdFromFile(file) {
  // remove .pt-BR.json ou .en-US.json
  return file.replace(/\.(pt-BR|en-US)\.json$/, "");
}

function validatePrompt(prompt, qid) {
  // prompt pode ser string (simples) OU objeto (PromptRich)
  if (isNonEmptyString(prompt)) return;

  assert(
    prompt && typeof prompt === "object",
    `Questão ${qid}: "prompt" deve ser string ou objeto`,
  );

  // obrigatório no prompt rico
  assert(
    isNonEmptyString(prompt.intro),
    `Questão ${qid}: prompt.intro obrigatório`,
  );

  // opcionais (se existirem, devem ser strings não vazias)
  if (prompt.observation !== undefined) {
    assert(
      isNonEmptyString(prompt.observation),
      `Questão ${qid}: prompt.observation deve ser string não vazia`,
    );
  }
  if (prompt.statementsTitle !== undefined) {
    assert(
      isNonEmptyString(prompt.statementsTitle),
      `Questão ${qid}: prompt.statementsTitle deve ser string não vazia`,
    );
  }
  if (prompt.attention !== undefined) {
    assert(
      isNonEmptyString(prompt.attention),
      `Questão ${qid}: prompt.attention deve ser string não vazia`,
    );
  }

  // statements (se existir)
  if (prompt.statements !== undefined) {
    assert(
      Array.isArray(prompt.statements),
      `Questão ${qid}: prompt.statements deve ser array`,
    );
    assert(
      prompt.statements.length > 0,
      `Questão ${qid}: prompt.statements não pode ser vazio`,
    );
    for (const s of prompt.statements) {
      assert(
        isNonEmptyString(s),
        `Questão ${qid}: prompt.statements deve conter apenas strings não vazias`,
      );
    }
  }
}

function validateQuestionJson(q, file) {
  assert(
    q && typeof q === "object",
    `Questão inválida (não é objeto): ${file}`,
  );

  assert(isNonEmptyString(q.id), `Questão sem "id": ${file}`);
  assert(
    q.id === parseQuestionIdFromFile(file),
    `ID interno não bate com arquivo: ${file} (id=${q.id})`,
  );

  assert(
    q.type === "single" || q.type === "multi",
    `Questão ${q.id}: "type" deve ser "single" ou "multi"`,
  );

  assert(
    q.prompt !== undefined && q.prompt !== null,
    `Questão ${q.id}: "prompt" obrigatório`,
  );
  validatePrompt(q.prompt, q.id);

  assert(Array.isArray(q.options), `Questão ${q.id}: "options" deve ser array`);
  assert(
    q.options.length >= 2,
    `Questão ${q.id}: precisa de pelo menos 2 opções`,
  );

  const optionIds = [];
  for (const opt of q.options) {
    assert(opt && typeof opt === "object", `Questão ${q.id}: option inválida`);
    assert(isNonEmptyString(opt.id), `Questão ${q.id}: option sem "id"`);
    assert(
      isNonEmptyString(opt.text),
      `Questão ${q.id}: option ${opt.id}: "text" obrigatório`,
    );
    optionIds.push(opt.id);
  }

  assert(
    unique(optionIds).length === optionIds.length,
    `Questão ${q.id}: options com IDs duplicados`,
  );

  assert(
    Array.isArray(q.correctOptionIds),
    `Questão ${q.id}: "correctOptionIds" deve ser array`,
  );
  assert(
    q.correctOptionIds.length >= 1,
    `Questão ${q.id}: "correctOptionIds" não pode ser vazio`,
  );

  const correct = q.correctOptionIds.filter((x) => typeof x === "string");
  assert(
    correct.length === q.correctOptionIds.length,
    `Questão ${q.id}: "correctOptionIds" deve ter só strings`,
  );

  const correctUnique = unique(correct);
  assert(
    correctUnique.length === correct.length,
    `Questão ${q.id}: "correctOptionIds" tem duplicados`,
  );

  const optionIdSet = new Set(optionIds);
  for (const cid of correctUnique) {
    assert(
      optionIdSet.has(cid),
      `Questão ${q.id}: correta "${cid}" não existe em options`,
    );
  }

  if (q.type === "single") {
    assert(
      correctUnique.length === 1,
      `Questão ${q.id}: type=single deve ter exatamente 1 correta`,
    );
  } else {
    assert(
      correctUnique.length >= 1,
      `Questão ${q.id}: type=multi deve ter 1+ corretas`,
    );
  }
}

function validateSimulationJson(sim, file) {
  assert(
    sim && typeof sim === "object",
    `Simulado inválido (não é objeto): ${file}`,
  );

  assert(isNonEmptyString(sim.id), `Simulado sem "id": ${file}`);
  assert(
    isNonEmptyString(sim.title),
    `Simulado ${sim.id}: "title" obrigatório`,
  );
  assert(
    isPositiveInt(sim.timeLimitMinutes),
    `Simulado ${sim.id}: "timeLimitMinutes" deve ser inteiro > 0`,
  );

  assert(
    Array.isArray(sim.questionIds),
    `Simulado ${sim.id}: "questionIds" deve ser array`,
  );
  assert(
    sim.questionIds.length >= 1,
    `Simulado ${sim.id}: "questionIds" não pode ser vazio`,
  );

  const qids = sim.questionIds.filter(
    (x) => typeof x === "string" && x.trim().length > 0,
  );
  assert(
    qids.length === sim.questionIds.length,
    `Simulado ${sim.id}: "questionIds" deve ter só strings não vazias`,
  );
  assert(
    unique(qids).length === qids.length,
    `Simulado ${sim.id}: "questionIds" tem duplicados`,
  );

  return qids;
}

function questionFileExists(questionId) {
  const pt = path.join(questionsDir, `${questionId}.pt-BR.json`);
  const en = path.join(questionsDir, `${questionId}.en-US.json`);
  return fs.existsSync(pt) || fs.existsSync(en);
}

function validateManifestPtBr(manifest) {
  assert(
    manifest && typeof manifest === "object",
    `Manifest pt-BR.json inválido (não é objeto)`,
  );

  assert(
    manifest.examCode === "AZ-900",
    `Manifest pt-BR.json: examCode deve ser "AZ-900"`,
  );
  assert(
    manifest.locale === "pt-BR",
    `Manifest pt-BR.json: locale deve ser "pt-BR"`,
  );

  assert(
    Array.isArray(manifest.fixedSimulations),
    `Manifest pt-BR.json: fixedSimulations deve ser array`,
  );
  assert(
    manifest.fixedSimulations.length >= 1,
    `Manifest pt-BR.json: fixedSimulations não pode ser vazio`,
  );

  const ids = [];
  for (const s of manifest.fixedSimulations) {
    assert(
      s && typeof s === "object",
      `Manifest pt-BR.json: item inválido em fixedSimulations`,
    );
    assert(isNonEmptyString(s.id), `Manifest pt-BR.json: item sem id`);
    assert(
      isNonEmptyString(s.title),
      `Manifest pt-BR.json: ${s.id}: title obrigatório`,
    );
    assert(
      isPositiveInt(s.questionCount),
      `Manifest pt-BR.json: ${s.id}: questionCount deve ser inteiro > 0`,
    );
    assert(
      isPositiveInt(s.timeLimitMinutes),
      `Manifest pt-BR.json: ${s.id}: timeLimitMinutes deve ser inteiro > 0`,
    );
    ids.push(s.id);
  }

  assert(
    unique(ids).length === ids.length,
    `Manifest pt-BR.json: IDs duplicados em fixedSimulations`,
  );
}

// ===== Execução =====
assert(fs.existsSync(base), `Base não encontrada: ${base}`);
assert(
  fs.existsSync(questionsDir),
  `Pasta questions não encontrada: ${questionsDir}`,
);
assert(
  fs.existsSync(simsDir),
  `Pasta fixed-simulations não encontrada: ${simsDir}`,
);
assert(
  fs.existsSync(manifestsDir),
  `Pasta manifests não encontrada: ${manifestsDir}`,
);

// 1) Questões
const questionFiles = listJson(questionsDir);
assert(questionFiles.length > 0, `Nenhuma questão encontrada em questions/`);

const questionIdSet = new Set();

for (const file of questionFiles) {
  validateQuestionFileName(file);

  const full = path.join(questionsDir, file);
  const q = readJson(full);

  validateQuestionJson(q, file);

  if (questionIdSet.has(q.id)) {
    fail(`ID de questão duplicado (em arquivos diferentes): ${q.id}`);
  }
  questionIdSet.add(q.id);
}

ok(`Questões ok: ${questionFiles.length}`);

// 2) Simulados
const simFiles = listJson(simsDir);
assert(simFiles.length > 0, `Nenhum simulado encontrado em fixed-simulations/`);

const simById = new Map();

for (const file of simFiles) {
  const full = path.join(simsDir, file);
  const sim = readJson(full);

  const qids = validateSimulationJson(sim, file);

  for (const qid of qids) {
    assert(
      questionFileExists(qid),
      `Simulado ${sim.id}: questão não encontrada: ${qid}`,
    );
  }

  simById.set(sim.id, { file, sim });
}

ok(`Simulados ok: ${simFiles.length}`);

// 3) Manifest pt-BR
const manifestPt = path.join(manifestsDir, "pt-BR.json");
assert(fs.existsSync(manifestPt), `Manifest não encontrado: ${manifestPt}`);

const manifest = readJson(manifestPt);
validateManifestPtBr(manifest);

// valida consistência manifest vs arquivos de simulados
for (const entry of manifest.fixedSimulations) {
  const found = simById.get(entry.id);
  assert(
    !!found,
    `Manifest pt-BR.json: simulado listado não existe: ${entry.id}`,
  );

  const sim = found.sim;
  assert(
    entry.questionCount === sim.questionIds.length,
    `Manifest pt-BR.json: ${entry.id}: questionCount (${entry.questionCount}) != (${sim.questionIds.length})`,
  );
  assert(
    entry.timeLimitMinutes === sim.timeLimitMinutes,
    `Manifest pt-BR.json: ${entry.id}: timeLimitMinutes (${entry.timeLimitMinutes}) != (${sim.timeLimitMinutes})`,
  );
  assert(
    entry.title === sim.title,
    `Manifest pt-BR.json: ${entry.id}: title ("${entry.title}") != sim.title ("${sim.title}")`,
  );
}

ok(`Manifest pt-BR ok: ${manifest.fixedSimulations.length} simulados`);

console.log("✅ Validação AZ-900 concluída.");
