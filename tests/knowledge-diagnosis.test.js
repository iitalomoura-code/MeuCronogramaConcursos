"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const knowledge = require("../js/knowledge-base.js");
const mapping = require("../js/knowledge-mapping.js");
const diagnosis = require("../js/knowledge-diagnosis.js");
const LearningState = require("../js/learning-state.js");

function baseFor(titles, evidence = []) {
  return knowledge.migrateKnowledgeMappings({
    schemaVersion: 2,
    concepts: titles.map((title) => ({ canonicalKey: mapping.normalize(title), canonicalTitle: title })),
    evidence,
    topicMappings: [],
  });
}

function historicalEvidence(title, values = {}) {
  return {
    id: values.id || `evidence-${mapping.normalize(title)}-${values.sessionId || "one"}`,
    sourcePlanId: values.sourcePlanId || "old-plan",
    sourcePlanName: values.sourcePlanName || "Plano anterior",
    sessionId: values.sessionId || "session-one",
    canonicalKey: mapping.normalize(title),
    canonicalTitle: title,
    originalTopic: title,
    originalSubject: values.subject || "Direito Administrativo",
    questions: values.questions ?? 20,
    correctAnswers: values.correctAnswers ?? 18,
    studiedMinutes: values.studiedMinutes ?? 45,
    completedAt: values.completedAt || "2026-08-01T12:00:00.000Z",
    observedAt: values.observedAt || "",
  };
}

function topic(title, options = {}) {
  return {
    planId: options.planId || "current-plan",
    topicId: options.topicId || `topic-${mapping.normalize(title).replace(/ /g, "-")}`,
    materia: options.subject || "Direito Administrativo",
    assunto: title,
    titulo: title,
    descricao: options.details || "",
  };
}

function confirmed(base, currentTopic, conceptKeys, options = {}) {
  const mapped = {
    topic: currentTopic,
    conceptKeys,
    confidence: "high",
    matchBasis: options.matchBasis || "controlled-alias",
    relationship: options.relationship || (conceptKeys.length > 1 ? "composite" : "equivalent"),
    coverage: options.coverage ?? (conceptKeys.length > 1 ? .7 : 1),
  };
  return mapping.applyMappingDecision(base, mapped, "confirm", "2026-09-12T10:00:00.000Z");
}

const now = new Date("2026-09-12T12:00:00.000Z").getTime();

const noMapping = baseFor(["Atos Administrativos"], [historicalEvidence("Atos Administrativos")]);
assert.equal(diagnosis.derive({ base: noMapping, topic: topic("Tema novo"), currentPlanId: "current-plan", now }).mastery.level, "none", "Sem mapping não há conhecimento herdado.");

const suggestedBase = baseFor(["Crase", "Pontuação"], [historicalEvidence("Crase", { subject: "Língua Portuguesa" }), historicalEvidence("Pontuação", { id: "p-1", sessionId: "p-session", subject: "Língua Portuguesa" })]);
const suggested = diagnosis.derive({ base: suggestedBase, topic: topic("Crase e Pontuação", { subject: "Língua Portuguesa" }), currentPlanId: "current-plan", now });
assert.equal(suggested.mastery.level, "none", "Suggested não pode produzir domínio herdado.");
assert.equal(diagnosis.derive({ base: suggestedBase, topic: topic("Crase e Pontuação", { subject: "Língua Portuguesa" }), currentPlanId: "current-plan", legacyInheritance: { level: "strong" }, now }).mastery.level, "none", "Suggested também não pode abrir crédito pelo fallback legado.");

const exactTopic = topic("Atos Administrativos");
const strongBase = baseFor(["Atos Administrativos"], [
  historicalEvidence("Atos Administrativos", { id: "strong-1", sessionId: "strong-1", questions: 25, correctAnswers: 23, completedAt: "2026-08-01T12:00:00.000Z" }),
  historicalEvidence("Atos Administrativos", { id: "strong-2", sessionId: "strong-2", questions: 25, correctAnswers: 24, completedAt: "2026-08-10T12:00:00.000Z" }),
]);
const autoStrong = diagnosis.derive({ base: strongBase, topic: exactTopic, currentPlanId: "current-plan", now });
assert.equal(autoStrong.mastery.level, "strong", "Canonical exact com histórico forte deve ser base forte.");
assert.equal(autoStrong.origin, "knowledge-base");
assert.equal(autoStrong.evidence.questions, 50);
assert.equal(autoStrong.recommendation, "Questões diagnósticas");

