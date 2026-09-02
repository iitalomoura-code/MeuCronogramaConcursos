"use strict";

(function initContinueRecommendation(global) {
  function score(entry = {}, helpers = {}) {
    const block = entry.block || {};
    const data = entry.derived || entry.suggestion || {};
    const phase = data.phase || helpers.phase || {};
    const profile = phase.profile || phase || {};
    const status = helpers.normalizeStatus ? helpers.normalizeStatus(block.status) : block.status;
    let total = 0;
    if (data.review?.overdue?.length) total += 130 * (profile.reviewMultiplier || 1);
    else if (data.review?.today?.length) total += 100 * (profile.reviewMultiplier || 1);
    if (status === "Em andamento") total += 105;
    total -= Math.min(32, (Number(block.reprogramacoes) || 0) * 10);
    total += (data.adaptive?.adjustment || 0) * 70 * (profile.performanceMultiplier || 1);
    total += (data.incidence?.adjustment || 0) * 60 * (profile.incidenceMultiplier || 1);
    if (!data.hasContact) total += (profile.uncoveredAdjustment || 0) * 100;
    total += (Number(block.prioridade) || 0) * 24;
    total += data.rotation?.score || 0;
    if (data.weeklyReinforcement) total += 72;
    if (data.weeklyAdjustment) total += Math.min(95, Math.max(20, Number(data.weeklyAdjustment.weight) || 0));
    return { ...data, score: total };
  }

  function rank(snapshot = {}, options = {}) {
    const normalizeStatus = options.normalizeStatus || ((value) => value);
    const matchesFilters = options.matchesFilters || (() => true);
    const entries = (snapshot.entries || [])
      .map((entry) => ({ ...entry, suggestion: score(entry, { normalizeStatus, phase: snapshot.phase }) }))
      .sort((a, b) => b.suggestion.score - a.suggestion.score ||
        Number(normalizeStatus(b.block.status) === "Em andamento") - Number(normalizeStatus(a.block.status) === "Em andamento") ||
        Number(Boolean(b.suggestion.review?.hasAttention)) - Number(Boolean(a.suggestion.review?.hasAttention)) ||
        a.index - b.index);
    const filtered = entries.filter((entry) => matchesFilters(entry.block));
    return options.hasActiveFilter ? filtered : entries;
  }

  function alternatives(suggested, rankedEntries = []) {
    const remaining = rankedEntries.filter((entry) => entry.index !== suggested?.index);
    const diversified = [];
    const subjects = new Set();
    remaining.forEach((entry) => {
      if (diversified.length >= 5 || subjects.has(entry.block.materia)) return;
      diversified.push(entry);
      subjects.add(entry.block.materia);
    });
    remaining.forEach((entry) => {
      if (diversified.length >= 5 || diversified.some((item) => item.index === entry.index)) return;
      diversified.push(entry);
    });
    return diversified;
  }

  function build(rankedEntries = [], options = {}) {
    if (!rankedEntries.length) return { recommendation: null, alternatives: [], reasons: [], suggestedMinutes: 0, activityType: "" };
    const offset = Math.max(0, Number(options.offset) || 0) % rankedEntries.length;
    const recommendation = rankedEntries[offset];
    const explanation = explain(recommendation.block, recommendation.suggestion, options.helpers || {});
    return {
      recommendation,
      alternatives: options.includeAlternatives ? alternatives(recommendation, rankedEntries).slice(0, 3) : [],
      reasons: explanation.factors,
      suggestedMinutes: Math.round((Number(recommendation.block.duracao) || 0) * 60),
      activityType: recommendation.suggestion.weeklyReinforcement
        ? "Questões · Reforço recomendado"
        : recommendation.block.atividadeSugerida || recommendation.block.tipoAtividade || recommendation.block.tipo || "Teoria e questões",
      weeklyReinforcement: recommendation.suggestion.weeklyReinforcement || null,
    };
  }

  function explain(block = {}, context = {}, helpers = {}) {
    if (!block) return { text: "", factors: [] };
    const adaptive = context.adaptive || {};
    const review = context.review || {};
    const incidence = context.incidence || {};
    const phase = context.phase || helpers.phase || {};
    const predictiveRisk = helpers.predictiveRiskForSubject?.(block.materia);
    const priority = helpers.priorityInfo?.(block.prioridadeBase ?? block.prioridade) || { percent: 0 };
    const factors = [];
    if (context.weeklyReinforcement?.reasons?.length) context.weeklyReinforcement.reasons.slice(0, 2).forEach((reason) => factors.push(`reforço recomendado: ${reason}`));
    if (context.weeklyAdjustment?.reason) factors.push(context.weeklyAdjustment.reason);
    if (review.hasAttention) factors.push("revisão merece atenção antes de avançar");
    if (helpers.normalizeStatus?.(block.status) === "Em andamento") factors.push("tema em andamento");
    if (helpers.normalizeStatus?.(block.status) === "Reprogramar") factors.push("tema reprogramado, com retorno gradual ao ciclo");
    const diagnosisReason = helpers.initialDiagnosisReason?.(block.materia);
    if (diagnosisReason && (helpers.initialDiagnosisInfluence?.(block.materia)?.adjustment || 0) * (phase.diagnosisMultiplier || 1) >= .025) factors.push(diagnosisReason);
    if (Number(helpers.subjectPlanningData?.(block.materia)?.dominio) >= 4) factors.push("dificuldade pessoal alta");
    (context.rotation?.reasons || [context.rotation?.reason || block.rotationReason].filter(Boolean)).forEach((reason) => {
      if (reason && !reason.includes("frequência recentemente")) factors.push(reason);
    });
    (adaptive.reasons || []).slice(0, 2).forEach((reason) => {
      if (reason.includes("acerto recente")) factors.push("desempenho recente indica reforço");
      else if (reason.includes("dificuldade")) factors.push("dificuldade informada alta");
      else if (reason.includes("reprogram")) factors.push("tema reprogramado anteriormente");
      else if (reason.includes("queda")) factors.push("queda de desempenho recente");
    });
    const mastery = adaptive.mastery;
    if (mastery?.needsDiagnostic) factors.push("ainda faltam questões para avaliar melhor este tema");
    else if (["critical", "deficiency"].includes(mastery?.level)) factors.push(mastery.action?.label === "Revisão aprofundada" ? "desempenho recente pede revisão aprofundada" : "desempenho recente pede reforço direcionado");
    else if (mastery?.trend?.label === "falling") factors.push("queda nas sessões mais recentes");
    if (incidence.applied && incidence.normalized >= .5) factors.push(incidence.kind === "fgv" ? "incidência histórica relevante na FGV" : "incidência histórica relevante na matéria");
    if (predictiveRisk?.level === "Prioridade") factors.push("matéria com risco de preparação no ritmo recente");
    else if (predictiveRisk?.level === "Atenção") factors.push("matéria que merece atenção nas próximas semanas");
    if (context.hasContact === false && phase.configured !== false) factors.push(helpers.isPreNotice?.(phase) ? "amplia a cobertura entre as matérias" : "conteúdo relevante ainda sem contato");
    if (!factors.length && priority.percent >= 60) factors.push("tema prioritário para a prova");
    if (!factors.length) return { text: "Este é o próximo bloco pendente do ciclo atual.", factors: [] };
    return { text: `${factors.slice(0, 3).join("; ")}.`, factors: [...new Set(factors)].slice(0, 3) };
  }

  const api = { score, rank, alternatives, build, explain };
  global.ContinueRecommendation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
