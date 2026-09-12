"use strict";

const assert = require("node:assert/strict");
const Checkpoint = require("../js/ai-coach-checkpoint.js");
const Delta = require("../js/ai-coach-delta.js");

function snapshot({ questions, correct, sessions, readiness = "developing", confidence = .4, rank = 8, learningState = "practice" } = {}) {
  return {
    generatedAt: "2026-09-12T12:00:00.000Z",
    signature: { value: `sig-${questions}-${sessions}-${rank}` },
    weeklyCycle: { cycleId: "cycle-2", startedAt: "2026-09-08T00:00:00.000Z", plannedMinutes: 600, executedMinutes: 300 },
    subjects: [{ name: "Português", readiness: { state: readiness }, diagnosticConfidence: confidence }],
    topics: [{
      subject: "Português",
      topic: "Sintaxe",
      readiness: { state: readiness },
      confidence: { value: confidence },
      diagnosis: { learningState: { key: learningState } },
      strategic: { rank, score: .7, learningState: { key: learningState } },
      currentEvidence: { questions, correctAnswers: correct, sessions, studiedMinutes: 60 },
      maintenanceDue: false,
    }],
  };
}

const previous = Checkpoint.fromSnapshot(snapshot({ questions: 100, correct: 70, sessions: 5, readiness: "unknown", confidence: .35, rank: 8, learningState: "practice" }));
const current = snapshot({ questions: 150, correct: 110, sessions: 7, readiness: "developing", confidence: .7, rank: 2, learningState: "maintenance" });
const currentBefore = structuredClone(current);
const result = Delta.compare({ previousCheckpoint: previous, currentSnapshot: current, now: current.generatedAt });

assert.deepEqual(current, currentBefore, "comparar deltas não pode mutar o snapshot atual");
assert.equal(result.newQuestions, 50);
assert.equal(result.newSessions, 2);
assert.equal(result.readinessChanges[0].from, "unknown");
assert.equal(result.readinessChanges[0].to, "developing");
assert.equal(result.confidenceChanges[0].from, .35);
assert.equal(result.confidenceChanges[0].to, .7);
assert.equal(result.priorityChanges[0].fromRank, 8);
assert.equal(result.priorityChanges[0].toRank, 2);
assert.equal(result.learningStateChanges[0].from, "practice");
assert.equal(result.learningStateChanges[0].to, "maintenance");
assert.equal(Delta.compare({ previousCheckpoint: null, currentSnapshot: current }), null);
assert.deepEqual(result, Delta.compare({ previousCheckpoint: previous, currentSnapshot: current, now: current.generatedAt }), "mesma entrada e now devem ser determinísticos");

const unknown = Checkpoint.fromSnapshot(snapshot({ questions: null, correct: null, sessions: null }));
assert.equal(unknown.totals.questions, 0);
assert.equal(unknown.topics[0].accuracy, null);
assert.equal(Delta.compare({ previousCheckpoint: { generatedAt: "2026-09-01T00:00:00.000Z", totals: { questions: null, sessions: null, correct: null, studyMinutes: null }, subjects: [], topics: [] }, currentSnapshot: unknown }).newQuestions, null);

console.log("OK - checkpoint factual e delta do AI Coach são determinísticos, não inventam execução e preservam a entrada.");
