"use strict";

(function initStrategicAdvisor(global) {
  const LIMIT = 3;

  function clamp(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function title(item = {}) {
    return item.assunto ? `${item.materia}: ${item.assunto}` : item.materia || "Conteúdo";
  }

  function evidenceLanguage(item = {}) {
    const confidence = clamp(item.diagnosis?.confidence);
    if (confidence < .35) return "Ainda é cedo para concluir";
    if (confidence < .62) return "Os dados indicam";
    return "Há evidência consistente de";
  }

  function reasonList(item = {}) {
    const diagnosis = item.diagnosis || {};
    const strategic = item.strategic || {};
    const reasons = [];
    if (clamp(strategic.scoreComponents?.importance) >= .75) reasons.push("importância alta na prova");
    if (Number.isFinite(diagnosis.accuracy)) reasons.push(`${Math.round(diagnosis.accuracy * 100)}% de acerto recente`);
    if (diagnosis.trend?.label === "falling") reasons.push("queda recente confirmada");
    if (item.errorSignals?.recurrence === "high" || Number(item.errorSignals?.postInterventionErrors) >= 2) reasons.push("erros recorrentes");
    if (clamp(strategic.scoreComponents?.difficulty) >= .8) reasons.push("dificuldade pessoal elevada");
    if (item.historyInheritance?.level === "strong" && !diagnosis.hasContact) reasons.push("base prévia forte sem confirmação atual");
    if (!diagnosis.hasContact) reasons.push("ainda sem contato suficiente");
    return reasons.slice(0, 4);
  }

  function categoryFor(item = {}) {
    const diagnosis = item.diagnosis || {};
    const strategic = item.strategic || {};
    const history = item.historyInheritance || diagnosis.historyInheritance || {};
    const initial = item.initialProfile || {};
    const confidence = clamp(diagnosis.confidence);
    const score = clamp(strategic.score);
    if (diagnosis.level === "insufficient") {
      if (history.level === "strong" || history.level === "partial" || ["intermediate", "advanced"].includes(initial.level)) return "diagnostic";
      return "building";
    }
    if (strategic.learningState?.key === "recovery" || (diagnosis.trend?.label === "falling" && confidence >= .55 && Number.isFinite(diagnosis.overallAccuracy) && Number.isFinite(diagnosis.accuracy) && diagnosis.overallAccuracy - diagnosis.accuracy >= .06)) return "recovery";
    if (["critical", "deficiency"].includes(diagnosis.level) || (diagnosis.level === "attention" && score >= .56)) return "prioritize";
    if (diagnosis.level === "strong" && confidence >= .55 && diagnosis.trend?.label !== "falling" && score < .56) return "reduce";
    if (diagnosis.trend?.label === "falling" || diagnosis.level === "attention") return "watch";
    return "maintain";
  }

  function textFor(category, item) {
    const subject = title(item);
    const lead = evidenceLanguage(item).toLowerCase();
    if (category === "prioritize") return `${subject} concentra uma boa oportunidade de ganho agora: ${reasonList(item).join(", ") || "o diagnóstico aponta necessidade de reforço"}.`;
    if (category === "recovery") return `${subject} pede recuperação temporária: ${lead} queda após uma base antes mais consistente.`;
    if (category === "reduce") return `${subject} pode perder carga sem ser abandonado. O desempenho está estável e pede apenas contatos periódicos.`;
    if (category === "building") return `${subject} está em construção. Ainda não há evidência suficiente para tratá-lo como deficiência.`;
    if (category === "diagnostic") return `${subject} tem indícios de base prévia, mas faltam questões recentes para confirmar o nível atual.`;
    if (category === "watch") return `${subject} merece observação: ${lead} um sinal que ainda não pede uma mudança ampla de estratégia.`;
    return `${subject} permanece em manutenção, com contato periódico suficiente neste momento.`;
  }

  function normalize(item = {}) {
    const category = categoryFor(item);
    return {
      ...item,
      category,
      title: title(item),
      reasons: reasonList(item),
      confidence: clamp(item.diagnosis?.confidence),
      explanation: textFor(category, item),
    };
  }

  function groupBySubject(items = []) {
    const grouped = new Map();
    items.forEach((item) => {
      const group = grouped.get(item.materia) || [];
      group.push(item);
      grouped.set(item.materia, group);
    });
    return [...grouped.entries()].map(([materia, topics]) => ({ materia, topics }));
  }

  function compactSubjectItems(items = []) {
    return groupBySubject(items).map(({ materia, topics }) => {
      const top = [...topics].sort((a, b) => clamp(b.strategic?.score) - clamp(a.strategic?.score))[0];
      const names = topics.map((item) => item.assunto).filter(Boolean).slice(0, 2);
      return { ...top, materia, assunto: names.join(" e "), title: names.length ? `${materia}: ${names.join(" e ")}` : materia };
    });
  }

  function summaryFor(groups) {
    const sentences = [];
    if (groups.priorities.length) sentences.push(`${groups.priorities[0].title} concentra a maior oportunidade de ganho neste momento.`);
    if (groups.reduceLoad.length) sentences.push(`${groups.reduceLoad.map((item) => item.materia).join(" e ")} ${groups.reduceLoad.length === 1 ? "pode" : "podem"} receber menos carga e seguir em manutenção.`);
    if (groups.watch.length) sentences.push(`${groups.watch.map((item) => item.title).join(" e ")} ${groups.watch.length === 1 ? "merece" : "merecem"} observação temporária.`);
    if (groups.building.length || groups.diagnostic.length) sentences.push("Os conteúdos sem evidência suficiente seguem em construção ou pedem questões diagnósticas, sem serem tratados como deficiência.");
    return sentences.slice(0, 4);
  }

  function build({ topics = [] } = {}) {
    const items = topics.map(normalize);
    const categories = {
      priorities: compactSubjectItems(items.filter((item) => ["prioritize", "recovery"].includes(item.category))).sort((a, b) => clamp(b.strategic?.score) - clamp(a.strategic?.score)).slice(0, LIMIT),
      reduceLoad: compactSubjectItems(items.filter((item) => item.category === "reduce")).sort((a, b) => clamp(a.strategic?.score) - clamp(b.strategic?.score)).slice(0, LIMIT),
      maintain: compactSubjectItems(items.filter((item) => item.category === "maintain")).slice(0, LIMIT),
      watch: compactSubjectItems(items.filter((item) => item.category === "watch")).sort((a, b) => clamp(b.strategic?.score) - clamp(a.strategic?.score)).slice(0, LIMIT),
      building: compactSubjectItems(items.filter((item) => item.category === "building")).slice(0, LIMIT),
      diagnostic: compactSubjectItems(items.filter((item) => item.category === "diagnostic")).slice(0, LIMIT),
    };
    const bottlenecks = categories.priorities.filter((item) => ["critical", "deficiency"].includes(item.diagnosis?.level) || item.errorSignals?.recurrence === "high").slice(0, LIMIT);
    const positiveSignals = [...categories.reduceLoad, ...categories.maintain].slice(0, LIMIT);
    return {
      summary: summaryFor(categories),
      priorities: categories.priorities,
      reduceLoad: categories.reduceLoad,
      maintain: categories.maintain,
      watch: categories.watch,
      building: categories.building,
      insufficientEvidence: categories.diagnostic,
      bottlenecks,
      positiveSignals,
      changes: [],
      confidence: items.length ? items.reduce((total, item) => total + item.confidence, 0) / items.length : 0,
      snapshot: { generatedAt: new Date().toISOString(), itemCount: items.length, categories: items.map((item) => ({ materia: item.materia, assunto: item.assunto, category: item.category, level: item.diagnosis?.level || "insufficient" })) },
    };
  }

  const api = { build, categoryFor, reasonList };
  global.StrategicAdvisor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
