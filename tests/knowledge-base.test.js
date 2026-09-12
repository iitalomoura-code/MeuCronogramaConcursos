"use strict";

const assert = require("assert");
const knowledge = require("../js/knowledge-base.js");

function source(id, name, blocks) {
  return { id, name, snapshot: { completedHistory: blocks } };
}

const planOne = source("plan-a", "TCE-PE", [
  {
    materia: "Administração Geral",
    assunto: "Atos Administrativos: requisitos e atributos",
    metaTitulo: "Atos Administrativos",
    questoes: 10,
    acertos: 8,
    tempoEstudado: 1.5,
    sessaoId: "session-1",
    completedAt: "21/07/2026",
    status: "Concluído",
  },
]);

const planTwo = source("plan-b", "TCE-PB", [
  {
    materia: "Direito Administrativo",
    assunto: "Atos Administrativos",
    questoes: 20,
    acertos: 16,
    durationMinutes: 45,
    sessionId: "session-2",
    completedAt: "2026-08-02T12:00:00.000Z",
    status: "Concluído",
  },
]);

const original = JSON.stringify([planOne, planTwo]);
const base = knowledge.buildKnowledgeBase({}, [planOne, planTwo]);

assert.equal(base.schemaVersion, 2);
assert.equal(base.concepts.length, 1, "Mesmo título canônico em matérias diferentes deve formar um conceito único.");
assert.equal(base.concepts[0].domain, "", "A matéria do edital não pode virar domínio conceitual permanente.");
assert.equal(base.evidence.length, 2, "Sessões de planos diferentes são evidências distintas.");
assert.equal(base.evidence[0].originalSubject, "Administração Geral", "A matéria original deve permanecer apenas como origem da evidência.");
assert.equal(base.topicMappings.length, 2, "O mapeamento mínimo por plano deve permanecer auditável.");
assert.equal(base.evidence[0].completedAt, "21/07/2026", "A data original não pode ser trocada pela data do bootstrap.");
assert.equal(base.evidence[0].studiedMinutes, 90);
assert.equal(base.evidence[1].studiedMinutes, 45);
assert.equal(JSON.stringify([planOne, planTwo]), original, "O bootstrap não pode mutar snapshots dos planos.");

const summary = knowledge.summarizeConceptEvidence(base, "Atos Administrativos");
assert.equal(summary.questions, 30);
assert.equal(summary.correctAnswers, 24);
assert.equal(summary.studiedMinutes, 135);
assert.equal(summary.sourcePlanCount, 2);
assert.equal(summary.accuracy, .8);

const duplicateAcrossCollections = source("plan-c", "Duplicado", [
  {
    materia: "Português",
    assunto: "Pontuação",
    questoes: 12,
    acertos: 14,
    tempoEstudado: "1h 15min",
    sessaoId: "same-session",
    completedAt: "2026-08-03",
    status: "Concluído",
  },
  {
    materia: "Português",
    assunto: "Pontuação",
    questoes: 12,
    acertos: 14,
    tempoEstudado: "1h 15min",
    sessaoId: "same-session",
    completedAt: "2026-08-03",
    status: "Concluído",
  },
]);
const clamped = knowledge.buildKnowledgeBase({}, [duplicateAcrossCollections]);
assert.equal(clamped.evidence.length, 1, "Uma sessão repetida não pode duplicar evidência.");
assert.equal(clamped.evidence[0].correctAnswers, 12, "Acertos inconsistentes devem respeitar o limite de questões.");
assert.equal(clamped.evidence[0].studiedMinutes, 75);
assert.equal(clamped.warnings.length, 1);

const noSessionId = knowledge.evidenceFromStudyEntry({
  materia: "Contabilidade", assunto: "Lançamentos", questoes: 8, acertos: 6, tempoEstudado: 1, completedAt: "2026-08-04",
}, { sourcePlanId: "plan-d" });
assert.ok(noSessionId.id.startsWith("fallback:plan-d:"), "Registros legados usam assinatura estrutural conservadora.");
assert.equal(knowledge.dedupeEvidence([noSessionId, { ...noSessionId }]).length, 1);

const plannedOnly = { id: "planned", name: "Planejado", snapshot: { generatedBlocks: [{ materia: "Direito Constitucional", assunto: "Direitos Fundamentais", status: "Não iniciado" }] } };
assert.equal(knowledge.buildKnowledgeBase({}, [plannedOnly]).evidence.length, 0, "Bloco apenas planejado não é conhecimento adquirido.");

