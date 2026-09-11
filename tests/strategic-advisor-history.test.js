"use strict";

const assert = require("assert");
const history = require("../js/strategic-advisor-history.js");

const advisorFor = (topics = [], coverage = { level: "broad", ratio: 1, evidencedTopics: topics.length, totalTopics: topics.length }) => ({
  coverage,
  confidence: .72,
  summary: ["Leitura estratégica atual."],
  priorities: [],
  reduceLoad: [],
  watch: [],
  building: [],
  insufficientEvidence: [],
  topicStates: topics,
});

const topic = (overrides = {}) => ({
  materia: "Contabilidade",
  assunto: "Lançamentos",
  category: "prioritize",
  learningState: "practice",
  diagnosisLevel: "deficiency",
  strategicScore: .7,
  confidence: .75,
  recentAccuracy: .55,
  overallAccuracy: .65,
  questions: 40,
  trend: "stable",
  errorRecurrence: "none",
  evidenceStage: "evidenced",
  reasons: ["erros recorrentes"],
  ...overrides,
});

const snapshot = (topics, coverage, id) => history.createSnapshot({ advisor: advisorFor(topics, coverage), id, createdAt: "2026-09-11T12:00:00.000Z" });

const first = snapshot([topic()], undefined, "first");
const firstAppend = history.appendSnapshot([], first);
assert.ok(firstAppend.added && firstAppend.comparison.initial, "O primeiro marco não deve inventar comparação.");

const duplicate = history.appendSnapshot(firstAppend.snapshots, snapshot([topic()], undefined, "duplicate"));
assert.equal(duplicate.added, false, "Um snapshot com fingerprint idêntico não pode duplicar o histórico.");
assert.ok(duplicate.message.includes("Não houve mudança"), "A repetição deve explicar que não houve mudança estratégica.");

let comparison = history.compare(first, snapshot([topic({ category: "watch", diagnosisLevel: "attention", strategicScore: .55 })], undefined, "attention"));
assert.equal(comparison.improvements.length, 1, "Deficiência para atenção deve ser reconhecida como melhora.");

comparison = history.compare(snapshot([topic({ category: "watch", diagnosisLevel: "attention" })], undefined, "attention-before"), snapshot([topic({ category: "reduce", diagnosisLevel: "strong", strategicScore: .25 })], undefined, "strong"));
assert.equal(comparison.improvements.length, 1, "Atenção para forte deve ser uma melhora relevante.");

comparison = history.compare(snapshot([topic({ category: "reduce", diagnosisLevel: "strong", strategicScore: .2 })], undefined, "strong-before"), snapshot([topic({ category: "watch", diagnosisLevel: "attention", strategicScore: .55 })], undefined, "fall"));
assert.equal(comparison.declines.length, 1, "Forte para atenção com evidência deve ser reconhecido como piora.");

comparison = history.compare(snapshot([topic({ category: "maintain", diagnosisLevel: "adequate", strategicScore: .35 })], undefined, "maintain-before"), snapshot([topic({ category: "recovery", learningState: "recovery", diagnosisLevel: "attention", strategicScore: .72, trend: "falling" })], undefined, "recovery"));
assert.equal(comparison.newPriorities.length, 1, "Manutenção para recuperação deve criar novo ponto prioritário.");

comparison = history.compare(first, snapshot([topic({ category: "maintain", diagnosisLevel: "adequate", strategicScore: .3 })], undefined, "resolved"));
assert.equal(comparison.resolvedPriorities.length, 1, "Prioridade que vira manutenção deve ser registrada como resolvida.");

comparison = history.compare(snapshot([topic({ strategicScore: .7 })], undefined, "score-small-before"), snapshot([topic({ strategicScore: .73 })], undefined, "score-small-after"));
assert.equal(comparison.priorityChanges.length, 0, "Variação de score abaixo do delta não deve gerar ruído.");

