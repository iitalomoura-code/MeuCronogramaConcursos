(function (global) {
  "use strict";

  const LEVELS = Object.freeze({
    unknown: { id: "unknown", label: "Não sei avaliar", value: 0.5, adjustment: 0, activity: "" },
    none: { id: "none", label: "Não estudei", value: 0.1, adjustment: 0.13, activity: "Teoria" },
    weak: { id: "weak", label: "Base fraca", value: 0.3, adjustment: 0.07, activity: "Teoria e questões" },
    intermediate: { id: "intermediate", label: "Intermediário", value: 0.6, adjustment: -0.03, activity: "" },
    good: { id: "good", label: "Bom domínio", value: 0.85, adjustment: -0.1, activity: "Questões" },
  });

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function normalizeLevel(value) {
    const key = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(LEVELS, key) ? key : "unknown";
  }

  function levelInfo(value) {
    return LEVELS[normalizeLevel(value)];
  }

  // A confiança combina amostras diferentes para que uma única sessão ou prova
  // curta não apague prematuramente a autoavaliação inicial.
  function historyConfidence(evidence = {}) {
    const questions = clamp((Number(evidence.questions) || 0) / 40);
    const sessions = clamp((Number(evidence.sessions) || 0) / 4);
    const reviews = clamp((Number(evidence.reviews) || 0) / 3);
    const hours = clamp((Number(evidence.hours) || 0) / 6);
    const reinforcements = clamp((Number(evidence.reinforcements) || 0) / 2);
    return clamp(questions * 0.55 + sessions * 0.2 + reviews * 0.1 + hours * 0.1 + reinforcements * 0.05);
  }

  function influenceFor(value, evidence = {}) {
    const level = levelInfo(value);
    const confidence = historyConfidence(evidence);
    const remainingWeight = level.id === "unknown" ? 0 : 1 - confidence;
    return {
      level: level.id,
      label: level.label,
      value: level.value,
      confidence,
      remainingWeight,
      adjustment: Number((level.adjustment * remainingWeight).toFixed(4)),
      active: level.id !== "unknown" && remainingWeight > 0.08,
      historyIsPrimary: confidence >= 0.7,
    };
  }

  function suggestedActivity(value, evidence = {}, currentActivity = "") {
    const influence = influenceFor(value, evidence);
    if (!influence.active || influence.confidence >= 0.45) return currentActivity;
    return LEVELS[influence.level].activity || currentActivity;
  }

  function subjectIdForName(name = "") {
    const normalized = String(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    let hash = 2166136261;
    for (let index = 0; index < normalized.length; index += 1) {
      hash ^= normalized.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `subject-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  const api = { LEVELS, normalizeLevel, levelInfo, historyConfidence, influenceFor, suggestedActivity, subjectIdForName };
  global.InitialDiagnosisEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
