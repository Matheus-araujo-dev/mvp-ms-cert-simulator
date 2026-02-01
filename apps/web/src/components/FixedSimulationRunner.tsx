"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

type PerQuestionGrade = {
  correct: boolean;
  correctOptionIds: string[];
  answeredOptionIds: string[];
};

type PersistedStateV5 = {
  v: 5;
  startedAt: number;
  expiresAt: number;
  currentIndex: number;
  answers: Record<string, string[]>;
  finished: boolean;
  finishReason?: "manual" | "timeout";
  result?: {
    correct: number;
    total: number;
    byQuestion: Array<{ id: string; answered: boolean; correct: boolean }>;
  };
  studyGrades?: Record<string, PerQuestionGrade>;
  examGrades?: Record<string, PerQuestionGrade>;
  // NEW: no modo estudo, “conferiu” bloqueia a questão nessa execução
  studyChecked?: Record<string, true>;
};

function formatTime(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function isPromptRich(prompt: QuestionPublic["prompt"]): prompt is PromptRich {
  return typeof prompt === "object" && prompt !== null && "intro" in prompt;
}

function renderPrompt(prompt: QuestionPublic["prompt"]) {
  if (!isPromptRich(prompt)) {
    return <div className="font-semibold whitespace-pre-wrap">{prompt}</div>;
  }

  const title = (prompt.statementsTitle ?? "").trim();

  return (
    <div className="space-y-4">
      <div className="whitespace-pre-wrap">{prompt.intro}</div>

      {prompt.observation && (
        <div className="whitespace-pre-wrap">
          <span className="font-semibold">OBSERVAÇÃO:</span> {prompt.observation}
        </div>
      )}

      {(title || (prompt.statements && prompt.statements.length > 0)) && (
        <div className="space-y-2">
          {title && <div className="font-semibold tracking-wide">{title}</div>}
          {prompt.statements && prompt.statements.length > 0 && (
            <ul className="list-disc pl-6 space-y-1">
              {prompt.statements.map((s, idx) => (
                <li key={idx} className="whitespace-pre-wrap">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {prompt.attention && (
        <div className="whitespace-pre-wrap">
          <span className="font-semibold">ATENÇÃO:</span> {prompt.attention}
        </div>
      )}
    </div>
  );
}

export default function FixedSimulationRunner(props: {
  examCode: string;
  locale: string;
  simulationId: string;
  title: string;
  timeLimitMinutes: number;
  questions: QuestionPublic[];
  runMode: "study" | "exam";
}) {
  const router = useRouter();

  const {
    examCode,
    locale,
    simulationId,
    title,
    timeLimitMinutes,
    questions,
    runMode,
  } = props;

  const isStudy = runMode === "study";
  const durationSeconds = Math.max(1, timeLimitMinutes) * 60;

  const STORAGE_KEY = `mvp-ms-cert-simulator:${examCode}:${locale}:sim:${simulationId}:${runMode}:v5`;

  const [mode, setMode] = useState<"question" | "review" | "result">("question");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [finished, setFinished] = useState(false);

  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [expiresAt, setExpiresAt] = useState<number>(() => {
    const nowTs = Date.now();
    return isStudy
      ? nowTs + 10 * 365 * 24 * 60 * 60 * 1000
      : nowTs + durationSeconds * 1000;
  });

  const [now, setNow] = useState<number>(() => Date.now());

  const [finishReason, setFinishReason] = useState<
    "manual" | "timeout" | undefined
  >(undefined);

  const [result, setResult] = useState<PersistedStateV5["result"]>(undefined);
  const [isGrading, setIsGrading] = useState(false);
  const didLoadRef = useRef(false);

  // grading caches
  const [studyGrades, setStudyGrades] = useState<Record<string, PerQuestionGrade>>(
    {}
  );
  const [examGrades, setExamGrades] = useState<Record<string, PerQuestionGrade>>(
    {}
  );

  // NEW: estudo -> “conferiu” trava a questão nessa execução
  const [studyChecked, setStudyChecked] = useState<Record<string, true>>({});
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // explanation UI
  const [showExplanation, setShowExplanation] = useState(false);

  const current = questions[currentIndex];

  const checkedCount = useMemo(() => {
    if (!isStudy) return 0;
    return Object.keys(studyChecked).length;
  }, [isStudy, studyChecked]);

  const answeredCount = useMemo(() => {
    if (isStudy) return checkedCount;

    let c = 0;
    for (const q of questions) {
      const a = answers[q.id] ?? [];
      if (a.length > 0) c++;
    }
    return c;
  }, [answers, questions, isStudy, checkedCount]);

  const progressPercent = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const allAnswered = useMemo(
    () => answeredCount === questions.length,
    [answeredCount, questions.length]
  );

  const remainingSeconds = useMemo(() => {
    const diffMs = expiresAt - now;
    return Math.max(0, Math.floor(diffMs / 1000));
  }, [expiresAt, now]);

  const selected = current ? answers[current.id] ?? [] : [];

  const isExamLocked = !isStudy && finished;
  const isCurrentChecked = !!(current && studyChecked[current.id]);
  const inputsDisabled = isExamLocked || (isStudy && isCurrentChecked);

  function exitToHome() {
    const hasProgress =
      Object.keys(answers).length > 0 ||
      Object.keys(studyChecked).length > 0 ||
      currentIndex > 0 ||
      finished;

    if (hasProgress) {
      const ok = window.confirm(
        "Ao voltar para a página inicial, seu progresso será perdido. Deseja continuar?"
      );
      if (!ok) return;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    router.push("/");
  }

  // ===== Load =====
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const nowTs = Date.now();
        setStartedAt(nowTs);
        setExpiresAt(
          isStudy
            ? nowTs + 10 * 365 * 24 * 60 * 60 * 1000
            : nowTs + durationSeconds * 1000
        );
        didLoadRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as PersistedStateV5;

      if (!parsed || parsed.v !== 5) {
        const nowTs = Date.now();
        setStartedAt(nowTs);
        setExpiresAt(
          isStudy
            ? nowTs + 10 * 365 * 24 * 60 * 60 * 1000
            : nowTs + durationSeconds * 1000
        );
        didLoadRef.current = true;
        return;
      }

      setStartedAt(parsed.startedAt ?? Date.now());
      setExpiresAt(
        parsed.expiresAt ??
          (isStudy
            ? Date.now() + 10 * 365 * 24 * 60 * 60 * 1000
            : Date.now() + durationSeconds * 1000)
      );

      setCurrentIndex(
        Math.min(
          Math.max(parsed.currentIndex ?? 0, 0),
          Math.max(questions.length - 1, 0)
        )
      );

      setAnswers(parsed.answers ?? {});
      setFinished(!!parsed.finished);
      setFinishReason(parsed.finishReason);
      setResult(parsed.result);

      setStudyGrades(parsed.studyGrades ?? {});
      setExamGrades(parsed.examGrades ?? {});
      setStudyChecked(parsed.studyChecked ?? {});

      if (parsed.finished) setMode("result");

      didLoadRef.current = true;
    } catch {
      const nowTs = Date.now();
      setStartedAt(nowTs);
      setExpiresAt(
        isStudy
          ? nowTs + 10 * 365 * 24 * 60 * 60 * 1000
          : nowTs + durationSeconds * 1000
      );
      didLoadRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY, durationSeconds, isStudy]);

  // ===== Save =====
  useEffect(() => {
    if (!didLoadRef.current) return;

    const state: PersistedStateV5 = {
      v: 5,
      startedAt,
      expiresAt,
      currentIndex,
      answers,
      finished,
      finishReason,
      result,
      studyGrades,
      examGrades,
      studyChecked,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [
    STORAGE_KEY,
    startedAt,
    expiresAt,
    currentIndex,
    answers,
    finished,
    finishReason,
    result,
    studyGrades,
    examGrades,
    studyChecked,
  ]);

  // ===== Timer (exam only) =====
  useEffect(() => {
    if (isStudy) return;
    if (finished) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finished, isStudy]);

  // ===== Timeout (exam only) =====
  useEffect(() => {
    if (isStudy) return;
    if (finished) return;
    if (remainingSeconds <= 0) {
      void finalize("timeout");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, finished, isStudy]);

  // ===== Warn before leaving (exam only) =====
  useEffect(() => {
    if (isStudy) return;
    if (finished) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [finished, isStudy]);

  // reset UI when switching question/mode
  useEffect(() => {
    setShowExplanation(false);
    setCheckError(null);
    setIsChecking(false);
  }, [currentIndex, mode]);

  // exam finished: load correctOptionIds for the current question (to show right/wrong)
  const gradeAbortRef = useRef<AbortController | null>(null);

  async function gradeOneQuestion(
    questionId: string,
    answerOptionIds: string[],
    signal?: AbortSignal
  ): Promise<PerQuestionGrade | null> {
    try {
      const res = await fetch("/api/az-900/grade-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answerOptionIds }),
        signal,
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        questionId: string;
        correct: boolean;
        correctOptionIds: string[];
        answeredOptionIds: string[];
      };

      return {
        correct: !!data.correct,
        correctOptionIds: data.correctOptionIds ?? [],
        answeredOptionIds: data.answeredOptionIds ?? [],
      };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (isStudy) return;
    if (!finished) return;
    if (mode !== "question") return;
    if (!current) return;

    if (examGrades[current.id]) return; // already cached

    if (gradeAbortRef.current) gradeAbortRef.current.abort();
    const controller = new AbortController();
    gradeAbortRef.current = controller;

    (async () => {
      const selectedNow = answers[current.id] ?? [];
      const g = await gradeOneQuestion(current.id, selectedNow, controller.signal);
      if (!g) return;

      setExamGrades((prev) => ({ ...prev, [current.id]: g }));
    })();

    return () => controller.abort();
  }, [isStudy, finished, mode, current, answers, examGrades]);

  function setAnswer(questionId: string, optionId: string, type: "single" | "multi") {
    if (inputsDisabled) return;

    setAnswers((prev) => {
      const existing = prev[questionId] ?? [];

      if (type === "single") {
        return { ...prev, [questionId]: [optionId] };
      }

      const has = existing.includes(optionId);
      const next = has ? existing.filter((x) => x !== optionId) : [...existing, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  function clearCurrentAnswer() {
    if (!current) return;
    if (inputsDisabled) return;

    setAnswers((prev) => {
      const next = { ...prev };
      delete next[current.id];
      return next;
    });
  }

  async function checkCurrentAnswerStudy() {
    if (!isStudy) return;
    if (!current) return;
    if (isCurrentChecked) return;
    if (selected.length === 0) return;

    setCheckError(null);
    setIsChecking(true);

    if (gradeAbortRef.current) gradeAbortRef.current.abort();
    const controller = new AbortController();
    gradeAbortRef.current = controller;

    const g = await gradeOneQuestion(current.id, selected, controller.signal);

    if (!g) {
      setCheckError("Não foi possível conferir (erro na correção). Tente novamente.");
      setIsChecking(false);
      return;
    }

    setStudyGrades((prev) => ({ ...prev, [current.id]: g }));
    setStudyChecked((prev) => ({ ...prev, [current.id]: true }));

    if ((current.explanation ?? "").trim() !== "") {
      setShowExplanation(true);
    }

    setIsChecking(false);
  }

  function resetSimulation() {
    const ok = window.confirm("Isso vai apagar seu progresso e reiniciar. Continuar?");
    if (!ok) return;

    const nowTs = Date.now();

    setMode("question");
    setAnswers({});
    setCurrentIndex(0);
    setFinished(false);
    setFinishReason(undefined);
    setResult(undefined);
    setStudyGrades({});
    setExamGrades({});
    setStudyChecked({});
    setStartedAt(nowTs);
    setExpiresAt(
      isStudy
        ? nowTs + 10 * 365 * 24 * 60 * 60 * 1000
        : nowTs + durationSeconds * 1000
    );

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function finalize(reason: "manual" | "timeout") {
    if (isStudy) return;
    if (isGrading) return;

    if (reason === "manual" && !allAnswered) {
      setMode("review");
      return;
    }

    setIsGrading(true);
    setFinished(true);
    setFinishReason(reason);

    try {
      const res = await fetch("/api/az-900/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulationId, answers }),
      });

      if (!res.ok) {
        setResult(undefined);
        setMode("result");
        return;
      }

      const data = await res.json();

      setResult({
        correct: data.correct,
        total: data.total,
        byQuestion: data.byQuestion,
      });

      setMode("result");
    } catch {
      setResult(undefined);
      setMode("result");
    } finally {
      setIsGrading(false);
    }
  }

  if (!current) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2">Nenhuma questão encontrada.</p>
      </main>
    );
  }

  const isLast = currentIndex === questions.length - 1;

  const selectedNow = answers[current.id] ?? [];
  const hasSelection = selectedNow.length > 0;

  // exam per-question status from backend grade
  const currentEval = result?.byQuestion?.find((x) => x.id === current.id);
  const studyEval = studyGrades[current.id];
  const examEval = examGrades[current.id];

  const hasExplanation = (current.explanation ?? "").trim() !== "";

  // which grade object to use for highlighting
  const activeGrade: PerQuestionGrade | undefined = isStudy
    ? isCurrentChecked
      ? studyEval
      : undefined
    : finished
    ? examEval
    : undefined;

  const isCorrectOpt = (optId: string) => !!activeGrade?.correctOptionIds?.includes(optId);

  const isWrongSelected = (optId: string) =>
    !!activeGrade && selectedNow.includes(optId) && !activeGrade.correctOptionIds.includes(optId);

  const showStudyBanner = isStudy && isCurrentChecked && !!studyEval;
  const showExamBanner = !isStudy && finished;

  const answeredCountText = `${answeredCount}/${questions.length} (${progressPercent}%)`;

  const Header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>

        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          <span>
            Modo: <strong>{isStudy ? "Estudo" : "Prova"}</strong>
          </span>

          {!isStudy && (
            <>
              <span>•</span>
              <span>Tempo: {timeLimitMinutes} min</span>
              <span>•</span>
              <span>
                Restante:{" "}
                <strong className={remainingSeconds <= 60 ? "text-red-500" : ""}>
                  {formatTime(remainingSeconds)}
                </strong>
              </span>
            </>
          )}

          <span>•</span>
          <span>
            Progresso: <strong>{answeredCountText}</strong>
          </span>
        </div>

        <div className="mt-3 h-2 w-full max-w-xl rounded bg-gray-800">
          <div className="h-2 rounded bg-gray-300" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className="flex gap-2">
        <button className="rounded border px-4 py-2" onClick={() => setMode("review")}>
          Revisão
        </button>

        <button className="rounded border px-4 py-2" onClick={resetSimulation}>
          Reiniciar
        </button>

        <button className="rounded border px-4 py-2" onClick={exitToHome}>
          Sair
        </button>
      </div>
    </div>
  );

  // ===== Result view (exam only) =====
  if (mode === "result") {
    const correct = result?.correct ?? 0;
    const total = result?.total ?? questions.length;
    const pct = total ? Math.round((correct / total) * 100) : 0;

    const answered = result?.byQuestion?.filter((x) => x.answered).length ?? 0;
    const unanswered = total - answered;

    return (
      <main className="p-6 space-y-4">
        {Header}

        <div className="rounded border p-4 space-y-2">
          <div className="text-lg font-semibold">Resultado</div>

          <div>
            Motivo:{" "}
            <strong>
              {finishReason === "timeout" ? "Tempo esgotado" : "Finalizado manualmente"}
            </strong>
          </div>

          <div>
            Acertos: <strong>{correct}</strong> de <strong>{total}</strong> ({pct}%)
          </div>

          <div className="text-sm text-gray-600">
            Respondidas: {answered}/{total} • Não respondidas: {unanswered}
          </div>

          {result?.byQuestion && (
            <div className="mt-3">
              <div className="text-sm font-semibold mb-2">Revisão pós-prova</div>

              <div className="flex flex-wrap gap-2">
                {result.byQuestion.map((q, idx) => (
                  <button
                    key={q.id}
                    className={`rounded border px-2 py-1 text-xs ${
                      !q.answered ? "opacity-60" : q.correct ? "border-green-500" : "border-red-500"
                    }`}
                    title={!q.answered ? "Não respondida" : q.correct ? "Correta" : "Incorreta"}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setMode("question");
                    }}
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>

              <div className="text-xs text-gray-600 mt-2">
                Clique numa questão para ver: correta/incorreta + explicação.
              </div>
            </div>
          )}

          {!result && (
            <div className="text-sm text-red-500">
              Não foi possível calcular o resultado (erro na correção). Recarregue a página e tente
              finalizar novamente.
            </div>
          )}
        </div>
      </main>
    );
  }

  // ===== Review view =====
  if (mode === "review") {
    return (
      <main className="p-6 space-y-4">
        {Header}

        <div className="rounded border p-4 space-y-3">
          <div className="text-lg font-semibold">Revisão</div>

          <div className="text-sm text-gray-600">
            Clique numa questão para ir direto.
            {!isStudy && " Finalizar exige todas respondidas."}
            {isStudy && " No modo estudo, conta como concluída apenas após “Conferir resposta”."}
          </div>

          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const a = answers[q.id] ?? [];
              const answered = a.length > 0;
              const checked = !!studyChecked[q.id];

              const evalQ = result?.byQuestion?.find((x) => x.id === q.id);

              const border =
                isStudy
                  ? checked
                    ? "border-gray-300"
                    : "opacity-60"
                  : finished
                  ? !answered
                    ? "opacity-60"
                    : evalQ?.correct
                    ? "border-green-500"
                    : "border-red-500"
                  : answered
                  ? ""
                  : "opacity-60";

              return (
                <button
                  key={q.id}
                  className={`rounded border px-3 py-2 text-sm ${
                    idx === currentIndex ? "border-gray-300" : ""
                  } ${border}`}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setMode("question");
                  }}
                  title={
                    isStudy
                      ? checked
                        ? "Conferida"
                        : "Não conferida"
                      : !answered
                      ? "Não respondida"
                      : finished
                      ? evalQ?.correct
                        ? "Correta"
                        : "Incorreta"
                      : "Respondida"
                  }
                >
                  Q{idx + 1} {isStudy ? (checked ? "✓" : "•") : answered ? "✓" : "•"}
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex gap-2">
            <button className="rounded border px-4 py-2" onClick={() => setMode("question")}>
              Voltar
            </button>

            {!isStudy && (
              <button
                className="ml-auto rounded border px-4 py-2 disabled:opacity-50"
                disabled={!allAnswered || isGrading}
                title={!allAnswered ? "Responda todas as questões para finalizar" : ""}
                onClick={() => void finalize("manual")}
              >
                {isGrading ? "Finalizando..." : finished ? "Finalizado" : "Finalizar"}
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ===== Question view =====
  const examAnswered = selectedNow.length > 0;

  const examCorrect =
    (currentEval?.answered ? currentEval.correct : undefined) ??
    (examEval ? examEval.correct : undefined);

  const statusText = !examAnswered ? "Não respondida" : examCorrect ? "Correta" : "Incorreta";

  const nextDisabled = isStudy ? !isCurrentChecked || isLast : !examAnswered || isLast;

  return (
    <main className="p-6 space-y-4">
      {Header}

      <div className="rounded border p-4 space-y-3">
        <div className="text-sm text-gray-600">
          Questão {currentIndex + 1} de {questions.length}
          {!isStudy && finished && (
            <>
              {" "}
              • Status: <strong>{statusText}</strong>
            </>
          )}
          {isStudy && (
            <>
              {" "}
              • Status: <strong>{isCurrentChecked ? "Conferida" : "Não conferida"}</strong>
            </>
          )}
        </div>

        {renderPrompt(current.prompt)}

        {/* Study banner only after "Conferir resposta" */}
        {showStudyBanner && studyEval && (
          <div
            className={`rounded border p-3 text-sm ${
              studyEval.correct ? "border-green-500" : "border-red-500"
            }`}
          >
            <div className="font-semibold">
              {studyEval.correct ? "Sua seleção está correta" : "Sua seleção está incorreta"}
            </div>
          </div>
        )}

        {/* Exam banner after finishing */}
        {showExamBanner && (
          <div
            className={`rounded border p-3 text-sm ${
              examAnswered
                ? examCorrect
                  ? "border-green-500"
                  : "border-red-500"
                : "border-gray-300"
            }`}
          >
            <div className="font-semibold">
              {examAnswered
                ? examCorrect
                  ? "Sua seleção está correta"
                  : "Sua seleção está incorreta"
                : "Questão não respondida"}
            </div>
          </div>
        )}

        {checkError && (
          <div className="rounded border border-red-500 p-3 text-sm">{checkError}</div>
        )}

        <div className="space-y-2">
          {current.options.map((opt) => {
            const checked = selectedNow.includes(opt.id);

            const shouldHighlight =
              (isStudy && isCurrentChecked && !!studyEval) || (!isStudy && finished && !!examEval);

            const boxClass = shouldHighlight
              ? isCorrectOpt(opt.id)
                ? "border-green-500"
                : isWrongSelected(opt.id)
                ? "border-red-500"
                : "border-gray-200"
              : "border-gray-200";

            return (
              <label
                key={opt.id}
                className={`flex gap-2 items-start cursor-pointer rounded border p-2 ${boxClass} ${
                  inputsDisabled ? "opacity-90" : ""
                }`}
              >
                <input
                  type={current.type === "single" ? "radio" : "checkbox"}
                  name={current.id}
                  checked={checked}
                  onChange={() => setAnswer(current.id, opt.id, current.type)}
                  className="mt-1"
                  aria-label={opt.text}
                  disabled={inputsDisabled}
                />
                <span className="whitespace-pre-wrap">{opt.text}</span>
              </label>
            );
          })}
        </div>

        <div className="pt-2 flex flex-wrap gap-2 items-center">
          <button
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            onClick={clearCurrentAnswer}
            disabled={inputsDisabled}
          >
            Limpar resposta
          </button>

          {/* Study: Conferir resposta */}
          {isStudy && (
            <button
              className="rounded border px-3 py-1 text-sm ml-auto disabled:opacity-50"
              disabled={isCurrentChecked || !hasSelection || isChecking}
              onClick={() => void checkCurrentAnswerStudy()}
              title={!hasSelection ? "Selecione uma alternativa" : ""}
            >
              {isCurrentChecked
                ? "Resposta conferida"
                : isChecking
                ? "Conferindo..."
                : "Conferir resposta"}
            </button>
          )}

          {/* Exam: explicação só após finalizar */}
          {!isStudy && finished && hasExplanation && (
            <button
              className="rounded border px-3 py-1 text-sm ml-auto"
              onClick={() => setShowExplanation((v) => !v)}
            >
              {showExplanation ? "Ocultar explicação" : "Explique melhor"}
            </button>
          )}

          {/* Study: após conferir, permitir mostrar/ocultar explicação */}
          {isStudy && isCurrentChecked && hasExplanation && (
            <button
              className="rounded border px-3 py-1 text-sm"
              onClick={() => setShowExplanation((v) => !v)}
            >
              {showExplanation ? "Ocultar explicação" : "Explique melhor"}
            </button>
          )}
        </div>

        {/* Explanation */}
        {hasExplanation && showExplanation && (
          <div className="rounded border p-3 text-sm whitespace-pre-wrap">
            <div className="font-semibold mb-1">Explicação</div>
            {current.explanation}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          className="rounded border px-4 py-2 disabled:opacity-50"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          Anterior
        </button>

        <button
          className="rounded border px-4 py-2 disabled:opacity-50"
          disabled={nextDisabled}
          title={
            isStudy
              ? !isCurrentChecked
                ? "Use “Conferir resposta” para avançar"
                : ""
              : !examAnswered
              ? "Responda a questão para avançar"
              : ""
          }
          onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Próxima
        </button>

        {!isStudy && !finished && (
          <button
            className="ml-auto rounded border px-4 py-2 disabled:opacity-50"
            disabled={!examAnswered || !allAnswered || isGrading}
            title={
              !examAnswered
                ? "Responda a questão para finalizar"
                : !allAnswered
                ? "Responda todas as questões para finalizar"
                : ""
            }
            onClick={() => void finalize("manual")}
          >
            {isGrading ? "Finalizando..." : "Finalizar"}
          </button>
        )}
      </div>
    </main>
  );
}