const once = knowledge.buildKnowledgeBase({}, [planOne, planTwo]);
const twice = knowledge.buildKnowledgeBase(once, [planOne, planTwo]);
assert.equal(twice.evidence.length, once.evidence.length, "Bootstrap incremental deve ser idempotente.");
assert.equal(twice.concepts.length, once.concepts.length);

const incremental = knowledge.buildKnowledgeBase(once, [source("plan-a", "TCE-PE", [{
  materia: "Administração Geral", assunto: "Atos Administrativos", questoes: 5, acertos: 4, tempoEstudado: .5, sessaoId: "session-3", completedAt: "2026-08-05", status: "Concluído",
}])]);
assert.equal(incremental.evidence.length, 3, "Uma nova sessão deve entrar sem reimportar as anteriores.");

const inspection = knowledge.inspectKnowledgeBase(base);
assert.deepEqual(inspection, { schemaVersion: 2, concepts: 1, evidence: 2, mappings: 2, sourcePlans: 2, warnings: 0 });
const conceptInspection = knowledge.inspectConcept(base, "Atos Administrativos");
assert.equal(conceptInspection.evidence.length, 2);
assert.equal(conceptInspection.mappings.length, 2);

[
  [.75, 45],
  [1.5, 90],
  [45, 45],
  [90, 90],
  ["1h 15min", 75],
  ["00:45", 45],
  ["01:30", 90],
].forEach(([tempoEstudado, expected]) => {
  const evidence = knowledge.evidenceFromStudyEntry({ materia: "Português", assunto: "Interpretação", tempoEstudado }, { sourcePlanId: "legacy-time" });
  assert.equal(evidence.studiedMinutes, expected, `Tempo legado ${tempoEstudado} deve virar ${expected} minutos.`);
});

const correctionInitial = source("correction-plan", "Correção", [{
  materia: "Contabilidade", assunto: "Lançamentos", questoes: 20, acertos: 15, tempoEstudado: 1, sessaoId: "session-correction", completedAt: "2026-08-01", status: "Concluído",
}]);
correctionInitial.snapshot.savedAt = "2026-08-01T10:00:00.000Z";
const correctionUpdated = source("correction-plan", "Correção", [{
  materia: "Contabilidade", assunto: "Lançamentos", questoes: 25, acertos: 20, tempoEstudado: 1.25, sessaoId: "session-correction", completedAt: "2026-08-01", status: "Concluído",
}]);
correctionUpdated.snapshot.savedAt = "2026-08-02T10:00:00.000Z";
const corrected = knowledge.buildKnowledgeBase(knowledge.buildKnowledgeBase({}, [correctionInitial]), [correctionUpdated]);
assert.equal(corrected.evidence.length, 1, "Uma sessão corrigida continua sendo uma única evidência.");
assert.deepEqual([corrected.evidence[0].questions, corrected.evidence[0].correctAnswers, corrected.evidence[0].studiedMinutes], [25, 20, 75]);

const unorderedDates = knowledge.buildKnowledgeBase({}, [source("date-plan", "Datas", [
  { materia: "Português", assunto: "Sintaxe", questoes: 1, acertos: 1, sessaoId: "date-1", completedAt: "10/08/2026", status: "Concluído" },
  { materia: "Português", assunto: "Sintaxe", questoes: 1, acertos: 1, sessaoId: "date-2", completedAt: "01/07/2026", status: "Concluído" },
  { materia: "Português", assunto: "Sintaxe", questoes: 1, acertos: 1, sessaoId: "date-3", completedAt: "20/07/2026", status: "Concluído" },
])]);
const dateSummary = knowledge.summarizeConceptEvidence(unorderedDates, "Sintaxe");
assert.equal(dateSummary.firstCompletedAt, "01/07/2026");
assert.equal(dateSummary.lastCompletedAt, "10/08/2026");

