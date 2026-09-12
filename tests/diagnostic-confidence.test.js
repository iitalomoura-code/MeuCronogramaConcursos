"use strict";

const assert = require("node:assert/strict");
const confidence = require("../js/diagnostic-confidence.js");

const now = "2026-09-12T12:00:00.000Z";
const result = (questions, sessions, accuracy = .9) => confidence.calculate({
  evidence: { questions, sessions, accuracy },
  now,
});

assert.equal(result(0, 0).evidenceStage, "unknown");
assert.equal(result(0, 0).level, "low");
assert.equal(result(5, 1, .95).level, "low", "Alta taxa em cinco questões não é alta confiança.");
assert.equal(result(30, 1, .4).level, "low", "Uma sessão ainda limita a confiança.");
assert.equal(result(30, 3, .4).level, "medium", "Sessões independentes aumentam a confiança sem usar desempenho.");
assert.equal(result(60, 5, .4).level, "high", "Volume e diversidade suficientes confirmam a confiança.");
assert.equal(result(80, 6, .4).level, "high", "Desempenho baixo não reduz a confiança da medição.");
assert.equal(result(5, 1, .95).evidenceStage, "early");
assert.equal(result(30, 3, .95).evidenceStage, "developing");
assert.equal(result(60, 5, .95).evidenceStage, "confirmed");

const dated = confidence.calculate({
  evidence: { entries: [
    { questions: 10, correctAnswers: 9, completedAt: "2026-08-01T12:00:00.000Z" },
    { questions: 10, correctAnswers: 8, completedAt: "2026-08-10T12:00:00.000Z" },
    { questions: 10, correctAnswers: 8, completedAt: "2026-09-10T12:00:00.000Z" },
  ] },
  now,
});
assert.equal(dated.sessions, 3);
assert.ok(dated.reasons.includes("há evidência recente"));
assert.ok(dated.limitations.length <= 1, "Três sessões distribuídas não devem acumular limitações artificiais.");

console.log("OK - confiança diagnóstica separa confiabilidade da medição e não confunde desempenho com certeza.");
