"use strict";

(function initReadiness(global) {
  const VERSION = 1;
  const text = (value = "") => String(value ?? "").trim();
  const numberOrNull = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
  const round = (value, digits = 3) => Number(Number(value).toFixed(digits));

  function topicKey(topic = {}) {
    return [
      text(topic.subject || topic.materia),
      text(topic.subarea),
      text(topic.topic || topic.assunto || topic.titulo),
    ].join("|").toLowerCase();
  }

  function stateKey(topic = {}) {
    const state = topic.learningState || topic.strategic?.learningState || topic.diagnosis?.learningState || {};
    return text(typeof state === "string" ? state : state.key);
  }

  function evidenceFor(topic = {}) {
    const diagnosis = topic.diagnosis || {};
    const evidence = topic.currentEvidence || {};
    const questions = Math.max(0, Number(evidence.questions ?? diagnosis.questions) || 0);
    const sessions = Math.max(0, Number(evidence.sessions ?? evidence.sessionCount ?? diagnosis.sessionCount) || 0);
    const accuracy = numberOrNull(evidence.accuracy ?? diagnosis.currentAccuracy ?? diagnosis.accuracy);
    return { questions, sessions, accuracy };
  }

  function confidenceFor(topic = {}) {
    const diagnosis = topic.diagnosis || {};
    const source = topic.confidence || {};
    const value = numberOrNull(source.value ?? diagnosis.confidence);
    const level = text(source.level || diagnosis.confidenceLevel)
      || (value !== null && value >= .68 ? "high" : value !== null && value >= .35 ? "medium" : "low");
    const stage = text(source.evidenceStage || diagnosis.evidenceStage) || "unknown";
    return { value, level, stage };
  }

  function inheritedBaseline(topic = {}) {
    const source = topic.inheritedKnowledge || topic.historyInheritance || {};
    const available = Boolean(source.available || source.knowledgeConfirmed) && text(source.level) !== "none";
    return {
      available,
      level: available ? text(source.level) || "unknown" : "none",
      confidence: numberOrNull(source.confidence),
      accuracy: numberOrNull(source.accuracy),
      coverage: numberOrNull(source.coverage),
      relationship: text(source.relationship) || "unknown",
      source: text(source.source) || null,
    };
  }

  function hasRecurringErrors(topic = {}) {
    const signals = topic.errors || topic.errorSignals || {};
    return text(signals.recurrence).toLowerCase() === "high"
      || Number(signals.postInterventionErrors) >= 2;
  }

  function evaluateTopic(topic = {}, { now = null } = {}) {
    const diagnosis = topic.diagnosis || {};
    const evidence = evidenceFor(topic);
    const confidence = confidenceFor(topic);
    const learningState = stateKey(topic) || "unknown";
    const masteryLevel = text(diagnosis.masteryLevel || diagnosis.level) || "insufficient";
    const inherited = inheritedBaseline(topic);
    const maintenanceDue = Boolean(topic.maintenanceDue || learningState === "maintenance");
    const recovery = learningState === "recovery"
      || Boolean(diagnosis.recoveryEvidence || topic.recoveryEvidence);
    const falling = text(diagnosis.trend?.label || diagnosis.trend).toLowerCase() === "falling";
    const recurringErrors = hasRecurringErrors(topic);
    const hasEvidence = evidence.questions > 0 || evidence.sessions > 0;
    const currentStateUncertain = !hasEvidence
      || confidence.level === "low"
      || confidence.stage === "unknown"
      || confidence.stage === "early";
    let state = "unknown";
    if (!currentStateUncertain && recovery) {
      state = ["critical", "deficiency"].includes(masteryLevel) ? "not-ready" : "fragile";
    } else if (!currentStateUncertain && ["critical", "deficiency"].includes(masteryLevel)) {
      state = confidence.level === "high" ? "not-ready" : "fragile";
    } else if (!currentStateUncertain && maintenanceDue && masteryLevel === "strong" && confidence.level === "high") {
      state = "ready-maintenance";
    } else if (!currentStateUncertain && confidence.level === "high" && ["adequate", "strong"].includes(masteryLevel)) {
      state = falling || recurringErrors ? "fragile" : "ready";
    } else if (!currentStateUncertain && confidence.level === "medium" && ["adequate", "strong"].includes(masteryLevel)) {
      state = recurringErrors || falling ? "fragile" : "developing";
    } else if (!currentStateUncertain && masteryLevel === "insufficient") {
      state = "developing";
    }

    const reasons = [];
    if (state === "unknown") {
      reasons.push(hasEvidence ? "a evidência atual ainda não confirma o diagnóstico" : "não há evidência atual suficiente");
      if (inherited.available) reasons.push("há uma base histórica forte, mas o estado atual continua incerto");
    } else if (state === "not-ready") {
      reasons.push("deficiência atual confiável");
    } else if (state === "fragile") {
      reasons.push(recovery ? "há recuperação em andamento" : "há risco relevante no estado atual");
      if (recurringErrors) reasons.push("erros recorrentes ainda limitam a preparação");
    } else if (state === "developing") {
      reasons.push("conhecimento adequado em construção, ainda sem confirmação suficiente");
    } else if (state === "ready-maintenance") {
      reasons.push("domínio atual confiável entrando em manutenção");
    } else {
      reasons.push("domínio atual adequado e confirmado por evidência factual");
    }

    return {
      subject: text(topic.subject || topic.materia),
      topic: text(topic.topic || topic.assunto || topic.titulo),
      state,
      confidence: confidence.level,
      confidenceValue: confidence.value,
      masteryLevel,
      learningState,
      currentAccuracy: evidence.accuracy,
      evidenceStage: confidence.stage,
      currentQuestions: evidence.questions,
      currentSessions: evidence.sessions,
      inheritedBaseline: inherited,
      maintenanceDue,
      blocker: false,
      blockerSeverity: null,
      reasons,
      asOf: now instanceof Date ? now.toISOString() : (text(now) || null),
    };
  }

  function normalizedImportance(topic = {}, subject = {}) {
    const raw = numberOrNull(topic.importance?.score ?? topic.importance ?? subject.importance?.score ?? subject.importance);
    if (raw === null) return null;
    return raw > 1 ? clamp(raw / 5) : clamp(raw);
  }

  function relevanceFor(topic = {}, subject = {}) {
    const importance = normalizedImportance(topic, subject);
    const examWeight = numberOrNull(topic.importance?.examWeight ?? topic.examWeight ?? subject.examWeight);
    const incidence = numberOrNull(topic.incidence ?? subject.incidence?.value ?? subject.incidence);
    const rank = numberOrNull(topic.strategic?.rank);
    const relevant = (importance !== null && importance >= .6)
      || (examWeight !== null && ((examWeight <= 1 && examWeight >= .6) || examWeight >= 3))
      || (incidence !== null && incidence >= .6)
      || (rank !== null && rank <= 3);
    const major = (importance !== null && importance >= .8)
      || (incidence !== null && incidence >= .75)
      || (rank !== null && rank <= 2)
      || (examWeight !== null && examWeight >= 4);
    return { relevant, major };
  }

  function confidenceAggregate(subject, evaluatedTopics, totalTopics) {
    const values = evaluatedTopics.map((topic) => topic.confidenceValue).filter((value) => value !== null);
    const base = numberOrNull(subject.diagnosticConfidence)
      ?? (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);
    const highCount = evaluatedTopics.filter((topic) => topic.confidence === "high").length;
    const diagnosticShare = totalTopics ? evaluatedTopics.filter((topic) => topic.currentQuestions > 0 || topic.currentSessions > 0).length / totalTopics : 0;
    const highShare = totalTopics ? highCount / totalTopics : 0;
    const cap = highShare >= .7 ? 1 : highShare >= .35 ? .67 : .34;
    return clamp(Math.min(base, cap) * (.5 + .5 * clamp(diagnosticShare)));
  }

  function topicDistribution(evaluatedTopics, totalTopics) {
    const distribution = { ready: 0, readyMaintenance: 0, developing: 0, fragile: 0, notReady: 0, unknown: 0 };
    evaluatedTopics.forEach((topic) => {
      const key = topic.state === "not-ready" ? "notReady" : topic.state === "ready-maintenance" ? "readyMaintenance" : topic.state;
      if (distribution[key] !== undefined) distribution[key] += 1;
    });
    distribution.unknown += Math.max(0, totalTopics - evaluatedTopics.length);
    return distribution;
  }

  function evaluateSubject(subject = {}, topics = [], { now = null } = {}) {
    const name = text(subject.name || subject.materia || subject.subject);
    const sourceTopics = topics.filter((topic) => text(topic.subject || topic.materia) === name);
    const evaluatedTopics = sourceTopics.map((topic) => evaluateTopic(topic, { now }));
    const totalTopics = Math.max(0, Number(subject.topicCount ?? subject.assuntos?.length) || evaluatedTopics.length);
    const distribution = topicDistribution(evaluatedTopics, totalTopics);
    const knownTopics = evaluatedTopics.filter((topic) => topic.currentQuestions > 0 || topic.currentSessions > 0).length;
    const diagnosticCoverage = totalTopics ? knownTopics / totalTopics : 0;
    const highConfidenceTopics = evaluatedTopics.filter((topic) => topic.confidence === "high").length;
    const highConfidenceCoverage = totalTopics ? highConfidenceTopics / totalTopics : 0;
    const contentCoverage = numberOrNull(subject.coverage) ?? (totalTopics ? evaluatedTopics.filter((topic) => topic.currentQuestions > 0 || topic.currentSessions > 0 || topic.coverage > 0).length / totalTopics : 0);
    const confidenceValue = confidenceAggregate(subject, evaluatedTopics, totalTopics);
    const confidence = confidenceValue >= .68 ? "high" : confidenceValue >= .35 ? "medium" : "low";
    const blockingTopics = [];
    evaluatedTopics.forEach((evaluated, index) => {
      if (evaluated.state !== "not-ready") return;
      const relevance = relevanceFor(sourceTopics[index], subject);
      if (!relevance.relevant) return;
      const severity = relevance.major ? "major" : "moderate";
      blockingTopics.push({ subject: name, topic: evaluated.topic, severity, reason: "deficiência atual confiável" });
    });
    const maintenanceTopics = evaluatedTopics.filter((topic) => topic.state === "ready-maintenance").map((topic) => topic.topic);
    const uncertainties = evaluatedTopics.filter((topic) => topic.state === "unknown").map((topic) => ({ topic: topic.topic, reason: "insufficient-current-evidence", confidence: topic.confidence }));
    const unknownShare = totalTopics ? distribution.unknown / totalTopics : 1;
    let state = "insufficient-data";
    if (totalTopics && diagnosticCoverage >= .25 && unknownShare < .5) {
      if (blockingTopics.some((topic) => topic.severity === "major")) state = "not-ready";
      else if (blockingTopics.length || distribution.notReady || distribution.fragile) state = "fragile";
      else if (distribution.developing) state = "developing";
      else if (distribution.ready + distribution.readyMaintenance === totalTopics) state = "ready";
      else state = "developing";
    }
    const reasons = [];
    if (state === "insufficient-data") reasons.push("a maior parte do conteúdo ainda não possui evidência atual suficiente");
    else if (blockingTopics.length) reasons.push(`${blockingTopics.length} tópico${blockingTopics.length === 1 ? "" : "s"} relevante${blockingTopics.length === 1 ? "" : "s"} limita${blockingTopics.length === 1 ? "" : "m"} a prontidão`);
    else if (state === "ready") reasons.push("todos os tópicos avaliados estão prontos ou em manutenção");
    else if (state === "developing") reasons.push("há conhecimento adequado em construção");
    else if (state === "fragile") reasons.push("há risco relevante em parte do conteúdo");
    if (maintenanceTopics.length) reasons.push(`${maintenanceTopics.length} tópico${maintenanceTopics.length === 1 ? "" : "s"} precisa${maintenanceTopics.length === 1 ? "" : "m"} apenas de manutenção`);
    reasons.push(`${round(diagnosticCoverage * 100, 1)}% do conteúdo possui evidência atual`);
    return {
      subject: name,
      state,
      confidence,
      confidenceValue: round(confidenceValue),
      topicDistribution: distribution,
      contentCoverage: round(clamp(contentCoverage)),
      diagnosticCoverage: round(diagnosticCoverage),
      highConfidenceCoverage: round(highConfidenceCoverage),
      coverage: round(clamp(contentCoverage)),
      blockingTopics,
      maintenanceTopics,
      uncertainties,
      reasons,
      topics: evaluatedTopics,
    };
  }

  function subjectWeight(subject = {}) {
    const weight = numberOrNull(subject.examWeight ?? subject.importance?.score ?? subject.importance);
    return weight !== null && weight > 0 ? weight : 1;
  }

  function evaluateExam({ subjects = [], topics = [], now = null } = {}) {
    const subjectInputs = Array.isArray(subjects) ? subjects : [];
    const topicInputs = Array.isArray(topics) ? topics : [];
    const evaluatedSubjects = subjectInputs.map((subject) => evaluateSubject(subject, topicInputs, { now }));
    const knownSubjects = evaluatedSubjects.filter((subject) => subject.diagnosticCoverage > 0);
    const totalWeight = evaluatedSubjects.reduce((sum, subject) => sum + subjectWeight(subjectInputs.find((item) => text(item.name || item.materia || item.subject) === subject.subject) || {}), 0) || 1;
    const weightedAverage = (field) => evaluatedSubjects.reduce((sum, subject) => {
      const source = subjectInputs.find((item) => text(item.name || item.materia || item.subject) === subject.subject) || {};
      return sum + subject[field] * subjectWeight(source);
    }, 0) / totalWeight;
    const contentCoverage = weightedAverage("contentCoverage");
    const diagnosticCoverage = weightedAverage("diagnosticCoverage");
    const highConfidenceCoverage = weightedAverage("highConfidenceCoverage");
    const subjectDistribution = { wellPrepared: 0, developing: 0, fragile: 0, notReady: 0, unknown: 0 };
    evaluatedSubjects.forEach((subject) => {
      if (subject.state === "ready") subjectDistribution.wellPrepared += 1;
      else if (subject.state === "developing") subjectDistribution.developing += 1;
      else if (subject.state === "fragile") subjectDistribution.fragile += 1;
      else if (subject.state === "not-ready") subjectDistribution.notReady += 1;
      else subjectDistribution.unknown += 1;
    });
    const blockingTopics = evaluatedSubjects.flatMap((subject) => subject.blockingTopics);
    const confidenceValue = evaluatedSubjects.length
      ? Math.min(evaluatedSubjects.reduce((sum, subject) => sum + subject.confidenceValue, 0) / evaluatedSubjects.length, highConfidenceCoverage >= .7 ? 1 : highConfidenceCoverage >= .35 ? .67 : .34) * (.5 + .5 * diagnosticCoverage)
      : 0;
    const confidence = confidenceValue >= .68 ? "high" : confidenceValue >= .35 ? "medium" : "low";
    let state = "insufficient-data";
    if (evaluatedSubjects.length && diagnosticCoverage >= .2) {
      if (highConfidenceCoverage < .25 && diagnosticCoverage < .5) state = "early";
      else if (blockingTopics.some((topic) => topic.severity === "major") || subjectDistribution.notReady > 1) state = "fragile";
      else if (subjectDistribution.notReady || subjectDistribution.fragile) state = "developing";
      else if (diagnosticCoverage >= .75 && highConfidenceCoverage >= .6 && !subjectDistribution.developing) state = "well-prepared";
      else if (diagnosticCoverage >= .5) state = "competitive";
      else state = "developing";
    }
    const strongestAreas = evaluatedSubjects.filter((subject) => subject.state === "ready").map((subject) => subject.subject);
    const uncertainAreas = evaluatedSubjects.filter((subject) => subject.state === "insufficient-data" || subject.confidence === "low").map((subject) => subject.subject);
    const maintenanceLoad = evaluatedSubjects.filter((subject) => subject.maintenanceTopics.length).map((subject) => ({ subject: subject.subject, topics: subject.maintenanceTopics }));
    const reasons = [];
    if (state === "insufficient-data" || state === "early") reasons.push("a evidência factual ainda cobre uma parcela limitada do edital");
    if (blockingTopics.length) reasons.push(`${blockingTopics.length} tópico${blockingTopics.length === 1 ? "" : "s"} relevante${blockingTopics.length === 1 ? "" : "s"} exige atenção estratégica`);
    if (strongestAreas.length) reasons.push(`${strongestAreas.length} matéria${strongestAreas.length === 1 ? "" : "s"} possui${strongestAreas.length === 1 ? "" : "em"} base atual pronta`);
    return {
      state,
      confidence,
      confidenceValue: round(confidenceValue),
      contentCoverage: round(contentCoverage),
      diagnosticCoverage: round(diagnosticCoverage),
      highConfidenceCoverage: round(highConfidenceCoverage),
      evidenceCoverage: round(diagnosticCoverage),
      subjectDistribution,
      majorRisks: blockingTopics,
      strongestAreas,
      uncertainAreas,
      maintenanceLoad,
      reasons,
      subjects: evaluatedSubjects,
      topics: evaluatedSubjects.flatMap((subject) => subject.topics),
    };
  }

  const api = { VERSION, evaluateTopic, evaluateSubject, evaluateExam };
  global.Readiness = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