comparison = history.compare(snapshot([topic({ strategicScore: .45 })], undefined, "score-large-before"), snapshot([topic({ strategicScore: .7 })], undefined, "score-large-after"));
assert.equal(comparison.priorityChanges.length, 1, "Variação relevante de score deve aparecer na comparação.");

comparison = history.compare(snapshot([topic({ recentAccuracy: .74 })], undefined, "accuracy-before"), snapshot([topic({ recentAccuracy: .72 })], undefined, "accuracy-after"));
assert.equal(comparison.declines.length, 0, "Oscilação pequena de acerto isolada não pode virar piora automática.");

comparison = history.compare(snapshot([topic({ category: "watch", diagnosisLevel: "attention", questions: 25 })], undefined, "sample-before"), snapshot([topic({ category: "maintain", diagnosisLevel: "adequate", questions: 3, confidence: .2 })], undefined, "sample-after"));
assert.ok(comparison.improvements[0].cautious && comparison.improvements[0].explanation.includes("sinal inicial"), "Amostra pequena deve usar linguagem cautelosa.");

comparison = history.compare(snapshot([topic()], { level: "low", ratio: .08, evidencedTopics: 2, totalTopics: 25 }, "coverage-low"), snapshot([topic()], { level: "partial", ratio: .3, evidencedTopics: 8, totalTopics: 25 }, "coverage-partial"));
assert.equal(comparison.coverageChanges[0].current, "partial", "Low para partial deve registrar aumento de cobertura.");
comparison = history.compare(snapshot([topic()], { level: "partial", ratio: .4, evidencedTopics: 10, totalTopics: 25 }, "coverage-partial-2"), snapshot([topic()], { level: "broad", ratio: .72, evidencedTopics: 18, totalTopics: 25 }, "coverage-broad"));
assert.ok(comparison.coverageChanges[0].explanation.includes("conclusões mais amplas"), "Partial para broad deve explicar maior confiabilidade global.");

comparison = history.compare(
  snapshot([topic({ assunto: "Estoques", category: "watch", diagnosisLevel: "attention" }), topic({ assunto: "Patrimônio", category: "watch", diagnosisLevel: "attention" })], undefined, "group-before"),
  snapshot([topic({ assunto: "Estoques", category: "maintain", diagnosisLevel: "adequate" }), topic({ assunto: "Patrimônio", category: "reduce", diagnosisLevel: "strong" })], undefined, "group-after"),
);
assert.equal(comparison.grouped.improvements.length, 1, "Mudanças múltiplas da mesma matéria devem poder ser sintetizadas em uma única leitura.");
assert.equal(comparison.grouped.improvements[0].title, "Contabilidade", "A síntese deve agrupar mudanças pelo nome da matéria.");

const beforeStudyData = JSON.stringify({ questions: 40, sessions: 3, hours: 12, confidence: .75, level: "deficiency", priority: .7 });
let snapshots = [];
for (let index = 0; index < 22; index += 1) {
  const result = history.appendSnapshot(snapshots, snapshot([topic({ strategicScore: .2 + index * .01 })], undefined, `limit-${index}`));
  snapshots = result.snapshots;
}
assert.equal(snapshots.length, history.MAX_SNAPSHOTS, "O histórico estratégico deve respeitar o limite de snapshots.");
assert.equal(JSON.stringify({ questions: 40, sessions: 3, hours: 12, confidence: .75, level: "deficiency", priority: .7 }), beforeStudyData, "Registrar snapshots não pode alterar dados de estudo.");

const deterministicA = history.compare(first, snapshot([topic({ category: "watch", diagnosisLevel: "attention" })], undefined, "deterministic"));
const deterministicB = history.compare(first, snapshot([topic({ category: "watch", diagnosisLevel: "attention" })], undefined, "deterministic"));
assert.deepEqual(deterministicA, deterministicB, "A comparação deve ser determinística para os mesmos snapshots.");

console.log("OK - histórico do Orientador cria marcos imutáveis e compara mudanças estratégicas sem tocar nos dados de estudo.");
