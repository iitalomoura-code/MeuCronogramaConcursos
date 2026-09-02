"use strict";

(function initLearningDiagnosisView(global) {
  const LEVELS = {
    strong: { label: "Domínio forte", rank: 6, tone: "strong" },
    adequate: { label: "Adequado", rank: 5, tone: "adequate" },
    attention: { label: "Atenção", rank: 4, tone: "attention" },
    deficiency: { label: "Deficiência", rank: 3, tone: "deficiency" },
    critical: { label: "Crítico", rank: 2, tone: "critical" },
    insufficient: { label: "Mais dados necessários", rank: 1, tone: "insufficient" },
  };

  function levelInfo(level) {
    return LEVELS[level] || LEVELS.insufficient;
  }

  function actionText(diagnosis = {}) {
    const action = diagnosis.action || {};
    const parts = [action.label || "Manter contato normal"];
    if (Number(action.minutes) > 0) parts.push(`${action.minutes} min`);
    if (Number(action.questions) > 0) parts.push(`${action.questions} questões`);
    return { label: parts.join(" · "), detail: action.text || "Mantenha o próximo contato previsto pelo ciclo." };
  }

  function evidenceFor(topic = {}) {
    const diagnosis = topic.diagnosis || {};
    const errors = topic.errorSignals || {};
    const items = [];
    if (diagnosis.accuracy !== null && typeof diagnosis.accuracy !== "undefined") items.push(`${Math.round(diagnosis.accuracy * 100)}% nas questões recentes`);
    if (diagnosis.trend?.label === "falling") items.push("queda nas sessões recentes");
    else if (diagnosis.trend?.label === "improving") items.push("tendência de melhora");
    if (errors.recurrence === "high") items.push(`erros em ${errors.sessionsWithErrors} sessões diferentes`);
    else if (Number(errors.postInterventionErrors) >= 2) items.push("erros persistentes após reforço");
    else if (Number(errors.concentration) >= .35) items.push(`${Math.round(errors.concentration * 100)}% dos erros recentes da matéria estão neste tema`);
    if (diagnosis.needsDiagnostic) items.push(`apenas ${diagnosis.questions || 0} questões para avaliar este tema`);
    if (topic.daysWithoutContact >= 10) items.push(`${topic.daysWithoutContact} dias sem contato`);
    return [...new Set(items)].slice(0, 3);
  }

  function responseFor(intervention = null) {
    if (!intervention?.lastResult || intervention.lastResult === "pending") return null;
    const labels = {
      resolved: "Recuperação consolidada",
      improved: "Melhorando",
      "improving-signal": "Sinal de melhora",
      unchanged: "Pouca resposta",
      worse: "Precisa de nova abordagem",
    };
    return { label: labels[intervention.lastResult] || "Em acompanhamento", detail: intervention.lastResultMessage || "A resposta ao reforço foi registrada." };
  }

  function build({ topics = [] } = {}) {
    const prepared = topics.map((topic) => {
      const diagnosis = topic.diagnosis || {};
      const info = levelInfo(diagnosis.level);
      return {
        ...topic,
        level: diagnosis.level || "insufficient",
        levelInfo: info,
        evidence: evidenceFor(topic),
        action: actionText(diagnosis),
        response: responseFor(topic.intervention),
      };
    });
    const order = (a, b) => {
      const interventionDifference = Number(b.errorSignals?.postInterventionErrors || 0) - Number(a.errorSignals?.postInterventionErrors || 0);
      if (interventionDifference) return interventionDifference;
      const rankDifference = a.levelInfo.rank - b.levelInfo.rank;
      if (rankDifference) return rankDifference;
      return String(a.materia).localeCompare(String(b.materia)) || String(a.assunto).localeCompare(String(b.assunto));
    };
    const sorted = [...prepared].sort(order);
    const bySubject = new Map();
    sorted.forEach((topic) => {
      const group = bySubject.get(topic.materia) || { materia: topic.materia, topics: [] };
      group.topics.push(topic);
      bySubject.set(topic.materia, group);
    });
    const subjects = [...bySubject.values()].map((subject) => {
      const levels = subject.topics.map((topic) => topic.levelInfo.rank);
      const weakest = subject.topics[0];
      return { ...subject, weakest, levelInfo: weakest?.levelInfo || LEVELS.insufficient, topics: subject.topics, levelRank: Math.min(...levels) };
    }).sort((a, b) => a.levelRank - b.levelRank || a.materia.localeCompare(b.materia));
    const counts = prepared.reduce((result, topic) => {
      if (topic.level === "strong") result.strong += 1;
      else if (["critical", "deficiency"].includes(topic.level)) result.deficiency += 1;
      else if (topic.level === "insufficient") result.insufficient += 1;
      else result.monitoring += 1;
      return result;
    }, { strong: 0, monitoring: 0, deficiency: 0, insufficient: 0 });
    const errorPatterns = sorted.filter((topic) => topic.errorSignals?.recurrence === "high" || Number(topic.errorSignals?.postInterventionErrors) >= 2 || Number(topic.errorSignals?.concentration) >= .35).slice(0, 3);
    const responses = sorted.filter((topic) => topic.response).slice(0, 3);
    return { topics: sorted, subjects, counts, priorities: sorted.slice(0, 5), errorPatterns, responses };
  }

  function render(model, options = {}) {
    const escape = options.escape || ((value) => String(value || ""));
    const expanded = options.expandedSubjects || new Set();
    const subject = options.subject || "all";
    const attentionOnly = Boolean(options.attentionOnly);
    const status = options.status || "";
    const matchesStatus = (topic) => !status
      || (status === "monitoring" && ["adequate", "attention"].includes(topic.level))
      || (status === "deficiency" && ["critical", "deficiency"].includes(topic.level))
      || topic.level === status;
    const visible = model.topics.filter((topic) => (subject === "all" || topic.materia === subject) && (!attentionOnly || ["attention", "deficiency", "critical", "insufficient"].includes(topic.level)) && matchesStatus(topic));
    const visibleKeys = new Set(visible.map((topic) => `${topic.materia}::${topic.assunto}`));
    const priorityItems = visible.slice(0, 5);
    const subjectItems = model.subjects.map((item) => ({ ...item, topics: item.topics.filter((topic) => visibleKeys.has(`${topic.materia}::${topic.assunto}`)) })).filter((item) => item.topics.length);
    const badge = (topic) => `<span class="learning-diagnosis-status ${topic.levelInfo.tone}">${escape(topic.levelInfo.label)}</span>`;
    const topicCard = (topic, compact = false) => `<article class="learning-diagnosis-topic${compact ? " compact" : ""}"><div class="learning-diagnosis-topic-heading"><div><span>${escape(topic.materia)}</span><h4>${escape(topic.assunto)}</h4></div>${badge(topic)}</div><p class="learning-diagnosis-evidence">${topic.evidence.length ? escape(topic.evidence.join(" · ")) : "Ainda não há evidências suficientes para detalhar este tema."}</p>${topic.response ? `<p class="learning-diagnosis-response"><strong>${escape(topic.response.label)}</strong><span>${escape(topic.response.detail)}</span></p>` : ""}<div class="learning-diagnosis-action"><span>Próxima ação</span><strong>${escape(topic.action.label)}</strong><small>${escape(topic.action.detail)}</small></div>${!compact ? `<button class="primary-button compact-button" type="button" data-reinforce-topic="${escape(topic.materia)}" data-reinforce-subject="${escape(topic.assuntoOriginal || topic.assunto)}"><i data-lucide="zap"></i><span>Reforçar agora</span></button>` : ""}</article>`;
    const mapRows = visible.slice(0, 36).map((topic) => `<article class="learning-diagnosis-map-row"><div><strong>${escape(topic.assunto)}</strong><span>${escape(topic.materia)}</span></div>${badge(topic)}<span>${escape(topic.diagnosis.trend?.label === "falling" ? "Queda" : topic.diagnosis.trend?.label === "improving" ? "Melhora" : "Estável")}</span><span>${Math.round((Number(topic.diagnosis.confidence) || 0) * 100)}%</span><small>${escape(topic.action.label)}</small></article>`).join("");
    return `
      <div class="learning-diagnosis-summary">${[
        ["strong", "Domínio forte", model.counts.strong], ["monitoring", "Sob acompanhamento", model.counts.monitoring], ["deficiency", "Em deficiência", model.counts.deficiency], ["insufficient", "Mais dados", model.counts.insufficient],
      ].map(([key, label, count]) => `<button type="button" class="learning-diagnosis-metric ${status === key ? "is-active" : ""}" data-learning-diagnosis-status="${key}"><strong>${count}</strong><span>${label}</span></button>`).join("")}</div>
      <section class="learning-diagnosis-section learning-diagnosis-priorities"><div class="learning-diagnosis-section-heading"><div><span class="section-kicker">Prioridades de melhoria</span><h3>Onde agir agora</h3><p>Os temas mais relevantes para o próximo passo do seu estudo.</p></div></div><div class="learning-diagnosis-priority-list">${priorityItems.length ? priorityItems.map((topic) => topicCard(topic)).join("") : "<p class=\"muted-note\">Nenhum tema corresponde aos filtros selecionados.</p>"}</div></section>
      <section class="learning-diagnosis-section"><div class="learning-diagnosis-section-heading"><div><span class="section-kicker">Diagnóstico por matéria</span><h3>Onde cada matéria pede atenção</h3></div></div><div class="learning-diagnosis-subject-list">${subjectItems.map((item) => { const isExpanded = expanded.has(item.materia); const topics = isExpanded ? item.topics : item.topics.slice(0, 4); return `<article class="learning-diagnosis-subject"><header><div><strong>${escape(item.materia)}</strong><span class="learning-diagnosis-status ${item.levelInfo.tone}">${escape(item.levelInfo.label)}</span></div><small>${item.topics.length} tema${item.topics.length === 1 ? "" : "s"} analisado${item.topics.length === 1 ? "" : "s"}</small></header><div class="learning-diagnosis-subject-topics">${topics.map((topic) => `<span><b>${escape(topic.assunto)}</b>${badge(topic)}</span>`).join("")}</div>${item.topics.length > 4 ? `<button class="text-action" type="button" data-learning-diagnosis-expand="${escape(item.materia)}">${isExpanded ? "Mostrar menos" : "Ver todos os assuntos"}</button>` : ""}</article>`; }).join("") || "<p class=\"muted-note\">Nenhuma matéria corresponde aos filtros.</p>"}</div></section>
      <div class="learning-diagnosis-secondary-grid"><section class="learning-diagnosis-section"><div class="learning-diagnosis-section-heading"><div><span class="section-kicker">Meus padrões de erro</span><h3>O que está se repetindo</h3></div></div>${model.errorPatterns.length ? `<div class="learning-diagnosis-patterns">${model.errorPatterns.map((topic) => `<article><strong>${escape(topic.assunto)}</strong><span>${Number(topic.errorSignals.postInterventionErrors) >= 2 ? "Erros persistentes após reforço." : topic.errorSignals.recurrence === "high" ? `Erros em ${topic.errorSignals.sessionsWithErrors} sessões diferentes.` : `${Math.round(topic.errorSignals.concentration * 100)}% dos erros recentes de ${topic.materia} estão aqui.`}</span></article>`).join("")}</div>` : "<p class=\"muted-note\">Os padrões relevantes de erro aparecerão conforme novas questões forem registradas.</p>"}</section><section class="learning-diagnosis-section"><div class="learning-diagnosis-section-heading"><div><span class="section-kicker">O que está funcionando</span><h3>Resposta aos reforços</h3></div></div>${model.responses.length ? `<div class="learning-diagnosis-patterns">${model.responses.map((topic) => `<article><strong>${escape(topic.assunto)} · ${escape(topic.response.label)}</strong><span>${escape(topic.response.detail)}</span></article>`).join("")}</div>` : "<p class=\"muted-note\">Depois de um reforço com novas questões, a resposta aparecerá aqui.</p>"}</section></div>
      <section class="learning-diagnosis-section learning-diagnosis-map"><div class="learning-diagnosis-section-heading"><div><span class="section-kicker">Mapa de domínio</span><h3>Todos os temas no estado atual</h3></div></div><div class="learning-diagnosis-map-head"><span>Assunto</span><span>Situação</span><span>Tendência</span><span>Confiança</span><span>Ação</span></div>${mapRows || "<p class=\"muted-note\">Ainda não há temas para exibir.</p>"}</section>`;
  }

  const api = { LEVELS, build, render };
  global.LearningDiagnosisView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
