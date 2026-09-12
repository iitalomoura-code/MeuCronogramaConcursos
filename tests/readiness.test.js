"use strict";

const assert = require("node:assert/strict");
const Readiness = require("../js/readiness.js");

const now = "2026-09-12T12:00:00.000Z";

assert.equal(Readiness.numberOrNull(null), null);
assert.equal(Readiness.numberOrNull(undefined), null);
assert.equal(Readiness.numberOrNull(""), null);
assert.equal(Readiness.numberOrNull("   "), null);
assert.equal(Readiness.numberOrNull(0), 0);
assert.equal(Readiness.numberOrNull("0"), 0);

function topic({ subject = "Direito", topic = "Tema", level = "strong", confidence = "high", confidenceValue = .82, evidenceStage = "confirmed", questions = 60, sessions = 4, learningState = "practice", maintenanceDue = false, importance = null, rank = null, recurrence = "low", inheritedKnowledge = null, recoveryEvidence = false } = {}) {
  return {
    subject,
    topic,
    diagnosis: { level, confidence: confidenceValue, confidenceLevel: confidence, evidenceStage, learningState, recoveryEvidence },
    confidence: { value: confidenceValue, level: confidence, evidenceStage },
    currentEvidence: { questions, sessions, accuracy: questions ? .85 : null },
    learningState,
    maintenanceDue,
    importance: importance === null ? undefined : { score: importance },
    strategic: { rank, learningState },
    errors: { recurrence: recurrence },
    inheritedKnowledge: inheritedKnowledge || { available: false, level: "none" },
  };
}

assert.equal(Readiness.evaluateTopic(topic({ questions: 5, sessions: 1, confidence: "low", confidenceValue: .12, evidenceStage: "early", level: "strong" }), { now }).state, "unknown");
assert.equal(Readiness.evaluateTopic(topic({ level: "deficiency", confidence: "high", confidenceValue: .86 }), { now }).state, "not-ready");
assert.equal(Readiness.evaluateTopic(topic({ level: "strong", confidence: "high", confidenceValue: .86 }), { now }).state, "ready");
assert.equal(Readiness.evaluateTopic(topic({ level: "strong", confidence: "high", confidenceValue: .86, learningState: "maintenance", maintenanceDue: true }), { now }).state, "ready-maintenance");
assert.equal(Readiness.evaluateTopic(topic({ level: "strong", confidence: "low", confidenceValue: .18, evidenceStage: "early", questions: 3, sessions: 1, inheritedKnowledge: { available: true, level: "strong", confidence: .9, accuracy: .9 } }), { now }).state, "unknown");
assert.equal(Readiness.evaluateTopic(topic({ level: "deficiency", confidence: "high", confidenceValue: .86, learningState: "recovery", recoveryEvidence: true }), { now }).state, "not-ready");
assert.equal(Readiness.evaluateTopic(topic({ level: "adequate", confidence: "medium", confidenceValue: .55, evidenceStage: "developing" }), { now }).state, "developing");

const blockerTopics = [
  topic({ topic: "CPC 00", importance: .95 }),
  topic({ topic: "Balanço", importance: .2 }),
  topic({ topic: "DFC", level: "deficiency", confidence: "high", confidenceValue: .86, importance: .9 }),
  topic({ topic: "DVA", level: "adequate", confidence: "medium", confidenceValue: .55, evidenceStage: "developing", importance: .2 }),
  topic({ topic: "Custos", importance: .2 }),
];
const blockerSubject = Readiness.evaluateSubject({ name: "Direito", topicCount: 5, examWeight: 4 }, blockerTopics, { now });
assert.notEqual(blockerSubject.state, "ready");
assert.equal(blockerSubject.blockingTopics.length, 1);
assert.equal(blockerSubject.blockingTopics[0].topic, "DFC");
assert.equal(blockerSubject.blockingTopics[0].severity, "major");

