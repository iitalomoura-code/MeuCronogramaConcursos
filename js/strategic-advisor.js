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

  function summaryFor(groups, coverage) {
    const sentences = [];
    if (coverage.level === "partial") {
      sentences.push("A visão global ainda é parcial porque muitos conteúdos não possuem evidência suficiente.");
    } else if (coverage.level === "low") {
      sentences.push("A visão global ainda é limitada porque poucos conteúdos possuem evidência própria.");
    }
    if (groups.priorities.length) sentences.push(`${groups.priorities[0].title} concentra a maior oportunidade de ganho neste momento.`);
    if (groups.reduceLoad.length) sentences.push(`${groups.reduceLoad.map((item) => item.materia).join(" e ")} ${groups.reduceLoad.length === 1 ? "pode" : "podem"} receber menos carga e seguir em manutenção.`);
    if (groups.watch.length) sentences.push(`${groups.watch.map((item) => item.title).join(" e ")} ${groups.watch.length === 1 ? "merece" : "merecem"} observação temporária.`);
    if (groups.building.length || groups.diagnostic.length) sentences.push("Os conteúdos sem evidência suficiente seguem em construção ou pedem questões diagnósticas, sem serem tratados como deficiência.");
    return sentences.slice(0, 4);
  }

  function hasLocalEvidence(item = {}) {
    return clamp(item.confidence) >= .45
      || Number(item.diagnosis?.questions) >= 10
      || Number(item.diagnosis?.sessionCount || item.diagnosis?.sessions) >= 2;
  }

  function coverageFor(items = []) {
    const evidencedTopics = items.filter(hasLocalEvidence).length;
    const totalTopics = items.length;
    const ratio = totalTopics ? evidencedTopics / totalTopics : 0;
    const evidencedSubjects = new Set(items.filter(hasLocalEvidence).map((item) => item.materia)).size;
    const totalSubjects = new Set(items.map((item) => item.materia)).size;
    const subjectRatio = totalSubjects ? evidencedSubjects / totalSubjects : 0;
    let level = "low";
    if (ratio >= .6 && subjectRatio >= .45) level = "broad";
    else if (ratio >= .15 || evidencedTopics >= 3) level = "partial";
    return { evidencedTopics, totalTopics, ratio, evidencedSubjects, totalSubjects, subjectRatio, level };
  }

  function mixedSubjectsFor(items = []) {
    return groupBySubject(items).map(({ materia, topics }) => {
      const focus = topics.filter((item) => ["prioritize", "recovery"].includes(item.category) || (item.category === "watch" && hasLocalEvidence(item)));
      const maintain = topics.filter((item) => ["maintain", "reduce"].includes(item.category));
      if (!focus.length || !maintain.length) return null;
      const focusNames = focus.map((item) => item.assunto).filter(Boolean);
      const maintainNames = maintain.map((item) => item.assunto).filter(Boolean);
      const focusLabel = focusNames.join(" e ") || materia;
      const maintainLabel = maintainNames.join(" e ") || "os demais temas analisados";
      return {
        materia,
        focus: focusNames,
        maintain: maintainNames,
        title: materia,
        explanation: `${focusLabel} ${focusNames.length === 1 ? "ainda exige" : "ainda exigem"} reforço, enquanto ${maintainLabel} ${maintainNames.length === 1 ? "pode seguir" : "podem seguir"} em manutenção.`,
      };
    }).filter(Boolean);
  }

  function build({ topics = [] } = {}) {
    const items = topics.map(normalize);
    const mixedSubjects = mixedSubjectsFor(items);
    const mixedSubjectNames = new Set(mixedSubjects.map((item) => item.materia));
    const riskySubjects = new Set(groupBySubject(items.filter((item) => ["prioritize", "recovery"].includes(item.category) || ["critical", "deficiency"].includes(item.diagnosis?.level) || item.errorSignals?.recurrence === "high")).map((group) => group.materia));
    const categories = {
      priorities: compactSubjectItems(items.filter((item) => ["prioritize", "recovery"].includes(item.category))).sort((a, b) => clamp(b.strategic?.score) - clamp(a.strategic?.score)).slice(0, LIMIT),
      reduceLoad: compactSubjectItems(items.filter((item) => item.category === "reduce" && !riskySubjects.has(item.materia) && !mixedSubjectNames.has(item.materia))).sort((a, b) => clamp(a.strategic?.score) - clamp(b.strategic?.score)).slice(0, LIMIT),
      maintain: compactSubjectItems(items.filter((item) => item.category === "maintain" && !mixedSubjectNames.has(item.materia))).slice(0, LIMIT),
      watch: compactSubjectItems(items.filter((item) => item.category === "watch")).sort((a, b) => clamp(b.strategic?.score) - clamp(a.strategic?.score)).slice(0, LIMIT),
      building: compactSubjectItems(items.filter((item) => item.category === "building")).sort((a, b) => clamp(b.strategic?.score) - clamp(a.strategic?.score)).slice(0, LIMIT),
      diagnostic: compactSubjectItems(items.filter((item) => item.category === "diagnostic")).sort((a, b) => clamp(b.strategic?.score) - clamp(a.strategic?.score)).slice(0, LIMIT),
    };
    const bottlenecks = categories.priorities.filter((item) => ["critical", "deficiency"].includes(item.diagnosis?.level) || item.errorSignals?.recurrence === "high").slice(0, LIMIT);
    const positiveSignals = [...categories.reduceLoad, ...categories.maintain].slice(0, LIMIT);
    const coverage = coverageFor(items);
    const locallyConfident = items.some((item) => hasLocalEvidence(item) && ["prioritize", "recovery", "reduce", "maintain", "watch"].includes(item.category));
    const hasChange = categories.priorities.length || categories.reduceLoad.length || categories.watch.length || categories.building.length || categories.diagnostic.length;
    const awaitingEvidence = coverage.level === "low" && !locallyConfident;
    const summary = awaitingEvidence
      ? ["Ainda há poucos dados para uma orientação estratégica confiável. Continue registrando sessões e questões para que o sistema possa identificar prioridades com maior segurança."]
      : hasChange
        ? summaryFor(categories, coverage)
        : ["Sua preparação está estável neste momento. Não foram identificados gargalos relevantes que justifiquem mudança ampla de estratégia. Mantenha a distribuição atual e os contatos periódicos previstos."];
    return {
      summary,
      priorities: categories.priorities,
      reduceLoad: categories.reduceLoad,
      maintain: categories.maintain,
      watch: categories.watch,
      building: categories.building,
      insufficientEvidence: categories.diagnostic,
      bottlenecks,
      positiveSignals,
      mixedSubjects,
      coverage,
      globalAssessment: awaitingEvidence ? "low-evidence" : coverage.level,
      changes: [],
      stability: coverage.level === "broad" && !hasChange,
      awaitingEvidence,
      confidence: items.length ? items.reduce((total, item) => total + item.confidence, 0) / items.length : 0,
      topicStates: items.map((item) => ({
        materia: item.materia,
        assunto: item.assunto,
        subarea: item.subarea || "",
        category: item.category,
        learningState: item.strategic?.learningState?.key || "",
        diagnosisLevel: item.diagnosis?.level || "insufficient",
        strategicScore: clamp(item.strategic?.score),
        confidence: item.confidence,
        recentAccuracy: Number.isFinite(item.diagnosis?.accuracy) ? item.diagnosis.accuracy : null,
        overallAccuracy: Number.isFinite(item.diagnosis?.overallAccuracy) ? item.diagnosis.overallAccuracy : null,
        questions: Number(item.diagnosis?.questions) || 0,
        trend: item.diagnosis?.trend?.label || "stable",
        errorRecurrence: item.errorSignals?.recurrence || "none",
        evidenceStage: hasLocalEvidence(item) ? "evidenced" : "initial",
        reasons: [...item.reasons],
      })),
    };
  }

  const api = { build, categoryFor, reasonList, coverageFor };
  global.StrategicAdvisor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
