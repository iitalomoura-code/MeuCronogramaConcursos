"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const { create } = require("../js/strategic-planning-index.js");

const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const matches = (entry, materia, assunto = "") => {
  if (normalize(entry.materia) !== normalize(materia)) return false;
  if (!assunto) return true;
  const source = normalize(entry.assunto);
  const target = normalize(assunto);
  return source === target || source.includes(target) || target.includes(source);
};

const entries = Array.from({ length: 3000 }, (_, index) => {
  const topic = index % 120;
  return {
  materia: `Matéria ${topic % 12}`,
  assunto: `Tema ${topic}`,
  questoes: 10 + (index % 7),
  acertos: 5 + (index % 5),
  };
});
const targets = Array.from({ length: 120 }, (_, index) => ({ materia: `Matéria ${index % 12}`, assunto: `Tema ${index}` }));
const originalEntries = JSON.stringify(entries);

let baselineScans = 0;
const baselineStartedAt = performance.now();
const baseline = [...targets, ...targets].map(({ materia, assunto }) => {
  baselineScans += entries.length;
  return entries.filter((entry) => matches(entry, materia, assunto));
});
const baselineMs = performance.now() - baselineStartedAt;

const indexedStartedAt = performance.now();
const planningIndex = create({ entries, normalize, matches });
const indexed = [...targets, ...targets].map(({ materia, assunto }) => planningIndex.forTopic(materia, assunto));
const indexedMs = performance.now() - indexedStartedAt;

assert.deepEqual(indexed, baseline, "A pré-indexação precisa preservar exatamente os alvos encontrados.");
assert.equal(JSON.stringify(entries), originalEntries, "O índice não pode mutar o histórico recebido.");
assert.equal(planningIndex.stats.sourceScans, 1, "O histórico bruto deve ser indexado uma única vez por revisão.");
assert.equal(planningIndex.stats.topicFilters, targets.length, "Cada alvo deve ser filtrado uma vez antes de ser reaproveitado.");
assert.equal(planningIndex.stats.topicCacheHits, targets.length, "Chamadas repetidas para o mesmo alvo devem reutilizar o resultado da revisão.");
assert.equal(planningIndex.stats.topicCandidateScans, 30000, "Cada tema deve examinar somente o bucket da sua matéria, não o histórico inteiro.");
assert.equal(baselineScans, 720000, "A linha de base controlada deve revelar o custo de varrer todo o histórico a cada chamada.");
assert.ok(baselineScans > planningIndex.stats.sourceScans, "O benchmark deve demonstrar a eliminação de scans completos repetidos.");

assert.ok(index.includes('./js/strategic-planning-index.js?v=20260913-advisor-performance'), "O índice deve carregar antes do app.");
assert.ok(app.includes("window.__strategicPerf") && app.includes("PerformanceObserver") && app.includes('entryTypes: ["longtask"]'), "O Orientador deve expor profiling opt-in e observar long tasks quando houver suporte.");
assert.ok(app.includes('"advisorOpenStart"') && app.includes('"advisorShellPainted"') && app.includes('"advisorExecutiveReady"') && app.includes('"advisorFullModelReady"'), "O profiling deve marcar os principais momentos visuais do modal.");
assert.ok(app.includes('"masteryDiagnosisForTarget"') && app.includes('"initialDiagnosisEvidence"') && app.includes('"errorSignalsForTarget"') && app.includes('"strategicPriorityForTarget"'), "As operações por tópico devem aparecer separadamente no profiler.");
assert.ok(app.includes("strategicPlanningPerformanceIndex") && app.includes("initialDiagnosisEvidenceCache") && app.includes("learningInterventionCache"), "As otimizações devem reutilizar índices e subresultados apenas durante a revisão atual.");
assert.ok(app.includes("invalidateDerivedStudyCaches") && app.includes("initialDiagnosisEvidenceCache.clear()"), "A invalidação deve descartar os caches quando a evidência muda.");

console.log(`OK - profiling do Orientador preserva resultados; benchmark: ${baselineScans} scans integrais em ${baselineMs.toFixed(1)}ms vs ${planningIndex.stats.topicCandidateScans} candidatos indexados em ${indexedMs.toFixed(1)}ms.`);
