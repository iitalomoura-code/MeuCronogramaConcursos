"use strict";

(function initExamPhaseEngine(global) {
  const PRE_NOTICE = "PRE_NOTICE";
  const POST_NOTICE = "POST_NOTICE";

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function normalizePhase(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if ([PRE_NOTICE, "PRE", "PRE-EDITAL", "PRÉ-EDITAL"].includes(normalized)) return PRE_NOTICE;
    if ([POST_NOTICE, "POST", "POS-EDITAL", "PÓS-EDITAL", "PÓS EDITAL"].includes(normalized)) return POST_NOTICE;
    return "";
  }

  function daysUntil(examDate, now = new Date()) {
    if (!examDate) return null;
    const exam = new Date(`${String(examDate).slice(0, 10)}T12:00:00`);
    const current = new Date(now);
    if (Number.isNaN(exam.getTime()) || Number.isNaN(current.getTime())) return null;
    current.setHours(12, 0, 0, 0);
    return Math.max(0, Math.ceil((exam - current) / 86400000));
  }

  function postNoticeUrgency({ phase, examDate, now = new Date() } = {}) {
    if (normalizePhase(phase) !== POST_NOTICE) return { available: false, daysRemaining: null, weeksRemaining: null, value: 0 };
    const daysRemaining = daysUntil(examDate, now);
    if (daysRemaining === null) return { available: false, daysRemaining: null, weeksRemaining: null, value: 0 };
    // Curva contínua: cresce gradualmente nos 180 dias anteriores à prova.
    const value = clamp(1 - (daysRemaining / 180));
    return { available: true, daysRemaining, weeksRemaining: Math.ceil(daysRemaining / 7), value };
  }

  function phaseProfile({ phase, examDate, now = new Date() } = {}) {
    const normalized = normalizePhase(phase) || PRE_NOTICE;
    const urgency = postNoticeUrgency({ phase: normalized, examDate, now });
    if (normalized === PRE_NOTICE) {
      return {
        phase: normalized,
        urgency,
        incidenceMultiplier: 0.55,
        performanceMultiplier: 0.85,
        diagnosisMultiplier: 1,
        reviewMultiplier: 0.9,
        uncoveredAdjustment: 0.07,
      };
    }
    const level = urgency.value;
    return {
      phase: normalized,
      urgency,
      incidenceMultiplier: 0.82 + (level * 0.38),
      performanceMultiplier: 1 + (level * 0.35),
      diagnosisMultiplier: 0.5 - (level * 0.2),
      reviewMultiplier: 1 + (level * 0.5),
      uncoveredAdjustment: 0.08 - (level * 0.035),
    };
  }

  function displayLabel({ phase, examDate, now = new Date(), configured = true } = {}) {
    const normalized = normalizePhase(phase);
    if (!configured || !normalized) return "Fase não definida";
    if (normalized === PRE_NOTICE) return "Pré-edital";
    const urgency = postNoticeUrgency({ phase: normalized, examDate, now });
    return urgency.available
      ? `Pós-edital · ${urgency.weeksRemaining} ${urgency.weeksRemaining === 1 ? "semana" : "semanas"} para a prova`
      : "Pós-edital · informe a data da prova";
  }

  function suggestActivity({ phase, examDate, currentActivity = "Teoria e questões", hasContact = false, lowPerformance = false, reviewAvailable = false } = {}) {
    const profile = phaseProfile({ phase, examDate });
    if (profile.phase !== POST_NOTICE) return currentActivity;
    if (reviewAvailable) return "Revisão";
    if (!hasContact) return currentActivity;
    if (lowPerformance || profile.urgency.value >= 0.72) return "Questões";
    if (profile.urgency.value >= 0.5 && currentActivity === "Teoria") return "Teoria e questões";
    return currentActivity;
  }

  function coverageRisk({ phase, examDate, totalTopics = 0, contactedTopics = 0, recentContactCount = 0, observedDays = 0, weeklyHours = 0 } = {}) {
    const urgency = postNoticeUrgency({ phase, examDate });
    if (!urgency.available || recentContactCount < 3 || observedDays < 7 || Number(weeklyHours) <= 0 || Number(totalTopics) <= 0) {
      return { available: false, status: "insufficient-data" };
    }
    const remainingTopics = Math.max(0, Number(totalTopics) - Number(contactedTopics));
    const topicsPerWeek = recentContactCount / (observedDays / 7);
    const weeksNeeded = topicsPerWeek > 0 ? remainingTopics / topicsPerWeek : Infinity;
    return {
      available: true,
      remainingTopics,
      topicsPerWeek,
      weeksNeeded,
      weeksRemaining: urgency.weeksRemaining,
      atRisk: weeksNeeded > urgency.weeksRemaining,
    };
  }

  const api = { PRE_NOTICE, POST_NOTICE, normalizePhase, daysUntil, postNoticeUrgency, phaseProfile, displayLabel, suggestActivity, coverageRisk };
  global.ExamPhaseEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
