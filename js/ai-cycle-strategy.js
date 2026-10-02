"use strict";

(function initAICycleStrategy(global) {
  const ACTIONS = Object.freeze(["START_FOUNDATION", "CONTINUE_THEORY", "PRACTICE", "REVIEW", "REMEDIATE_GAP", "ADVANCE", "MAINTAIN"]);
  const SESSION_TYPES = Object.freeze(["Teoria e questões", "Questões", "Revisão", "Teoria", "Retomada"]);
  const PRIORITIES = Object.freeze(["high", "medium", "low"]);
  const text = (value = "") => String(value ?? "").trim();
  const normalized = (value = "") => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
  const topicKey = (item = {}) => text(item.key) || [normalized(item.subject || item.materia), normalized(item.subarea), normalized(item.topic || item.assunto || item.titulo)].filter(Boolean).join("::");
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

  function recommendationKey(item = {}) {
    return [normalized(item.subject || item.materia), normalized(item.subarea), normalized(item.topic || item.assunto || item.titulo)].filter(Boolean).join("::");
  }

  function priorityBoost(priority, confidence) {
    const base = priority === "high" ? .18 : priority === "medium" ? .1 : .04;
    return Number((base * (confidence === "high" ? 1 : confidence === "medium" ? .72 : .45)).toFixed(3));
  }

  function actionCompatible(candidate = {}, action = "", sessionType = "") {
    const base = normalized(candidate.baseLevel || "unknown");
    const lowBase = ["never-studied", "basic", "unknown"].includes(base);
    const hasHistory = Boolean(candidate.history?.reliable || candidate.hasValidatedHistory);
    const hasTheory = Boolean(candidate.hasTheoryContact || candidate.executableNow && Number(candidate.pedagogicalStage || 0) > 0);
    const hasGap = Boolean(candidate.hasConfirmedGap || candidate.performance?.errorRecurrence === "high" || ["critical", "deficiency"].includes(candidate.performance?.level));
    const reviewDue = Boolean(candidate.reviewPending);
    const initialStage = Number(candidate.pedagogicalStage || 0) === 0;
    if (candidate.blocked && !candidate.reservable) return false;
    if (action === "REVIEW") return reviewDue;
    if (action === "REMEDIATE_GAP") return hasGap;
    if (lowBase) {
      if (action === "START_FOUNDATION") return initialStage || hasGap;
      if (action === "CONTINUE_THEORY") return Boolean(candidate.executableNow || hasTheory);
      if (action === "PRACTICE") return hasTheory && sessionType !== "Teoria";
      return false;
    }
    if (base === "intermediate") {
      if (action === "ADVANCE") return Boolean(candidate.executableNow && hasHistory);
      if (action === "MAINTAIN") return hasHistory && Number(candidate.performance?.accuracy || 0) >= .7;
      if (action === "START_FOUNDATION") return initialStage && hasGap;
      return ["CONTINUE_THEORY", "PRACTICE"].includes(action);
    }
    if (["advanced", "strong"].includes(base)) {
      if (action === "START_FOUNDATION") return hasGap && initialStage;
      if (action === "ADVANCE") return Boolean(candidate.executableNow && hasHistory);
      if (action === "MAINTAIN") return hasHistory;
      return ["CONTINUE_THEORY", "PRACTICE"].includes(action);
    }
    return false;
  }

  function validateRecommendation(recommendation = {}, context = {}) {
    const recommendationIdentity = recommendationKey(recommendation);
    const candidate = context.candidatesByKey?.get(recommendationIdentity);
    const action = text(recommendation.action);
    const sessionType = text(recommendation.sessionType);
    const confidence = text(recommendation.confidence);
    const priority = text(recommendation.priority);
    if (!candidate) return { accepted: false, reason: "unknown-topic" };
    if (!ACTIONS.includes(action)) return { accepted: false, reason: "invalid-action" };
    if (!SESSION_TYPES.includes(sessionType)) return { accepted: false, reason: "invalid-session-type" };
    if (!PRIORITIES.includes(priority) || !PRIORITIES.includes(confidence)) return { accepted: false, reason: "invalid-priority-or-confidence" };
    if (!actionCompatible(candidate, action, sessionType)) return { accepted: false, reason: "incompatible-with-base-or-progression" };
    const evidence = Array.isArray(recommendation.evidence) ? recommendation.evidence.map(text).filter(Boolean) : [];
    if (!evidence.length || evidence.some((item) => !candidate.evidenceKeys.has(item))) return { accepted: false, reason: "unsupported-evidence" };
    const dependencies = Array.isArray(recommendation.dependencies) ? recommendation.dependencies.map(text).filter(Boolean) : [];
    if (dependencies.some((item) => !candidate.prerequisiteKeys.includes(item)) || candidate.prerequisiteKeys.some((item) => !dependencies.includes(item))) return { accepted: false, reason: "invalid-dependency" };
    const suggestedBlocks = clamp(recommendation.suggestedBlocks, 1, 3);
    const suggestedMinutes = clamp(recommendation.suggestedMinutes, 30, 120);
    if (!Number.isFinite(Number(recommendation.suggestedBlocks)) || !Number.isFinite(Number(recommendation.suggestedMinutes))) return { accepted: false, reason: "invalid-capacity" };
    const original = {
      subject: text(recommendation.subject || recommendation.materia),
      subarea: text(recommendation.subarea),
      topic: text(recommendation.topic || recommendation.assunto || recommendation.titulo),
      action,
      sessionType,
      priority,
      confidence,
      suggestedBlocks: Number(recommendation.suggestedBlocks),
      suggestedMinutes: Number(recommendation.suggestedMinutes),
      justification: text(recommendation.justification).slice(0, 320),
      evidence: evidence.slice(),
      dependencies: dependencies.slice(),
    };
    return {
      accepted: true,
      value: {
        key: candidate.key,
        original,
        subject: candidate.subject,
        topic: candidate.topic,
        subarea: candidate.subarea || "",
        action,
        sessionType,
        priority,
        confidence,
        suggestedBlocks,
        suggestedMinutes,
        justification: text(recommendation.justification).slice(0, 320),
        evidence,
        dependencies,
        reserved: Boolean(candidate.reservable && !candidate.executableNow),
        priorityBoost: priorityBoost(priority, confidence),
      },
    };
  }

  function validateStrategy(strategy = {}, { candidates = [], capacityMinutes = 0, maxBlocksPerSubject = Number.POSITIVE_INFINITY } = {}) {
    const candidatesByKey = new Map();
    (candidates || []).forEach((candidate) => {
      const normalizedCandidate = {
        ...candidate,
        key: topicKey(candidate),
        evidenceKeys: new Set(candidate.evidenceKeys || []),
        prerequisiteKeys: Array.isArray(candidate.prerequisiteKeys) ? candidate.prerequisiteKeys : [],
      };
      candidatesByKey.set(normalizedCandidate.key, normalizedCandidate);
      candidatesByKey.set(recommendationKey(normalizedCandidate), normalizedCandidate);
    });
    const raw = Array.isArray(strategy?.recommendations) ? strategy.recommendations : [];
    const accepted = [];
    const rejected = [];
    const subjectBlocks = new Map();
    const seen = new Set();
    let requestedMinutes = 0;
    raw.slice(0, 24).forEach((recommendation) => {
      const result = validateRecommendation(recommendation, { candidatesByKey });
      if (!result.accepted) {
        rejected.push({ key: recommendationKey(recommendation), reason: result.reason });
        return;
      }
      const value = result.value;
      if (seen.has(value.key)) {
        rejected.push({ key: value.key, reason: "duplicate-recommendation" });
        return;
      }
      const availableBlocks = Math.max(0, Number(maxBlocksPerSubject) - (subjectBlocks.get(value.subject) || 0));
      const availableMinutes = Math.max(0, Number(capacityMinutes) - requestedMinutes);
      const acceptedBlocks = Math.min(value.suggestedBlocks, availableBlocks);
      const acceptedMinutes = Math.min(value.suggestedMinutes, availableMinutes);
      if (!acceptedBlocks || !acceptedMinutes) {
        rejected.push({ key: value.key, reason: availableBlocks ? "capacity-exceeded" : "subject-block-cap" });
        return;
      }
      const adjusted = acceptedBlocks !== value.suggestedBlocks || acceptedMinutes !== value.suggestedMinutes;
      const acceptedValue = {
        ...value,
        suggestedBlocks: acceptedBlocks,
        suggestedMinutes: acceptedMinutes,
        validationAdjustment: adjusted ? "limitada pela capacidade ou pelo teto de distribuição" : "",
      };
      seen.add(acceptedValue.key);
      subjectBlocks.set(acceptedValue.subject, (subjectBlocks.get(acceptedValue.subject) || 0) + acceptedBlocks);
      requestedMinutes += acceptedMinutes;
      accepted.push(acceptedValue);
    });
    return {
      source: accepted.length ? "ai" : "fallback",
      summary: text(strategy?.summary).slice(0, 500),
      accepted,
      rejected,
      requestedMinutes,
      fallbackRequired: !accepted.length,
    };
  }

  function recommendationFor(strategy = {}, item = {}) {
    const key = topicKey(item);
    return (strategy.accepted || []).find((recommendation) => recommendation.key === key) || null;
  }

  const api = { ACTIONS, SESSION_TYPES, PRIORITIES, topicKey, recommendationKey, validateStrategy, recommendationFor };
  global.AICycleStrategy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
