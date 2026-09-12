"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const target = require("../js/ai-coach-cycle-target.js");
const Memory = require("../js/ai-coach-memory.js");
const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");

const cycle = (id, closedAt) => ({ weeklyStudyCycle: { id, status: "closed", closedAt }, generatedBlocks: [] });
const latest = cycle("cycle-2", "2026-09-12T00:00:00.000Z");
const older = cycle("cycle-1", "2026-09-05T00:00:00.000Z");

assert.equal(target.getReviewableCycle({ cycleHistory: [], reviews: [] }), null);
assert.equal(target.hasReviewFor(null, [{ mode: "cycle-review", cycle_id: "cycle-1" }]), false);
const selected = target.getReviewableCycle({ cycleHistory: [older, latest], reviews: [] });
assert.equal(selected.cycleId, "cycle-2");
assert.equal(selected.cycleReferenceAt, "2026-09-12T00:00:00.000Z");
assert.equal(selected.previousRecord, older);

const reviewedLatest = target.getReviewableCycle({
  cycleHistory: [older, latest],
  reviews: [{ mode: "cycle-review", cycle_id: "cycle-2", cycle_reference_at: latest.weeklyStudyCycle.closedAt }],
});
assert.equal(reviewedLatest, null, "um ciclo antigo sem review nao deve habilitar uma analise que o snapshot atual nao representa");

const targetSnapshot = {
  aiReadContractVersion: 1,
  generatedAt: "2026-09-13T00:00:00.000Z",
  signature: { value: "snapshot-cycle-2" },
  comparison: { previousCycle: { cycleId: "cycle-2", closedAt: "2026-09-12T00:00:00.000Z" } },
  weeklyCycle: {},
  topics: [],
  subjects: [],
};
assert.equal(target.matchesSnapshot(selected, targetSnapshot), true);
assert.equal(target.matchesSnapshot(selected, { comparison: { previousCycle: { cycleId: "cycle-1", closedAt: older.weeklyStudyCycle.closedAt } } }), false);

const payload = Memory.buildPersistencePayload({
  response: { meta: { snapshotSignature: "snapshot-cycle-2", contractVersion: 1 }, review: {} },
  snapshot: targetSnapshot,
  mode: "cycle-review",
});
assert.equal(payload.cycle_id, "cycle-2");
assert.equal(payload.cycle_reference_at, "2026-09-12T00:00:00.000Z");
assert.ok(index.includes("ai-coach-cycle-target.js"));
assert.ok(app.includes("function getAICoachReviewableCycle"));
assert.ok(app.includes("const cycleTarget = mode === \"cycle-review\" ? getAICoachReviewableCycle() : null;"));
assert.ok(app.includes("matchesSnapshot?.(cycleTarget, snapshot)"));
assert.ok(app.includes("hasReviewFor?.(cycleTarget.previousRecord, [record])"));

console.log("OK - ciclo alvo do AI Coach e unico, representavel pelo snapshot e persistido com a mesma referencia.");
