"use client";

import { useMemo, useState } from "react";

type Question = {
  id: string;
  type: "single" | "multi";
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
};

export default function FixedSimulationRunner(props: {
  title: string;
  timeLimitMinutes: number;
  questions: Question[];
}) {
  const { title, timeLimitMinutes, questions } = props;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [finished, setFinished] = useState(false);

  const current = questions[currentIndex];

  function setAnswer(questionId: string, optionId: string, type: "single" | "multi") {
    setAnswers((prev) => {
      const existing = prev[questionId] ?? [];

      if (type === "single") {
        return { ...prev, [questionId]: [optionId] };
      }

      // multi: toggle
      const has = existing.includes(optionId);
      const next = has ? existing.filter((x) => x !== optionId) : [...existing, optionId];
      return { ...prev, [questionId]: next };
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

  if (finished) {
    return (
      <main className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-gray-600">Tempo: {timeLimitMinutes} min</p>

        <div className="rounded border p-4">
          <div className="text-lg font-semibold">Resultado</div>
          <div className="mt-2">
            Acertos: <strong>{score.correct}</strong> de <strong>{score.total}</strong>
          </div>
          <div className="mt-1">
            Percentual: <strong>{Math.round((score.correct / score.total) * 100)}%</strong>
          </div>
        </div>

        <button
          className="rounded border px-4 py-2"
          onClick={() => {
            setFinished(false);
            setCurrentIndex(0);
            setAnswers({});
          }}
        >
          Refazer
        </button>
      </main>
    );
  }

  const selected = answers[current.id] ?? [];

  return (
    <main className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-gray-600">Tempo: {timeLimitMinutes} min</p>
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
          disabled={currentIndex === questions.length - 1}
          onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Próxima
        </button>

        <button
          className="ml-auto rounded border px-4 py-2"
          onClick={() => setFinished(true)}
        >
          Finalizar
        </button>
      </div>
    </main>
  );
}
