"use strict";

(function initStrategicPlanningIndex(global) {
  function create({ entries = [], normalize = (value) => String(value || ""), matches = () => false } = {}) {
    const bySubject = new Map();
    const byTarget = new Map();
    const stats = { sourceScans: 1, subjectLookups: 0, topicFilters: 0, topicCandidateScans: 0, topicCacheHits: 0 };

    entries.forEach((entry) => {
      const key = normalize(entry?.materia || "");
      const bucket = bySubject.get(key) || [];
      bucket.push(entry);
      bySubject.set(key, bucket);
    });

    function forSubject(materia = "") {
      stats.subjectLookups += 1;
      return bySubject.get(normalize(materia)) || [];
    }

    function forTopic(materia = "", assunto = "") {
      if (!assunto) return forSubject(materia);
      const key = `${normalize(materia)}::${normalize(assunto)}`;
      if (byTarget.has(key)) {
        stats.topicCacheHits += 1;
        return byTarget.get(key);
      }
      stats.topicFilters += 1;
      const candidates = forSubject(materia);
      stats.topicCandidateScans += candidates.length;
      const result = candidates.filter((entry) => matches(entry, materia, assunto));
      byTarget.set(key, result);
      return result;
    }

    return { forSubject, forTopic, stats };
  }

  const api = { create };
  global.StrategicPlanningIndex = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
