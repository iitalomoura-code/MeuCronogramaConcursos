"use strict";

(function initAdaptiveLearningPolicy(global) {
  const LEVEL_SCORE = {
    critical: 120,
    deficiency: 82,
    attention: 38,
    insufficient: 16,
    adequate: 0,
    strong: 0,
  };

  function unique(values = []) {
    return [...new Set(values.filter(Boolean))];
  }

  function decision({ diagnosis = {}, intervention = null } = {}) {
    const level = String(diagnosis.level || "").toLowerCase();
    const result = intervention?.lastResult || "";
    const resolved = result === "resolved" || ["strong", "adequate"].includes(level);
    const active = Boolean(level) && !resolved && ["critical", "deficiency", "attention", "insufficient"].includes(level);
    const escalation = active && ["unchanged", "worse"].includes(result)
      ? Math.min(36, Math.max(12, Number(intervention?.ineffectiveInterventions) * 12 || 12))
      : 0;
    const action = diagnosis.action || {};
    const kind = level === "insufficient" ? "diagnostic" : active ? (action.kind || "reinforcement") : "maintenance";
    const fallbackReason = level === "critical" ? "tema crítico segundo o diagnóstico"
      : level === "deficiency" ? "tema em deficiência segundo o diagnóstico"
        : level === "attention" ? "tema em atenção segundo o diagnóstico"
          : level === "insufficient" ? "sessão diagnóstica necessária" : "";
    const reasons = unique([
      ...(diagnosis.reasons || []),
      fallbackReason,
      ["unchanged", "worse"].includes(result) ? (intervention?.lastResultMessage || "o reforço anterior ainda não produziu melhora suficiente") : "",
    ]).slice(0, 3);

    return {
      active,
      resolved,
      level,
      score: active ? (LEVEL_SCORE[level] || 0) + escalation : 0,
      kind,
      activityType: kind === "diagnostic" ? "Questões diagnósticas" : kind === "maintenance" ? "Estudo" : "Questões",
      minutes: Math.max(0, Number(action.minutes) || (kind === "diagnostic" ? 30 : active ? 30 : 0)),
      questions: Math.max(0, Number(intervention?.recommendation?.questions) || Number(action.questions) || (kind === "diagnostic" ? 10 : 0)),
      reasons,
    };
  }

  function requiresAdaptiveContact(diagnosis = {}, intervention = null) {
    return decision({ diagnosis, intervention }).active;
  }

  const api = { LEVEL_SCORE, decision, requiresAdaptiveContact };
  global.AdaptiveLearningPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
