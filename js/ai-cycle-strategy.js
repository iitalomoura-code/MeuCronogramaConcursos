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

  function baseAllowsAction(candidate = {}, action = "") {
    const base = normalized(candidate.baseLevel || "unknown");
    if (["never-studied", "basic", "unknown"].includes(base) && action === "ADVANCE") return false;
    if (candidate.blocked && !candidate.reservable) return false;
    return true;
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
    if (!baseAllowsAction(candidate, action)) return { accepted: false, reason: "incompatible-with-base-or-progression" };
    const evidence = Array.isArray(recommendation.evidence) ? recommendation.evidence.map(text).filter(Boolean) : [];
    if (!evidence.length || evidence.some((item) => !candidate.evidenceKeys.has(item))) return { accepted: false, reason: "unsupported-evidence" };
    const dependencies = Array.isArray(recommendation.dependencies) ? recommendation.dependencies.map(text).filter(Boolean) : [];
    if (dependencies.some((item) => !candidate.prerequisiteKeys.includes(item))) return { accepted: false, reason: "invalid-dependency" };
    const suggestedBlocks = clamp(recommendation.suggestedBlocks, 1, 3);
    const suggestedMinutes = clamp(recommendation.suggestedMinutes, 30, 120);
    if (!Number.isFinite(Number(recommendation.suggestedBlocks)) || !Number.isFinite(Number(recommendation.suggestedMinutes))) return { accepted: false, reason: "invalid-capacity" };
    return {
      accepted: true,
      value: {
        key: candidate.key,
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
      const nextSubjectBlocks = (subjectBlocks.get(value.subject) || 0) + value.suggestedBlocks;
      if (nextSubjectBlocks > maxBlocksPerSubject) {
        rejected.push({ key: value.key, reason: "subject-block-cap" });
        return;
      }
      if (requestedMinutes + value.suggestedMinutes > Math.max(0, Number(capacityMinutes) || 0)) {
        rejected.push({ key: value.key, reason: "capacity-exceeded" });
        return;
      }
      seen.add(value.key);
      subjectBlocks.set(value.subject, nextSubjectBlocks);
      requestedMinutes += value.suggestedMinutes;
      accepted.push(value);
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
