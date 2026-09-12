"use strict";

(function initAICoachCycleTarget(global) {
  const text = (value = "") => String(value ?? "").trim();

  function dateIso(value) {
    const date = new Date(value || "");
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function cycleFor(record = {}) {
    return record?.weeklyStudyCycle || {};
  }

  function cycleIdFor(record = {}) {
    const cycle = cycleFor(record);
    return text(cycle.id || cycle.cycleId || record?.cycleId) || null;
  }

  function referenceAtFor(record = {}) {
    const cycle = cycleFor(record);
    return dateIso(cycle.closedAt || cycle.finalizedAt || record?.closedAt || record?.finalizedAt || cycle.endsAt || record?.savedAt);
  }

  function isClosed(record = {}) {
    const cycle = cycleFor(record);
    return Boolean(cycle.closedAt || cycle.finalizedAt || cycle.status === "closed" || record?.closedAt || record?.finalizedAt);
  }

  function hasReviewFor(record = {}, reviews = []) {
    const cycleId = cycleIdFor(record);
    const referenceAt = referenceAtFor(record);
    return (Array.isArray(reviews) ? reviews : []).some((review) => {
      if (review?.mode !== "cycle-review") return false;
      if (cycleId) return text(review.cycle_id) === cycleId;
      return Boolean(referenceAt && dateIso(review.cycle_reference_at) === referenceAt);
    });
  }

  function getReviewableCycle({ cycleHistory = [], reviews = [] } = {}) {
    const closed = (Array.isArray(cycleHistory) ? cycleHistory : [])
      .map((record, index) => ({ record, index, cycle: cycleFor(record), referenceAt: referenceAtFor(record) }))
      .filter((entry) => isClosed(entry.record) && entry.record?.weeklyStudyCycle && entry.referenceAt)
      .sort((a, b) => (new Date(a.referenceAt).getTime() - new Date(b.referenceAt).getTime()) || a.index - b.index);
    if (!closed.length) return null;

    const latestClosed = closed[closed.length - 1];
    const target = [...closed].reverse().find((entry) => !hasReviewFor(entry.record, reviews));
    // O snapshot atual compara somente contra o ciclo fechado mais recente.
    // Ciclos anteriores continuam no historico, mas nao sao alvos seguros aqui.
    if (!target || target !== latestClosed) return null;
    const targetPosition = closed.indexOf(target);
    const previous = targetPosition > 0 ? closed[targetPosition - 1] : null;

    return {
      record: target.record,
      cycle: target.cycle,
      cycleId: cycleIdFor(target.record),
      cycleReferenceAt: target.referenceAt,
      index: target.index,
      previousRecord: previous?.record || null,
      previousCycle: previous?.cycle || null,
    };
  }

  function matchesSnapshot(target = null, snapshot = {}) {
    if (!target) return false;
    const previousCycle = snapshot.comparison?.previousCycle || {};
    const snapshotCycleId = text(previousCycle.cycleId || previousCycle.id);
    const snapshotReferenceAt = dateIso(previousCycle.closedAt || previousCycle.finalizedAt || previousCycle.endsAt);
    return target.cycleId
      ? snapshotCycleId === target.cycleId
      : Boolean(target.cycleReferenceAt && snapshotReferenceAt === target.cycleReferenceAt);
  }

  const api = { getReviewableCycle, matchesSnapshot, hasReviewFor, cycleIdFor, referenceAtFor };
  global.AICoachCycleTarget = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
