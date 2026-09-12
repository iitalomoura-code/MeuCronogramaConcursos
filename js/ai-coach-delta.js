"use strict";

(function initAICoachDelta(global) {
  const Checkpoint = global.AICoachCheckpoint || (typeof require === "function" ? require("./ai-coach-checkpoint.js") : null);
  const DAY = 24 * 60 * 60 * 1000;
  const text = (value = "") => String(value ?? "").trim();
  const numberOrNull = Checkpoint?.numberOrNull || ((value) => Number.isFinite(Number(value)) ? Number(value) : null);
  const key = (item = {}) => [item.subject || item.materia, item.topic || item.assunto].map(text).join("|").toLocaleLowerCase();
  const dateTime = (value) => { const date = new Date(value || ""); return Number.isFinite(date.getTime()) ? date.getTime() : null; };
  const delta = (current, previous) => current === null || previous === null || current === undefined || previous === undefined ? null : Number((current - previous).toFixed(4));

  function changesFor(previousItems = [], currentItems = [], fields = []) {
    const before = new Map(previousItems.map((item) => [key(item), item]));
    return currentItems.map((current) => {
      const previous = before.get(key(current));
      if (!previous) return null;
      const changedFields = fields.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(current[field]));
      return changedFields.length ? { subject: current.subject, topic: current.topic, changedFields, from: previous, to: current } : null;
    }).filter(Boolean).sort((a, b) => key(a).localeCompare(key(b)));
  }

  function compare({ previousCheckpoint = null, currentSnapshot = {}, now = null } = {}) {
    if (!previousCheckpoint) return null;
    const current = currentSnapshot?.totals && currentSnapshot?.topics ? currentSnapshot : Checkpoint.fromSnapshot(currentSnapshot);
    const previous = previousCheckpoint;
    const fromTime = dateTime(previous.generatedAt);
    const toTime = dateTime(current.generatedAt) ?? dateTime(now);
    const topicChanges = changesFor(previous.topics || [], current.topics || [], ["readinessState", "confidence", "learningState", "strategicRank", "strategicScore", "questions", "accuracy", "studyMinutes", "maintenanceDue"]);
    const readinessChanges = topicChanges.filter((change) => change.changedFields.includes("readinessState")).map((change) => ({ subject: change.subject, topic: change.topic, from: change.from.readinessState ?? null, to: change.to.readinessState ?? null }));
    const confidenceChanges = topicChanges.filter((change) => change.changedFields.includes("confidence")).map((change) => ({ subject: change.subject, topic: change.topic, from: change.from.confidence ?? null, to: change.to.confidence ?? null }));
    const learningStateChanges = topicChanges.filter((change) => change.changedFields.includes("learningState")).map((change) => ({ subject: change.subject, topic: change.topic, from: change.from.learningState ?? null, to: change.to.learningState ?? null }));
    const priorityChanges = topicChanges.filter((change) => change.changedFields.includes("strategicRank")).map((change) => ({ subject: change.subject, topic: change.topic, fromRank: numberOrNull(change.from.strategicRank), toRank: numberOrNull(change.to.strategicRank) }));
    const subjectsChanged = changesFor(previous.subjects || [], current.subjects || [], ["readinessState", "confidence", "questions", "accuracy", "studyMinutes"]);
    return {
      from: previous.generatedAt || null,
      to: current.generatedAt || now || null,
      elapsedDays: fromTime !== null && toTime !== null ? Number(((toTime - fromTime) / DAY).toFixed(2)) : null,
      newSessions: delta(numberOrNull(current.totals?.sessions), numberOrNull(previous.totals?.sessions)),
      newQuestions: delta(numberOrNull(current.totals?.questions), numberOrNull(previous.totals?.questions)),
      newCorrect: delta(numberOrNull(current.totals?.correct), numberOrNull(previous.totals?.correct)),
      studyMinutes: delta(numberOrNull(current.totals?.studyMinutes), numberOrNull(previous.totals?.studyMinutes)),
      subjectsChanged,
      topicChanges,
      readinessChanges,
      confidenceChanges,
      learningStateChanges,
      priorityChanges,
      newRisks: [],
      resolvedRisks: [],
      maintenanceChanges: topicChanges.filter((change) => change.changedFields.includes("maintenanceDue")).map((change) => ({ subject: change.subject, topic: change.topic, from: Boolean(change.from.maintenanceDue), to: Boolean(change.to.maintenanceDue) })),
    };
  }

  const api = { compare };
  global.AICoachDelta = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
