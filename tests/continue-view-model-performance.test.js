const fs = require("fs");
const { performance } = require("perf_hooks");
const derived = require("../js/study-derived-state.js");
const recommendation = require("../js/continue-recommendation.js");

const entries = Array.from({ length: 150 }, (_, index) => ({
  index,
  block: { materia: `Matéria ${index % 18}`, assunto: `Tema ${index + 1}`, status: index === 0 ? "Em andamento" : "Não iniciado", prioridade: 1 + (index % 5), duracao: [0.5, .75, 1, 1.5][index % 4] },
}));
let derivations = 0;
const input = {
  revision: 7001,
  entries,
  phase: { profile: { reviewMultiplier: 1, performanceMultiplier: 1, incidenceMultiplier: 1, uncoveredAdjustment: .2 } },
  deriveEntry(entry) {
    derivations += 1;
    return { adaptive: { adjustment: entry.index % 7 === 0 ? .15 : 0, mastery: {} }, review: { overdue: entry.index === 2 ? [{}] : [], today: [], hasAttention: entry.index === 2 }, incidence: { adjustment: 0, applied: false }, rotation: { score: 0, reasons: [] }, hasContact: entry.index % 3 !== 0 };
  },
  buildStrategicQueue(items) { return items.map((entry, index) => ({ index: entry.index, strategic: { queueRank: index + 1, score: 1 - index / items.length } })); },
};
// Baseline: o caminho anterior recriava o estado derivado e a ordenação em
// cada interação da lista. A revisão diferente simula a antiga assinatura
// integral invalidando o cache a todo clique.
derived.invalidate();
let baselineDerivations = 0;
const baselineStarted = performance.now();
for (let click = 0; click < 20; click += 1) {
  const snapshot = derived.continueSnapshot({ ...input, revision: 6000 + click, deriveEntry(entry) {
    baselineDerivations += 1;
    return input.deriveEntry(entry);
  } });
  const ranked = recommendation.rank(snapshot, { normalizeStatus: (value) => value, matchesFilters: () => true, hasActiveFilter: false });
  recommendation.build(ranked, { offset: click, includeAlternatives: true, helpers: { normalizeStatus: (value) => value, priorityInfo: () => ({ percent: 60 }) } });
}
const baselineMs = performance.now() - baselineStarted;

derivations = 0;
derived.invalidate();
const started = performance.now();
const snapshot = derived.continueSnapshot(input);
const firstRank = recommendation.rank(snapshot, { normalizeStatus: (value) => value, matchesFilters: () => true, hasActiveFilter: false });
const initialMs = performance.now() - started;
const clickTimes = [];
for (let click = 0; click < 20; click += 1) {
  const clickStarted = performance.now();
  const filtered = firstRank.filter((entry) => !click % 2 || Math.round(entry.block.duracao * 60) <= 60);
  recommendation.build(filtered, { offset: click % Math.max(1, filtered.length), includeAlternatives: true, helpers: { normalizeStatus: (value) => value, priorityInfo: () => ({ percent: 60 }) } });
  clickTimes.push(performance.now() - clickStarted);
}
const maxClickMs = Math.max(...clickTimes);
require("assert").equal(baselineDerivations, 3000, "O baseline deve demonstrar as derivações repetidas.");
require("assert").equal(derivations, 150, "Os 20 cliques devem reutilizar a derivação dos 150 temas.");
require("assert").ok(initialMs < 100, `A criação do modelo deve ficar abaixo de 100 ms no fixture: ${initialMs.toFixed(2)} ms.`);
require("assert").ok(maxClickMs < 50, `A interação de alternativa não pode gerar tarefa longa: ${maxClickMs.toFixed(2)} ms.`);
console.log(`OK - fixture grande (150 temas/25 blocos representativos): antes ${baselineMs.toFixed(2)} ms e ${baselineDerivations} derivações; depois modelo ${initialMs.toFixed(2)} ms, 20 interações reutilizadas, pior interação ${maxClickMs.toFixed(2)} ms e ${derivations} derivações.`);