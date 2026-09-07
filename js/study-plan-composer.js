"use strict";

(function initStudyPlanComposer(global) {
  const Policy = global.AdaptiveLearningPolicy || (typeof module !== "undefined" && module.exports ? require("./adaptive-learning-policy.js") : null);

  function composeAdaptiveCandidates({ candidates = [], plannedHours = 0, examContext = {} } = {}) {
    const postNotice = (examContext?.effectiveExamPhase || examContext?.examPhase) === "POST_NOTICE";
    const urgency = Number(examContext?.urgency?.value) || 0;
    const share = postNotice ? Math.min(.45, .28 + urgency * .17) : .25;
    const maxItems = Math.max(1, Math.min(3, Math.floor(Math.max(1, Number(plannedHours) || 0) * share / .5)));
    const subjectCount = new Map();
    return candidates
      .map((candidate) => {
        const signal = Policy?.decision?.({ diagnosis: candidate.diagnosis, intervention: candidate.intervention }) || { active: false, score: 0, kind: "maintenance", reasons: [] };
        return { ...candidate, adaptiveScore: signal.score, adaptiveReasons: signal.reasons, adaptiveType: signal.kind, adaptiveDecision: signal };
      })
      .filter((candidate) => candidate.adaptiveScore > 0)
      .sort((a, b) => b.adaptiveScore - a.adaptiveScore || Number(b.priority) - Number(a.priority))
      .filter((candidate) => {
        const subject = candidate.materia || "";
        const count = subjectCount.get(subject) || 0;
        if (count >= 1) return false;
        subjectCount.set(subject, count + 1);
        return true;
      })
      .slice(0, maxItems);
  }

  const api = { composeAdaptiveCandidates };
  global.StudyPlanComposer = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
