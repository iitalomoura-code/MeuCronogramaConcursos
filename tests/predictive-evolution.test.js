"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
require("../js/evolution-diagnosis.js");
const engine = require("../js/predictive-evolution.js");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");

const now = new Date("2026-08-18T12:00:00");
const entries = [
  { date: "2026-07-24T12:00:00", hours: 4, questions: 10, correct: 7, contactKey: "a" },
  { date: "2026-07-31T12:00:00", hours: 5, questions: 10, correct: 7, contactKey: "b" },
  { date: "2026-08-07T12:00:00", hours: 7, questions: 12, correct: 9, contactKey: "c" },
  { date: "2026-08-14T12:00:00", hours: 8, questions: 12, correct: 10, contactKey: "d" },
];
const result = engine.build({
  now,
  examDate: "2026-10-13",
  topics: ["a", "b", "c", "d", "e", "f"].map((key, index) => ({ key, contacted: index < 4, estimatedHours: 1 })),
  entries,
  subjects: [{ name: "Português", coverage: .4, performance: .58, questions: 20, priority: .8, openReviews: 2, remainingHours: 4, diagnosis: { level: "critical", confidence: .8, trend: { label: "falling" }, reasons: [], action: { kind: "deep-recovery" } }, topicDiagnoses: [{ assunto: "Pontuação", diagnosis: { level: "critical", confidence: .8, trend: { label: "falling" }, reasons: [], action: { kind: "deep-recovery" } } }] }],
});

assert.strictEqual(result.coverage.contactedTopics, 4);
assert.ok(result.coverage.estimatedWeeks > 0, "A previsão deve usar o ritmo observado.");
assert.strictEqual(result.rhythm.trend.direction, "↑", "A tendência deve privilegiar as semanas recentes.");
assert.notStrictEqual(result.confidence.level, "baixa", "Quatro semanas ativas devem superar a confiança baixa.");
assert.strictEqual(result.subjects[0].risk.level, "Prioridade", "Cobertura baixa, diagnóstico crítico e revisões devem elevar o risco.");

const sparse = engine.build({ now, topics: [{ key: "a", contacted: false, estimatedHours: 1 }], entries: [{ date: now, hours: 1, contactKey: "a" }] });
assert.strictEqual(sparse.confidence.available, false, "Uma sessão isolada não pode gerar previsão confiável.");

assert.ok(index.includes("js/predictive-evolution.js"), "O motor preditivo deve ser carregado antes do app.");
["buildPredictiveEvolution", "renderPredictiveEvolution", "predictiveRiskForSubject"].forEach((name) => assert.ok(app.includes(`function ${name}`), `${name} deve integrar a previsão ao painel.`));
assert.ok(index.includes('id="evolutionPredictive"'), "O Painel de Evolução deve ter uma área própria para projeções.");
assert.ok(index.includes("js/evolution-diagnosis.js"), "O adaptador de diagnóstico deve carregar antes do motor preditivo.");

console.log("OK - evolução preditiva usa registros recentes, confiança explícita e risco por matéria.");
