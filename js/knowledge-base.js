"use strict";

(function initKnowledgeBase(global) {
  const SCHEMA_VERSION = 1;
  const HISTORY = global.HistoryInheritance || (typeof require === "function" ? require("./history-inheritance.js") : null);

  function nowIso() {
    return new Date().toISOString();
  }

  function text(value = "") {
    return String(value || "").trim();
  }

  function normalizeConcept(value = "") {
    const title = text(value);
    const canonical = HISTORY?.normalize ? HISTORY.normalize(title) : title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return {
      id: canonical ? `concept:${canonical.replace(/\s+/g, "-")}` : "",
      canonicalKey: canonical,
      canonicalTitle: title,
      domain: "",
    };
  }

  function conceptFromHistoricalEntry(entry = {}) {
    const canonical = HISTORY?.canonicalHistoricalTopic
      ? HISTORY.canonicalHistoricalTopic(entry)
      : { title: entry.metaTitulo || text(entry.assunto).split(":")[0], subject: entry.materia || "" };
    const concept = normalizeConcept(canonical.title || entry.assunto);
    return {
      ...concept,
      canonicalTitle: text(canonical.title) || concept.canonicalTitle,
      domain: text(canonical.subject || entry.materia),
    };
  }

  function nonNegativeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function normalizeMinutes(value, { numericUnit = "minutes" } = {}) {
    if (typeof value === "number") return Math.round(nonNegativeNumber(value) * (numericUnit === "hours" ? 60 : 1));
    const raw = text(value).toLowerCase().replace(",", ".");
    if (!raw) return 0;
    const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hora|horas)\b/);
    const minutes = raw.match(/(\d+(?:\.\d+)?)\s*(?:min|minuto|minutos)\b/);
    if (hours || minutes) return Math.round((Number(hours?.[1]) || 0) * 60 + (Number(minutes?.[1]) || 0));
    const number = Number(raw);
    return Number.isFinite(number) ? Math.round(Math.max(0, number) * (numericUnit === "hours" ? 60 : 1)) : 0;
  }

  function originalCompletedAt(entry = {}) {
    return entry.completedAt || entry.concluidoEm || entry.closedAt || entry.savedAt || entry.createdAt || "";
  }

  function activityType(entry = {}) {
    return text(entry.activityType || entry.tipoAtividade || entry.tipo || entry.kind || "Estudo") || "Estudo";
  }

  function studiedMinutes(entry = {}) {
    if (entry.studiedMinutes !== undefined) return normalizeMinutes(entry.studiedMinutes);
    if (entry.durationMinutes !== undefined) return normalizeMinutes(entry.durationMinutes);
    if (entry.tempoEstudado !== undefined) return normalizeMinutes(entry.tempoEstudado, { numericUnit: "hours" });
    if (entry.tempo !== undefined) return normalizeMinutes(entry.tempo, { numericUnit: "hours" });
    return 0;
  }

  function evidenceIdentity(evidence = {}) {
    const sourcePlanId = text(evidence.sourcePlanId || evidence.planId || evidence.sourceId || "local");
    const sessionId = text(evidence.sessionId || evidence.sessaoId || evidence.lastSavedSessionId || evidence.eventId || evidence.executionId);
    if (sessionId) return `session:${sourcePlanId}:${sessionId}`;
    return [
      "fallback",
      sourcePlanId,
      text(evidence.canonicalKey || normalizeConcept(evidence.canonicalTitle || evidence.originalTopic).canonicalKey),
      text(evidence.completedAt),
      Math.max(0, Number(evidence.questions) || 0),
      Math.max(0, Number(evidence.correctAnswers) || 0),
      Math.max(0, Number(evidence.studiedMinutes) || 0),
    ].join(":");
  }

  function evidenceFromStudyEntry(entry = {}, context = {}) {
    const concept = conceptFromHistoricalEntry(entry);
    if (!concept.canonicalKey) return null;
    const questions = Math.round(nonNegativeNumber(entry.questions ?? entry.questoes));
    const rawCorrect = Math.round(nonNegativeNumber(entry.correctAnswers ?? entry.acertos));
    const correctAnswers = questions ? Math.min(rawCorrect, questions) : 0;
    const evidence = {
      id: "",
      sourcePlanId: text(context.sourcePlanId || context.id || entry.sourceId),
      sourcePlanName: text(context.sourcePlanName || context.name || entry.sourceName),
      originalSubject: text(entry.materia || entry.subject),
      originalTopic: text(entry.assunto || entry.topic || entry.metaTitulo),
      canonicalKey: concept.canonicalKey,
      canonicalTitle: concept.canonicalTitle,
      domain: concept.domain,
      sessionId: text(entry.sessaoId || entry.sessionId || entry.lastSavedSessionId || entry.eventId || entry.executionId),
      questions,
      correctAnswers,
      studiedMinutes: studiedMinutes(entry),
      activityType: activityType(entry),
      difficulty: entry.dificuldade ?? entry.difficulty ?? null,
      completedAt: originalCompletedAt(entry),
      sourceType: text(context.sourceType || entry.sourceType || "legacy-backfill"),
      createdAt: text(entry.createdAt || entry.completedAt || entry.concluidoEm || context.createdAt),
    };
    evidence.id = evidenceIdentity(evidence);
    return evidence;
  }

  function dedupeEvidence(evidence = []) {
    const seen = new Set();
    return evidence.filter((item) => {
      if (!item || !item.canonicalKey) return false;
      const identity = item.id || evidenceIdentity(item);
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }).map((item) => ({ ...item, id: item.id || evidenceIdentity(item) }));
  }

  function emptyKnowledgeBase(now = nowIso()) {
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      concepts: [],
      evidence: [],
      topicMappings: [],
    };
  }

  function normalizeExistingBase(base = {}) {
    const createdAt = text(base.createdAt) || nowIso();
    return {
      ...emptyKnowledgeBase(createdAt),
      ...base,
      schemaVersion: SCHEMA_VERSION,
      createdAt,
      concepts: Array.isArray(base.concepts) ? base.concepts.map((concept) => ({ ...concept })) : [],
      evidence: Array.isArray(base.evidence) ? base.evidence.map((item) => ({ ...item })) : [],
      topicMappings: Array.isArray(base.topicMappings) ? base.topicMappings.map((item) => ({ ...item })) : [],
    };
  }

  function conceptMap(concepts = [], evidence = []) {
    const map = new Map();
    concepts.forEach((concept) => {
      const normalized = normalizeConcept(concept.canonicalTitle || concept.canonicalKey);
      if (!normalized.canonicalKey) return;
      map.set(normalized.canonicalKey, {
        id: concept.id || normalized.id,
        canonicalKey: normalized.canonicalKey,
        canonicalTitle: text(concept.canonicalTitle) || normalized.canonicalTitle,
        domain: text(concept.domain),
        createdAt: text(concept.createdAt) || nowIso(),
        updatedAt: text(concept.updatedAt) || text(concept.createdAt) || nowIso(),
      });
    });
    evidence.forEach((item) => {
      if (!item?.canonicalKey) return;
      const existing = map.get(item.canonicalKey);
      const createdAt = existing?.createdAt || item.createdAt || item.completedAt || nowIso();
      map.set(item.canonicalKey, {
        id: existing?.id || `concept:${item.canonicalKey.replace(/\s+/g, "-")}`,
        canonicalKey: item.canonicalKey,
        canonicalTitle: existing?.canonicalTitle || item.canonicalTitle,
        domain: existing?.domain || item.domain || "",
        createdAt,
        updatedAt: item.createdAt || item.completedAt || existing?.updatedAt || createdAt,
      });
    });
    return map;
  }

  function mappingFromEvidence(item = {}) {
    return {
      planId: item.sourcePlanId,
      originalSubject: item.originalSubject,
      originalTopic: item.originalTopic,
      conceptId: `concept:${item.canonicalKey.replace(/\s+/g, "-")}`,
      canonicalKey: item.canonicalKey,
      confidence: "exact-canonical-title",
      sourceType: item.sourceType,
    };
  }

  function dedupeMappings(mappings = []) {
    const seen = new Set();
    return mappings.filter((mapping) => {
      const key = [mapping.planId, mapping.originalSubject, mapping.originalTopic, mapping.canonicalKey].map(text).join("|");
      if (!key.replace(/\|/g, "")) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((mapping) => ({ ...mapping }));
  }

  // The caller decides which accessible plan snapshots are relevant to a bootstrap.
  // This module never searches the learner's history by itself.
  function buildKnowledgeBase(base = {}, sources = []) {
    const normalizedBase = normalizeExistingBase(base);
    const warnings = [];
    const additions = [];
    (Array.isArray(sources) ? sources : []).forEach((source) => {
      const entries = HISTORY?.snapshotBlocks ? HISTORY.snapshotBlocks(source) : [];
      entries.forEach((entry) => {
        const evidence = evidenceFromStudyEntry(entry, {
          sourcePlanId: source.id || entry.sourceId,
          sourcePlanName: source.name || entry.sourceName,
          sourceType: source.sourceType || "legacy-backfill",
        });
        if (!evidence) return;
        const rawCorrect = Math.round(nonNegativeNumber(entry.correctAnswers ?? entry.acertos));
        if (evidence.questions && rawCorrect > evidence.questions) {
          warnings.push({ type: "correct-answers-clamped", evidenceId: evidence.id, sourcePlanId: evidence.sourcePlanId });
        }
        additions.push(evidence);
      });
    });
    const evidence = dedupeEvidence([...normalizedBase.evidence, ...additions]);
    const concepts = [...conceptMap(normalizedBase.concepts, evidence).values()];
    const mappings = dedupeMappings([...normalizedBase.topicMappings, ...evidence.map(mappingFromEvidence)]);
    return {
      ...normalizedBase,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowIso(),
      concepts,
      evidence,
      topicMappings: mappings,
      warnings,
    };
  }

  function summarizeConceptEvidence(base = {}, keyOrConcept = "") {
    const key = typeof keyOrConcept === "object" ? keyOrConcept.canonicalKey : normalizeConcept(keyOrConcept).canonicalKey || text(keyOrConcept);
    const evidence = (base.evidence || []).filter((item) => item.canonicalKey === key);
    const questions = evidence.reduce((sum, item) => sum + (Number(item.questions) || 0), 0);
    const correctAnswers = evidence.reduce((sum, item) => sum + (Number(item.correctAnswers) || 0), 0);
    const studiedMinutes = evidence.reduce((sum, item) => sum + (Number(item.studiedMinutes) || 0), 0);
    const dates = evidence.map((item) => item.completedAt).filter(Boolean);
    return {
      canonicalKey: key,
      canonicalTitle: evidence[0]?.canonicalTitle || (base.concepts || []).find((concept) => concept.canonicalKey === key)?.canonicalTitle || "",
      evidenceCount: evidence.length,
      sourcePlanCount: new Set(evidence.map((item) => item.sourcePlanId).filter(Boolean)).size,
      questions,
      correctAnswers,
      accuracy: questions ? correctAnswers / questions : null,
      studiedMinutes,
      firstCompletedAt: dates[0] || "",
      lastCompletedAt: dates[dates.length - 1] || "",
    };
  }

  function inspectKnowledgeBase(base = {}) {
    const normalized = normalizeExistingBase(base);
    return {
      schemaVersion: normalized.schemaVersion,
      concepts: normalized.concepts.length,
      evidence: normalized.evidence.length,
      mappings: normalized.topicMappings.length,
      sourcePlans: new Set(normalized.evidence.map((item) => item.sourcePlanId).filter(Boolean)).size,
      warnings: Array.isArray(normalized.warnings) ? normalized.warnings.length : 0,
    };
  }

  function inspectConcept(base = {}, keyOrConcept = "") {
    const summary = summarizeConceptEvidence(base, keyOrConcept);
    return {
      ...summary,
      evidence: (base.evidence || []).filter((item) => item.canonicalKey === summary.canonicalKey).map((item) => ({ ...item })),
      mappings: (base.topicMappings || []).filter((item) => item.canonicalKey === summary.canonicalKey).map((item) => ({ ...item })),
    };
  }

  const api = {
    SCHEMA_VERSION,
    normalizeConcept,
    conceptFromHistoricalEntry,
    evidenceFromStudyEntry,
    evidenceIdentity,
    dedupeEvidence,
    summarizeConceptEvidence,
    buildKnowledgeBase,
    inspectKnowledgeBase,
    inspectConcept,
    normalizeMinutes,
    emptyKnowledgeBase,
  };
  global.KnowledgeBase = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
