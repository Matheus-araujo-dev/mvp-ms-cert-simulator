"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type QuestionPublic = {
  id: string;
  type: "single" | "multi";
  prompt: string;
  options: { id: string; text: string }[];
};

type PersistedStateV2 = {
  v: 2;
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
};

function formatTime(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function FixedSimulationRunner(props: {
  examCode: string;
  locale: string;
  simulationId: string;
  title: string;
  timeLimitMinutes: number;
  questions: QuestionPublic[];
}) {
  const { examCode, locale, simulationId, title, timeLimitMinutes, questions } = props;

  const durationSeconds = Math.max(1, timeLimitMinutes) * 60;
  const STORAGE_KEY = `mvp-ms-cert-simulator:${examCode}:${locale}:sim:${simulationId}:v2`;

  const [mode, setMode] = useState<"question" | "review" | "result">("question");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [finished, setFinished] = useState(false);

  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [expiresAt, setExpiresAt] = useState<number>(() => Date.now() + durationSeconds * 1000);
  const [now, setNow] = useState<number>(() => Date.now());

  const [finishReason, setFinishReason] = useState<"manual" | "timeout" | undefined>(undefined);
  const [result, setResult] = useState<PersistedStateV2["result"]>(undefined);
  const [isGrading, setIsGrading] = useState(false);
  const didLoadRef = useRef(false);

  const current = questions[currentIndex];

  const answeredCount = useMemo(() => {
    let c = 0;
    for (const q of questions) {
      const a = answers[q.id] ?? [];
      if (a.length > 0) c++;
    }
    return c;
  }, [answers, questions]);

  const progressPercent = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const allAnswered = useMemo(() => answeredCount === questions.length, [answeredCount, questions.length]);

  const remainingSeconds = useMemo(() => {
    const diffMs = expiresAt - now;
    return Math.max(0, Math.floor(diffMs / 1000));
  }, [expiresAt, now]);

  const isCurrentAnswered = useMemo(() => {
    if (!current) return false;
    return (answers[current.id] ?? []).length > 0;
  }, [answers, current]);

  // ===== Load from localStorage =====
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const nowTs = Date.now();
        setStartedAt(nowTs);
        setExpiresAt(nowTs + durationSeconds * 1000);
        didLoadRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as PersistedStateV2;

      if (!parsed || parsed.v !== 2) {
        const nowTs = Date.now();
        setStartedAt(nowTs);
        setExpiresAt(nowTs + durationSeconds * 1000);
        didLoadRef.current = true;
        return;
      }

      setStartedAt(parsed.startedAt ?? Date.now());
      setExpiresAt(parsed.expiresAt ?? Date.now() + durationSeconds * 1000);
      setCurrentIndex(Math.min(Math.max(parsed.currentIndex ?? 0, 0), Math.max(questions.length - 1, 0)));
      setAnswers(parsed.answers ?? {});
      setFinished(!!parsed.finished);
      setFinishReason(parsed.finishReason);
      setResult(parsed.result);

      if (parsed.finished) setMode("result");

      didLoadRef.current = true;
    } catch {
      const nowTs = Date.now();
      setStartedAt(nowTs);
      setExpiresAt(nowTs + durationSeconds * 1000);
      didLoadRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY, durationSeconds]);

  // ===== Save to localStorage =====
  useEffect(() => {
    if (!didLoadRef.current) return;

    const state: PersistedStateV2 = {
      v: 2,
      startedAt,
      expiresAt,
      currentIndex,
      answers,
      finished,
      finishReason,
      result,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [STORAGE_KEY, startedAt, expiresAt, currentIndex, answers, finished, finishReason, result]);

  // ===== Timer tick =====
  useEffect(() => {
    if (finished) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finished]);

  // ===== Auto-finish on timeout =====
  useEffect(() => {
    if (finished) return;
    if (remainingSeconds <= 0) {
      void finalize("timeout");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingSeconds, finished]);

  // ===== Warn before leaving =====
  useEffect(() => {
    if (finished) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [finished]);

  function setAnswer(questionId: string, optionId: string, type: "single" | "multi") {
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
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[current.id];
      return next;
    });
  }

  function resetSimulation() {
    const ok = window.confirm("Isso vai apagar seu progresso e reiniciar o simulado. Continuar?");
    if (!ok) return;

    const nowTs = Date.now();

    setMode("question");
    setAnswers({});
    setCurrentIndex(0);
    setFinished(false);
    setFinishReason(undefined);
    setResult(undefined);
    setStartedAt(nowTs);
    setExpiresAt(nowTs + durationSeconds * 1000);

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function finalize(reason: "manual" | "timeout") {
    if (isGrading) return;

    // Em finalização manual: exige todas respondidas (melhor UX + seu requisito de bloqueio)
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

  const selected = answers[current.id] ?? [];
  const isLast = currentIndex === questions.length - 1;

  // ===== UI: header =====
  const Header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>

        <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
          <span>Tempo: {timeLimitMinutes} min</span>
          <span>•</span>
          <span>
            Restante:{" "}
            <strong className={remainingSeconds <= 60 ? "text-red-500" : ""}>
              {formatTime(remainingSeconds)}
            </strong>
          </span>
          <span>•</span>
          <span>
            Progresso: <strong>{answeredCount}</strong>/<strong>{questions.length}</strong> ({progressPercent}%)
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
      </div>
    </div>
  );

  // ===== Result view =====
  if (mode === "result") {
    const correct = result?.correct ?? 0;
    const total = result?.total ?? questions.length;

    const pct = total ? Math.round((correct / total) * 100) : 0;

    const answered = result?.byQuestion?.filter((x) => x.answered).length ?? answeredCount;
    const unanswered = total - answered;

    return (
      <main className="p-6 space-y-4">
        {Header}

        <div className="rounded border p-4 space-y-2">
          <div className="text-lg font-semibold">Resultado</div>

          <div>
            Motivo:{" "}
            <strong>{finishReason === "timeout" ? "Tempo esgotado" : "Finalizado manualmente"}</strong>
          </div>

          <div>
            Acertos: <strong>{correct}</strong> de <strong>{total}</strong> ({pct}%)
          </div>

          <div className="text-sm text-gray-600">
            Respondidas: {answered}/{total} • Não respondidas: {unanswered}
          </div>

          {result?.byQuestion && (
            <div className="mt-3">
              <div className="text-sm font-semibold mb-2">Resumo por questão</div>
              <div className="flex flex-wrap gap-2">
                {result.byQuestion.map((q, idx) => (
                  <span
                    key={q.id}
                    className={`rounded border px-2 py-1 text-xs ${
                      !q.answered
                        ? "opacity-60"
                        : q.correct
                        ? ""
                        : "border-red-500"
                    }`}
                    title={!q.answered ? "Não respondida" : q.correct ? "Correta" : "Incorreta"}
                  >
                    Q{idx + 1}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!result && (
            <div className="text-sm text-red-500">
              Não foi possível calcular o resultado (erro na correção). Recarregue a página e tente finalizar novamente.
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
            Clique numa questão para ir direto. Finalizar exige todas respondidas (tempo pode finalizar sozinho).
          </div>

          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const a = answers[q.id] ?? [];
              const answered = a.length > 0;

              return (
                <button
                  key={q.id}
                  className={`rounded border px-3 py-2 text-sm ${
                    idx === currentIndex ? "border-gray-300" : ""
                  } ${answered ? "" : "opacity-60"}`}
                  onClick={() => {
                    setCurrentIndex(idx);
                    setMode("question");
                  }}
                  title={answered ? "Respondida" : "Não respondida"}
                >
                  Q{idx + 1} {answered ? "✓" : "•"}
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex gap-2">
            <button className="rounded border px-4 py-2" onClick={() => setMode("question")}>
              Voltar
            </button>

            <button
              className="ml-auto rounded border px-4 py-2 disabled:opacity-50"
              disabled={!allAnswered || isGrading}
              title={!allAnswered ? "Responda todas as questões para finalizar" : ""}
              onClick={() => void finalize("manual")}
            >
              {isGrading ? "Finalizando..." : "Finalizar"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ===== Question view =====
  return (
    <main className="p-6 space-y-4">
      {Header}

      <div className="rounded border p-4 space-y-3">
        <div className="text-sm text-gray-600">
          Questão {currentIndex + 1} de {questions.length}
        </div>

        <div className="font-semibold">{current.prompt}</div>

        <div className="space-y-2">
          {current.options.map((opt) => {
            const checked = selected.includes(opt.id);

            return (
              <label key={opt.id} className="flex gap-2 items-start cursor-pointer">
                <input
                  type={current.type === "single" ? "radio" : "checkbox"}
                  name={current.id}
                  checked={checked}
                  onChange={() => setAnswer(current.id, opt.id, current.type)}
                  className="mt-1"
                />
                <span>{opt.text}</span>
              </label>
            );
          })}
        </div>

        <div className="pt-2">
          <button className="rounded border px-3 py-1 text-sm" onClick={clearCurrentAnswer}>
            Limpar resposta
          </button>
        </div>
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
          disabled={!isCurrentAnswered || isLast}
          title={!isCurrentAnswered ? "Responda a questão para avançar" : ""}
          onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Próxima
        </button>

        <button
          className="ml-auto rounded border px-4 py-2 disabled:opacity-50"
          disabled={!isCurrentAnswered || !allAnswered || isGrading}
          title={
            !isCurrentAnswered
              ? "Responda a questão para finalizar"
              : !allAnswered
              ? "Responda todas as questões para finalizar"
              : ""
          }
          onClick={() => void finalize("manual")}
        >
          {isGrading ? "Finalizando..." : "Finalizar"}
        </button>
      </div>
    </main>
  );
}
