"use strict";

const assert = require("assert");
const derivedState = require("../js/study-derived-state.js");
const recommendation = require("../js/continue-recommendation.js");

let derivations = 0;
const rawEntries = [
  { index: 0, block: { materia: "Português", assunto: "Pontuação", prioridade: 3, duracao: 1, status: "Não iniciado" } },
  { index: 1, block: { materia: "AFO", assunto: "Despesa pública", prioridade: 3, duracao: .75, status: "Em andamento" } },
];
const input = {
  revision: 1,
  entries: rawEntries,
  phase: { profile: { reviewMultiplier: 1, performanceMultiplier: 1, incidenceMultiplier: 1, uncoveredAdjustment: .2 } },
  deriveEntry(entry, phase) {
    derivations += 1;
    return {
      adaptive: { adjustment: entry.index === 1 ? .1 : 0, reasons: [], mastery: { level: entry.index === 1 ? "attention" : "adequate" } },
      review: { overdue: [], today: [], hasAttention: false },
      rotation: { score: 0, reasons: [] },
      incidence: { adjustment: 0, applied: false },
      weeklyReinforcement: null,
      weeklyAdjustment: null,
      phase: phase.profile,
      hasContact: entry.index === 1,
    };
  },
};

const first = derivedState.continueSnapshot(input);
const second = derivedState.continueSnapshot({ ...input, entries: [...rawEntries] });
assert.strictEqual(first, second, "O snapshot deve ser reutilizado até uma alteração relevante.");
assert.equal(derivations, 2, "O estado derivado deve calcular cada bloco apenas uma vez por revisão.");
assert.equal(first.diagnosisByTopic.get("afo::despesa pública").level, "attention", "O diagnóstico por tema deve ficar disponível no snapshot compartilhável.");

const ranked = recommendation.rank(first, {
  normalizeStatus: (status) => status,
  matchesFilters: () => true,
  hasActiveFilter: false,
});
assert.equal(ranked[0].index, 1, "Tema em andamento deve manter vantagem para conclusão.");

const result = recommendation.build(ranked, {
  includeAlternatives: true,
  helpers: { normalizeStatus: (status) => status, priorityInfo: () => ({ percent: 60 }) },
});
assert.equal(result.recommendation.index, 1, "A recomendação deve usar a ordenação preparada.");
assert.equal(result.suggestedMinutes, 45, "A duração da recomendação deve continuar em minutos.");
assert.equal(result.alternatives.length, 1, "Alternativas devem excluir a recomendação principal.");

derivedState.continueSnapshot({ ...input, revision: 2 });
assert.equal(derivations, 4, "Uma alteração relevante deve invalidar o snapshot derivado.");

console.log("OK - estado derivado e motor da tela Continuar reutilizam cálculos e preservam recomendação.");
