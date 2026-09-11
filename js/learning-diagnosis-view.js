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
  const PRIORITY_RANK = { critical: 0, deficiency: 1, attention: 2, insufficient: 3, adequate: 4, strong: 5 };

  function levelInfo(level, diagnosis = {}) {
    if (level === "adequate" && diagnosis.evidenceStage === "preliminary") {
      return { ...LEVELS.adequate, label: "Em consolidação" };
    }
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

  function subjectSummary(topics = []) {
    const count = (levels) => topics.filter((topic) => levels.includes(topic.level)).length;
    const parts = [];
    const strong = count(["strong"]);
    const adequate = count(["adequate"]);
    const monitoring = count(["attention"]);
    const deficiency = count(["deficiency", "critical"]);
    const insufficient = count(["insufficient"]);
    if (strong) parts.push(`${strong} consolidado${strong === 1 ? "" : "s"}`);
    if (adequate) parts.push(`${adequate} adequado${adequate === 1 ? "" : "s"}`);
    if (monitoring) parts.push(`${monitoring} em acompanhamento`);
    if (deficiency) parts.push(`${deficiency} em deficiência`);
    if (insufficient) parts.push(`${insufficient} sem dados suficientes`);
    return parts.join(" · ") || "Ainda sem evidências suficientes.";
  }

  function subjectVisualState(topics = []) {
    const total = Math.max(1, topics.length);
    const count = (levels) => topics.filter((topic) => levels.includes(topic.level)).length;
    const insufficient = count(["insufficient"]);
    const needsAttention = count(["critical", "deficiency"]);
    const monitoring = count(["attention"]);
    if (insufficient / total >= .6) return { label: "Em construção", tone: "insufficient" };
    if (needsAttention > 0) return { label: "Com pontos de atenção", tone: "attention" };
    if (monitoring > 0 || insufficient > 0) return { label: "Em acompanhamento", tone: "attention" };
    return { label: "Base consistente", tone: "strong" };
  }

  function originLabel(diagnosis = {}, topic = {}) {
    const origin = diagnosis.diagnosisOrigin || diagnosis.historyInheritance?.origin || topic.historyInheritance?.origin || "none";
    return {
      "current-cycle": "Dados do ciclo atual",
      "previous-history": "Histórico de ciclos anteriores",
      "self-assessment": "Autopercepção inicial",
      mixed: "Histórico + dados atuais",
      none: "Ainda sem evidência suficiente",
    }[origin] || "Registros disponíveis";
  }

  function technicalDetails(topic, escape, actionButton) {
    const diagnosis = topic.diagnosis || {};
    const errors = topic.errorSignals || {};
    const trend = diagnosis.trend?.label === "falling" ? "Queda" : diagnosis.trend?.label === "improving" ? "Melhora" : "Estável";
    const percentage = (value) => value === null || typeof value === "undefined" ? "Sem registro" : `${Math.round(value * 100)}%`;
    const source = originLabel(diagnosis, topic);
    const errorDetail = errors.recurrence === "high" ? `Recorrentes em ${errors.sessionsWithErrors || 0} sessões` : Number(errors.postInterventionErrors) >= 2 ? "Persistentes após reforço" : "Sem recorrência relevante";
    return `<details class="learning-diagnosis-topic-details"><summary>Ver detalhes</summary><dl><div><dt>Desempenho recente</dt><dd>${escape(percentage(diagnosis.accuracy))}</dd></div><div><dt>Desempenho histórico</dt><dd>${escape(percentage(diagnosis.overallAccuracy))}</dd></div><div><dt>Questões</dt><dd>${escape(diagnosis.questions || 0)}</dd></div><div><dt>Sessões</dt><dd>${escape(diagnosis.sessions || 0)}</dd></div><div><dt>Tendência</dt><dd>${escape(trend)}</dd></div><div><dt>Confiança</dt><dd>${Math.round((Number(diagnosis.confidence) || 0) * 100)}%</dd></div><div><dt>Último contato</dt><dd>${topic.daysWithoutContact > 0 ? `${escape(topic.daysWithoutContact)} dias atrás` : "Hoje ou sem registro anterior"}</dd></div><div><dt>Erros</dt><dd>${escape(errorDetail)}</dd></div><div><dt>Origem</dt><dd>${escape(source)}</dd></div></dl><div class="learning-diagnosis-detail-action"><span>Próxima ação disponível</span><strong>${escape(topic.action.label)}</strong><small>${escape(topic.action.detail)}</small><button class="secondary-button compact-button" type="button" data-reinforce-topic="${escape(topic.materia)}" data-reinforce-subject="${escape(topic.assuntoOriginal || topic.assunto)}"><i data-lucide="zap"></i><span>${actionButton(topic)}</span></button></div></details>`;
  }

  function build({ topics = [] } = {}) {
    const prepared = topics.map((topic) => {
      const diagnosis = topic.diagnosis || {};
      const info = levelInfo(diagnosis.level, diagnosis);
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
      const rankDifference = (PRIORITY_RANK[a.level] ?? 9) - (PRIORITY_RANK[b.level] ?? 9);
      if (rankDifference) return rankDifference;
      const relevanceDifference = Number(b.diagnosis?.relevance || 0) - Number(a.diagnosis?.relevance || 0);
      if (relevanceDifference) return relevanceDifference;
      const confidenceDifference = Number(b.diagnosis?.confidence || 0) - Number(a.diagnosis?.confidence || 0);
      if (confidenceDifference) return confidenceDifference;
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
      return { ...subject, weakest, levelInfo: weakest?.levelInfo || LEVELS.insufficient, visualState: subjectVisualState(subject.topics), topics: subject.topics, levelRank: Math.min(...levels) };
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
      || (status === "attention" && ["adequate", "attention", "deficiency", "critical"].includes(topic.level))
      || (status === "monitoring" && ["adequate", "attention"].includes(topic.level))
      || (status === "deficiency" && ["critical", "deficiency"].includes(topic.level))
      || topic.level === status;
    const visible = model.topics.filter((topic) => (subject === "all" || topic.materia === subject) && (!attentionOnly || ["attention", "deficiency", "critical", "insufficient"].includes(topic.level)) && matchesStatus(topic));
    const visibleKeys = new Set(visible.map((topic) => `${topic.materia}::${topic.assunto}`));
    const subjectItems = model.subjects.map((item) => ({ ...item, topics: item.topics.filter((topic) => visibleKeys.has(`${topic.materia}::${topic.assunto}`)) })).filter((item) => item.topics.length);
    const badge = (topic) => `<span class="learning-diagnosis-status ${topic.levelInfo.tone}">${escape(topic.levelInfo.label)}</span>`;
    const actionButton = (topic) => topic.level === "insufficient" ? "Fazer diagnóstico" : "Reforçar agora";
    const mapRows = visible.slice(0, 36).map((topic) => `<article class="learning-diagnosis-map-row"><div><strong>${escape(topic.assunto)}</strong><span>${escape(topic.materia)}</span></div>${badge(topic)}<span>${escape(topic.diagnosis.trend?.label === "falling" ? "Queda" : topic.diagnosis.trend?.label === "improving" ? "Melhora" : "Estável")}</span><span>${Math.round((Number(topic.diagnosis.confidence) || 0) * 100)}%</span><small>${escape(topic.action.label)}</small></article>`).join("");
    return `
      <div class="learning-diagnosis-summary">${[
        ["strong", "Domínio forte", model.counts.strong], ["attention", "Atenção", model.counts.monitoring + model.counts.deficiency], ["insufficient", "Mais dados", model.counts.insufficient],
      ].map(([key, label, count]) => `<button type="button" class="learning-diagnosis-metric ${status === key ? "is-active" : ""}" data-learning-diagnosis-status="${key}"><strong>${count}</strong><span>${label}</span></button>`).join("")}</div>
      <section class="learning-diagnosis-section"><div class="learning-diagnosis-section-heading"><div><span class="section-kicker">Diagnóstico por matéria</span><h3>Como está cada matéria</h3><p>Abra uma matéria para ver os assuntos e investigue as evidências somente quando precisar.</p></div></div><div class="learning-diagnosis-subject-list">${subjectItems.map((item) => { const isExpanded = expanded.has(item.materia); return `<article class="learning-diagnosis-subject ${isExpanded ? "is-expanded" : ""}"><button class="learning-diagnosis-subject-trigger" type="button" data-learning-diagnosis-expand="${escape(item.materia)}" aria-expanded="${isExpanded}" aria-label="${isExpanded ? "Recolher" : "Expandir"} ${escape(item.materia)}"><span><strong>${escape(item.materia)}</strong></span><span class="learning-diagnosis-subject-overview"><b class="learning-diagnosis-status ${item.visualState.tone}">${escape(item.visualState.label)}</b><small>${escape(subjectSummary(item.topics))}</small></span><i data-lucide="chevron-down" aria-hidden="true"></i></button>${isExpanded ? `<div class="learning-diagnosis-subject-topics">${item.topics.map((topic) => `<article class="learning-diagnosis-topic"><div><strong>${escape(topic.assunto)}</strong>${badge(topic)}</div>${technicalDetails(topic, escape, actionButton)}</article>`).join("")}</div>` : ""}</article>`; }).join("") || "<p class=\"muted-note\">Nenhuma matéria corresponde aos filtros.</p>"}</div></section>
      <details class="learning-diagnosis-map learning-diagnosis-section"><summary><span class="section-kicker">Mapa de domínio</span><strong>Ver mapa completo de assuntos</strong><i data-lucide="chevron-down" aria-hidden="true"></i></summary><div class="learning-diagnosis-map-content"><div class="learning-diagnosis-map-head"><span>Assunto</span><span>Situação</span><span>Tendência</span><span>Confiança</span><span>Ação</span></div>${mapRows || "<p class=\"muted-note\">Ainda não há temas para exibir.</p>"}</div></details>`;
  }

  const api = { LEVELS, build, render };
  global.LearningDiagnosisView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