const userConfirmedBase = confirmed(baseFor(["Atos Administrativos"], [
  historicalEvidence("Atos Administrativos", { id: "u-1", sessionId: "u-1", questions: 25, correctAnswers: 24 }),
  historicalEvidence("Atos Administrativos", { id: "u-2", sessionId: "u-2", questions: 25, correctAnswers: 23 }),
]), topic("Atos da Administração Pública"), ["atos administrativos"], { matchBasis: "controlled-alias" });
const userStrong = diagnosis.derive({ base: userConfirmedBase, topic: topic("Atos da Administração Pública"), currentPlanId: "current-plan", now });
assert.equal(userStrong.mastery.level, "strong", "Mapping user-confirmed equivalente deve influenciar a base.");
assert.equal(userStrong.mapping.status, "user-confirmed");

const partialBase = confirmed(baseFor(["IA e Aprendizado de Máquina"], [
  historicalEvidence("IA e Aprendizado de Máquina", { id: "partial-1", sessionId: "partial-1", questions: 50, correctAnswers: 47 }),
]), topic("Analytics e Inteligência Artificial", { subject: "Tecnologia" }), ["ia e aprendizado de maquina"], { relationship: "partial", coverage: .5 });
const partial = diagnosis.derive({ base: partialBase, topic: topic("Analytics e Inteligência Artificial", { subject: "Tecnologia" }), currentPlanId: "current-plan", now });
assert.equal(partial.mastery.level, "partial", "Mapping parcial nunca pode virar domínio total.");
assert.equal(partial.inheritedCoverage, .5);
assert.match(partial.recommendation, /gaps/);

const compositeBase = confirmed(baseFor(["Crase", "Pontuação"], [
  historicalEvidence("Crase", { id: "composite-1", sessionId: "same-session", questions: 20, correctAnswers: 18 }),
  historicalEvidence("Pontuação", { id: "composite-2", sessionId: "same-session", questions: 20, correctAnswers: 18 }),
]), topic("Crase e Pontuação", { subject: "Língua Portuguesa" }), ["crase", "pontuacao"], { relationship: "composite", coverage: .75 });
const composite = diagnosis.derive({ base: compositeBase, topic: topic("Crase e Pontuação", { subject: "Língua Portuguesa" }), currentPlanId: "current-plan", now });
assert.equal(composite.mastery.level, "partial", "Composite mantém a cobertura parcial do tópico atual.");
assert.equal(composite.evidence.questions, 20, "A mesma sessionId não pode ser contada duas vezes.");
assert.equal(composite.evidence.sessions, 1);

const small = diagnosis.derive({
  base: baseFor(["Regência"], [historicalEvidence("Regência", { questions: 5, correctAnswers: 5, sessionId: "small" })]),
  topic: topic("Regência"), currentPlanId: "current-plan", now,
});
assert.notEqual(small.mastery.level, "strong", "Amostra pequena não declara domínio forte.");
assert.ok(small.confidence < .45, "Amostra pequena deve manter confiança limitada.");

const weak = diagnosis.derive({
  base: baseFor(["Créditos Adicionais"], [
    historicalEvidence("Créditos Adicionais", { id: "weak-1", sessionId: "weak-1", questions: 30, correctAnswers: 12 }),
    historicalEvidence("Créditos Adicionais", { id: "weak-2", sessionId: "weak-2", questions: 30, correctAnswers: 15 }),
  ]),
  topic: topic("Créditos Adicionais"), currentPlanId: "current-plan", now,
});
assert.notEqual(weak.mastery.level, "strong", "Histórico com baixo acerto não pode virar base forte.");
const weakVoluminous = diagnosis.derive({
  base: baseFor(["Execução Orçamentária"], [
    historicalEvidence("Execução Orçamentária", { id: "weak-volume-1", sessionId: "weak-volume-1", questions: 30, correctAnswers: 13 }),
    historicalEvidence("Execução Orçamentária", { id: "weak-volume-2", sessionId: "weak-volume-2", questions: 30, correctAnswers: 14 }),
  ]),
  topic: topic("Execução Orçamentária"), currentPlanId: "current-plan", now,
});
assert.equal(weakVoluminous.mastery.level, "contact", "Volume alto com 45% de acerto continua sendo apenas contato.");

