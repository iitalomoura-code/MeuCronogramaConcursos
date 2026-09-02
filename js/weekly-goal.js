(function (global) {
  "use strict";

  function asDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (!value) return null;
    const localDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (localDate) return new Date(Number(localDate[1]), Number(localDate[2]) - 1, Number(localDate[3]));
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function dateKey(value) {
    const date = asDate(value) || new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function weekBounds(value = new Date()) {
    const current = asDate(value) || new Date();
    current.setHours(0, 0, 0, 0);
    const weekday = current.getDay() || 7;
    const start = new Date(current);
    start.setDate(current.getDate() - weekday + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end, startDate: dateKey(start), endDate: dateKey(end), key: `week:${dateKey(start)}` };
  }

  function withinWeek(value, bounds) {
    const date = asDate(value);
    return Boolean(date && date >= bounds.start && date <= bounds.end);
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function uniqueBy(items, keyFor) {
    const seen = new Set();
    return (items || []).filter((item) => {
      const key = keyFor(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function reinforcementReasons(candidate = {}) {
    const reasons = [];
    const accuracy = Number.isFinite(candidate.recentAccuracy) ? Number(candidate.recentAccuracy) : null;
    const questions = Number(candidate.recentQuestions) || 0;
    if (questions >= 10 && accuracy !== null && accuracy < 0.6) reasons.push(`último desempenho: ${Math.round(accuracy * 100)}%`);
    else if (questions >= 10 && accuracy !== null && accuracy < 0.75) reasons.push(`desempenho recente: ${Math.round(accuracy * 100)}%`);
    if (candidate.performanceDrop) reasons.push("queda relevante no desempenho recente");
    if (Number(candidate.lowResultCount) >= 2) reasons.push("erros repetidos em tentativas recentes");
    if (candidate.highDifficulty && (accuracy === null || accuracy < 0.75)) reasons.push("dificuldade pessoal alta");
    if (Number(candidate.daysWithoutContact) >= 14 && Number(candidate.priority) >= 0.6) reasons.push(`${candidate.daysWithoutContact} dias sem contato`);
    if (reasons.length && candidate.incidenceApplied && Number(candidate.incidence) >= 0.5) reasons.push("incidência histórica relevante na banca");
    (candidate.adaptiveReasons || []).forEach((reason) => reasons.push(reason));
    return [...new Set(reasons)].slice(0, 3);
  }

  function selectReinforcements(candidates = [], maxItems = 2) {
    return candidates
      .map((candidate) => {
        const reasons = reinforcementReasons(candidate);
        let score = 0;
        const accuracy = Number.isFinite(candidate.recentAccuracy) ? Number(candidate.recentAccuracy) : null;
        if (Number(candidate.recentQuestions) >= 10 && accuracy !== null) score += accuracy < 0.6 ? 80 : accuracy < 0.75 ? 48 : 0;
        if (candidate.performanceDrop) score += 42;
        if (Number(candidate.lowResultCount) >= 2) score += 34;
        if (candidate.highDifficulty && (accuracy === null || accuracy < 0.75)) score += 24;
        if (Number(candidate.daysWithoutContact) >= 14 && Number(candidate.priority) >= 0.6) score += Math.min(24, 10 + Math.floor((candidate.daysWithoutContact - 14) / 4) * 2);
        if (candidate.incidenceApplied && Number(candidate.incidence) >= 0.5 && reasons.length) score += 10;
        score += Number(candidate.adaptiveScore) || 0;
        return { ...candidate, reasons, score };
      })
      .filter((candidate) => candidate.key && candidate.reasons.length && candidate.score > 0)
      .sort((a, b) => b.score - a.score || Number(b.priority || 0) - Number(a.priority || 0))
      .filter((candidate, index, list) => list.findIndex((item) => item.key === candidate.key) === index)
      .slice(0, Math.max(0, Number(maxItems) || 0))
      .map((candidate) => ({
        id: `reinforcement:${candidate.key}`,
        blockKey: candidate.key,
        materia: candidate.materia,
        assunto: candidate.assunto,
        minutes: Math.min(45, Math.max(30, Number(candidate.minutes) || 30)),
        activityType: candidate.adaptiveType === "diagnostic" ? "Questões diagnósticas" : "Questões",
        kind: candidate.adaptiveType || "reinforcement",
        reasons: candidate.reasons,
      }));
  }

  function subjectPerformanceComparisons(current = null, previous = null, minQuestions = 10) {
    const previousBySubject = new Map((previous?.subjects || []).map((item) => [String(item.materia || "").toLowerCase(), item]));
    return (current?.subjects || [])
      .map((item) => {
        const prior = previousBySubject.get(String(item.materia || "").toLowerCase());
        if (!prior || Number(item.questions) < minQuestions || Number(prior.questions) < minQuestions) return null;
        const currentAccuracy = Number(item.accuracy);
        const previousAccuracy = Number(prior.accuracy);
        if (!Number.isFinite(currentAccuracy) || !Number.isFinite(previousAccuracy)) return null;
        return {
          materia: item.materia,
          currentAccuracy,
          previousAccuracy,
          deltaPoints: Math.round((currentAccuracy - previousAccuracy) * 100),
          currentQuestions: Number(item.questions) || 0,
          previousQuestions: Number(prior.questions) || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => Math.abs(b.deltaPoints) - Math.abs(a.deltaPoints));
  }

  function buildWeeklyClosure({ goal = {}, progress = {}, performance = null, previousPerformance = null, coverage = null, pending = null, contactGaps = [], interventions = [], errorInsights = [], examContext = null } = {}) {
    const comparisons = subjectPerformanceComparisons(performance, previousPerformance);
    const safeCoverage = {
      totalTopics: Number(coverage?.totalTopics) || 0,
      beforeContact: Number(coverage?.beforeContact) || 0,
      afterContact: Number(coverage?.afterContact) || 0,
      beforePercent: Number(coverage?.beforePercent) || 0,
      afterPercent: Number(coverage?.afterPercent) || 0,
      newTopics: Number(coverage?.newTopics) || 0,
      completedTopics: Number(coverage?.completedTopics) || 0,
      inProgressTopics: Number(coverage?.inProgressTopics) || 0,
    };
    const safePending = {
      ongoing: Array.isArray(pending?.ongoing) ? pending.ongoing : [],
      reprogrammed: Array.isArray(pending?.reprogrammed) ? pending.reprogrammed : [],
      relevantReviews: Array.isArray(pending?.relevantReviews) ? pending.relevantReviews : [],
      reinforcements: Array.isArray(pending?.reinforcements) ? pending.reinforcements : [],
    };
    const highlights = [];
    const addHighlight = (item) => {
      if (!item?.title || !item?.detail || highlights.length >= 4) return;
      const fingerprint = `${item.type || ""}:${item.materia || ""}:${item.title}`;
      if (!highlights.some((entry) => entry.fingerprint === fingerprint)) highlights.push({ ...item, fingerprint });
    };

    comparisons.filter((item) => Math.abs(item.deltaPoints) >= 5).slice(0, 2).forEach((item) => {
      addHighlight({
        type: item.deltaPoints > 0 ? "progress" : "attention",
        materia: item.materia,
        title: item.deltaPoints > 0 ? "Você avançou" : "Ponto de atenção",
        detail: `${item.materia} passou de ${Math.round(item.previousAccuracy * 100)}% para ${Math.round(item.currentAccuracy * 100)}% (${item.deltaPoints > 0 ? "+" : ""}${item.deltaPoints} p.p.).`,
      });
    });
    (performance?.subjects || [])
      .filter((item) => Number(item.questions) >= 10 && Number(item.accuracy) < 0.7)
      .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))
      .slice(0, 2)
      .forEach((item) => addHighlight({ type: "attention", materia: item.materia, title: "Ponto de atenção", detail: `${item.materia} ficou com ${Math.round(Number(item.accuracy) * 100)}% de acertos em ${item.questions} questões.` }));
    if (safeCoverage.newTopics > 0) {
      addHighlight({ type: "coverage", title: "Cobertura", detail: `${safeCoverage.newTopics} ${safeCoverage.newTopics === 1 ? "novo tema recebeu" : "novos temas receberam"} primeiro contato.` });
    }
    const gap = [...contactGaps].filter((item) => Number(item.days) >= 7).sort((a, b) => Number(b.days) - Number(a.days))[0];
    if (gap) addHighlight({ type: "contact", materia: gap.materia, title: "Tempo sem contato", detail: `${gap.materia} está há ${gap.days} dias sem estudo registrado.` });
    (interventions || []).slice(0, 2).forEach((item) => {
      if (!item?.materia || !item?.detail) return;
      const title = item.result === "resolved" ? "Recuperação confirmada" : item.result === "improved" || item.result === "improving-signal" ? "Tema em melhora" : "Reforço precisa evoluir";
      addHighlight({ type: item.result === "resolved" || item.result === "improved" ? "progress" : "attention", materia: item.materia, title, detail: `${item.assunto || item.materia}: ${item.detail}` });
    });
    (errorInsights || []).slice(0, 1).forEach((item) => {
      if (!item?.materia || !item?.assunto) return;
      const detail = item.postInterventionErrors >= 2
        ? `${item.assunto} continuou apresentando erros após o reforço.`
        : item.trend === "improving"
          ? `${item.assunto} deixou de concentrar os erros recentes de ${item.materia}.`
          : `${item.assunto} concentra erros recorrentes em ${item.materia}.`;
      addHighlight({ type: item.trend === "improving" ? "progress" : "attention", materia: item.materia, title: item.trend === "improving" ? "Erros em redução" : "Foco de erros", detail });
    });

    const adjustments = [];
    const addAdjustment = (item) => {
      if (!item?.reason) return;
      const key = `${item.type || ""}:${item.blockKey || ""}:${item.materia || ""}`;
      if (!adjustments.some((entry) => entry.key === key)) adjustments.push({ ...item, key });
    };
    safePending.ongoing.slice(0, 3).forEach((item) => addAdjustment({ type: "continue", blockKey: item.blockKey, materia: item.materia, assunto: item.assunto, weight: 110, reason: `concluir o tema em andamento de ${item.materia}` }));
    safePending.reprogrammed.slice(0, 3).forEach((item) => addAdjustment({ type: "redistribute", blockKey: item.blockKey, materia: item.materia, assunto: item.assunto, weight: 70, reason: `redistribuir ${item.assunto || item.materia} sem perder o progresso` }));
    (performance?.subjects || []).filter((item) => Number(item.questions) >= 10 && Number(item.accuracy) < 0.7).slice(0, 2).forEach((item) => addAdjustment({ type: "reinforce", materia: item.materia, weight: 65, reason: `aumentar contato com ${item.materia}` }));
    comparisons.filter((item) => item.deltaPoints >= 8 && item.currentAccuracy >= 0.75).slice(0, 1).forEach((item) => addAdjustment({ type: "maintain", materia: item.materia, weight: 20, reason: `manter a frequência de ${item.materia} após a evolução observada` }));
    if (gap) addAdjustment({ type: "return", materia: gap.materia, weight: 55, reason: `retomar ${gap.materia}` });
    if (safePending.relevantReviews.length) addAdjustment({ type: "reviews", weight: 60, reason: `reservar espaço para ${safePending.relevantReviews.length} ${safePending.relevantReviews.length === 1 ? "revisão relevante" : "revisões relevantes"}` });

    const noActivity = (Number(progress.realizedHours) || 0) <= 0 && (Number(progress.completedBlocks) || 0) <= 0 && (Number(progress.completedReviews) || 0) <= 0;
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      noActivity,
      headline: noActivity ? "Não houve atividades registradas nesta semana." : `${Number(progress.compliance) || 0}% da meta cumprida`,
      highlights: highlights.slice(0, 4).map(({ fingerprint, ...item }) => item),
      comparisons,
      coverage: safeCoverage,
      pending: safePending,
      adjustments: adjustments.slice(0, 6).map(({ key, ...item }) => item),
      examContext: examContext || goal.examContext || null,
    };
  }

  function buildWeeklyGoal({ now = new Date(), plannedHours = 0, cycleLabel = "", blocks = [], reviews = [], reinforcementCandidates = [], examContext = null, adjustments = [], sourceWeekId = "" } = {}) {
    const bounds = weekBounds(now);
    const targetHours = Math.max(0, Number(plannedHours) || 0);
    const reinforcements = selectReinforcements(reinforcementCandidates, 3);
    const reinforcementKeys = new Set(reinforcements.map((item) => item.blockKey));
    const availableReviews = uniqueBy(reviews, (item) => item.id)
      .filter((item) => {
        const due = asDate(item.dueDate);
        return !due || due <= bounds.end;
      });
    const configuredPhase = String(examContext?.examPhase || "");
    const isPostNotice = configuredPhase === "POST_NOTICE";
    const urgency = isPostNotice && examContext?.urgency?.available ? clamp(examContext.urgency.value) : 0;
    const reviewShare = isPostNotice ? 0.3 + (urgency * 0.1) : configuredPhase === "PRE_NOTICE" ? 0.25 : 0.3;
    const maxReviewHours = targetHours ? targetHours * reviewShare : 0;
    const plannedReviews = availableReviews.slice(0, Math.max(0, Math.floor(maxReviewHours / 0.5)) || (availableReviews.length && targetHours >= 1 ? 1 : 0));
    const reviewHours = Math.min(maxReviewHours, plannedReviews.length * 0.5);
    const adjustmentWeight = (item) => (adjustments || []).reduce((sum, adjustment) => {
      if (adjustment.blockKey && adjustment.blockKey === item.key) return sum + (Number(adjustment.weight) || 0);
      if (!adjustment.blockKey && adjustment.materia && String(adjustment.materia).toLowerCase() === String(item.materia || "").toLowerCase()) return sum + (Number(adjustment.weight) || 0);
      return sum;
    }, 0);
    const orderedBlocks = uniqueBy(blocks, (item) => item.key)
      .filter((item) => item.key && item.status !== "Concluído")
      .sort((a, b) => Number(b.status === "Em andamento") - Number(a.status === "Em andamento") || adjustmentWeight(b) - adjustmentWeight(a) || Number(a.order || 0) - Number(b.order || 0));
    const capacity = Math.max(0, targetHours - reviewHours);
    const selected = [];
    let selectedHours = 0;
    const preferred = [
      ...orderedBlocks.filter((item) => item.status === "Em andamento"),
      ...orderedBlocks.filter((item) => adjustmentWeight(item) > 0),
      ...orderedBlocks.filter((item) => reinforcementKeys.has(item.key)),
      ...orderedBlocks,
    ];
    uniqueBy(preferred, (item) => item.key).forEach((item) => {
      if (capacity <= 0) return;
      const hours = Math.max(0.25, Number(item.hours) || 0.5);
      if (selectedHours + hours > capacity + 0.001) return;
      if (selectedHours < capacity) {
        selected.push(item);
        selectedHours += hours;
      }
    });
    const selectedKeys = new Set(selected.map((item) => item.key));
    const selectedReinforcements = reinforcements.filter((item) => selectedKeys.has(item.blockKey));

    const composition = { studyHours: 0, questionsHours: 0, reviewHours, reinforcementHours: 0, ongoingHours: 0 };
    selected.forEach((item) => {
      const hours = Math.max(0.25, Number(item.hours) || 0.5);
      if (reinforcementKeys.has(item.key)) composition.reinforcementHours += hours;
      else if (item.status === "Em andamento") composition.ongoingHours += hours;
      else if (String(item.activityType || "").toLowerCase().includes("quest")) composition.questionsHours += hours;
      else composition.studyHours += hours;
    });

    return {
      id: bounds.key,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      status: "active",
      cycleLabel,
      plannedHours: targetHours,
      plannedBlockKeys: selected.map((item) => item.key),
      plannedReviewIds: plannedReviews.map((item) => item.id),
      composition,
      reinforcements: selectedReinforcements,
      adaptiveMessage: selectedReinforcements.length
        ? `${selectedReinforcements.length} ${selectedReinforcements.length === 1 ? "ponto recebeu" : "pontos receberam"} reforço orientado pelo diagnóstico, sem substituir a sequência principal do ciclo.`
        : "",
      adjustments: Array.isArray(adjustments) ? adjustments : [],
      sourceWeekId: sourceWeekId || "",
      examContext: examContext || null,
      createdAt: new Date(now).toISOString(),
    };
  }

  function weeklyProgress(goal = {}, { completedBlocks = [], completedReviews = [], allStudyEvents = [], now = new Date() } = {}) {
    const bounds = weekBounds(goal.startDate || now);
    const plannedBlockKeys = new Set(goal.plannedBlockKeys || []);
    const plannedReviewIds = new Set(goal.plannedReviewIds || []);
    const blockEvents = uniqueBy(completedBlocks, (item) => item.eventId || `${item.key}:${item.completedAt || ""}`)
      .filter((item) => withinWeek(item.completedAt, bounds));
    const plannedCompleted = new Set(blockEvents.filter((item) => plannedBlockKeys.has(item.key)).map((item) => item.key));
    const reviewEvents = uniqueBy(completedReviews, (item) => item.eventId || `${item.id}:${item.completedAt || ""}`)
      .filter((item) => withinWeek(item.completedAt, bounds));
    const plannedReviewsCompleted = new Set(reviewEvents.filter((item) => plannedReviewIds.has(item.id)).map((item) => item.id));
    const studyEvents = uniqueBy(allStudyEvents, (item) => item.eventId || `${item.key}:${item.completedAt || ""}`)
      .filter((item) => withinWeek(item.completedAt, bounds));
    const realizedHours = studyEvents.reduce((sum, item) => sum + Math.max(0, Number(item.hours) || 0), 0);
    const completedReinforcements = (goal.reinforcements || []).filter((item) => plannedCompleted.has(item.blockKey)).length;
    const hourRatio = goal.plannedHours > 0 ? realizedHours / goal.plannedHours : 0;
    const blockRatio = plannedBlockKeys.size ? plannedCompleted.size / plannedBlockKeys.size : hourRatio;
    const reviewRatio = plannedReviewIds.size ? plannedReviewsCompleted.size / plannedReviewIds.size : hourRatio;
    const compliance = Math.round((clamp(hourRatio) * 0.6 + clamp(blockRatio) * 0.25 + clamp(reviewRatio) * 0.15) * 100);
    return {
      realizedHours,
      completedBlocks: plannedCompleted.size,
      plannedBlocks: plannedBlockKeys.size,
      completedReviews: plannedReviewsCompleted.size,
      plannedReviews: plannedReviewIds.size,
      completedReinforcements,
      plannedReinforcements: (goal.reinforcements || []).length,
      compliance,
      exceeded: realizedHours > Number(goal.plannedHours || 0),
    };
  }

  function closeWeeklyGoal(goal = {}, progress = {}, performance = null, now = new Date(), closure = null) {
    return {
      ...goal,
      status: "closed",
      closedAt: new Date(now).toISOString(),
      summary: {
        realizedHours: Number(progress.realizedHours) || 0,
        completedBlocks: Number(progress.completedBlocks) || 0,
        completedReviews: Number(progress.completedReviews) || 0,
        completedReinforcements: Number(progress.completedReinforcements) || 0,
        compliance: Number(progress.compliance) || 0,
        performance: performance || null,
      },
      closure: closure || goal.closure || null,
    };
  }

  const api = { weekBounds, withinWeek, selectReinforcements, subjectPerformanceComparisons, buildWeeklyClosure, buildWeeklyGoal, weeklyProgress, closeWeeklyGoal };
  global.WeeklyGoalEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
