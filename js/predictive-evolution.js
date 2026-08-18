"use strict";

(function initPredictiveEvolutionEngine(global) {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

  function clamp(value, min = 0, max = 1) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function asDate(value) { const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
  function weekStart(value) { const date = asDate(value); if (!date) return null; const result = new Date(date); result.setHours(0, 0, 0, 0); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; }
  function median(values = []) { const ordered = values.filter(Number.isFinite).sort((a, b) => a - b); if (!ordered.length) return 0; const middle = Math.floor(ordered.length / 2); return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2; }
  function weekKey(value) { const date = weekStart(value); return date ? date.toISOString().slice(0, 10) : ""; }
  function rangeText(value) { if (!Number.isFinite(value) || value <= 0) return ""; const low = Math.max(1, Math.floor(value * .85)); const high = Math.max(low + 1, Math.ceil(value * 1.15)); return low === high ? `aproximadamente ${low} semana${low === 1 ? "" : "s"}` : `aproximadamente ${low}–${high} semanas`; }

  function weeklySeries(entries = [], now = new Date(), weeks = 8) {
    const end = weekStart(now);
    const start = new Date(end.getTime() - (weeks - 1) * WEEK_MS);
    const buckets = new Map(Array.from({ length: weeks }, (_, index) => {
      const date = new Date(start.getTime() + index * WEEK_MS);
      return [weekKey(date), { key: weekKey(date), date, hours: 0, contacts: new Set(), questions: 0, correct: 0 }];
    }));
    entries.forEach((entry) => {
      const date = asDate(entry.date);
      const key = date ? weekKey(date) : "";
      const bucket = buckets.get(key);
      if (!bucket) return;
      bucket.hours += Math.max(0, Number(entry.hours) || 0);
      bucket.questions += Math.max(0, Number(entry.questions) || 0);
      bucket.correct += Math.min(Math.max(0, Number(entry.correct) || 0), Math.max(0, Number(entry.questions) || 0));
      if (entry.contactKey) bucket.contacts.add(entry.contactKey);
    });
    const result = [...buckets.values()];
    const nonZeroHours = result.filter((item) => item.hours > 0).map((item) => item.hours);
    const cap = nonZeroHours.length >= 3 ? Math.max(median(nonZeroHours) * 1.8, 1) : Infinity;
    return result.map((item) => ({ ...item, effectiveHours: Math.min(item.hours, cap), contacts: item.contacts.size }));
  }

  function trend(values = [], tolerance = .15) {
    const usable = values.filter(Number.isFinite);
    if (usable.length < 4) return { label: "Dados insuficientes", direction: "", delta: null };
    const previous = usable.slice(-4, -2);
    const recent = usable.slice(-2);
    const previousMean = previous.reduce((sum, value) => sum + value, 0) / previous.length;
    const recentMean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    if (previousMean <= 0 && recentMean <= 0) return { label: "Estável", direction: "→", delta: 0 };
    const delta = recentMean - previousMean;
    const relative = previousMean ? Math.abs(delta) / previousMean : 1;
    if (relative < tolerance) return { label: "Estável", direction: "→", delta };
    return delta > 0 ? { label: "Em crescimento", direction: "↑", delta } : { label: "Em redução", direction: "↓", delta };
  }

  function confidence({ activeWeeks = 0, sessions = 0, stability = 1, questions = 0 } = {}) {
    if (activeWeeks < 2 || sessions < 3) return "baixa";
    if (activeWeeks >= 4 && sessions >= 8 && stability <= .55 && questions >= 20) return "alta";
    return "moderada";
  }

  function subjectRisk(subject = {}, context = {}) {
    const reasons = [];
    let score = 0;
    const coverage = clamp(subject.coverage);
    const performance = Number(subject.performance);
    const priority = clamp(subject.priority);
    const remainingHours = Math.max(0, Number(subject.remainingHours) || 0);
    if (coverage < .5) { score += 2; reasons.push(`${Math.round((1 - coverage) * 100)}% do conteúdo ainda sem contato`); }
    else if (coverage < .75) { score += 1; reasons.push("cobertura ainda parcial"); }
    if (Number(subject.questions) >= 10 && performance < .6) { score += 2; reasons.push(`desempenho recente de ${Math.round(performance * 100)}%`); }
    if (subject.performanceTrend === "Queda") { score += 1; reasons.push("queda recente de desempenho"); }
    if (Number(subject.openReviews) >= 2) { score += 1; reasons.push(`${subject.openReviews} revisões pendentes`); }
    if (Number(subject.reprograms) >= 2) { score += 1; reasons.push(`${subject.reprograms} reprogramações registradas`); }
    if (context.weeksToExam !== null && context.weeksToExam <= 8 && remainingHours > 0) { score += 1; reasons.push("pouco tempo até a prova"); }
    score += priority >= .75 && coverage < .75 ? 1 : 0;
    const level = score >= 4 ? "Prioridade" : score >= 2 ? "Atenção" : "Sob controle";
    return { level, score, reasons: reasons.slice(0, 3) };
  }

  function build(input = {}) {
    const now = asDate(input.now) || new Date();
    const topics = Array.isArray(input.topics) ? input.topics : [];
    const entries = (Array.isArray(input.entries) ? input.entries : []).map((entry) => ({ ...entry, date: asDate(entry.date) })).filter((entry) => entry.date);
    const series = weeklySeries(entries, now);
    const active = series.filter((item) => item.hours > 0 || item.contacts > 0);
    const recent = active.slice(-4);
    const weeklyHours = recent.length ? recent.reduce((sum, item) => sum + item.effectiveHours, 0) / recent.length : 0;
    const coverageVelocity = recent.length ? recent.reduce((sum, item) => sum + item.contacts, 0) / recent.length : 0;
    const hoursValues = recent.map((item) => item.effectiveHours);
    const mean = hoursValues.length ? hoursValues.reduce((sum, value) => sum + value, 0) / hoursValues.length : 0;
    const variation = mean ? Math.sqrt(hoursValues.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / hoursValues.length) / mean : 1;
    const totalTopics = topics.length;
    const contactedTopics = topics.filter((topic) => topic.contacted).length;
    const remainingHours = topics.filter((topic) => !topic.contacted).reduce((sum, topic) => sum + Math.max(.5, Number(topic.estimatedHours) || 1), 0);
    const estimatedWeeks = weeklyHours > 0 ? remainingHours / weeklyHours : null;
    const reliableCoverage = active.length >= 2 && entries.length >= 3 && weeklyHours > 0;
    const examDate = asDate(input.examDate);
    const weeksToExam = examDate ? Math.max(0, Math.ceil((examDate - now) / WEEK_MS)) : null;
    const projectedCoverage = reliableCoverage && weeksToExam !== null && totalTopics ? clamp(contactedTopics / totalTopics + (coverageVelocity * weeksToExam / totalTopics)) : null;
    const overallQuestions = entries.reduce((sum, entry) => sum + (Number(entry.questions) || 0), 0);
    const confidenceLevel = confidence({ activeWeeks: active.length, sessions: entries.length, stability: variation, questions: overallQuestions });
    const subjects = (Array.isArray(input.subjects) ? input.subjects : []).map((subject) => ({ ...subject, risk: subjectRisk(subject, { weeksToExam }) })).sort((a, b) => b.risk.score - a.risk.score || String(a.name).localeCompare(String(b.name)));
    // A semana atual pode ainda não ter sessões; ela não deve parecer uma queda de ritmo.
    const rhythmTrend = trend(active.map((item) => item.effectiveHours));
    const situation = projectedCoverage === null ? "Dados insuficientes" : projectedCoverage >= .98 ? "Ritmo adequado" : projectedCoverage >= .8 ? "Atenção" : "Risco de cobertura";
    return {
      coverage: { totalTopics, contactedTopics, percent: totalTopics ? contactedTopics / totalTopics : null, remainingHours, estimatedWeeks: reliableCoverage ? estimatedWeeks : null, estimateText: reliableCoverage ? rangeText(estimatedWeeks) : "" },
      rhythm: { weeklyHours, trend: rhythmTrend, series: series.slice(-4), activeWeeks: active.length },
      performance: { questions: overallQuestions },
      confidence: { level: confidenceLevel, available: reliableCoverage, message: reliableCoverage ? "" : "Continue registrando sessões para construirmos uma estimativa mais confiável." },
      exam: { date: examDate, weeksToExam, projectedCoverage, situation },
      subjects,
    };
  }

  const api = { build, weeklySeries, trend, subjectRisk, confidence };
  global.PredictiveEvolutionEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