const stale = diagnosis.derive({
  base: baseFor(["Licitações"], [
    historicalEvidence("Licitações", { id: "stale-1", sessionId: "stale-1", questions: 25, correctAnswers: 24, completedAt: "2026-01-01T12:00:00.000Z" }),
    historicalEvidence("Licitações", { id: "stale-2", sessionId: "stale-2", questions: 25, correctAnswers: 24, completedAt: "2026-01-10T12:00:00.000Z" }),
  ]),
  topic: topic("Licitações"), currentPlanId: "current-plan", now,
});
assert.equal(stale.mastery.level, "strong");
assert.equal(stale.mastery.freshness, "stale");
assert.equal(stale.recommendation, "Revisão curta + questões");

const observedFallback = diagnosis.derive({
  base: baseFor(["Orçamento Público"], [historicalEvidence("Orçamento Público", {
    id: "observed-date", sessionId: "observed-date", questions: 20, correctAnswers: 16,
    completedAt: "data inválida", observedAt: "2026-09-01T12:00:00.000Z",
  })]),
  topic: topic("Orçamento Público"), currentPlanId: "current-plan", now,
});
assert.equal(observedFallback.metrics.lastContact, Date.parse("2026-09-01T12:00:00.000Z"), "Data observada deve ser usada quando completedAt é inválido.");

const recoveryHistory = { level: "strong", confidence: .8, metrics: { accuracy: .9 } };
const recovery = LearningState.derive({
  diagnosis: { level: "attention", questions: 50, needsDiagnostic: false, accuracy: .63, trend: { label: "falling" }, overallAccuracy: null, confidence: .72 },
  hasContact: true,
  historyInheritance: recoveryHistory,
  errorSignals: { recurrence: "high" },
});
assert.equal(recovery.key, "recovery", "Base forte pode servir como referência para recovery após queda atual confiável.");
const recoveryWithTinyCurrentSample = LearningState.derive({
  diagnosis: { level: "attention", questions: 3, needsDiagnostic: true, accuracy: .63, trend: { label: "falling" }, overallAccuracy: null, confidence: .72 },
  hasContact: true,
  historyInheritance: recoveryHistory,
  errorSignals: { recurrence: "high" },
});
assert.notEqual(recoveryWithTinyCurrentSample.key, "recovery", "Base forte não dispara recovery com amostra atual pequena.");

const currentOnly = diagnosis.derive({
  base: baseFor(["Atos Administrativos"], [historicalEvidence("Atos Administrativos", { sourcePlanId: "current-plan", sessionId: "current-1", questions: 50, correctAnswers: 50 })]),
  topic: exactTopic, currentPlanId: "current-plan", currentEvidence: { questions: 50, sessions: 1, hours: 1 }, now,
});
assert.equal(currentOnly.mastery.level, "none", "Evidência do plano atual não pode ser herdada.");
assert.equal(currentOnly.origin, "current-cycle");

const sameFactsBase = baseFor(["Direitos Fundamentais"], [historicalEvidence("Direitos Fundamentais", { questions: 40, correctAnswers: 36, sessionId: "old-1" })]);
const legacy = { level: "strong", confidence: .8, origin: "previous-history", metrics: { questions: 40, accuracy: .9 }, sources: [{ sourceName: "Legado" }] };
const preferredKnowledge = diagnosis.derive({ base: sameFactsBase, topic: topic("Direitos Fundamentais"), currentPlanId: "current-plan", legacyInheritance: legacy, now });
assert.equal(preferredKnowledge.origin, "knowledge-base", "A Base Permanente deve ser a fonte principal quando tem fatos confiáveis.");
assert.equal(preferredKnowledge.evidence.questions, 40, "HistoryInheritance legado não deve ser somado à Base Permanente.");

