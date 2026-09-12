"use strict";

const assert = require("node:assert/strict");
const snapshotEngine = require("../js/ai-strategic-snapshot.js");

const now = "2026-09-12T12:00:00.000Z";
const currentTopics = [
  {
    subject: "Português",
    topic: "Interpretação de textos",
    diagnosis: { level: "deficiency", needsDiagnostic: false, trend: { label: "stable" }, reasons: ["desempenho recente: 58%"] },
    currentEvidence: {
      entries: [
        { questions: 10, correctAnswers: 6, studiedMinutes: 30, completedAt: "2026-08-20T12:00:00.000Z" },
        { questions: 10, correctAnswers: 6, studiedMinutes: 30, completedAt: "2026-08-25T12:00:00.000Z" },
        { questions: 10, correctAnswers: 6, studiedMinutes: 30, completedAt: "2026-09-01T12:00:00.000Z" },
        { questions: 10, correctAnswers: 5, studiedMinutes: 30, completedAt: "2026-09-10T12:00:00.000Z" },
      ],
      interventions: [{ kind: "targeted-reinforcement", result: "unchanged", createdAt: "2026-09-01T12:00:00.000Z" }],
    },
    inheritedKnowledge: { available: true, knowledgeBase: true, level: "strong", confidence: .81, accuracy: .89, questions: 52, sessions: 4, lastContact: "2026-06-01T12:00:00.000Z", freshness: "stale", coverage: 1, relationship: "equivalent", mapping: { status: "auto-confirmed" } },
    selfAssessment: { level: "advanced" },
    strategic: { score: .82, band: "high", rank: 2, recommendedSession: { label: "Reforço direcionado" }, learningState: { key: "consolidating", label: "Consolidação" }, reasons: ["erros recorrentes"] },
    errorSignals: { recentErrors: 17, recurrence: "high", concentration: .45, types: ["Confusão conceitual"] },
    coverage: 1,
  },
  {
    subject: "Contabilidade",
    topic: "DFC",
    diagnosis: { level: "insufficient", needsDiagnostic: true, trend: { label: "insufficient" } },
    currentEvidence: { questions: 5, correctAnswers: 2, sessions: 1, studiedMinutes: 10 },
    inheritedKnowledge: { available: true, level: "strong", confidence: .88, accuracy: .9, questions: 50, sessions: 4, coverage: 1, relationship: "equivalent", mapping: { status: "suggested" } },
    selfAssessment: { level: "basic" },
    strategic: { score: .61, band: "medium", rank: 4, recommendedSession: "Sessão diagnóstica", learningState: "building", reasons: [] },
    coverage: 1,
  },
  {
    subject: "Controle Externo",
    topic: "Auditoria",
    diagnosis: { level: "strong", trend: { label: "stable" } },
    currentEvidence: { questions: 30, correctAnswers: 26, sessions: 3, studiedMinutes: 90 },
    inheritedKnowledge: { available: false, level: "none", mapping: { status: "unknown" } },
    selfAssessment: { level: "advanced" },
    strategic: { score: .2, band: "very-low", rank: 8, recommendedSession: { label: "Manutenção" }, learningState: { key: "maintenance", label: "Manutenção" }, reasons: [] },
    maintenanceDue: true,
    coverage: 1,
  },
];

const input = {
  now,
  contestName: "Concurso demonstrativo",
  role: "Analista",
  subjects: [
    { name: "Português", peso: 5, dominio: 3, examImportance: { importanceScore: 1, estimatedPercentage: .2 }, topicCount: 1 },
    { name: "Contabilidade", peso: 3, dominio: 2, topicCount: 1 },
    { name: "Controle Externo", peso: 4, dominio: 4, topicCount: 1 },
  ],
  topics: currentTopics,
  weeklyCycle: { weeklyHours: 21, totalCapacityMinutes: 1260, plannedMinutes: 1159, completedMinutes: 720, reserveMinutes: 101 },
  plannedBlocks: [{ materia: "Português", assunto: "Interpretação de textos", tipoAtividade: "Reforço", durationMinutes: 60 }],
  executedBlocks: [{ materia: "Português", assunto: "Interpretação de textos", tipoAtividade: "Reforço", studiedMinutes: 45 }],
  previousCycle: { weeklyHours: 21, totalCapacityMinutes: 1260, plannedMinutes: 1100, completedMinutes: 600, questions: 30, accuracy: .7, coverage: .5, confidence: .4 },
  previousTopics: [{ subject: "Português", topic: "Interpretação de textos", diagnosis: { masteryLevel: "attention", learningState: { key: "consolidating" } }, confidence: { value: .5 }, strategic: { rank: 5 } }],
};
const before = structuredClone(input);
const snapshot = snapshotEngine.buildStrategicSnapshot(input);

