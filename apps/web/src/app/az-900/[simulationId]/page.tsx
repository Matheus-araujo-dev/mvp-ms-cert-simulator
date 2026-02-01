"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Question = {
  id: string;
  type: "single" | "multi";
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[]; // MVP: fica no client (ver nota no final)
};

type PersistedStateV1 = {
  v: 1;
  expiresAt: number; // timestamp em ms
  currentIndex: number;
  answers: Record<string, string[]>;
  finished: boolean;
};

function formatTime(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const mmStr = String(mm).padStart(2, "0");
  const ssStr = String(ss).padStart(2, "0");
  return `${mmStr}:${ssStr}`;
}

export default function FixedSimulationRunner(props: {
  simulationId: string;
  title: string;
  timeLimitMinutes: number;
  questions: Question[];
}) {
  const { simulationId, title, timeLimitMinutes, questions } = props;

  const STORAGE_KEY = `mvp-ms-cert-simulator:sim:${simulationId}:v1`;
  const durationSeconds = Math.max(1, timeLimitMinutes) * 60;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [finished, setFinished] = useState(false);

  // Timer (controlado via expiresAt)
  const [expiresAt, setExpiresAt] = useState<number>(() => Date.now() + durationSeconds * 1000);
  const [now, setNow] = useState<number>(() => Date.now());

  // Evita sobrescrever localStorage antes de carregar estado
  const didLoadRef = useRef(false);

  const current = questions[currentIndex];

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const q of questions) {
      const a = answers[q.id] ?? [];
      if (a.length > 0) count++;
    }
    return count;
  }, [answers, questions]);

  const progressPercent = useMemo(() => {
    if (questions.length === 0) return 0;
    return Math.round((answeredCount / questions.length) * 100);
  }, [answeredCount, questions.length]);

  const remainingSeconds = useMemo(() => {
    const diffMs = expiresAt - now;
    return Math.max(0, Math.floor(diffMs / 1000));
  }, [expiresAt, now]);

  const isCurrentAnswered = useMemo(() => {
    if (!current) return false;
    return (answers[current.id] ?? []).length > 0;
  }, [answers, current]);

  // ====== Load state (localStorage) ======
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // primeiro acesso: inicia um timer novo
        setExpiresAt(Date.now() + durationSeconds * 1000);
        didLoadRef.current = true;
        return;
      }

      const parsed = JSON.parse(raw) as PersistedStateV1;

      if (parsed?.v !== 1) {
        // formato antigo/novo desconhecido: ignora
        setExpiresAt(Date.now() + durationSeconds * 1000);
        didLoadRef.current = true;
        return;
      }

      setExpiresAt(parsed.expiresAt);
      setCurrentIndex(Math.min(Math.max(parsed.currentIndex, 0), Math.max(questions.length - 1, 0)));
      setAnswers(parsed.answers ?? {});
      setFinished(!!parsed.finished);

      didLoadRef.current = true;
    } catch {
      setExpiresAt(Date.now() + durationSeconds * 1000);
      didLoadRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [STORAGE_KEY, durationSeconds]);

  // ====== Save state (localStorage) ======
  useEffect(() => {
    if (!didLoadRef.current) return;

    const state: PersistedStateV1 = {
      v: 1,
      expiresAt,
      currentIndex,
      answers,
      finished,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // se falhar, só ignora (storage cheio, etc.)
    }
  }, [STORAGE_KEY, expiresAt, currentIndex, answers, finished]);

  // ====== Timer tick ======
  useEffect(() => {
    if (finished) return;

    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, [finished]);

  // Auto-finaliza quando tempo acabar
  useEffect(() => {
    if (finished) return;
    if (remainingSeconds <= 0) {
      setFinished(true);
    }
  }, [finished, remainingSeconds]);

  // Aviso ao sair/fechar a aba
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

  const score = useMemo(() => {
    let correct = 0;

    for (const q of questions) {
      const a = (answers[q.id] ?? []).slice().sort().join("|");
      const c = q.correctOptionIds.slice().sort().join("|");
      if (a === c) correct++;
    }

    return { correct, total: questions.length };
  }, [answers, questions]);

  function resetSimulation() {
    const ok = window.confirm("Isso vai apagar seu progresso e reiniciar o simulado. Continuar?");
    if (!ok) return;

    setAnswers({});
    setCurrentIndex(0);
    setFinished(false);
    setExpiresAt(Date.now() + durationSeconds * 1000);

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
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

  if (finished) {
    return (
      <main className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm text-gray-600">Tempo: {timeLimitMinutes} min</p>
          </div>

          <button className="rounded border px-4 py-2" onClick={resetSimulation}>
            Reiniciar
          </button>
        </div>

        <div className="rounded border p-4">
          <div className="text-lg font-semibold">Resultado</div>
          <div className="mt-2">
            Acertos: <strong>{score.correct}</strong> de <strong>{score.total}</strong>
          </div>
          <div className="mt-1">
            Percentual: <strong>{score.total ? Math.round((score.correct / score.total) * 100) : 0}%</strong>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Progresso respondido: {answeredCount}/{questions.length} ({progressPercent}%)
          </div>
        </div>
      </main>
    );
  }

  const selected = answers[current.id] ?? [];
  const isLast = currentIndex === questions.length - 1;

  return (
    <main className="p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>

          <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
            <span>Tempo: {timeLimitMinutes} min</span>
            <span>•</span>
            <span>
              Restante: <strong className={remainingSeconds <= 60 ? "text-red-500" : ""}>{formatTime(remainingSeconds)}</strong>
            </span>
            <span>•</span>
            <span>
              Progresso: <strong>{answeredCount}</strong>/<strong>{questions.length}</strong> ({progressPercent}%)
            </span>
          </div>

          <div className="mt-3 h-2 w-full max-w-xl rounded bg-gray-800">
            <div
              className="h-2 rounded bg-gray-300"
              style={{ width: `${progressPercent}%` }}
              aria-label="Progresso"
            />
          </div>
        </div>

        <button className="rounded border px-4 py-2" onClick={resetSimulation}>
          Reiniciar
        </button>
      </div>

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
          disabled={!isCurrentAnswered}
          title={!isCurrentAnswered ? "Responda a questão para finalizar" : ""}
          onClick={() => setFinished(true)}
        >
          Finalizar
        </button>
      </div>
    </main>
  );
}
