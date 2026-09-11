"use strict";

(function initStrategicTimeAllocation(global) {
  const config = global.StrategicPriorityConfig || (typeof module !== "undefined" && module.exports ? require("./strategic-priority-config.js") : {});

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, Number(value) || 0));
  }

  function text(value) {
    return String(value || "").trim();
  }

  function keyFor(topic = {}) {
    return `${text(topic.materia).toLocaleLowerCase()}::${text(topic.assunto).toLocaleLowerCase()}`;
  }

  function stateKey(topic = {}) {
    return text(topic.learningState?.key || topic.strategic?.learningState?.key || topic.learningState || "practice");
  }

  function sessionFor(topic = {}, settings = {}) {
    const state = stateKey(topic);
    const configured = config.sessions?.[state === "not-started" ? "diagnostic" : state] || config.sessions?.practice || {};
    const session = topic.recommendedSession || topic.strategic?.recommendedSession || configured;
    const idealDuration = Math.max(1, Math.round(Number(session.minutes) || Number(configured.minutes) || 30));
    return {
      kind: text(session.kind || configured.kind || "questions"),
      label: text(session.label || configured.label || "Questões"),
      idealDuration,
      minimumDuration: Math.min(idealDuration, Number(settings.minimumSessionMinutes) || 20),
    };
  }

  function normalizedTopic(topic = {}, settings = {}) {
    const materia = text(topic.materia || topic.subject || topic.unit?.materia);
    const assunto = text(topic.assunto || topic.topic || topic.unit?.assunto);
    const strategicScore = clamp(topic.strategicScore ?? topic.strategic?.score ?? topic.score);
    if (!materia || !assunto || strategicScore <= 0 || topic.disabled === true) return null;
    const normalized = { materia, assunto, strategicScore, learningState: stateKey(topic), source: topic };
    return { ...normalized, session: sessionFor({ ...topic, ...normalized }, settings) };
  }

  function countsFromRecent(recentAllocations = []) {
    const topicCounts = new Map();
    const subjectCounts = new Map();
    const topicMinutes = new Map();
    const subjectMinutes = new Map();
    (Array.isArray(recentAllocations) ? recentAllocations : []).forEach((entry) => {
      const topicKey = keyFor(entry);
      const subjectKey = text(entry.materia).toLocaleLowerCase();
      const durationMinutes = Math.max(0, Number(entry.durationMinutes) || 0);
      if (!topicKey || topicKey === "::") return;
      topicCounts.set(topicKey, (topicCounts.get(topicKey) || 0) + 1);
      subjectCounts.set(subjectKey, (subjectCounts.get(subjectKey) || 0) + 1);
      topicMinutes.set(topicKey, (topicMinutes.get(topicKey) || 0) + durationMinutes);
      subjectMinutes.set(subjectKey, (subjectMinutes.get(subjectKey) || 0) + durationMinutes);
    });
    return { topicCounts, subjectCounts, topicMinutes, subjectMinutes };
  }

  function stateMultiplier(state, settings) {
    if (state === "maintenance") return Number(settings.maintenanceMultiplier) || .72;
    if (state === "recovery") return Number(settings.recoveryMultiplier) || 1.08;
    return 1;
  }

  function candidateUtility(topic, context) {
    const topicKey = keyFor(topic);
    const subjectKey = topic.materia.toLocaleLowerCase();
    const repetitionIndex = context.topicCounts.get(topicKey) || 0;
    const subjectRepetitions = context.subjectCounts.get(subjectKey) || 0;
    const decay = context.settings.sameTopicDecay || [1, .78, .58, .42];
    const marginalMultiplier = Number(decay[Math.min(repetitionIndex, decay.length - 1)]) || decay.at(-1) || .42;
    const subjectMultiplier = subjectRepetitions ? Math.pow(Number(context.settings.sameSubjectDecay) || .94, subjectRepetitions) : 1;
    const concentrationCap = context.availableMinutes * (Number(context.settings.concentrationSoftCap) || .5);
    const allocatedToTopic = context.topicMinutes.get(topicKey) || 0;
    const exceedsSoftCap = allocatedToTopic >= concentrationCap && context.candidateCount > 1 && context.availableMinutes > topic.session.idealDuration;
    const concentrationMultiplier = exceedsSoftCap ? Number(context.settings.concentrationDecay) || .72 : 1;
    const effectiveOpportunity = topic.strategicScore * stateMultiplier(topic.learningState, context.settings) * marginalMultiplier * subjectMultiplier * concentrationMultiplier;
    return { effectiveOpportunity, repetitionIndex, marginalMultiplier, subjectMultiplier, concentrationMultiplier };
  }

  function compareCandidates(left, right) {
    return right.utility.effectiveOpportunity - left.utility.effectiveOpportunity
      || right.topic.strategicScore - left.topic.strategicScore
      || left.topic.learningState.localeCompare(right.topic.learningState)
      || left.topic.materia.localeCompare(right.topic.materia, "pt-BR")
      || left.topic.assunto.localeCompare(right.topic.assunto, "pt-BR");
  }

  function rationaleFor(topic, utility, duration) {
    const rationale = ["maior oportunidade estratégica disponível"];
    if (topic.learningState === "recovery") rationale.push("conteúdo em recuperação");
    else if (topic.learningState === "maintenance") rationale.push("contato de manutenção selecionado sem competir com oportunidades superiores");
    if (utility.repetitionIndex) rationale.push("retorno marginal ajustado após bloco anterior do mesmo assunto");
    else rationale.push("retorno marginal ainda alto");
    if (duration < topic.session.idealDuration) rationale.push("sessão reduzida, mantendo a mesma intenção pedagógica");
    return rationale;
  }

  // recentAllocations representa somente blocos relevantes para a janela atual
  // (por exemplo, o dia em andamento). O chamador não deve passar o histórico completo.
  function allocate({ availableMinutes = 0, topics = [], recentAllocations = [], options = {} } = {}) {
    const settings = { ...(config.timeAllocation || {}), ...(options || {}) };
    const available = Math.max(0, Math.floor(Number(availableMinutes) || 0));
    const normalizedTopics = (Array.isArray(topics) ? topics : []).map((topic) => normalizedTopic(topic, settings)).filter(Boolean);
    if (!available || available < Number(settings.minimumSessionMinutes) || !normalizedTopics.length) {
      return { availableMinutes: available, allocatedMinutes: 0, unusedMinutes: available, sessions: [], deferred: normalizedTopics, explanation: [], diagnostics: { candidateCount: normalizedTopics.length, minimumSessionMinutes: Number(settings.minimumSessionMinutes) || 20 } };
    }
    const counts = countsFromRecent(recentAllocations);
    const context = {
      ...counts,
      topicMinutes: counts.topicMinutes,
      subjectMinutes: counts.subjectMinutes,
      availableMinutes: available,
      candidateCount: normalizedTopics.length,
      settings,
    };
    const sessions = [];
    let remaining = available;
    const capacitySessionLimit = Math.ceil(available / Number(settings.minimumSessionMinutes));
    const maximumSessions = Math.max(1, Math.min(Number(settings.maximumSessions) || 12, capacitySessionLimit));
    while (remaining >= Number(settings.minimumSessionMinutes) && sessions.length < maximumSessions) {
      const candidates = normalizedTopics
        .map((topic) => ({ topic, utility: candidateUtility(topic, context) }))
        .filter((candidate) => candidate.utility.effectiveOpportunity >= Number(settings.minimumOpportunity || .06))
        .filter((candidate) => remaining >= candidate.topic.session.minimumDuration)
        .sort(compareCandidates);
      const selected = candidates[0];
      if (!selected) break;
      const durationMinutes = remaining >= selected.topic.session.idealDuration ? selected.topic.session.idealDuration : remaining;
      if (durationMinutes < selected.topic.session.minimumDuration) break;
      sessions.push({
        materia: selected.topic.materia,
        assunto: selected.topic.assunto,
        durationMinutes,
        sessionType: selected.topic.session.label,
        sessionKind: selected.topic.session.kind,
        learningState: selected.topic.learningState,
        strategicScore: selected.topic.strategicScore,
        effectiveOpportunity: selected.utility.effectiveOpportunity,
        repetitionIndex: selected.utility.repetitionIndex,
        marginalMultiplier: selected.utility.marginalMultiplier,
        subjectMultiplier: selected.utility.subjectMultiplier,
        concentrationMultiplier: selected.utility.concentrationMultiplier,
        idealDuration: selected.topic.session.idealDuration,
        minimumDuration: selected.topic.session.minimumDuration,
        rationale: rationaleFor(selected.topic, selected.utility, durationMinutes),
        rank: sessions.length + 1,
      });
      const topicKey = keyFor(selected.topic);
      const subjectKey = selected.topic.materia.toLocaleLowerCase();
      context.topicCounts.set(topicKey, (context.topicCounts.get(topicKey) || 0) + 1);
      context.subjectCounts.set(subjectKey, (context.subjectCounts.get(subjectKey) || 0) + 1);
      context.topicMinutes.set(topicKey, (context.topicMinutes.get(topicKey) || 0) + durationMinutes);
      remaining -= durationMinutes;
    }
    const allocatedMinutes = sessions.reduce((total, session) => total + session.durationMinutes, 0);
    const selectedKeys = new Set(sessions.map(keyFor));
    const deferred = normalizedTopics.filter((topic) => !selectedKeys.has(keyFor(topic))).map((topic) => ({ materia: topic.materia, assunto: topic.assunto, reason: "outras oportunidades tiveram melhor encaixe na capacidade atual" }));
    return {
      availableMinutes: available,
      allocatedMinutes,
      unusedMinutes: Math.max(0, available - allocatedMinutes),
      sessions,
      deferred,
      explanation: sessions.length ? ["A capacidade foi organizada em sessões pedagógicas úteis, priorizando a melhor oportunidade marginal a cada escolha."] : ["Não havia tempo ou candidato suficiente para formar uma sessão útil agora."],
      diagnostics: { candidateCount: normalizedTopics.length, maximumSessions, minimumSessionMinutes: Number(settings.minimumSessionMinutes) || 20 },
    };
  }

  const api = { allocate, candidateUtility };
  global.StrategicTimeAllocation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
