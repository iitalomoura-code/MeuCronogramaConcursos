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

assert.equal(base.schemaVersion, 1);
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
assert.deepEqual(inspection, { schemaVersion: 1, concepts: 1, evidence: 2, mappings: 2, sourcePlans: 2, warnings: 0 });
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

console.log("OK - base permanente consolida evidências executadas, preserva origem e suporta bootstrap incremental.");
