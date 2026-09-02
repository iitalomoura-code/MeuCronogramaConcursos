(function (global) {
  "use strict";

  const STRONG_REFERENCE = 0.85;
  const DAY = 24 * 60 * 60 * 1000;

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function answeredEntries(entries = []) {
    return entries.filter((entry) => Number(entry.questoes) > 0);
  }

  function totals(entries = []) {
    return entries.reduce((result, entry) => {
      const questions = Math.max(0, Number(entry.questoes) || 0);
      result.questions += questions;
      result.correct += Math.min(questions, Math.max(0, Number(entry.acertos) || 0));
      return result;
    }, { questions: 0, correct: 0 });
  }

  function accuracy(entries = []) {
    const result = totals(entries);
    return result.questions ? result.correct / result.questions : null;
  }

  function weightedRecentAccuracy(entries = []) {
    const recent = answeredEntries(entries).slice(-8);
    if (!recent.length) return null;
    let correct = 0;
    let questions = 0;
    recent.forEach((entry, index) => {
      const weight = Math.pow(0.76, recent.length - index - 1);
      const total = Math.max(0, Number(entry.questoes) || 0);
      correct += Math.min(total, Math.max(0, Number(entry.acertos) || 0)) * weight;
      questions += total * weight;
    });
    return questions ? correct / questions : null;
  }

  function trend(entries = []) {
    const answered = answeredEntries(entries);
    if (answered.length < 4) return { label: "insufficient", delta: 0 };
    const recent = answered.slice(-Math.min(3, Math.ceil(answered.length / 2)));
    const previous = answered.slice(0, -recent.length).slice(-3);
    const recentAccuracy = accuracy(recent);
    const previousAccuracy = accuracy(previous);
    if (recentAccuracy === null || previousAccuracy === null) return { label: "insufficient", delta: 0 };
    const delta = recentAccuracy - previousAccuracy;
    return { label: delta >= 0.08 ? "improving" : delta <= -0.08 ? "falling" : "stable", delta, recentAccuracy, previousAccuracy };
  }

  function confidence(entries = [], reviewCount = 0) {
    const answered = answeredEntries(entries);
    const questionCount = totals(answered).questions;
    const sessionCount = entries.filter((entry) => Number(entry.questoes) > 0 || Number(entry.tempoEstudado) > 0).length;
    return clamp((questionCount / 50) * 0.68 + (Math.min(5, sessionCount) / 5) * 0.22 + (Math.min(3, reviewCount) / 3) * 0.10);
  }

  function actionFor(level, data) {
    if (data.needsDiagnostic) return {
      kind: "diagnostic",
      label: "Sessão diagnóstica",
      minutes: 30,
      questions: 10,
      text: "Faça 10 questões deste tema para melhorar o diagnóstico.",
    };
    if (level === "critical") return {
      kind: "deep-recovery",
      label: "Revisão aprofundada",
      minutes: 45,
      questions: data.relevance >= 0.65 ? 20 : 15,
      text: "Retome a teoria ou o resumo, corrija os erros e faça uma nova rodada de questões.",
    };
    if (level === "deficiency") return {
      kind: "targeted-reinforcement",
      label: "Reforço direcionado",
      minutes: 30,
      questions: data.relevance >= 0.65 ? 15 : 10,
      text: "Faça uma revisão curta, corrija os erros e registre os pontos relevantes.",
    };
    if (level === "attention") return {
      kind: "light-reinforcement",
      label: "Reforço leve",
      minutes: 25,
      questions: 10,
      text: "Faça questões direcionadas e revise os erros antes do próximo contato.",
    };
    return { kind: "maintain", label: "Manter contato", minutes: 30, questions: 0, text: "Mantenha o contato normal previsto pelo ciclo." };
  }

  function diagnose(input = {}) {
    const entries = Array.isArray(input.entries) ? input.entries : [];
    const answered = answeredEntries(entries);
    const counts = totals(answered);
    const review = input.review || {};
    const currentAccuracy = weightedRecentAccuracy(entries);
    const overallAccuracy = accuracy(answered);
    const direction = trend(entries);
    const sampleConfidence = confidence(entries, Number(review.completed) || 0);
    const highDifficulty = entries.slice(-6).filter((entry) => String(entry.dificuldade || "").toLowerCase() === "alta").length;
    const reprograms = entries.filter((entry) => String(entry.status || "").toLowerCase().includes("reprogram")).length;
    const repeatedErrors = Math.max(0, answered.filter((entry) => Number(entry.questoes) > 0 && (Number(entry.acertos) || 0) / Number(entry.questoes) < 0.7).length - 1);
    const important = clamp(input.importance);
    const incidence = clamp(input.incidence);
    const urgency = clamp(input.urgency);
    const coverage = clamp(input.coverage);
    const relevance = clamp(important * 0.48 + incidence * 0.22 + urgency * 0.18 + (1 - coverage) * 0.12);
    const lastContact = Number(input.lastContact) || 0;
    const daysWithoutContact = lastContact ? Math.max(0, Math.floor((Date.now() - lastContact) / DAY)) : null;
    const needsDiagnostic = counts.questions < 10 && sampleConfidence < 0.38;
    const initialInfluence = clamp(input.initialInfluence, -0.12, 0.14) * (1 - sampleConfidence);
    const errorRate = currentAccuracy === null ? null : 1 - currentAccuracy;
    let pressure = 0;
    if (currentAccuracy !== null) {
      if (currentAccuracy < 0.45) pressure += 0.46;
      else if (currentAccuracy < 0.60) pressure += 0.30;
      else if (currentAccuracy < 0.70) pressure += 0.18;
      else if (currentAccuracy < 0.85) pressure += 0.07;
    }
    if (direction.label === "falling") pressure += 0.14;
    if (highDifficulty >= 2) pressure += 0.10;
    if (reprograms >= 2) pressure += 0.09;
    if (repeatedErrors >= 2) pressure += Math.min(0.12, repeatedErrors * 0.04);
    if (Number(review.overdue) > 0) pressure += 0.14;
    else if (Number(review.available) > 0) pressure += 0.07;
    if (daysWithoutContact !== null && daysWithoutContact >= 10) pressure += Math.min(0.10, 0.04 + Math.floor((daysWithoutContact - 10) / 7) * 0.02);
    pressure += initialInfluence;
    pressure = Math.max(0, pressure);

    let level = "adequate";
    if (needsDiagnostic) level = "insufficient";
    else if ((currentAccuracy !== null && currentAccuracy < 0.45 && relevance >= 0.42) || (pressure >= 0.52 && sampleConfidence >= 0.35)) level = "critical";
    else if ((currentAccuracy !== null && currentAccuracy < 0.60 && sampleConfidence >= 0.22) || pressure >= 0.32) level = "deficiency";
    else if ((currentAccuracy !== null && currentAccuracy < STRONG_REFERENCE) || direction.label === "falling" || pressure >= 0.14) level = "attention";
    else if (currentAccuracy !== null && currentAccuracy >= STRONG_REFERENCE && sampleConfidence >= 0.45 && direction.label !== "falling") level = "strong";

    const reasons = [];
    if (currentAccuracy !== null) reasons.push(`${Math.round(currentAccuracy * 100)}% nas questões mais recentes`);
    if (direction.label === "falling") reasons.push("queda nas sessões recentes");
    if (highDifficulty >= 2) reasons.push("dificuldade alta recorrente");
    if (reprograms >= 2) reasons.push(`${reprograms} reprogramações`);
    if (repeatedErrors >= 2) reasons.push("erros recorrentes");
    if (Number(review.overdue) > 0) reasons.push("revisão pendente há mais tempo");
    if (needsDiagnostic) reasons.unshift("ainda há poucas questões registradas");
    if (!reasons.length && level === "strong") reasons.push("desempenho consistente e sem queda recente");

    const priorityAdjustment = level === "critical" ? 0.28 : level === "deficiency" ? 0.20 : level === "attention" ? 0.10 : level === "insufficient" && relevance >= 0.55 ? 0.05 : 0;
    return {
      level,
      reference: STRONG_REFERENCE,
      basis: input.basis || "subject",
      confidence: sampleConfidence,
      questions: counts.questions,
      correct: counts.correct,
      accuracy: currentAccuracy,
      overallAccuracy,
      errorRate,
      trend: direction,
      repeatedErrors,
      highDifficulty,
      reprograms,
      daysWithoutContact,
      relevance,
      needsDiagnostic,
      action: actionFor(level, { needsDiagnostic, relevance }),
      priorityAdjustment,
      reasons: reasons.slice(0, 3),
    };
  }

  global.MasteryDiagnosis = { STRONG_REFERENCE, diagnose, accuracy, confidence, trend };
  if (typeof module !== "undefined" && module.exports) module.exports = global.MasteryDiagnosis;
})(typeof window !== "undefined" ? window : globalThis);
