"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const Memory = require("../js/ai-coach-memory.js");
require("../js/ai-coach-checkpoint.js");

const snapshot = {
  generatedAt: "2026-09-12T12:00:00.000Z",
  aiReadContractVersion: 1,
  signature: { value: "snapshot-1" },
  weeklyCycle: { id: "cycle-1", startedAt: "2026-09-08T00:00:00.000Z", endsAt: "2026-09-15T00:00:00.000Z", plannedMinutes: 600 },
  subjects: [],
  topics: [{ subject: "Português", topic: "Sintaxe", currentEvidence: { questions: 10, correctAnswers: 8, sessions: 2, studiedMinutes: 45 }, strategic: { rank: 1, score: .8, learningState: { key: "practice" } } }],
};
const response = { review: { periodDiagnosis: { summary: "Resumo", confidence: "medium" }, priorities: [] }, meta: { snapshotSignature: "snapshot-1", contractVersion: 1, generatedAt: snapshot.generatedAt, model: "gpt-test" } };
const previous = { id: "review-previous", mode: "progress-check", review_json: response.review, checkpoint_json: { snapshotSignature: "old", generatedAt: "2026-09-10T00:00:00.000Z" } };
const previousCycle = { id: "review-cycle", mode: "cycle-review", review_json: response.review, checkpoint_json: { snapshotSignature: "cycle-old", generatedAt: "2026-09-01T00:00:00.000Z" } };
const payload = Memory.buildPersistencePayload({ response, snapshot, mode: "question", question: "Como estou evoluindo?", previousReview: previous, previousCycleReview: previousCycle });

assert.equal(payload.user_id, null, "o payload puro não deve inventar ou aceitar user_id do frontend");
assert.equal(payload.mode, "question");
assert.equal(payload.question, "Como estou evoluindo?");
assert.equal(payload.snapshot_signature, "snapshot-1");
assert.equal(payload.previous_review_id, "review-previous");
assert.equal(payload.previous_cycle_review_id, "review-cycle");
assert.equal(payload.cycle_id, "cycle-1");
assert.equal(payload.checkpoint_json.snapshotSignature, "snapshot-1");
assert.equal(Memory.compactCoachReviewForContext({ review_json: { priorities: Array.from({ length: 8 }, (_, i) => i), facts: [1, 2, 3] } }).priorities.length, 3);

test("persiste review com usuário autenticado e não expõe credenciais", async () => {
  let inserted;
  const chain = {
    insert(value) { inserted = value; return this; },
    select() { return this; },
    single: async () => ({ data: { id: "review-new", ...inserted }, error: null }),
  };
  const originalClient = global.supabaseClient;
  global.supabaseClient = {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) },
    from: (table) => { assert.equal(table, "ai_coach_reviews"); return chain; },
  };
  try {
    const saved = await Memory.saveReview({ response, snapshot, mode: "progress-check", previousReview: previous });
    assert.equal(inserted.user_id, "user-1");
    assert.equal(saved.user_id, "user-1");
    assert.equal(inserted.review_json, response.review);
  } finally {
    global.supabaseClient = originalClient;
  }
});

console.log("OK - memória do AI Coach deriva checkpoint, preserva links e insere usando somente o usuário autenticado.");
