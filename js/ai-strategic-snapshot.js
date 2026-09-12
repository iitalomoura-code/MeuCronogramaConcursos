"use strict";

(function initAIStrategicSnapshot(global) {
  const Confidence = global.DiagnosticConfidence || (typeof require === "function" ? require("./diagnostic-confidence.js") : null);
  const DAY = 24 * 60 * 60 * 1000;
  const VERSION = 1;
  const text = (value = "") => String(value ?? "").trim();
  const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
  const unique = (values = []) => [...new Set(values.filter(Boolean))];

  function dateValue(value) {
    if (value instanceof Date) return value.getTime();
    const raw = text(value);
    if (!raw) return 0;
    const brazilian = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const date = brazilian
      ? new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]))
      : new Date(raw);
    return Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }

  function isoDate(value) {
    const time = dateValue(value);
    return time ? new Date(time).toISOString() : null;
  }

  function nowTime(value) {
    const time = dateValue(value);
    return time || 0;
  }

  function factualEntry(entry = {}) {
    const questions = Math.max(0, Number(entry.questions ?? entry.questoes) || 0);
    const correctAnswers = Math.min(questions, Math.max(0, Number(entry.correctAnswers ?? entry.acertos) || 0));
    return {
      questions,
      correctAnswers,
      studiedMinutes: Math.max(0, Number(entry.studiedMinutes ?? entry.tempoEstudadoMinutes ?? entry.tempoEstudadoMinutos) || 0),
      completedAt: isoDate(entry.completedAt || entry.concluidoEm || entry.observedAt || entry.atualizadoEm),
    };
  }

  function currentEvidence(input = {}, diagnosis = {}) {
    const raw = input || {};
    const entries = Array.isArray(raw.entries) ? raw.entries.map(factualEntry) : [];
    const questions = Math.max(0, Number(raw.questions ?? diagnosis.questions) || entries.reduce((sum, item) => sum + item.questions, 0));
    const correctSource = raw.correctAnswers ?? raw.correct ?? diagnosis.correct;
    const correctAnswers = questions
      ? Math.min(questions, Math.max(0, Number(correctSource !== undefined ? correctSource : entries.reduce((sum, item) => sum + item.correctAnswers, 0)) || 0))
      : 0;
    const studiedMinutes = Math.max(0, Number(raw.studiedMinutes ?? diagnosis.studiedMinutes) || entries.reduce((sum, item) => sum + item.studiedMinutes, 0));
    const dates = entries.map((item) => dateValue(item.completedAt)).filter(Boolean);
    const lastContact = isoDate(raw.lastContact) || (Math.max(...dates, 0) ? new Date(Math.max(...dates)).toISOString() : null);
    return {
      questions,
      correctAnswers,
      accuracy: questions ? Number((correctAnswers / questions).toFixed(4)) : null,
      sessions: Math.max(0, Number(raw.sessions ?? raw.sessionCount ?? diagnosis.sessionCount) || entries.filter((item) => item.questions > 0 || item.studiedMinutes > 0).length),
      studiedMinutes,
      lastContact,
      recentAccuracy: numberOrNull(raw.recentAccuracy ?? diagnosis.accuracy),
      trend: text(raw.trend?.label || raw.trend || diagnosis.trend?.label || diagnosis.trend) || "insufficient",
      recurringErrors: raw.recurringErrors ?? raw.errorSignals?.recurrence ?? diagnosis.errorSignals?.recurrence ?? "low",
      difficultyObserved: text(raw.difficultyObserved || raw.difficulty || "") || null,
      interventions: sanitizeInterventions(raw.interventions || raw.interventionHistory || []),
      reviewResults: sanitizeReviewResults(raw.reviewResults || raw.reviews || []),
    };
  }

  function sanitizeErrorSignals(signals = {}) {
    return {
      recentErrors: numberOrNull(signals.recentErrors) ?? 0,
      recurrence: text(signals.recurrence) || "low",
      concentration: numberOrNull(signals.concentration) ?? 0,
      postInterventionErrors: numberOrNull(signals.postInterventionErrors) ?? 0,
      types: unique((signals.types || []).map(text)).slice(0, 8),
      trend: text(signals.trend) || "insufficient",
    };
  }

  function sanitizeInterventions(items = []) {
    const list = Array.isArray(items) ? items : items ? [items] : [];
    return list.slice(-8).map((item) => ({
      kind: text(item.kind || item.type || item.intensidade) || null,
      label: text(item.label || item.recommendation?.label) || null,
      result: text(item.result || item.lastResult || item.statusDepois) || null,
      recordedAt: isoDate(item.recordedAt || item.createdAt || item.atualizadaEm),
      ineffective: Boolean(item.ineffective || Number(item.ineffectiveInterventions) > 0),
    }));
  }

  function sanitizeReviewResults(items = []) {
    const list = Array.isArray(items) ? items : items ? [items] : [];
    return list.slice(-8).map((item) => ({
      status: text(item.status || item.result) || null,
      questions: Math.max(0, Number(item.questions ?? item.questoes ?? item.totalQuestoes) || 0),
      correctAnswers: Math.max(0, Number(item.correctAnswers ?? item.acertos) || 0),
      recordedAt: isoDate(item.recordedAt || item.registradaEm || item.createdAt),
    }));
  }

  function sanitizeInherited(input = {}, now = 0) {
    const mapping = input.mapping || {};
    const mappingStatus = text(input.mappingStatus || mapping.status);
    const confirmed = !["suggested", "unmatched", "user-rejected", "rejected"].includes(mappingStatus);
    const lastContact = isoDate(input.lastContact || input.metrics?.lastContact || input.evidence?.lastContact);
    const available = Boolean(input.available || input.knowledgeBase) && confirmed;
    return {
      available,
      knowledgeConfirmed: available,
      source: available
        ? (input.knowledgeBase ? "permanent-knowledge" : /previous|legacy|history/i.test(text(input.origin)) ? "legacy-history-fallback" : "historical-reference")
        : "none",
      level: text(input.level || input.inheritedMastery || input.mastery?.level) || "none",
      confidence: clamp(input.confidence ?? input.mastery?.confidence),
      confidenceLevel: text(input.confidenceLabel || (Number(input.confidence) >= .68 ? "high" : Number(input.confidence) >= .35 ? "medium" : "low")) || "low",
      accuracy: numberOrNull(input.accuracy ?? input.metrics?.accuracy ?? input.evidence?.accuracy),
      questions: Math.max(0, Number(input.questions ?? input.metrics?.questions ?? input.evidence?.questions) || 0),
      sessions: Math.max(0, Number(input.sessions ?? input.metrics?.sessions ?? input.evidence?.sessions) || 0),
      studiedMinutes: Math.max(0, Number(input.studiedMinutes ?? input.metrics?.studiedMinutes ?? input.evidence?.studiedMinutes) || 0),
      lastContact,
      freshness: text(input.freshness || input.mastery?.freshness) || "unknown",
      coverage: clamp(input.inheritedCoverage ?? input.coverage ?? mapping.coverage),
      relationship: text(input.relationship || mapping.relationship) || "unknown",
      mappingStatus: mappingStatus || "unknown",
      mappingConfidence: text(input.matchConfidence || mapping.confidence) || "unknown",
      sourcePlans: unique((input.sourcePlans || input.evidence?.sourcePlans || []).map(text)).slice(0, 6),
      daysSinceContact: lastContact && now ? Math.max(0, Math.floor((now - dateValue(lastContact)) / DAY)) : null,
    };
  }

  function topicIdentity(topic = {}) {
    return [text(topic.subject || topic.materia), text(topic.subarea), text(topic.topic || topic.assunto || topic.titulo)].join("|").toLowerCase();
  }

  function normalizeLearningState(state = {}) {
    if (typeof state === "string") return { key: state, label: state };
    return { key: text(state.key) || "unknown", label: text(state.label) || text(state.key) || "Desconhecido" };
  }

  function scoreComponents(value) {
    if (!value || typeof value !== "object") return null;
    return Object.keys(value).sort().reduce((result, key) => {
      const number = numberOrNull(value[key]);
      if (number !== null) result[key] = number;
      return result;
    }, {});
  }

  function buildTopic(topic = {}, { now = 0, subject = {} } = {}) {
    const diagnosis = topic.diagnosis || {};
    const current = currentEvidence(topic.currentEvidence || topic.current || diagnosis.evidence || {}, diagnosis);
    const confidence = Confidence?.calculate?.({ diagnosis, evidence: topic.currentEvidence || topic.current || diagnosis.evidence || current, now }) || {
      value: numberOrNull(diagnosis.confidence) ?? 0,
      level: text(diagnosis.confidenceLevel) || "low",
      label: "Baixa confiança",
      evidenceStage: text(diagnosis.evidenceStage) || "unknown",
      reasons: [],
      limitations: [],
    };
    const inherited = sanitizeInherited(topic.inheritedKnowledge || topic.historyInheritance || diagnosis.historyInheritance || {}, now);
    const learningState = normalizeLearningState(topic.learningState || diagnosis.learningState || {});
    const strategicSource = topic.strategic || topic.strategicPriority || {};
    const strategic = {
      score: numberOrNull(strategicSource.score),
      band: text(strategicSource.band) || null,
      rank: numberOrNull(strategicSource.rank ?? strategicSource.queueRank),
      recommendedSession: text(strategicSource.recommendedSession?.label || strategicSource.recommendedSession || strategicSource.sessionType) || null,
      learningState: normalizeLearningState(strategicSource.learningState || learningState),
      reasons: (strategicSource.reasons || []).map(text).filter(Boolean).slice(0, 6),
      scoreComponents: scoreComponents(strategicSource.scoreComponents),
    };
    const lastContact = current.lastContact;
    const daysWithoutContact = numberOrNull(topic.daysWithoutContact ?? diagnosis.daysWithoutContact);
    const maintenanceDue = Boolean(topic.maintenanceDue || learningState.key === "maintenance");
    return {
      subject: text(topic.subject || topic.materia || subject.name),
      topic: text(topic.topic || topic.assunto || topic.titulo),
      subarea: text(topic.subarea) || null,
      importance: {
        score: numberOrNull(topic.importance ?? subject.importance?.score ?? subject.importance),
        examWeight: numberOrNull(topic.examWeight ?? subject.examWeight),
      },
      diagnosis: {
        masteryLevel: text(diagnosis.masteryLevel || diagnosis.level) || "insufficient",
        confidence: confidence.value,
        confidenceLevel: confidence.level,
        evidenceStage: confidence.evidenceStage,
        currentAccuracy: current.accuracy,
        historicalAccuracy: inherited.accuracy,
        trend: text(diagnosis.trend?.label || diagnosis.trend || current.trend) || "insufficient",
        learningState,
        needsDiagnostic: Boolean(diagnosis.needsDiagnostic),
        recoveryEvidence: Boolean(topic.recoveryEvidence ?? diagnosis.recoveryEvidence ?? diagnosis.hasRecoveryEvidence),
        reasons: (diagnosis.reasons || []).map(text).filter(Boolean).slice(0, 6),
      },
      confidence: {
        value: confidence.value,
        level: confidence.level,
        label: confidence.label,
        evidenceStage: confidence.evidenceStage,
        reasons: confidence.reasons || [],
        limitations: confidence.limitations || [],
      },
      currentEvidence: current,
      inheritedKnowledge: inherited,
      selfAssessment: topic.selfAssessment || topic.initialProfile ? {
        level: text(topic.selfAssessment?.level || topic.initialProfile?.level) || "unknown",
        label: text(topic.selfAssessment?.label || topic.initialProfile?.label) || null,
      } : { level: "unknown", label: null },
      strategic,
      errors: sanitizeErrorSignals(topic.errorSignals || topic.errors || diagnosis.errorSignals || {}),
      recency: { lastContact, daysWithoutContact },
      coverage: numberOrNull(topic.coverage) ?? 0,
      maintenanceDue,
      interventions: current.interventions,
      reviewResults: current.reviewResults,
    };
  }

  function normalizeSubject(subject = {}, topics = [], now = 0) {
    const name = text(subject.name || subject.materia || subject.subject);
    const subjectTopics = topics.filter((topic) => topic.subject === name);
    const rawConfidence = subjectTopics.length
      ? subjectTopics.reduce((sum, topic) => sum + topic.confidence.value, 0) / subjectTopics.length
      : clamp(subject.diagnosticConfidence);
    const topicCount = Math.max(0, Number(subject.topicCount ?? subject.assuntos?.length) || subjectTopics.length);
    const studiedTopicCount = Math.max(0, Number(subject.studiedTopicCount) || subjectTopics.filter((topic) => topic.currentEvidence.questions > 0 || topic.currentEvidence.sessions > 0).length);
    const coverage = numberOrNull(subject.coverage) ?? (topicCount ? studiedTopicCount / topicCount : 0);
    const coverageAdjustedConfidence = topicCount ? rawConfidence * (.5 + .5 * clamp(coverage)) : rawConfidence;
    return {
      name,
      importance: {
        score: numberOrNull(subject.importance?.score ?? subject.importance ?? subject.examImportance?.importanceScore),
        estimatedPercentage: numberOrNull(subject.estimatedPercentage ?? subject.examImportance?.estimatedPercentage),
      },
      difficulty: numberOrNull(subject.difficulty ?? subject.dominio),
      examWeight: numberOrNull(subject.examWeight ?? subject.peso ?? subject.examImportance?.weight),
      incidence: typeof subject.incidence === "object" && subject.incidence !== null
        ? { value: numberOrNull(subject.incidence.normalized ?? subject.incidence.value), source: text(subject.incidence.source || subject.incidence.basis) || null }
        : numberOrNull(subject.incidence),
      topicCount,
      studiedTopicCount,
      coverage,
      diagnosticConfidence: Number(coverageAdjustedConfidence.toFixed(3)),
      strategicShare: numberOrNull(subject.strategicShare),
      topics: subjectTopics.map((topic) => topic.topic),
    };
  }

  function distribution(items = [], mode = "planned") {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const subject = text(item.subject || item.materia);
      const topic = text(item.topic || item.assunto || item.titulo);
      if (!subject && !topic) return;
      const activity = text(item.activityType || item.tipoAtividade || item.tipo) || "Estudo";
      const amount = mode === "executed"
        ? Math.max(0, Number(item.studiedMinutes ?? item.tempoEstudadoMinutes ?? item.tempoEstudadoMinutos) || 0)
        : Math.max(0, Number(item.plannedMinutes ?? item.durationMinutes ?? item.duracaoMinutos) || 0);
      const key = [subject, topic, activity].join("|");
      const current = map.get(key) || { subject, topic, activityType: activity, minutes: 0 };
      current.minutes += amount;
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => [a.subject, a.topic, a.activityType].join("|").localeCompare([b.subject, b.topic, b.activityType].join("|")));
  }

  function rollingWindow(value) {
    if (!value || typeof value !== "object") return null;
    return {
      weeks: Math.max(0, Number(value.weeks ?? value.activeWeeks) || 0),
      questions: numberOrNull(value.questions),
      accuracy: numberOrNull(value.accuracy),
      studyMinutes: numberOrNull(value.studyMinutes ?? value.studiedMinutes),
      coverage: numberOrNull(value.coverage),
      confidence: numberOrNull(value.confidence),
    };
  }

  function normalizeCycle(cycle = {}, input = {}) {
    const weeklyHours = numberOrNull(cycle.weeklyHours ?? input.weeklyHours);
    const totalCapacityMinutes = Math.max(0, Number(cycle.totalCapacityMinutes ?? cycle.weeklyCapacityMinutes ?? input.totalCapacityMinutes) || (weeklyHours || 0) * 60);
    const plannedMinutes = Math.max(0, Number(cycle.plannedMinutes) || 0);
    const executedMinutes = Math.max(0, Number(cycle.executedMinutes ?? cycle.completedMinutes) || 0);
    const remainingSource = cycle.remainingPlannedMinutes !== undefined
      ? Number(cycle.remainingPlannedMinutes)
      : plannedMinutes - executedMinutes;
    const reserveSource = cycle.reserveMinutes !== undefined
      ? Number(cycle.reserveMinutes)
      : totalCapacityMinutes - plannedMinutes;
    return {
      weeklyHours,
      totalCapacityMinutes,
      plannedMinutes,
      executedMinutes,
      questions: numberOrNull(cycle.questions),
      accuracy: numberOrNull(cycle.accuracy),
      studyMinutes: numberOrNull(cycle.studyMinutes),
      coverage: numberOrNull(cycle.coverage),
      confidence: numberOrNull(cycle.confidence),
      remainingPlannedMinutes: Math.max(0, Number.isFinite(remainingSource) ? remainingSource : 0),
      reserveMinutes: Math.max(0, Number.isFinite(reserveSource) ? reserveSource : 0),
      status: text(cycle.status) || "active",
      remainingMeaning: "capacidade planejada ainda não utilizada",
    };
  }

  function cycleMetrics(cycle = {}) {
    return {
      questions: numberOrNull(cycle.questions),
      accuracy: numberOrNull(cycle.accuracy),
      studyMinutes: numberOrNull(cycle.studyMinutes ?? cycle.executedMinutes ?? cycle.completedMinutes),
      coverage: numberOrNull(cycle.coverage),
      confidence: numberOrNull(cycle.confidence),
    };
  }

  function delta(current, previous) {
    return current === null || previous === null ? null : Number((current - previous).toFixed(4));
  }

  function compareCycles(current = {}, previous = {}, currentTopics = [], previousTopics = []) {
    const currentMetrics = cycleMetrics(current);
    const previousMetrics = cycleMetrics(previous);
    const priorityMovement = [];
    const learningStateChanges = [];
    const previousByKey = new Map(previousTopics.map((topic) => [topicIdentity(topic), topic]));
    currentTopics.forEach((topic) => {
      const before = previousByKey.get(topicIdentity(topic));
      if (!before) return;
      const fromRank = numberOrNull(before.strategic?.rank);
      const toRank = numberOrNull(topic.strategic?.rank);
      if (fromRank !== null && toRank !== null && fromRank !== toRank) priorityMovement.push({ subject: topic.subject, topic: topic.topic, fromRank, toRank, delta: toRank - fromRank });
      const fromState = text(before.diagnosis?.learningState?.key || before.learningState?.key);
      const toState = text(topic.diagnosis?.learningState?.key || topic.learningState?.key);
      if (fromState && toState && fromState !== toState) learningStateChanges.push({ subject: topic.subject, topic: topic.topic, from: fromState, to: toState });
    });
    return {
      questionsDelta: delta(currentMetrics.questions, previousMetrics.questions),
      accuracyDelta: delta(currentMetrics.accuracy, previousMetrics.accuracy),
      studyMinutesDelta: delta(currentMetrics.studyMinutes, previousMetrics.studyMinutes),
      coverageDelta: delta(currentMetrics.coverage, previousMetrics.coverage),
      confidenceDelta: delta(currentMetrics.confidence, previousMetrics.confidence),
      priorityMovement: priorityMovement.sort((a, b) => a.toRank - b.toRank || a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic)),
      learningStateChanges: learningStateChanges.sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic)),
    };
  }

  function meaningfulChanges(topics = [], previousTopics = []) {
    const changes = [];
    const previousByKey = new Map(previousTopics.map((topic) => [topicIdentity(topic), topic]));
    topics.forEach((topic) => {
      const before = previousByKey.get(topicIdentity(topic));
      if (!before) return;
      const from = text(before.diagnosis?.masteryLevel);
      const to = text(topic.diagnosis?.masteryLevel);
      const improvement = ["critical", "deficiency", "attention", "insufficient"].includes(from) && ["attention", "adequate", "strong"].includes(to);
      const decline = ["strong", "adequate", "attention"].includes(from) && ["critical", "deficiency"].includes(to);
      if (improvement) changes.push({ type: "mastery-improved", subject: topic.subject, topic: topic.topic, from, to });
      else if (decline) changes.push({ type: "mastery-declined", subject: topic.subject, topic: topic.topic, from, to });
      const fromConfidence = numberOrNull(before.confidence?.value);
      const toConfidence = numberOrNull(topic.confidence?.value);
      if (fromConfidence !== null && toConfidence !== null && Math.abs(toConfidence - fromConfidence) >= .15) changes.push({ type: toConfidence > fromConfidence ? "confidence-increased" : "confidence-decreased", subject: topic.subject, topic: topic.topic, from: fromConfidence, to: toConfidence });
      const fromRank = numberOrNull(before.strategic?.rank);
      const toRank = numberOrNull(topic.strategic?.rank);
      if (fromRank !== null && toRank !== null && toRank < fromRank) changes.push({ type: "priority-rise", subject: topic.subject, topic: topic.topic, fromRank, toRank });
    });
    return changes.sort((a, b) => [a.subject, a.topic, a.type].join("|").localeCompare([b.subject, b.topic, b.type].join("|")));
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stableValue(value[key]);
      return result;
    }, {});
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function hash(value) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      result ^= value.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(16).padStart(8, "0");
  }

  const AI_READ_INSTRUCTIONS = Object.freeze({
    version: VERSION,
    authority: ["current factual evidence", "permanent knowledge base", "legacy history fallback", "initial self-assessment"],
    rules: [
      "Current factual performance has precedence over historical knowledge.",
      "Historical knowledge is context and baseline, not current performance.",
      "Low confidence means caution, not low ability.",
      "Missing evidence is unknown, not weakness; null accuracy must remain unknown.",
      "Planning is not execution, and remaining planned capacity is not debt.",
      "strategic.score is calculated by the local engine and must not be recomputed.",
      "Suggested or partial mappings are not confirmed equivalent knowledge.",
      "Self-assessment has lower authority than factual evidence.",
      "Maintenance and recovery are different states.",
      "Separate fact, interpretation, and recommendation in any future response.",
    ],
  });

  const AI_OUTPUT_SCHEMA = Object.freeze({
    periodDiagnosis: { summary: "", confidence: "" },
    readiness: {},
    advances: [],
    bottlenecks: [],
    priorities: [{
      subject: "",
      topic: "",
      recommendation: "",
      reason: "",
      relationToEngine: "aligned|override-suggestion",
      confidence: "",
      engineRank: null,
      aiSuggestedImportance: null,
    }],
    maintenance: [],
    avoidForNow: [],
    uncertainties: [],
    strategicNotes: [],
  });

  function buildStrategicSnapshot(input = {}) {
    const now = nowTime(input.now);
    const rawSubjects = Array.isArray(input.subjects) ? input.subjects : [];
    const rawTopics = Array.isArray(input.topics) ? input.topics : rawSubjects.flatMap((subject) => (subject.topics || subject.assuntos || []).map((topic) => ({ ...topic, subject: topic.subject || topic.materia || subject.name || subject.materia })));
    const topics = rawTopics.map((topic) => buildTopic(topic, { now, subject: rawSubjects.find((subject) => text(subject.name || subject.materia) === text(topic.subject || topic.materia)) || {} })).filter((topic) => topic.subject && topic.topic).sort((a, b) => topicIdentity(a).localeCompare(topicIdentity(b)));
    const subjects = rawSubjects.length
      ? rawSubjects.map((subject) => normalizeSubject(subject, topics, now)).filter((subject) => subject.name)
      : [...new Set(topics.map((topic) => topic.subject))].sort().map((name) => normalizeSubject({ name }, topics, now));
    const weeklySource = input.weeklyCycle || input.cycle || {};
    const weeklyCycle = normalizeCycle(weeklySource, input);
    const plannedDistribution = distribution(input.plannedDistribution || input.plannedBlocks || weeklySource.plannedBlocks || [], "planned");
    const executionDistribution = distribution(input.executionDistribution || input.executedBlocks || input.executionBlocks || weeklySource.executedBlocks || [], "executed");
    const previousTopics = Array.isArray(input.previousTopics) ? input.previousTopics.map((topic) => buildTopic(topic, { now })) : Array.isArray(input.previousCycle?.topics) ? input.previousCycle.topics : [];
    const currentCycle = normalizeCycle(input.currentCycle || weeklySource, input);
    const previousCycle = input.previousCycle ? normalizeCycle(input.previousCycle, input) : null;
    const comparison = previousCycle ? compareCycles(currentCycle, previousCycle, topics, previousTopics) : null;
    const uncertainties = topics.filter((topic) => topic.confidence.level === "low" || topic.confidence.evidenceStage === "unknown" || topic.confidence.evidenceStage === "early").map((topic) => ({
      subject: topic.subject,
      topic: topic.topic,
      reason: topic.currentEvidence.questions === 0 ? "no-current-evidence" : topic.currentEvidence.questions < 10 ? "only-few-questions" : "low-confidence",
      confidence: topic.confidence.level,
      recommendedValidation: topic.diagnosis.needsDiagnostic ? "diagnostic-questions" : "more-independent-sessions",
    }));
    const snapshot = {
      aiReadContractVersion: VERSION,
      generatedAt: isoDate(input.now),
      evidenceAuthority: {
        order: ["current factual evidence", "permanent knowledge base", "legacy history fallback", "initial self-assessment"],
        current: 1,
        permanentKnowledge: 2,
        legacyHistory: 3,
        selfAssessment: 4,
      },
      instructions: AI_READ_INSTRUCTIONS,
      exam: {
        name: text(input.exam?.name || input.contestName || input.name) || null,
        role: text(input.exam?.role || input.role || input.cargo) || null,
        board: text(input.exam?.board || input.banca) || null,
      },
      subjects,
      topics,
      weeklyCycle: {
        ...weeklyCycle,
        plannedDistribution,
        executionDistribution,
      },
      comparison: {
        currentCycle,
        previousCycle,
        rollingWindow: rollingWindow(input.rollingWindow),
        deltas: comparison,
        meaningfulChanges: previousCycle ? meaningfulChanges(topics, previousTopics) : [],
      },
      uncertainties,
      readiness: {},
      outputSchema: AI_OUTPUT_SCHEMA,
    };
    const signaturePayload = { ...snapshot, generatedAt: undefined, signature: undefined };
    return {
      ...snapshot,
      signature: { algorithm: "fnv1a-32", value: hash(stableStringify(signaturePayload)) },
    };
  }

  const api = { VERSION, AI_READ_INSTRUCTIONS, AI_OUTPUT_SCHEMA, buildStrategicSnapshot, stableStringify, signatureFor: (snapshot) => hash(stableStringify({ ...snapshot, generatedAt: undefined, signature: undefined })) };
  global.AIStrategicSnapshot = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