const legacyBrokenBase = {
  schemaVersion: 1,
  evidence: [{
    id: "session:plan-a:s1", sessionId: "s1", sourcePlanId: "plan-a", sourcePlanName: "Plano A",
    originalSubject: "Informática", originalTopic: "Arquivos eletrônicos", canonicalKey: "arquivos eletronicos", canonicalTitle: "Arquivos eletrônicos",
    studiedMinutes: 2700, questions: 24, correctAnswers: 21, completedAt: "2026-09-01", activityType: "Estudo", createdAt: "2026-09-01",
  }],
};
const repairedSource = source("plan-a", "Plano A", [{
  materia: "Informática", assunto: "Arquivos eletrônicos", questoes: 24, acertos: 21, tempoEstudado: 45, sessaoId: "s1", completedAt: "2026-09-01", status: "Concluído",
}]);
repairedSource.snapshot.savedAt = "2026-09-11T12:00:00.000Z";
const repaired = knowledge.buildKnowledgeBase(legacyBrokenBase, [repairedSource]);
assert.equal(repaired.evidence.length, 1);
assert.equal(repaired.evidence[0].studiedMinutes, 45, "O snapshot atual deve reparar 2700 minutos legados para 45.");
assert.equal(repaired.evidence[0].legacyTimeOutlier, false);
assert.equal(knowledge.buildKnowledgeBase(repaired, [repairedSource]).evidence[0].studiedMinutes, 45, "A reparação precisa ser idempotente.");

const lowerCorrectionBase = {
  schemaVersion: 1,
  evidence: [{
    id: "session:plan-b:s2", sessionId: "s2", sourcePlanId: "plan-b", canonicalKey: "balanco patrimonial", canonicalTitle: "Balanço patrimonial",
    studiedMinutes: 60, questions: 25, correctAnswers: 22, completedAt: "2026-09-01", observedAt: "2026-09-01T10:00:00.000Z",
  }],
};
const lowerCorrectionSource = source("plan-b", "Plano B", [{
  materia: "Contabilidade", assunto: "Balanço patrimonial", questoes: 20, acertos: 18, tempoEstudado: 1, sessaoId: "s2", completedAt: "2026-09-01", status: "Concluído",
}]);
lowerCorrectionSource.snapshot.savedAt = "2026-09-12T10:00:00.000Z";
const lowerCorrected = knowledge.buildKnowledgeBase(lowerCorrectionBase, [lowerCorrectionSource]);
assert.equal(lowerCorrected.evidence.length, 1);
assert.deepEqual([lowerCorrected.evidence[0].questions, lowerCorrected.evidence[0].correctAnswers], [20, 18], "Uma correção recente pode reduzir questões e acertos.");

const liveContext = {
  sourcePlanId: "current-plan",
  sourcePlanName: "Plano atual",
  sessionId: "live-1",
  topicId: "topic-lancamentos",
  studiedMinutes: 45,
  questions: 20,
  correctAnswers: 16,
  completedAt: "2026-09-12T14:00:00.000Z",
  observedAt: "2026-09-12T14:00:00.000Z",
  now: "2026-09-12T14:00:00.000Z",
};
const liveSession = { materia: "Contabilidade", titulo: "Lançamentos", tipoAtividade: "Questões", dificuldade: "Média" };
const liveBase = knowledge.ingestStudySession({}, liveSession, liveContext);
assert.equal(liveBase.evidence.length, 1, "Sessão factual deve alimentar a base uma única vez.");
assert.deepEqual(
  [liveBase.evidence[0].originalSubject, liveBase.evidence[0].originalTopic, liveBase.evidence[0].questions, liveBase.evidence[0].correctAnswers, liveBase.evidence[0].studiedMinutes],
  ["Contabilidade", "Lançamentos", 20, 16, 45],
);
assert.equal(liveBase.evidence[0].activityType, "Questões");

const liveUpdated = knowledge.ingestStudySession(liveBase, liveSession, { ...liveContext, questions: 8, correctAnswers: 6, studiedMinutes: 15, now: "2026-09-12T15:00:00.000Z", observedAt: "2026-09-12T15:00:00.000Z" });
assert.equal(liveUpdated.evidence.length, 1, "Salvar a mesma sessão novamente deve fazer upsert.");
assert.deepEqual([liveUpdated.evidence[0].questions, liveUpdated.evidence[0].correctAnswers, liveUpdated.evidence[0].studiedMinutes], [8, 6, 15]);
const secondLive = knowledge.ingestStudySession(liveUpdated, liveSession, { ...liveContext, sessionId: "live-2" });
assert.equal(secondLive.evidence.length, 2, "Sessões diferentes devem gerar evidências diferentes.");

const liveReview = knowledge.ingestStudySession(secondLive, { ...liveSession, assunto: "Lançamentos", tipoAtividade: "Revisão" }, { ...liveContext, sessionId: "review-1", sourceType: "live-review-session", questions: 10, correctAnswers: 9, studiedMinutes: 30 });
assert.equal(liveReview.evidence.filter((item) => item.sessionId === "review-1")[0].activityType, "Revisão");
assert.equal(liveReview.evidence.length, 3);

