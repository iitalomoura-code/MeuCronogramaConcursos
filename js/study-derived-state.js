"use strict";

(function initStudyDerivedState(global) {
  let cachedSnapshot = null;
  let cachedRevision = -1;
  let cachedEntries = null;
  let cachedSignature = "";

  function invalidate() {
    cachedSnapshot = null;
    cachedRevision = -1;
    cachedEntries = null;
    cachedSignature = "";
  }

  // This module deliberately receives adapters instead of reaching into app state.
  // It can therefore be shared by other views without coupling them to the DOM.
  function continueSnapshot(input = {}) {
    const entries = input.entries || [];
    const revision = Number(input.revision) || 0;
    const signature = String(input.signature || "");
    if (cachedSnapshot && cachedRevision === revision && cachedSignature === signature) return cachedSnapshot;

    const phase = input.phase || { profile: {} };
    const derive = typeof input.deriveEntry === "function" ? input.deriveEntry : () => ({});
    const derivedEntries = entries.map((entry) => ({
      ...entry,
      derived: derive(entry, phase),
    }));
    const diagnosisByTopic = new Map();
    const diagnosisBySubject = new Map();
    derivedEntries.forEach((entry) => {
      const block = entry.block || {};
      const subjectKey = String(block.materia || "").trim().toLowerCase();
      const topicKey = `${subjectKey}::${String(block.assunto || "").trim().toLowerCase()}`;
      const diagnosis = entry.derived?.adaptive?.mastery || null;
      if (diagnosis && topicKey !== "::") diagnosisByTopic.set(topicKey, diagnosis);
      if (diagnosis && subjectKey && !diagnosisBySubject.has(subjectKey)) diagnosisBySubject.set(subjectKey, diagnosis);
    });

    cachedSnapshot = {
      revision,
      phase,
      entries: derivedEntries,
      diagnosisByTopic,
      diagnosisBySubject,
      createdAt: Date.now(),
    };
    cachedRevision = revision;
    cachedEntries = entries;
    cachedSignature = signature;
    return cachedSnapshot;
  }

  const api = { continueSnapshot, invalidate };
  global.StudyDerivedState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