const unknownTopics = Array.from({ length: 10 }, (_, index) => topic({ topic: `Tema ${index + 1}`, questions: index < 2 ? 60 : 0, sessions: index < 2 ? 4 : 0, confidence: index < 2 ? "high" : "low", confidenceValue: index < 2 ? .86 : 0, evidenceStage: index < 2 ? "confirmed" : "unknown" }));
const unknownSubject = Readiness.evaluateSubject({ name: "Direito", topicCount: 10 }, unknownTopics, { now });
assert.equal(unknownSubject.topicDistribution.ready, 2);
assert.equal(unknownSubject.topicDistribution.unknown, 8);
assert.equal(unknownSubject.state, "insufficient-data");
assert.equal(unknownSubject.confidence, "low");

const allReadySubject = Readiness.evaluateSubject({ name: "Direito", topicCount: 2, examWeight: 5 }, [topic({ topic: "A" }), topic({ topic: "B" })], { now });
assert.equal(allReadySubject.state, "ready");
assert.equal(allReadySubject.topicDistribution.ready, 2);

const halfDiagnosedExam = Readiness.evaluateExam({
  now,
  subjects: [{ name: "Direito", topicCount: 2, examWeight: 5 }],
  topics: [topic({ subject: "Direito", topic: "A" })],
});
assert.equal(halfDiagnosedExam.diagnosticCoverage, .5);
assert.equal(halfDiagnosedExam.state, "developing");
assert.notEqual(halfDiagnosedExam.state, "competitive", "Metade do edital sem diagnóstico não pode ser competitive.");

const competitiveExam = Readiness.evaluateExam({
  now,
  subjects: [
    { name: "Direito", topicCount: 2, examWeight: 5 },
    { name: "Português", topicCount: 2, examWeight: 5 },
  ],
  topics: [
    topic({ subject: "Direito", topic: "A" }),
    topic({ subject: "Direito", topic: "B" }),
    topic({ subject: "Português", topic: "A", confidence: "medium", confidenceValue: .55, evidenceStage: "developing", level: "adequate" }),
    topic({ subject: "Português", topic: "B", confidence: "medium", confidenceValue: .55, evidenceStage: "developing", level: "adequate" }),
  ],
});
assert.equal(competitiveExam.diagnosticCoverage, 1);
assert.ok(competitiveExam.highConfidenceCoverage >= .35);
assert.equal(competitiveExam.state, "competitive");

const wellPreparedExam = Readiness.evaluateExam({
  now,
  subjects: [
    { name: "Direito", topicCount: 2, examWeight: 5 },
    { name: "Português", topicCount: 2, examWeight: 5 },
  ],
  topics: [
    topic({ subject: "Direito", topic: "A" }),
    topic({ subject: "Direito", topic: "B" }),
    topic({ subject: "Português", topic: "A" }),
    topic({ subject: "Português", topic: "B" }),
  ],
});
assert.equal(wellPreparedExam.state, "well-prepared");

const exam = Readiness.evaluateExam({
  now,
  subjects: [
    { name: "Português", topicCount: 1, examWeight: 5 },
    { name: "Contabilidade", topicCount: 1, examWeight: 5 },
  ],
  topics: [
    topic({ subject: "Português", topic: "Interpretação", level: "strong", confidence: "high", confidenceValue: .9, importance: .95 }),
    topic({ subject: "Contabilidade", topic: "DFC", level: "deficiency", confidence: "high", confidenceValue: .9, importance: .95 }),
  ],
});
assert.equal(exam.subjectDistribution.wellPrepared, 1);
assert.equal(exam.subjectDistribution.notReady, 1);
assert.equal(exam.state, "fragile");
assert.equal(exam.majorRisks[0].topic, "DFC");
assert.ok(exam.diagnosticCoverage > 0);
assert.ok(exam.highConfidenceCoverage > 0);

const input = topic({ inheritedKnowledge: { available: true, level: "strong", confidence: .9, accuracy: .9 } });
const before = JSON.stringify(input);
const deterministicInput = { subjects: [{ name: "Direito", topicCount: 1 }], topics: [input], now };
assert.deepEqual(Readiness.evaluateExam(deterministicInput), Readiness.evaluateExam(deterministicInput), "A mesma entrada e o mesmo now devem produzir resultado idêntico.");
Readiness.evaluateExam(deterministicInput);
assert.equal(JSON.stringify(input), before, "Readiness deve ser read-only.");

console.log("OK - readiness determinístico distingue incerteza, preparação, manutenção e blockers sem prever aprovação.");