const timeOnly = knowledge.ingestStudySession({}, { materia: "Contabilidade", assunto: "Tempo", studiedMinutes: 25 }, { ...liveContext, sessionId: "time-only", questions: 0, correctAnswers: 0 });
const questionsOnly = knowledge.ingestStudySession({}, { materia: "Contabilidade", assunto: "Questões", questions: 12, correctAnswers: 9 }, { ...liveContext, sessionId: "questions-only", studiedMinutes: 0 });
const emptySession = knowledge.ingestStudySession({}, { materia: "Contabilidade", assunto: "Vazio" }, { ...liveContext, sessionId: "empty", questions: 0, correctAnswers: 0, studiedMinutes: 0 });
assert.equal(timeOnly.evidence.length, 1, "Tempo sem questões é uma evidência factual válida.");
assert.equal(questionsOnly.evidence.length, 1, "Questões sem tempo são uma evidência factual válida.");
assert.equal(emptySession.evidence.length, 0, "Sessão sem tempo e sem questões não deve alimentar a base.");

const mappedSeed = knowledge.buildKnowledgeBase({}, [source("old-plan", "Histórico", [{ materia: "Direito", assunto: "Atos Administrativos", questoes: 20, acertos: 18, tempoEstudado: 1, sessaoId: "old-1", completedAt: "2026-08-01" }])]);
const equivalentLive = knowledge.ingestStudySession(mappedSeed, { materia: "Administração", assunto: "Atos Administrativos", questoes: 10, acertos: 8 }, { ...liveContext, sourcePlanId: "another-plan", sessionId: "equivalent-1", studiedMinutes: 20, questions: 10, correctAnswers: 8 });
assert.equal(equivalentLive.evidence.find((item) => item.sessionId === "equivalent-1").canonicalKey, "atos administrativos", "Equivalência simples pode enriquecer o conceito canônico.");
const partial = knowledge.ingestStudySession(mappedSeed, { materia: "Administração", assunto: "Atos e poderes", questoes: 5, acertos: 3 }, { ...liveContext, sessionId: "partial-1", questions: 5, correctAnswers: 3, studiedMinutes: 10, mapping: { status: "suggested", conceptKeys: ["atos administrativos"], relationship: "partial" } });
assert.equal(partial.evidence.find((item) => item.sessionId === "partial-1").canonicalKey, "atos e poderes");
const composite = knowledge.ingestStudySession(mappedSeed, { materia: "Administração", assunto: "Atos e poderes", questoes: 5, acertos: 3 }, { ...liveContext, sessionId: "composite-1", questions: 5, correctAnswers: 3, studiedMinutes: 10, mapping: { status: "suggested", conceptKeys: ["atos administrativos", "poderes administrativos"], relationship: "composite" } });
assert.equal(composite.evidence.filter((item) => item.sessionId === "composite-1").length, 1);
assert.equal(composite.evidence.find((item) => item.sessionId === "composite-1").canonicalKey, "atos e poderes");

const noMutationBase = JSON.stringify(mappedSeed);
knowledge.ingestStudySession(mappedSeed, { materia: "Direito", assunto: "Novo", questions: 2, correctAnswers: 1, studiedMinutes: 5 }, { ...liveContext, sessionId: "immutable-1" });
assert.equal(JSON.stringify(mappedSeed), noMutationBase, "A ingestão deve ser não mutante.");
const deterministicBase = knowledge.emptyKnowledgeBase("2026-09-12T00:00:00.000Z");
const deterministicOne = knowledge.ingestStudySession(deterministicBase, liveSession, liveContext);
const deterministicTwo = knowledge.ingestStudySession(deterministicBase, liveSession, liveContext);
assert.deepEqual(deterministicOne, deterministicTwo, "Timestamp explícito torna a operação determinística.");

const currentPlanDiagnosis = require("../js/knowledge-diagnosis.js");
const currentOnly = knowledge.ingestStudySession({}, liveSession, { ...liveContext, sessionId: "current-only" });
const currentDiagnosis = currentPlanDiagnosis.derive({ base: currentOnly, topic: { planId: "current-plan", topicId: "topic-lancamentos", materia: "Contabilidade", assunto: "Lançamentos", titulo: "Lançamentos" }, currentPlanId: "current-plan", now: Date.parse("2026-09-12T16:00:00.000Z") });
assert.equal(currentDiagnosis.evidence.questions, 0, "Evidência do plano atual não pode virar herança no diagnóstico inicial.");
assert.equal(currentDiagnosis.mastery.level, "none");

console.log("OK - base permanente consolida evidências executadas, preserva origem e suporta bootstrap incremental.");