const fallback = diagnosis.derive({ base: baseFor(["Outro tema"]), topic: topic("Outro tema"), currentPlanId: "current-plan", legacyInheritance: legacy, now });
assert.equal(fallback, legacy, "Sem evidência permanente confiável, o legado continua como fallback.");

const rejectedBase = mapping.applyMappingDecision(baseFor(["Atos Administrativos"], [historicalEvidence("Atos Administrativos")]), {
  topic: topic("Atos da Administração Pública"), conceptKeys: ["atos administrativos"], confidence: "high", matchBasis: "controlled-alias", relationship: "equivalent", coverage: 1,
}, "reject", "2026-09-12T10:00:00.000Z");
const rejected = diagnosis.derive({ base: rejectedBase, topic: topic("Atos da Administração Pública"), currentPlanId: "current-plan", legacyInheritance: legacy, now });
assert.equal(rejected.mastery.level, "none", "Mapping rejeitado não pode produzir crédito herdado.");

const topicWithAlternative = topic("Tópico X", { topicId: "topic-x", subject: "Direito Administrativo" });
const alternativeBase = baseFor(["Conceito A", "Conceito B"], [
  historicalEvidence("Conceito B", { id: "alternative-b-1", sessionId: "alternative-b-1", questions: 25, correctAnswers: 23 }),
  historicalEvidence("Conceito B", { id: "alternative-b-2", sessionId: "alternative-b-2", questions: 25, correctAnswers: 24 }),
]);
const rejectedA = mapping.applyMappingDecision(alternativeBase, {
  topic: topicWithAlternative, conceptKeys: ["conceito a"], confidence: "high", matchBasis: "controlled-alias", relationship: "equivalent", coverage: 1,
}, "reject", "2026-09-12T10:00:00.000Z");
const confirmedB = mapping.applyMappingDecision(rejectedA, {
  topic: topicWithAlternative, conceptKeys: ["conceito b"], confidence: "high", matchBasis: "controlled-alias", relationship: "equivalent", coverage: 1,
}, "confirm", "2026-09-12T11:00:00.000Z");
assert.equal(diagnosis.mappingWasRejected(confirmedB, topicWithAlternative, ["conceito a"]), true, "A rejeição original deve continuar específica ao conceito A.");
assert.equal(diagnosis.mappingWasRejected(confirmedB, topicWithAlternative, ["conceito b"]), false, "A confirmação do conceito B não deve ser bloqueada pela rejeição de A.");
const alternative = diagnosis.derive({ base: confirmedB, topic: topicWithAlternative, currentPlanId: "current-plan", now });
assert.equal(alternative.mastery.level, "strong", "A confirmação posterior do conceito B deve produzir herança normalmente.");

const deterministicInput = { base: strongBase, topic: exactTopic, currentPlanId: "current-plan", now };
const strongBaseBeforeDerivation = structuredClone(strongBase);
assert.deepEqual(diagnosis.derive(deterministicInput), diagnosis.derive(deterministicInput), "A derivação deve ser determinística.");
assert.deepEqual(strongBase, strongBaseBeforeDerivation, "A derivação não pode mutar a Base Permanente.");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const index = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
assert.ok(app.includes("legacyHistoryInheritanceForTarget") && app.includes("KnowledgeDiagnosis?.derive"), "O canal existente deve usar a Base Permanente antes do fallback legado.");
assert.ok(app.includes("knowledgeBaseStructureSignature(knowledgeBaseState)"), "O cache do diagnóstico deve considerar alterações da Base Permanente.");
assert.ok(index.includes("knowledge-diagnosis.js"), "O módulo de contexto herdado deve ser carregado no aplicativo.");

console.log("OK - Base Permanente alimenta o contexto do diagnóstico sem misturar evidência atual ou duplicar histórico.");
