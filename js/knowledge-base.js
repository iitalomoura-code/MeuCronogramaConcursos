"use strict";

(function initKnowledgeBase(global) {
  const SCHEMA_VERSION = 2;
  const MAX_RELIABLE_SESSION_MINUTES = 240;
  const HISTORY = global.HistoryInheritance || (typeof require === "function" ? require("./history-inheritance.js") : null);
  const MAPPING = global.KnowledgeMapping || (typeof require === "function" ? require("./knowledge-mapping.js") : null);

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
      // A matéria é contexto da evidência, não uma família conceitual permanente.
      domain: "",
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
    const clock = raw.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
    if (clock) return Math.round(Number(clock[1]) * 60 + Number(clock[2]));
    const hours = raw.match(/(\d+(?:\.\d+)?)\s*(?:h|hora|horas)\b/);
    const minutes = raw.match(/(\d+(?:\.\d+)?)\s*(?:min|minuto|minutos)\b/);
    if (hours || minutes) return Math.round((Number(hours?.[1]) || 0) * 60 + (Number(minutes?.[1]) || 0));
    const number = Number(raw);
    return Number.isFinite(number) ? Math.round(Math.max(0, number) * (numericUnit === "hours" ? 60 : 1)) : 0;
  }

  function legacyTimeDetails(value) {
    if (typeof value === "string" && /(?:h|hora|min|:)/i.test(value)) return { minutes: normalizeMinutes(value), warning: "" };
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return { minutes: 0, warning: "" };
    // O formato atual registra horas decimais; backups antigos também têm minutos
    // inteiros. O limite confiável evita converter 45 min em 45 horas.
    if (number > 0 && number <= 4) return { minutes: Math.round(number * 60), warning: "" };
    if (Number.isInteger(number) && number >= 15 && number <= MAX_RELIABLE_SESSION_MINUTES) return { minutes: Math.round(number), warning: "" };
    if (number > MAX_RELIABLE_SESSION_MINUTES) return { minutes: Math.round(number), warning: "ambiguous-legacy-time" };
    return { minutes: Math.round(number), warning: "ambiguous-legacy-time" };
  }

  function originalCompletedAt(entry = {}) {
    return entry.completedAt || entry.concluidoEm || entry.closedAt || entry.savedAt || entry.createdAt || "";
  }

  function activityType(entry = {}) {
    return text(entry.activityType || entry.tipoAtividade || entry.tipo || entry.kind || "Estudo") || "Estudo";
  }

  function studiedMinutesDetails(entry = {}) {
    if (entry.studiedMinutes !== undefined) return { minutes: normalizeMinutes(entry.studiedMinutes), warning: "" };
    if (entry.durationMinutes !== undefined) return { minutes: normalizeMinutes(entry.durationMinutes), warning: "" };
    if (entry.tempoEstudado !== undefined) return legacyTimeDetails(entry.tempoEstudado);
    if (entry.tempo !== undefined) return legacyTimeDetails(entry.tempo);
    return { minutes: 0, warning: "" };
  }

  function studiedMinutes(entry = {}) {
    return studiedMinutesDetails(entry).minutes;
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
    const time = studiedMinutesDetails(entry);
    const evidence = {
      id: "",
      sourcePlanId: text(context.sourcePlanId || context.id || entry.sourceId),
      sourcePlanName: text(context.sourcePlanName || context.name || entry.sourceName),
      originalSubject: text(entry.materia || entry.subject),
      originalTopic: text(entry.assunto || entry.topic || entry.metaTitulo),
      originalTitle: text(concept.canonicalTitle),
      originalDetails: text(entry.conteudoBloco || entry.descricao || entry.descricaoTema || entry.metaConteudos || entry.conteudosOriginais),
      canonicalKey: concept.canonicalKey,
      canonicalTitle: concept.canonicalTitle,
      domain: concept.domain,
      sessionId: text(entry.sessaoId || entry.sessionId || entry.lastSavedSessionId || entry.eventId || entry.executionId),
      questions,
      correctAnswers,
      studiedMinutes: time.minutes,
      timeNormalizationWarning: time.warning,
      activityType: activityType(entry),
      difficulty: entry.dificuldade ?? entry.difficulty ?? null,
      completedAt: originalCompletedAt(entry),
      sourceType: text(context.sourceType || entry.sourceType || "legacy-backfill"),
      createdAt: text(entry.createdAt || entry.completedAt || entry.concluidoEm || context.createdAt),
      observedAt: text(entry.updatedAt || entry.atualizadoEm || context.observedAt),
    };
    evidence.id = evidenceIdentity(evidence);
    return evidence;
  }

  function dateValue(value = "") {
    const brazilian = text(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brazilian) {
      const [, day, month, year] = brazilian.map(Number);
      const date = new Date(year, month - 1, day).getTime();
      return Number.isFinite(date) ? date : 0;
    }
    const date = new Date(value).getTime();
    return Number.isFinite(date) && date >= new Date(2000, 0, 1).getTime() ? date : 0;
  }

  function factualCompleteness(item = {}) {
    return [item.questions, item.correctAnswers, item.studiedMinutes, item.completedAt, item.activityType, item.difficulty]
      .reduce((score, value) => score + (value === 0 || text(value) ? 1 : 0), 0);
  }

  function mergeEvidence(existing = {}, incoming = {}) {
    const existingObserved = dateValue(existing.observedAt || existing.updatedAt);
    const incomingObserved = dateValue(incoming.observedAt || incoming.updatedAt);
    const existingFacts = factualCompleteness(existing);
    const incomingFacts = factualCompleteness(incoming);
    // Uma sessão reextraída de snapshot observável corrige a evidência legada
    // sem observedAt. Nunca usamos números maiores como sinônimo de atualização.
    const preferIncoming = incomingObserved && existingObserved
      ? incomingObserved > existingObserved
      : incomingObserved && !existingObserved
        ? true
        : !incomingObserved && existingObserved
          ? false
          : incomingFacts > existingFacts;
    const preferred = preferIncoming ? incoming : existing;
    const secondary = preferIncoming ? existing : incoming;
    return {
      ...secondary,
      ...preferred,
      id: existing.id || incoming.id || evidenceIdentity(preferred),
      sourcePlanId: preferred.sourcePlanId || secondary.sourcePlanId,
      sourcePlanName: preferred.sourcePlanName || secondary.sourcePlanName,
      originalSubject: preferred.originalSubject || secondary.originalSubject,
      originalTopic: preferred.originalTopic || secondary.originalTopic,
      canonicalKey: preferred.canonicalKey || secondary.canonicalKey,
      canonicalTitle: preferred.canonicalTitle || secondary.canonicalTitle,
      createdAt: secondary.createdAt || preferred.createdAt,
    };
  }

  function dedupeEvidence(evidence = []) {
    const byIdentity = new Map();
    evidence.forEach((item) => {
      if (!item || !item.canonicalKey) return;
      const normalized = { ...item, domain: "", id: item.id || evidenceIdentity(item) };
      const previous = byIdentity.get(normalized.id);
      byIdentity.set(normalized.id, previous ? mergeEvidence(previous, normalized) : normalized);
    });
    return [...byIdentity.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  function emptyKnowledgeBase(now = nowIso()) {
    return {
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
      concepts: [],
      evidence: [],
      topicMappings: [],
      aliases: [],
      mappingRules: [],
      mappingRejections: [],
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
      evidence: Array.isArray(base.evidence) ? base.evidence.map((item) => ({
        ...item,
        domain: "",
        legacyTimeOutlier: Number(item.studiedMinutes) > MAX_RELIABLE_SESSION_MINUTES && !text(item.observedAt || item.updatedAt),
      })) : [],
      topicMappings: Array.isArray(base.topicMappings) ? base.topicMappings.map((item) => ({
        ...item,
        conceptKeys: sortedConceptKeys(item),
        status: item.status || (item.basis === "user-confirmed" ? "user-confirmed" : "auto-confirmed"),
      })) : [],
      aliases: dedupeAliases(base.aliases),
      mappingRules: dedupeMappingRules(base.mappingRules),
      mappingRejections: dedupeMappingRejections(base.mappingRejections),
    };
  }

  function sortedConceptKeys(item = {}) {
    return [...new Set((item.conceptKeys || [item.canonicalKey || item.conceptId?.replace(/^concept:/, "")]).filter(Boolean).map((key) => text(key).toLowerCase()))].sort((a, b) => a.localeCompare(b));
  }

  function dedupeAliases(items = []) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).map((item) => ({ ...item, aliasNormalized: text(item.aliasNormalized || item.aliasDisplay).toLowerCase(), conceptKey: text(item.conceptKey).toLowerCase(), subjectContext: text(item.subjectContext).toLowerCase() })).filter((item) => {
      const key = [item.aliasNormalized, item.conceptKey, item.subjectContext].join("|");
      if (!item.aliasNormalized || !item.conceptKey || seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => [a.aliasNormalized, a.conceptKey, a.subjectContext].join("|").localeCompare([b.aliasNormalized, b.conceptKey, b.subjectContext].join("|")));
  }

  function dedupeMappingRules(items = []) {
    const latest = new Map();
    const dateOf = (item) => dateValue(item.updatedAt || item.createdAt);
    (Array.isArray(items) ? items : []).map((item) => ({ ...item, conceptKeys: sortedConceptKeys(item), normalizedTargetTitle: text(item.normalizedTargetTitle).toLowerCase(), targetSubjectContext: text(item.targetSubjectContext).toLowerCase() })).filter((item) => item.normalizedTargetTitle && item.conceptKeys.length).forEach((item) => {
      const key = [item.normalizedTargetTitle, item.targetSubjectContext].join("|");
      const previous = latest.get(key);
      if (!previous || dateOf(item) > dateOf(previous) || (dateOf(item) === dateOf(previous) && JSON.stringify(item).localeCompare(JSON.stringify(previous)) > 0)) latest.set(key, item);
    });
    return [...latest.values()].sort((a, b) => [a.normalizedTargetTitle, a.targetSubjectContext].join("|").localeCompare([b.normalizedTargetTitle, b.targetSubjectContext].join("|")));
  }

  function dedupeMappingRejections(items = []) {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).map((item) => ({ ...item, conceptKeys: sortedConceptKeys(item) })).filter((item) => {
      const key = [text(item.topicIdentity), item.conceptKeys.join(",")].join("|");
      if (!text(item.topicIdentity) || seen.has(key)) return false;
      seen.add(key); return true;
    }).sort((a, b) => [a.topicIdentity, a.conceptKeys.join(",")].join("|").localeCompare([b.topicIdentity, b.conceptKeys.join(",")].join("|")));
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
        domain: "",
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
        domain: "",
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
      originalTitle: item.originalTitle || item.originalTopic,
      originalDetails: item.originalDetails || "",
      conceptId: `concept:${item.canonicalKey.replace(/\s+/g, "-")}`,
      canonicalKey: item.canonicalKey,
      conceptKeys: [item.canonicalKey],
      confidence: "exact-canonical-title",
      basis: "canonical-title-exact",
      status: "auto-confirmed",
      sourceType: item.sourceType,
    };
  }

  function dedupeMappings(mappings = []) {
    const seen = new Set();
    return mappings.filter((mapping) => {
      const key = [mapping.planId, mapping.topicId, mapping.originalSubject, mapping.originalTopic, (mapping.conceptKeys || [mapping.canonicalKey]).join(",")].map(text).join("|");
      if (!key.replace(/\|/g, "")) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((mapping) => ({
      ...mapping,
      conceptKeys: sortedConceptKeys(mapping),
      status: mapping.status || (mapping.basis === "user-confirmed" ? "user-confirmed" : "auto-confirmed"),
    }));
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
          observedAt: source.snapshot?.savedAt || source.data?.savedAt || source.updatedAt,
        });
        if (!evidence) return;
        const rawCorrect = Math.round(nonNegativeNumber(entry.correctAnswers ?? entry.acertos));
        if (evidence.questions && rawCorrect > evidence.questions) {
          warnings.push({ type: "correct-answers-clamped", evidenceId: evidence.id, sourcePlanId: evidence.sourcePlanId });
        }
        if (evidence.timeNormalizationWarning) {
          warnings.push({ type: evidence.timeNormalizationWarning, evidenceId: evidence.id, sourcePlanId: evidence.sourcePlanId });
        }
        additions.push(evidence);
      });
    });
    // Reprocessar fontes acessíveis torna esta sanitização idempotente: uma
    // sessão antiga com 2700 min é substituída pelos fatos do snapshot atual.
    const evidence = dedupeEvidence([...normalizedBase.evidence, ...additions]).map((item) => ({
      ...item,
      legacyTimeOutlier: Number(item.studiedMinutes) > MAX_RELIABLE_SESSION_MINUTES && !text(item.observedAt || item.updatedAt),
    }));
    const concepts = [...conceptMap(normalizedBase.concepts, evidence).values()];
    const mappings = dedupeMappings([...normalizedBase.topicMappings, ...evidence.map(mappingFromEvidence)]);
    return {
      ...normalizedBase,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowIso(),
      concepts,
      evidence,
      topicMappings: mappings,
      aliases: dedupeAliases(normalizedBase.aliases),
      mappingRules: dedupeMappingRules(normalizedBase.mappingRules),
      mappingRejections: dedupeMappingRejections(normalizedBase.mappingRejections),
      warnings: [...warnings, ...evidence.filter((item) => item.legacyTimeOutlier).map((item) => ({ type: "legacy-time-outlier-needs-reconciliation", evidenceId: item.id, sourcePlanId: item.sourcePlanId }))],
    };
  }

  function summarizeConceptEvidence(base = {}, keyOrConcept = "") {
    const key = typeof keyOrConcept === "object" ? keyOrConcept.canonicalKey : normalizeConcept(keyOrConcept).canonicalKey || text(keyOrConcept);
    const evidence = (base.evidence || []).filter((item) => item.canonicalKey === key);
    const questions = evidence.reduce((sum, item) => sum + (Number(item.questions) || 0), 0);
    const correctAnswers = evidence.reduce((sum, item) => sum + (Number(item.correctAnswers) || 0), 0);
    const studiedMinutes = evidence.reduce((sum, item) => sum + (Number(item.studiedMinutes) || 0), 0);
    const dates = evidence.map((item) => ({ raw: item.completedAt, value: dateValue(item.completedAt) })).filter((item) => item.value).sort((left, right) => left.value - right.value);
    return {
      canonicalKey: key,
      canonicalTitle: evidence[0]?.canonicalTitle || (base.concepts || []).find((concept) => concept.canonicalKey === key)?.canonicalTitle || "",
      evidenceCount: evidence.length,
      sourcePlanCount: new Set(evidence.map((item) => item.sourcePlanId).filter(Boolean)).size,
      questions,
      correctAnswers,
      accuracy: questions ? correctAnswers / questions : null,
      studiedMinutes,
      firstCompletedAt: dates[0]?.raw || "",
      lastCompletedAt: dates[dates.length - 1]?.raw || "",
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
      mappings: (base.topicMappings || []).filter((item) => (item.conceptKeys || [item.canonicalKey]).includes(summary.canonicalKey)).map((item) => ({ ...item })),
    };
  }

  function mapTopic(base = {}, topic = {}, options = {}) {
    return MAPPING?.matchTopicToConcepts ? MAPPING.matchTopicToConcepts(topic, normalizeExistingBase(base), options) : null;
  }

  function decideTopicMapping(base = {}, mapping = {}, decision = "confirm") {
    return MAPPING?.applyMappingDecision ? MAPPING.applyMappingDecision(normalizeExistingBase(base), mapping, decision) : normalizeExistingBase(base);
  }

  function revokeTopicMapping(base = {}, mapping = {}, options = {}) {
    return MAPPING?.revokeMappingDecision ? MAPPING.revokeMappingDecision(normalizeExistingBase(base), mapping, options) : normalizeExistingBase(base);
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
    legacyTimeDetails,
    mergeEvidence,
    emptyKnowledgeBase,
    dedupeAliases,
    dedupeMappingRules,
    dedupeMappingRejections,
    mapTopic,
    decideTopicMapping,
    revokeTopicMapping,
    migrateKnowledgeMappings: (base) => MAPPING?.migrateKnowledgeMappings ? MAPPING.migrateKnowledgeMappings(normalizeExistingBase(base)) : normalizeExistingBase(base),
  };
  global.KnowledgeBase = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
