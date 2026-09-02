"use strict";

(function initErrorAnalysis(global) {
  const DAY = 24 * 60 * 60 * 1000;
  let cached = null;
  let cachedRevision = -1;

  function normalized(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function dateValue(value) {
    const date = value instanceof Date ? value : new Date(value || 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function errorCount(record = {}) {
    return Math.max(0, Number(record.quantidade ?? record.errors ?? record.erros ?? record.count) || 0);
  }

  function normalizeRecord(record = {}, index = 0) {
    const materia = record.materia || record.subject || record.subjectName || "";
    const assunto = record.assunto || record.topic || record.topicName || "";
    const recordedAt = record.registradaEm || record.createdAt || record.data || record.date || record.atualizadaEm || "";
    const sessionId = record.sessaoId || record.sessionId || record.origemSessao || record.sourceKey || `${recordedAt}:${index}`;
    return {
      id: record.id || `legacy-error:${index}`,
      materia,
      assunto,
      key: `${normalized(materia)}::${normalized(assunto)}`,
      subjectKey: normalized(materia),
      macrotema: record.macrotema || record.macroTopic || "",
      count: errorCount(record),
      recordedAt,
      time: dateValue(recordedAt),
      sessionId: String(sessionId),
      type: record.tipoErro || record.errorType || record.tipo || "",
      observation: record.observacao || record.observacoes || "",
      difficulty: record.dificuldade || "",
      reviewId: record.revisaoId || record.reviewId || "",
      interventionId: record.intervencaoId || record.interventionId || "",
    };
  }

  function interventionStartMap(records = []) {
    const starts = new Map();
    records.forEach((record) => {
      const materia = record.materia || "";
      const assunto = record.assunto || "";
      const key = `${normalized(materia)}::${normalized(assunto)}`;
      const intervention = record.intervencao || record.intervention || {};
      const time = dateValue(intervention.createdAt || intervention.initialDiagnosis?.recordedAt || record.criadaEm || record.createdAt);
      if (!key || !time) return;
      const prior = starts.get(key);
      if (!prior || time > prior) starts.set(key, time);
    });
    return starts;
  }

  function weightedCount(records, now) {
    return records.reduce((sum, record) => {
      const days = record.time ? Math.max(0, (now - record.time) / DAY) : 90;
      return sum + record.count * Math.pow(.5, days / 45);
    }, 0);
  }

  function aggregate(records = [], interventions = [], now = Date.now()) {
    const normalizedRecords = records.map(normalizeRecord).filter((record) => record.key !== "::" && record.count > 0);
    const starts = interventionStartMap(interventions);
    const groups = new Map();
    const subjectRecent = new Map();
    normalizedRecords.forEach((record) => {
      const group = groups.get(record.key) || { ...record, records: [], sessions: new Set(), postIntervention: 0 };
      group.records.push(record);
      group.sessions.add(record.sessionId);
      if (record.time >= (starts.get(record.key) || Infinity)) group.postIntervention += record.count;
      groups.set(record.key, group);
      if (record.time && now - record.time <= 90 * DAY) subjectRecent.set(record.subjectKey, (subjectRecent.get(record.subjectKey) || 0) + record.count);
    });
    const byTopic = new Map();
    groups.forEach((group, key) => {
      const recent = group.records.filter((record) => record.time && now - record.time <= 45 * DAY);
      const older = group.records.filter((record) => record.time && now - record.time > 45 * DAY && now - record.time <= 120 * DAY);
      const recentWeighted = weightedCount(recent, now);
      const olderWeighted = weightedCount(older, now);
      const recentSessions = new Set(recent.map((record) => record.sessionId)).size;
      const totalRecentForSubject = subjectRecent.get(group.subjectKey) || 0;
      const concentration = totalRecentForSubject ? recent.reduce((sum, record) => sum + record.count, 0) / totalRecentForSubject : 0;
      const recurrence = recentSessions >= 4 ? "high" : recentSessions >= 2 ? "moderate" : "low";
      const trend = recentWeighted <= 0 ? "insufficient" : olderWeighted > 0 && recentWeighted <= olderWeighted * .58 ? "improving" : olderWeighted > 0 && recentWeighted >= olderWeighted * 1.25 ? "worsening" : "stable";
      byTopic.set(key, {
        materia: group.materia,
        assunto: group.assunto,
        macrotema: group.macrotema,
        totalErrors: group.records.reduce((sum, record) => sum + record.count, 0),
        recentErrors: recent.reduce((sum, record) => sum + record.count, 0),
        weightedRecentErrors: recentWeighted,
        sessionsWithErrors: group.sessions.size,
        recentSessions,
        recurrence,
        concentration,
        postInterventionErrors: group.postIntervention,
        lastErrorAt: group.records.reduce((latest, record) => Math.max(latest, record.time), 0),
        errorTrend: trend,
        types: [...new Set(group.records.map((record) => record.type).filter(Boolean))],
      });
    });
    return { byTopic, generatedAt: now };
  }

  function snapshot({ errors = [], interventions = [], revision = 0, now = Date.now() } = {}) {
    if (cached && cachedRevision === Number(revision)) return cached;
    cached = aggregate(errors, interventions, now);
    cachedRevision = Number(revision);
    return cached;
  }

  function signalsFor(snapshotValue, materia = "", assunto = "") {
    const key = `${normalized(materia)}::${normalized(assunto)}`;
    const item = snapshotValue?.byTopic?.get(key);
    if (!item) return { available: false, recentErrors: 0, recurrence: "low", sessionsWithErrors: 0, postInterventionErrors: 0, concentration: 0, trend: "insufficient", types: [] };
    return {
      available: true,
      recentErrors: item.recentErrors,
      recurrence: item.recurrence,
      sessionsWithErrors: item.recentSessions,
      postInterventionErrors: item.postInterventionErrors,
      concentration: item.concentration,
      trend: item.errorTrend,
      types: item.types,
    };
  }

  function invalidate() {
    cached = null;
    cachedRevision = -1;
  }

  const api = { normalizeRecord, aggregate, snapshot, signalsFor, invalidate };
  global.ErrorAnalysis = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
