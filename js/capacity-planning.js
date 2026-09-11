"use strict";

(function initCapacityPlanning(global) {
  const DAY_KEYS = ["segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"];
  const SAFETY_MARGIN = 0.92;
  const MAX_INTRACYCLE_ADAPTATION = 0.25;

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function round(value, places = 2) {
    const factor = 10 ** places;
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function normalizeDailyAvailability(dailyHours = {}, fallbackWeeklyHours = 0) {
    const supplied = DAY_KEYS.reduce((total, key) => total + Math.max(0, Number(dailyHours?.[key]) || 0), 0);
    if (supplied > 0) {
      return Object.fromEntries(DAY_KEYS.map((key) => [key, Math.max(0, Number(dailyHours?.[key]) || 0)]));
    }
    const weekly = Math.max(0, Number(fallbackWeeklyHours) || 0);
    const base = Math.floor((weekly / 7) * 4) / 4;
    let remaining = round(weekly - base * 7);
    return Object.fromEntries(DAY_KEYS.map((key) => {
      const extra = Math.min(.25, Math.max(0, remaining));
      remaining = round(remaining - extra);
      return [key, base + extra];
    }));
  }

  function capacityFor({ dailyHours = {}, weeklyHours = 0, safetyMargin = SAFETY_MARGIN, overrideHours = 0 } = {}) {
    const availability = normalizeDailyAvailability(dailyHours, weeklyHours);
    const availableHours = round(Object.values(availability).reduce((total, hours) => total + hours, 0));
    const requestedHours = Math.max(0, Number(overrideHours) || availableHours || Number(weeklyHours) || 0);
    const scale = availableHours > 0 && requestedHours !== availableHours ? requestedHours / availableHours : 1;
    const effectiveDailyHours = Object.fromEntries(DAY_KEYS.map((key) => [key, round(availability[key] * scale)]));
    const effectiveAvailableHours = round(Object.values(effectiveDailyHours).reduce((total, hours) => total + hours, 0));
    const margin = clamp(safetyMargin, .9, .95);
    const plannedHours = round(effectiveAvailableHours * margin);
    return {
      dailyHours: effectiveDailyHours,
      availableHours: effectiveAvailableHours,
      plannedHours,
      plannedMinutes: Math.round(plannedHours * 60),
      safetyMargin: margin,
      reserveHours: round(effectiveAvailableHours - plannedHours),
      adaptiveReserveMinutes: Math.floor(plannedHours * 60 * MAX_INTRACYCLE_ADAPTATION),
    };
  }

  function normalizeExamImportance(subject = {}) {
    const existing = subject.examImportance || {};
    const questionCount = Math.max(0, Number(existing.questionCount) || 0);
    const manualImportance = Number(subject.peso) || 3;
    // O peso da estrutura so vale quando ha questoes para ponderar.
    const weight = questionCount > 0 ? (Number(existing.weight ?? manualImportance) || 1) : manualImportance;
    const historicalIncidence = clamp(existing.historicalIncidence ?? subject.incidenciaHistorica?.normalized ?? 0);
    // A participação percentual é contexto absoluto; a pontuação só pode
    // reutilizá-la após a normalização relativa feita para toda a prova.
    const fallbackScore = historicalIncidence ? (weight / 5) * .78 + historicalIncidence * .22 : weight / 5;
    const score = questionCount > 0 && Number.isFinite(Number(existing.importanceScore))
      ? clamp(existing.importanceScore)
      : clamp(fallbackScore);
    const sourceType = questionCount > 0
      ? (existing.sourceType || "current-edital")
      : (historicalIncidence ? "historical-incidence" : "manual-fallback");
    return {
      subjectId: existing.subjectId || subject.id || `subject-${String(subject.materia || subject.subjectName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      subjectName: existing.subjectName || subject.materia || "",
      questionCount,
      weight,
      blockWeight: Math.max(0, Number(existing.blockWeight) || 0),
      estimatedPercentage: Math.max(0, Number(existing.estimatedPercentage) || 0),
      historicalIncidence,
      importanceScore: score,
      sourceType,
      sourceName: questionCount > 0
        ? (existing.sourceName || "Estrutura da prova")
        : (historicalIncidence ? "Incidência histórica e importância informada" : "Importância informada"),
      confidence: questionCount > 0 ? (existing.confidence || "confirmed") : (historicalIncidence ? "estimated" : "manual"),
    };
  }

  function normalizeSubject(subject = {}) {
    return {
      ...subject,
      active: subject.active !== false && subject.status !== "paused",
      status: subject.active === false || subject.status === "paused" ? "paused" : "active",
      familiarity: subject.familiarity || subject.initialKnowledgeLevel || "unknown",
      examImportance: normalizeExamImportance(subject),
    };
  }

  function knowledgeState(diagnosis = {}) {
    if (!diagnosis?.available && !diagnosis?.level) return { key: "unmeasured", label: "Ainda não medido", confidence: "very-low" };
    const confidence = Number(diagnosis.confidence) || 0;
    if (diagnosis.level === "strong" && confidence >= .45) return { key: "strong", label: "Forte", confidence: confidenceLabel(confidence) };
    if (["critical", "deficiency"].includes(diagnosis.level)) return { key: "fragile", label: "Frágil", confidence: confidenceLabel(confidence) };
    if (diagnosis.level === "insufficient") return { key: "preliminary", label: "Avaliação preliminar", confidence: confidenceLabel(confidence) };
    return { key: "consolidating", label: "Em consolidação", confidence: confidenceLabel(confidence) };
  }

  function confidenceLabel(value) {
    if (value < .2) return "very-low";
    if (value < .4) return "low";
    if (value < .65) return "medium";
    if (value < .82) return "good";
    return "high";
  }

  function studyPressure({ importance = {}, diagnosis = {}, urgency = 0, hasContact = false, familiarity = "unknown" } = {}) {
    const importanceScore = clamp(importance.importanceScore ?? importance);
    const levelNeed = { critical: 1, deficiency: .78, attention: .5, insufficient: .38, adequate: .18, strong: .04 }[diagnosis?.level] ?? 0;
    const trendNeed = diagnosis?.trend?.label === "falling" ? .18 : diagnosis?.trend?.label === "improving" ? -.06 : 0;
    const recencyNeed = Math.min(.18, Math.max(0, Number(diagnosis?.daysWithoutContact) || 0) / 120 * .18);
    const unmeasuredNeed = !hasContact && ["never-studied", "basic", "unknown", "none", "weak"].includes(familiarity) ? .12 : 0;
    return clamp(importanceScore * .48 + levelNeed * .34 + clamp(urgency) * .12 + recencyNeed + trendNeed + unmeasuredNeed);
  }

  function classifyBlock({ block = {}, diagnosis = {}, importance = {}, pressure = 0 } = {}) {
    const status = String(block.status || "").toLowerCase();
    const activity = String(block.tipoAtividade || block.tipo || "").toLowerCase();
    const review = activity.includes("revis") || Boolean(block.reviewCycle || block.reviewCycles?.length);
    const adaptive = Boolean(block.intervencao || block.adaptiveReason || ["critical", "deficiency", "insufficient"].includes(diagnosis.level));
    const protectedBlock = status.includes("andamento") || Boolean(block.protected) || (review && ["critical", "deficiency"].includes(diagnosis.level)) || (!block.hasContact && Number(importance.importanceScore) >= .7);
    return {
      category: protectedBlock ? "protected" : adaptive ? "adaptive" : "flexible",
      protected: protectedBlock,
      adaptive,
      reviewIntegrated: review,
      reinforcementIntegrated: adaptive,
      pressure: clamp(pressure),
    };
  }

  function mergeNeeds(blocks = []) {
    const byTopic = new Map();
    return blocks.reduce((merged, block) => {
      const key = `${String(block.materia || "").toLowerCase()}::${String(block.assunto || block.titulo || "").toLowerCase()}::${block.metaPartKey || ""}`;
      const existing = byTopic.get(key);
      if (!existing) {
        const item = { ...block, integratedNeeds: [...(block.integratedNeeds || [])] };
        byTopic.set(key, item);
        merged.push(item);
        return merged;
      }
      const needs = new Set([...(existing.integratedNeeds || []), ...(block.integratedNeeds || [])]);
      if (block.reviewIntegrated) needs.add("review");
      if (block.reinforcementIntegrated) needs.add("reinforcement");
      existing.integratedNeeds = [...needs];
      existing.reviewIntegrated ||= Boolean(block.reviewIntegrated);
      existing.reinforcementIntegrated ||= Boolean(block.reinforcementIntegrated);
      existing.adaptiveReason = existing.adaptiveReason || block.adaptiveReason || "";
      existing.duracao = Math.max(Number(existing.duracao) || 0, Number(block.duracao) || 0);
      return merged;
    }, []);
  }

  function capIntracycleAdaptations(existingBlocks = [], candidates = []) {
    const limit = Math.max(1, Math.floor(Math.max(existingBlocks.length, candidates.length) * MAX_INTRACYCLE_ADAPTATION));
    const alreadyAdaptive = existingBlocks.filter((block) => block.category === "adaptive" || block.adaptive).length;
    const remaining = Math.max(0, limit - alreadyAdaptive);
    return { limit, remaining, accepted: candidates.slice(0, remaining), deferred: candidates.slice(remaining) };
  }

  const api = {
    DAY_KEYS,
    SAFETY_MARGIN,
    MAX_INTRACYCLE_ADAPTATION,
    normalizeDailyAvailability,
    capacityFor,
    normalizeExamImportance,
    normalizeSubject,
    knowledgeState,
    studyPressure,
    classifyBlock,
    mergeNeeds,
    capIntracycleAdaptations,
  };
  global.CapacityPlanning = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
