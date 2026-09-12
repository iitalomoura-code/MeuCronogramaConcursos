"use strict";

(function initKnowledgeDiagnosis(global) {
  const MAPPING = global.KnowledgeMapping || (typeof require === "function" ? require("./knowledge-mapping.js") : null);
  const INITIAL = global.InitialDiagnosisEngine || (typeof require === "function" ? require("./initial-diagnosis.js") : null);
  const MASTERY = global.MasteryDiagnosis || (typeof require === "function" ? require("./mastery-diagnosis.js") : null);
  const DAY = 24 * 60 * 60 * 1000;
  const STALE_AFTER_DAYS = 90;
  const SAFE_AUTO_BASES = new Set([
    "canonical-title-exact",
    "canonical-title-equivalent",
    "confirmed-alias",
    "controlled-alias",
    "confirmed-equivalence",
  ]);

  const text = (value = "") => String(value ?? "").trim();
  const normalize = (value = "") => MAPPING?.normalize
    ? MAPPING.normalize(value)
    : text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
  const unique = (values = []) => [...new Set(values.filter(Boolean))];

  function mappingIsTrusted(mapping = {}) {
    if (mapping.status === "user-rejected" || mapping.matchBasis === "user-rejected") return false;
    if (mapping.status === "user-confirmed" || mapping.basis === "user-confirmed" || mapping.confirmed === true) return true;
    return mapping.status === "auto-confirmed"
      && mapping.confidence === "high"
      && SAFE_AUTO_BASES.has(mapping.matchBasis || mapping.basis);
  }

  function evidenceIdentity(item = {}) {
    const sourcePlanId = text(item.sourcePlanId || item.planId || item.sourceId || "unknown");
    const sessionId = text(item.sessionId || item.sessaoId || item.executionId || item.eventId || item.lastSavedSessionId);
    if (sessionId) return `session:${sourcePlanId}:${sessionId}`;
    return [
      "record",
      sourcePlanId,
      normalize(item.canonicalKey || item.canonicalTitle || item.originalTopic),
      text(item.completedAt || item.observedAt),
      Number(item.questions) || 0,
      Number(item.correctAnswers) || 0,
      Number(item.studiedMinutes) || 0,
    ].join("|");
  }

  function dateValue(value = "") {
    const raw = text(value);
    const brazilian = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brazilian) {
      const [, day, month, year] = brazilian.map(Number);
      const parsed = new Date(year, month - 1, day).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = new Date(raw).getTime();
    return Number.isFinite(parsed) && parsed >= new Date(2000, 0, 1).getTime() ? parsed : 0;
  }

  function sourcePlanId(item = {}) {
    return text(item.sourcePlanId || item.planId || item.sourceId);
  }

  function inheritedEvidence(base = {}, conceptKeys = [], currentPlanId = "") {
    const keys = new Set(conceptKeys.map(normalize).filter(Boolean));
    const seen = new Set();
    return (base.evidence || []).filter((item) => {
      if (!keys.has(normalize(item.canonicalKey))) return false;
      if (currentPlanId && sourcePlanId(item) === currentPlanId) return false;
      const identity = evidenceIdentity(item);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }).map((item) => ({ ...item }));
  }

  function aggregateEvidence(evidence = [], now = Date.now()) {
    const questions = evidence.reduce((sum, item) => sum + Math.max(0, Number(item.questions) || 0), 0);
    const correctAnswers = evidence.reduce((sum, item) => sum + Math.min(Math.max(0, Number(item.questions) || 0), Math.max(0, Number(item.correctAnswers) || 0)), 0);
    const dates = evidence.map((item) => dateValue(item.completedAt || item.observedAt)).filter(Boolean).sort((left, right) => left - right);
    const lastContact = dates.at(-1) || 0;
    const sessions = evidence.filter((item) => Number(item.questions) > 0 || Number(item.studiedMinutes) > 0).length;
    const studiedMinutes = evidence.reduce((sum, item) => sum + Math.max(0, Number(item.studiedMinutes) || 0), 0);
    const hours = studiedMinutes / 60;
    const accuracy = questions ? correctAnswers / questions : null;
    const daysSinceContact = lastContact ? Math.max(0, Math.floor((now - lastContact) / DAY)) : null;
    const sourcePlans = unique(evidence.map((item) => text(item.sourcePlanName || sourcePlanId(item))));
    const bySource = new Map();
    evidence.forEach((item) => {
      const id = sourcePlanId(item) || text(item.sourcePlanName) || "unknown";
      const current = bySource.get(id) || { sourceId: sourcePlanId(item), sourceName: text(item.sourcePlanName || sourcePlanId(item)), questions: 0, correct: 0, sessions: 0, studiedMinutes: 0, lastContact: 0 };
      const itemQuestions = Math.max(0, Number(item.questions) || 0);
      current.questions += itemQuestions;
      current.correct += Math.min(itemQuestions, Math.max(0, Number(item.correctAnswers) || 0));
      current.sessions += Number(item.questions) > 0 || Number(item.studiedMinutes) > 0 ? 1 : 0;
      current.studiedMinutes += Math.max(0, Number(item.studiedMinutes) || 0);
      current.lastContact = Math.max(current.lastContact, dateValue(item.completedAt || item.observedAt));
      bySource.set(id, current);
    });
    const sources = [...bySource.values()].map((item) => ({
      ...item,
      hours: item.studiedMinutes / 60,
      accuracy: item.questions ? item.correct / item.questions : null,
      daysSinceContact: item.lastContact ? Math.max(0, Math.floor((now - item.lastContact) / DAY)) : null,
      matchConfidence: "high",
      matchDirection: "equivalent",
    })).sort((left, right) => right.questions - left.questions || right.lastContact - left.lastContact);
    return { questions, correctAnswers, accuracy, sessions, studiedMinutes, hours, lastContact, daysSinceContact, sourcePlans, sources };
  }

  function confidenceFor(evidence, summary) {
    const masteryEntries = evidence.map((item) => ({
      questoes: item.questions,
      acertos: item.correctAnswers,
      tempoEstudado: (Number(item.studiedMinutes) || 0) / 60,
    }));
    const masteryConfidence = MASTERY?.confidence ? MASTERY.confidence(masteryEntries) : 0;
    const initialConfidence = INITIAL?.historyConfidence ? INITIAL.historyConfidence({
      questions: summary.questions,
      sessions: summary.sessions,
      hours: summary.hours,
    }) : 0;
    return clamp(Math.max(masteryConfidence, initialConfidence));
  }

  function masteryFor({ evidence = [], summary = {}, relationship = "equivalent", mappingCoverage = 0, now = Date.now() } = {}) {
    const strongReference = Number(MASTERY?.STRONG_REFERENCE) || .85;
    const minimumQuestions = Number(MASTERY?.STRONG_MIN_QUESTIONS) || 30;
    const minimumSessions = Number(MASTERY?.STRONG_MIN_SESSIONS) || 2;
    const confidence = confidenceFor(evidence, summary);
    const enough = summary.questions >= minimumQuestions && summary.sessions >= minimumSessions;
    const strongEvidence = enough && Number(summary.accuracy) >= strongReference && confidence >= .45;
    let level = summary.questions || summary.sessions ? "contact" : "none";
    if (strongEvidence && relationship === "equivalent" && mappingCoverage >= .8) level = "strong";
    else if (summary.questions >= 10 || summary.sessions >= 2) level = "partial";
    const freshness = summary.lastContact
      ? summary.daysSinceContact >= STALE_AFTER_DAYS ? "stale" : "fresh"
      : "unknown";
    return { level, confidence, freshness };
  }

  function recommendationFor(level, freshness, relationship) {
    if (level === "strong" && freshness === "stale") return "Revisão curta + questões";
    if (level === "strong") return "Questões diagnósticas";
    if (relationship === "partial" || relationship === "composite" || level === "partial") return "Diagnóstico curto e estudo dos gaps";
    if (level === "contact") return "Teoria direcionada e questões";
    return "Teoria e questões";
  }

  function trustedMappingFor(base = {}, topic = {}) {
    if (!MAPPING?.matchTopicToConcepts) return null;
    const result = MAPPING.matchTopicToConcepts(topic, base);
    if (!result?.conceptKeys?.length || !mappingIsTrusted(result)) return null;
    return result;
  }

  function mappingWasRejected(base = {}, topic = {}) {
    if (!MAPPING?.mappingIdentity) return false;
    const identity = MAPPING.mappingIdentity(topic);
    return (base.mappingRejections || []).some((item) => item.topicIdentity === identity && item.basis === "user-rejected");
  }

  function derive({ base = null, topic = {}, currentPlanId = "", currentEvidence = {}, initialProfile = {}, legacyInheritance = null, now = Date.now() } = {}) {
    if (!base || !MAPPING?.matchTopicToConcepts) return legacyInheritance || emptyContext({ currentEvidence, initialProfile });
    if (mappingWasRejected(base, topic)) return emptyContext({ currentEvidence, initialProfile });
    const candidate = MAPPING.matchTopicToConcepts(topic, base);
    if (candidate?.status === "suggested") return emptyContext({ currentEvidence, initialProfile });
    const mapping = trustedMappingFor(base, topic);
    if (!mapping) return legacyInheritance || emptyContext({ currentEvidence, initialProfile });
    const evidence = inheritedEvidence(base, mapping.conceptKeys, currentPlanId);
    if (!evidence.length) return legacyInheritance || emptyContext({ currentEvidence, initialProfile });
    const summary = aggregateEvidence(evidence, now);
    const relationship = mapping.relationship || (mapping.conceptKeys.length > 1 ? "composite" : "partial");
    const inheritedCoverage = clamp(mapping.coverage ?? (relationship === "equivalent" ? 1 : 0));
    const mastery = masteryFor({ evidence, summary, relationship, mappingCoverage: inheritedCoverage, now });
    const current = Number(currentEvidence.questions) > 0 || Number(currentEvidence.sessions) > 0 || Number(currentEvidence.hours) > 0;
    const informed = initialProfile.level && initialProfile.level !== "unknown";
    const origin = current || informed ? "mixed" : "knowledge-base";
    const sourceNames = summary.sourcePlans;
    const reasons = [
      mastery.level === "strong" ? "base anterior forte" : mastery.level === "partial" ? "base anterior parcial" : "houve contato anterior",
      relationship === "partial" ? "a correspondência cobre apenas parte do tópico atual" : relationship === "composite" ? "a base reúne mais de um conceito histórico" : "o conhecimento foi relacionado por correspondência equivalente",
      summary.questions ? `${summary.questions} questões anteriores` : `${summary.sessions} sessões anteriores`,
      summary.accuracy === null ? "sem percentual histórico consolidado" : `${Math.round(summary.accuracy * 100)}% de acerto histórico`,
    ];
    return {
      available: true,
      label: { none: "Sem base", contact: "Contato prévio", partial: "Base prévia parcial", strong: "Base prévia forte" }[mastery.level],
      confidence: mastery.confidence,
      confidenceLabel: mastery.confidence >= .68 ? "high" : mastery.confidence >= .35 ? "medium" : "low",
      matchConfidence: mapping.confidence || "high",
      origin,
      diagnosisOrigin: origin,
      knowledgeBase: true,
      provisional: !current,
      recommendation: recommendationFor(mastery.level, mastery.freshness, relationship),
      profileMismatch: mastery.level !== "none" && initialProfile.level === "never-studied",
      inheritedCoverage,
      inheritedMastery: mastery.level,
      mapping: {
        status: mapping.status,
        relationship,
        conceptKeys: [...mapping.conceptKeys],
        matchBasis: mapping.matchBasis,
        coverage: inheritedCoverage,
      },
      evidence: {
        questions: summary.questions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracy,
        sessions: summary.sessions,
        studiedMinutes: summary.studiedMinutes,
        hours: summary.hours,
        lastContact: summary.lastContact,
        daysSinceContact: summary.daysSinceContact,
        sourcePlans: sourceNames,
      },
      mastery,
      metrics: {
        questions: summary.questions,
        correctAnswers: summary.correctAnswers,
        accuracy: summary.accuracy,
        sessions: summary.sessions,
        hours: summary.hours,
        studiedMinutes: summary.studiedMinutes,
        lastContact: summary.lastContact,
        daysSinceContact: summary.daysSinceContact,
      },
      sources: summary.sources.map((source) => ({ ...source, matchConfidence: mapping.confidence || "high", matchDirection: relationship })),
      sourcePlans: sourceNames,
      reasons,
      currentEvidenceExcluded: true,
    };
  }

  function emptyContext({ currentEvidence = {}, initialProfile = {} } = {}) {
    const current = Number(currentEvidence.questions) > 0 || Number(currentEvidence.sessions) > 0 || Number(currentEvidence.hours) > 0;
    return {
      available: false,
      label: "Sem base",
      confidence: 0,
      confidenceLabel: "low",
      matchConfidence: "low",
      origin: current ? "current-cycle" : initialProfile.level && initialProfile.level !== "unknown" ? "self-assessment" : "none",
      knowledgeBase: false,
      provisional: false,
      recommendation: "Teoria e questões",
      profileMismatch: false,
      inheritedCoverage: 0,
      inheritedMastery: "none",
      mapping: null,
      evidence: { questions: 0, correctAnswers: 0, accuracy: null, sessions: 0, studiedMinutes: 0, hours: 0, lastContact: 0, daysSinceContact: null, sourcePlans: [] },
      mastery: { level: "none", confidence: 0, freshness: "unknown" },
      metrics: { questions: 0, accuracy: null, sessions: 0, hours: 0, studiedMinutes: 0, lastContact: 0, daysSinceContact: null },
      sources: [],
      sourcePlans: [],
      reasons: ["nenhum conhecimento permanente confiável correspondente"],
    };
  }

  const api = { mappingIsTrusted, evidenceIdentity, inheritedEvidence, aggregateEvidence, trustedMappingFor, mappingWasRejected, derive, emptyContext };
  global.KnowledgeDiagnosis = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
