"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const strategy = require("../js/ai-cycle-strategy.js");

const foundation = {
  key: "contabilidade::balanco", subject: "Contabilidade", topic: "Balanço patrimonial", subarea: "",
  baseLevel: "never-studied", executableNow: true, reservable: true, blocked: false,
  evidenceKeys: ["base-declared", "pedagogical-order", "exam-priority"], prerequisiteKeys: [],
};
const strong = {
  key: "constitucional::controle", subject: "Direito Constitucional", topic: "Controle de constitucionalidade", subarea: "",
  baseLevel: "advanced", executableNow: true, reservable: true, blocked: false,
  evidenceKeys: ["validated-history", "recent-performance", "exam-priority"], history: { reliable: true }, hasValidatedHistory: true, prerequisiteKeys: ["constitucional::principios"],
};

function recommendation(candidate, overrides = {}) {
  return {
    subject: candidate.subject, topic: candidate.topic, subarea: candidate.subarea,
    action: "CONTINUE_THEORY", sessionType: "Teoria e questões", priority: "high",
    suggestedBlocks: 1, suggestedMinutes: 60, justification: "Motivo verificável.",
    evidence: [candidate.evidenceKeys[0]], confidence: "high", dependencies: [], ...overrides,
  };
}

test("mantém matéria nova no fundamento e aceita histórico forte para manutenção", () => {
  const output = strategy.validateStrategy({ recommendations: [
    recommendation(foundation, { action: "START_FOUNDATION" }),
    recommendation(strong, { action: "MAINTAIN", sessionType: "Questões", evidence: ["validated-history"], dependencies: ["constitucional::principios"] }),
  ] }, { candidates: [foundation, strong], capacityMinutes: 180, maxBlocksPerSubject: 3 });
  assert.equal(output.source, "ai");
  assert.equal(output.accepted[0].action, "START_FOUNDATION");
  assert.equal(output.accepted[1].action, "MAINTAIN");
});

test("rejeita avanço não liberado para base fraca, tópico inventado e dependência inválida", () => {
  const output = strategy.validateStrategy({ recommendations: [
    recommendation(foundation, { action: "ADVANCE" }),
    { ...recommendation(foundation), subject: "Matéria inventada", topic: "Tema inexistente" },
    recommendation(strong, { dependencies: ["dependencia-inventada"] }),
  ] }, { candidates: [foundation, strong], capacityMinutes: 180, maxBlocksPerSubject: 3 });
  assert.equal(output.source, "fallback");
  assert.deepEqual(output.rejected.map((item) => item.reason), ["incompatible-with-base-or-progression", "unknown-topic", "invalid-dependency"]);
});

test("impede recomendação sem evidência, excesso de capacidade e concentração por matéria", () => {
  const output = strategy.validateStrategy({ recommendations: [
    recommendation(foundation, { evidence: ["evidencia-inventada"] }),
    recommendation(foundation, { suggestedMinutes: 120, suggestedBlocks: 2 }),
    recommendation(strong, { suggestedMinutes: 120, suggestedBlocks: 2 }),
  ] }, { candidates: [foundation, strong], capacityMinutes: 180, maxBlocksPerSubject: 1 });
  assert.equal(output.accepted.length, 0);
  assert.ok(output.rejected.some((item) => item.reason === "unsupported-evidence"));
  assert.ok(output.rejected.some((item) => item.reason === "subject-block-cap"));
});

test("estratégia ausente ou inválida sempre devolve fallback sem mutar candidatos", () => {
  const before = JSON.stringify(foundation);
  const output = strategy.validateStrategy(null, { candidates: [foundation], capacityMinutes: 60 });
  assert.equal(output.source, "fallback");
  assert.equal(output.fallbackRequired, true);
  assert.equal(JSON.stringify(foundation), before);
});


test("aplica a matriz pedagógica para base, histórico, revisão, lacuna e dependências completas", () => {
  const low = { ...foundation, hasTheoryContact: false, reviewPending: false, hasConfirmedGap: false, pedagogicalStage: 0 };
  const intermediate = { ...strong, baseLevel: "intermediate", performance: { accuracy: .82 }, pedagogicalStage: 1 };
  const advanced = { ...strong, baseLevel: "advanced", performance: { accuracy: .9 }, pedagogicalStage: 0, hasConfirmedGap: false };
  const rejected = strategy.validateStrategy({ recommendations: [
    recommendation(low, { action: "PRACTICE", sessionType: "Questões" }),
    recommendation(low, { action: "REVIEW", sessionType: "Revisão" }),
    recommendation(low, { action: "MAINTAIN", sessionType: "Questões" }),
    recommendation(advanced, { action: "START_FOUNDATION" }),
    recommendation(intermediate, { action: "ADVANCE", dependencies: [] }),
  ] }, { candidates: [low, intermediate, advanced], capacityMinutes: 300, maxBlocksPerSubject: 3 });
  assert.equal(rejected.accepted.length, 0);
  assert.ok(rejected.rejected.every((entry) => ["incompatible-with-base-or-progression", "invalid-dependency"].includes(entry.reason)));
  const accepted = strategy.validateStrategy({ recommendations: [
    recommendation(intermediate, { action: "ADVANCE", dependencies: ["constitucional::principios"] }),
  ] }, { candidates: [intermediate], capacityMinutes: 120, maxBlocksPerSubject: 2 });
  assert.equal(accepted.accepted[0].action, "ADVANCE");
});
