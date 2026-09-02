"use strict";

(function initStudyPlanComposer(global) {
  const LEVEL_SCORE = { critical: 120, deficiency: 82, attention: 38, insufficient: 16 };

  function composeAdaptiveCandidates({ candidates = [], plannedHours = 0, examContext = {} } = {}) {
    const postNotice = (examContext?.effectiveExamPhase || examContext?.examPhase) === "POST_NOTICE";
    const urgency = Number(examContext?.urgency?.value) || 0;
    const share = postNotice ? Math.min(.45, .28 + urgency * .17) : .25;
    const maxItems = Math.max(1, Math.min(3, Math.floor(Math.max(1, Number(plannedHours) || 0) * share / .5)));
    const subjectCount = new Map();
    return candidates
      .map((candidate) => {
        const level = candidate.diagnosis?.level || "";
        const score = LEVEL_SCORE[level] || 0;
        const reasons = score ? [level === "insufficient" ? "sessão diagnóstica necessária" : `${level === "critical" ? "tema crítico" : level === "deficiency" ? "tema em deficiência" : "tema em atenção"} segundo o diagnóstico`] : [];
        return { ...candidate, adaptiveScore: score, adaptiveReasons: reasons, adaptiveType: level === "insufficient" ? "diagnostic" : "reinforcement" };
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