assert.deepEqual(input, before, "Construir o snapshot não pode mutar a entrada.");
assert.equal(snapshot.aiReadContractVersion, 1);
assert.deepEqual(snapshot.readiness, {}, "Readiness deve permanecer extensível e sem score inventado.");
assert.equal(snapshot.outputSchema.priorities[0].engineRank, null);
assert.equal(snapshot.outputSchema.priorities[0].aiSuggestedImportance, null);
assert.deepEqual(snapshot.evidenceAuthority.order, ["current factual evidence", "permanent knowledge base", "legacy history fallback", "initial self-assessment"]);
const portuguese = snapshot.topics.find((topic) => topic.subject === "Português");
assert.equal(portuguese.currentEvidence.questions, 40);
assert.equal(portuguese.currentEvidence.accuracy, .575);
assert.equal(portuguese.inheritedKnowledge.accuracy, .89);
assert.equal(portuguese.diagnosis.currentAccuracy, .575);
assert.equal(portuguese.diagnosis.historicalAccuracy, .89);
assert.equal(portuguese.confidence.level, "high");
assert.equal(portuguese.inheritedKnowledge.source, "permanent-knowledge");
assert.equal(portuguese.strategic.score, .82, "O score estratégico deve ser apenas transportado do motor local.");
assert.ok(portuguese.errors.recurrence === "high");
assert.equal(portuguese.maintenanceDue, false);

const accounting = snapshot.topics.find((topic) => topic.subject === "Contabilidade");
assert.equal(accounting.inheritedKnowledge.available, false, "Suggested não pode aparecer como conhecimento confirmado.");
assert.equal(accounting.inheritedKnowledge.source, "none");
assert.equal(accounting.currentEvidence.accuracy, .4);
assert.equal(accounting.confidence.level, "low");
assert.equal(accounting.selfAssessment.level, "basic");

const control = snapshot.topics.find((topic) => topic.subject === "Controle Externo");
assert.ok(Math.abs(control.currentEvidence.accuracy - 26 / 30) < .0001);
assert.equal(control.maintenanceDue, true);
assert.equal(control.diagnosis.masteryLevel, "strong");

const partialSnapshot = snapshotEngine.buildStrategicSnapshot({ now, subjects: [{ name: "Direito", topicCount: 10 }], topics: [{ subject: "Direito", topic: "Tema estudado", diagnosis: { level: "adequate" }, currentEvidence: { questions: 60, sessions: 5 }, inheritedKnowledge: { available: true, knowledgeBase: true, level: "partial", confidence: .7, coverage: .4, relationship: "partial", mapping: { status: "auto-confirmed" } } }] });
assert.equal(partialSnapshot.topics[0].inheritedKnowledge.coverage, .4);
assert.ok(partialSnapshot.subjects[0].diagnosticConfidence < partialSnapshot.topics[0].confidence.value, "A confiança da matéria deve considerar a cobertura dos tópicos.");

assert.equal(snapshot.weeklyCycle.plannedMinutes, 1159);
assert.equal(snapshot.weeklyCycle.executedMinutes, 720);
assert.equal(snapshot.weeklyCycle.remainingPlannedMinutes, 439);
assert.equal(snapshot.weeklyCycle.remainingMeaning, "capacidade planejada ainda não utilizada");
assert.equal(snapshot.weeklyCycle.plannedDistribution[0].minutes, 60);
assert.equal(snapshot.weeklyCycle.executionDistribution[0].minutes, 45);
assert.equal(snapshot.comparison.deltas.questionsDelta, -30);
assert.equal(snapshot.comparison.deltas.studyMinutesDelta, 120);
assert.equal(snapshot.comparison.meaningfulChanges[0].type, "confidence-increased");
assert.ok(!JSON.stringify(snapshot).toLowerCase().includes("dívida"));
assert.equal(JSON.stringify(snapshot).includes("supabase"), false);
assert.equal(JSON.stringify(snapshot).includes("email"), false);
assert.doesNotThrow(() => JSON.stringify(snapshot));

const sameWithUiNoise = snapshotEngine.buildStrategicSnapshot({ ...input, ui: { activeTab: "diagnostico", modalOpen: true }, topics: [...input.topics].reverse() });
assert.equal(sameWithUiNoise.signature.value, snapshot.signature.value, "Mudanças de UI e ordem incidental não alteram a assinatura.");
const newSession = snapshotEngine.buildStrategicSnapshot({ ...input, topics: input.topics.map((topic) => topic.subject === "Português" ? { ...topic, currentEvidence: { ...topic.currentEvidence, entries: [...topic.currentEvidence.entries, { questions: 1, correctAnswers: 1, completedAt: now }] } } : topic) });
assert.notEqual(newSession.signature.value, snapshot.signature.value, "Nova evidência deve alterar a assinatura.");
const mappingChange = snapshotEngine.buildStrategicSnapshot({ ...input, topics: input.topics.map((topic) => topic.subject === "Português" ? { ...topic, inheritedKnowledge: { ...topic.inheritedKnowledge, relationship: "partial", coverage: .6 } } : topic) });
assert.notEqual(mappingChange.signature.value, snapshot.signature.value, "Mudança de correspondência relevante deve alterar a assinatura.");

console.log("OK - AI Strategic Snapshot separa evidências, preserva autoridade local e produz contrato determinístico sem state bruto.");
