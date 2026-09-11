"use strict";

(function initStrategicPriority(global) {
  const config = global.StrategicPriorityConfig || (typeof module !== "undefined" && module.exports ? require("./strategic-priority-config.js") : {});
  const LearningState = global.LearningState || (typeof module !== "undefined" && module.exports ? require("./learning-state.js") : null);

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function normalizedErrorNeed(signals = {}) {
    if (signals.recurrence === "high") return .86;
    if (signals.recurrence === "moderate") return .5;
    if (Number(signals.postInterventionErrors) >= 2) return .78;
    if (Number(signals.recentErrors) >= 2) return .28;
    return 0;
  }

  function trendNeed(trend = {}) {
    if (trend.label === "falling") return 1;
    if (trend.label === "stable") return .28;
    if (trend.label === "insufficient") return .18;
    return 0;
  }

  function masteryNeed(level = "insufficient") {
    return {
      critical: 1,
      deficiency: .8,
      attention: .5,
      adequate: .18,
      strong: 0,
      insufficient: .22,
    }[level] ?? .22;
  }

  function initialProfileNeed(profile = {}) {
    const value = {
      "never-studied": .75,
      basic: .5,
      intermediate: .3,
      advanced: .18,
    }[profile.level] || 0;
    return value * clamp(profile.remainingWeight);
  }

  function recencyNeed(days, state) {
    const thresholds = config.thresholds || {};
    const value = Math.max(0, Number(days) || 0);
    if (!value) return 0;
    if (state?.key === "maintenance") return value >= (thresholds.buildingContactDays || 12) * 2 ? .35 : .08;
    if (value < (thresholds.recentContactDays || 5)) return .05;
    if (value < (thresholds.buildingContactDays || 12)) return .35;
    return .72;
  }

  function sessionFor({ learningState = {}, diagnosis = {}, errorSignals = {}, intervention = null } = {}) {
    const sessions = config.sessions || {};
    const typeText = (errorSignals.types || []).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let base = learningState.awaitingDiagnostic
      ? sessions.diagnosticQuestions
      : sessions[learningState.key === "not-started" ? "diagnostic" : learningState.key] || sessions.practice || {};
    if (learningState.key === "consolidating" && /distracao|leitura do enunciado|interpretacao/.test(typeText) && !/conceitual|conteudo nao dominado|memoria|calculo/.test(typeText)) {
      base = { ...sessions.practice, kind: "questions_attention", label: "Questões com treino de atenção" };
    } else if (learningState.key === "consolidating" && /calculo/.test(typeText)) {
      base = { ...sessions.practice, kind: "guided_practice", label: "Prática orientada e questões" };
    }
    const action = diagnosis.action || {};
    const interventionRecommendation = intervention?.recommendation || {};
    if (["recovery", "consolidating", "building"].includes(learningState.key) && (action.minutes || interventionRecommendation.questions)) {
      return {
        ...base,
        minutes: Math.max(Number(base.minutes) || 30, Number(action.minutes) || 0),
        questions: Math.max(Number(base.questions) || 0, Number(interventionRecommendation.questions) || 0, Number(action.questions) || 0),
      };
    }
    return { ...base };
  }

  function bandFor(score) {
    const match = (config.bands || []).find(([, threshold]) => score >= threshold) || ["very-low", 0];
    return match[0];
  }

  function confidenceLabel(value) {
    if (value < .35) return "low";
    if (value < .68) return "medium";
    return "high";
  }

  function calculate(input = {}) {
    const subject = input.subject || {};
    const diagnosis = input.diagnosis || {};
    const errorSignals = input.errorSignals || diagnosis.errorSignals || {};
    const importance = clamp(input.importance ?? subject.examImportance?.importanceScore ?? ((Number(subject.peso) || 3) / 5));
    const difficulty = clamp(input.difficulty ?? ((Number(subject.dominio) || 3) / 5));
    const hasContact = Boolean(input.hasContact ?? diagnosis.hasContact);
    const coverage = Math.max(clamp(input.coverage), hasContact ? .55 : 0);
    const initialProfile = input.initialProfile || {};
    const learningState = input.learningState || LearningState?.derive?.({ diagnosis, hasContact, coverage, intervention: input.intervention, errorSignals, initialProfile }) || { key: "practice", label: "Questões" };
    const confidence = clamp(diagnosis.confidence);
    const recentAccuracy = Number.isFinite(diagnosis.accuracy) ? Number(diagnosis.accuracy) : null;
    const historicalAccuracy = Number.isFinite(diagnosis.overallAccuracy) ? Number(diagnosis.overallAccuracy) : null;
    const performanceGap = recentAccuracy === null ? 0 : clamp(((config.thresholds?.strongReference || .85) - recentAccuracy) / (config.thresholds?.strongReference || .85));
    const historicalGap = historicalAccuracy === null ? 0 : clamp(((config.thresholds?.strongReference || .85) - historicalAccuracy) / (config.thresholds?.strongReference || .85));
    const components = {
      importance,
      difficulty,
      masteryNeed: masteryNeed(diagnosis.level),
      recentPerformance: performanceGap * (Number(config.confidence?.evidenceFloor || .42) + confidence * (1 - Number(config.confidence?.evidenceFloor || .42))),
      historicalPerformance: historicalGap * confidence,
      trend: trendNeed(diagnosis.trend) * confidence,
      recurringErrors: normalizedErrorNeed(errorSignals) * Math.max(confidence, .45),
      recency: recencyNeed(input.daysWithoutContact ?? diagnosis.daysWithoutContact, learningState),
      coverage: hasContact ? clamp(1 - coverage) * .35 : 1,
      examUrgency: clamp(input.examUrgency ?? input.phase?.urgency?.value),
      incidence: clamp(input.incidence?.normalized ?? input.incidence),
      initialProfile: initialProfileNeed(initialProfile),
      confidenceAdjustment: confidence,
    };
    const weights = config.weights || {};
    const rawScore = Object.entries(components).reduce((total, [name, value]) => total + value * (Number(weights[name]) || 0), 0);
    const maintenancePenalty = learningState.key === "maintenance" ? Number(config.thresholds?.maintenancePenalty || .34) : 0;
    const strongPenalty = diagnosis.level === "strong" && learningState.key !== "recovery" ? Number(config.thresholds?.strongPenalty || .08) : 0;
    const score = clamp(rawScore - maintenancePenalty - strongPenalty);
    const recommendedSession = sessionFor({ learningState, diagnosis, errorSignals, intervention: input.intervention });
    const reasons = [];
    if (importance >= .8) reasons.push(`importância da matéria: ${Math.round(importance * 5)} de 5`);
    if (difficulty >= .8) reasons.push(`dificuldade pessoal: ${Math.round(difficulty * 5)} de 5`);
    if (recentAccuracy !== null) reasons.push(`desempenho recente: ${Math.round(recentAccuracy * 100)}%`);
    if (recentAccuracy !== null && historicalAccuracy !== null && Math.abs(historicalAccuracy - recentAccuracy) >= .03) reasons.push(`desempenho histórico: ${Math.round(historicalAccuracy * 100)}%`);
    if (diagnosis.trend?.label === "falling") reasons.push("tendência de queda confirmada");
    if (errorSignals.recurrence === "high") reasons.push("erros recorrentes");
    if (learningState.awaitingDiagnostic) reasons.push("base inicial informada: confirmar com questões diagnósticas");
    else if (initialProfile.active && initialProfile.remainingWeight >= .2) reasons.push(`base inicial informada: ${initialProfile.label.toLowerCase()}`);
    if (!hasContact) reasons.push("assunto ainda sem contato suficiente");
    if (Number(input.daysWithoutContact ?? diagnosis.daysWithoutContact) >= Number(config.thresholds?.buildingContactDays || 12)) reasons.push("contato precisa ser retomado");
    if (learningState.key === "maintenance") reasons.push("bom domínio reduz a necessidade de novo contato imediato");
    if (learningState.key === "recovery") reasons.push("queda relevante após desempenho antes consolidado");
    reasons.push(`estado atual: ${learningState.label}`);
    return {
      score,
      rawScore,
      band: bandFor(score),
      learningState,
      masteryLevel: diagnosis.level || "insufficient",
      confidence,
      confidenceLabel: confidenceLabel(confidence),
      trend: diagnosis.trend?.label || "insufficient",
      recommendedSession,
      scoreComponents: components,
      diminishingReturns: maintenancePenalty + strongPenalty,
      reasons: [...new Set(reasons)].slice(0, 5),
    };
  }

  function buildStrategicStudyQueue(entries = []) {
    const ranked = entries
      .map((entry, index) => ({ ...entry, strategic: entry.strategic || calculate(entry), originalIndex: index }))
      .sort((left, right) => right.strategic.score - left.strategic.score || left.originalIndex - right.originalIndex);
    const remaining = ranked.slice();
    const queue = [];
    let previousSubject = "";
    while (remaining.length) {
      const candidateIndex = remaining.findIndex((entry) => String(entry.unit?.materia || entry.materia || "").toLowerCase() !== previousSubject);
      const selected = remaining.splice(candidateIndex >= 0 ? candidateIndex : 0, 1)[0];
      previousSubject = String(selected.unit?.materia || selected.materia || "").toLowerCase();
      queue.push({ ...selected, queueRank: queue.length + 1 });
    }
    return queue;
  }

  function explainStrategicPriority(input = {}) {
    return calculate(input);
  }

  const api = { calculate, buildStrategicStudyQueue, explainStrategicPriority, bandFor, confidenceLabel };
  global.StrategicPriorityEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
