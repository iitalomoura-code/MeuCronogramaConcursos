"use strict";

const assert = require("assert");
const engine = require("../js/study-alerts.js");

const now = new Date("2026-08-18T12:00:00.000Z");
const baseline = {
  exam: { weeksToExam: 6, coverageRisk: true, confident: true, projectedCoverage: .58 },
  priorityReviews: 3,
  concentration: { sessions: 8, share: .75, subjectName: "Estatística" },
  subjects: [{
    name: "Estatística",
    coverage: .35,
    performance: .54,
    questions: 24,
    performanceTrend: "Queda",
    priority: 80,
    openReviews: 2,
    reprograms: 2,
    daysWithoutContact: 12,
  }],
};

const first = engine.build({ ...baseline, now });
assert.ok(first.some((item) => item.type === "SUBJECT_ATTENTION" && item.subjectName === "Estatística"), "Os sinais da mesma matéria devem gerar um alerta consolidado.");
assert.ok(first.some((item) => item.type === "REVISION_BACKLOG"), "Revisões acumuladas devem gerar alerta apenas acima da tolerância.");
assert.ok(first.some((item) => item.type === "COVERAGE_RISK"), "Risco de cobertura exige projeção confiável.");
assert.ok(first.some((item) => item.type === "STUDY_CONCENTRATION"), "Concentração só deve aparecer com amostra suficiente.");

const lowEvidence = engine.build({
  ...baseline,
  now,
  priorityReviews: 0,
  concentration: { sessions: 2, share: 1, subjectName: "Estatística" },
  exam: { weeksToExam: 6, coverageRisk: false, confident: false },
  subjects: [{ ...baseline.subjects[0], questions: 8, performance: .4, performanceTrend: "Dados insuficientes", daysWithoutContact: 2, openReviews: 0, reprograms: 0 }],
});
assert.ok(!lowEvidence.some((item) => item.type === "SUBJECT_ATTENTION"), "Uma sessão ruim isolada não deve gerar alerta de desempenho.");

const diagnosedAttention = engine.build({
  now,
  exam: { weeksToExam: 20, coverageRisk: false, confident: false },
  priorityReviews: 0,
  subjects: [{
    name: "Pontuação",
    coverage: .8,
    performance: .9,
    questions: 50,
    performanceTrend: "Estável",
    priority: 70,
    openReviews: 0,
    reprograms: 0,
    daysWithoutContact: 2,
    diagnosis: { level: "attention", confidence: .8, trend: { label: "falling" }, reasons: ["queda nas sessões recentes"], action: { kind: "light-reinforcement" } },
  }],
});
const diagnosedSubject = diagnosedAttention.find((item) => item.subjectName === "Pontuação");
assert.ok(diagnosedSubject.reasonCodes.includes("MASTERY_ATTENTION"), "Alertas devem usar o nível fornecido pelo diagnóstico.");
assert.ok(diagnosedSubject.reasonCodes.includes("PERFORMANCE_DROP"), "Alertas devem ler trend.label corretamente.");
assert.ok(!diagnosedSubject.reasonCodes.includes("LOW_PERFORMANCE"), "Com diagnóstico disponível, não deve haver uma régua paralela de desempenho.");

const dismissed = first.map((item) => item.type === "SUBJECT_ATTENTION" ? { ...item, dismissedAt: now.toISOString() } : item);
const unchanged = engine.build({ ...baseline, existing: dismissed, now: new Date("2026-08-19T12:00:00.000Z") });
assert.ok(unchanged.find((item) => item.type === "SUBJECT_ATTENTION").dismissedAt, "Um alerta dispensado deve permanecer oculto enquanto a situação não mudar.");

const resolved = engine.build({ ...baseline, existing: first, now: new Date("2026-08-20T12:00:00.000Z"), subjects: [] });
assert.ok(resolved.some((item) => item.type === "SUBJECT_ATTENTION" && item.resolvedAt), "Alertas sem condição ativa devem ser resolvidos automaticamente.");

console.log("OK - central de alertas consolida sinais, respeita tolerâncias e preserva dispensas.");
