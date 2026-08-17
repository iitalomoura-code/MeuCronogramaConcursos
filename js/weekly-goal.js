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
        activityType: "Questões",
        reasons: candidate.reasons,
      }));
  }

  function buildWeeklyGoal({ now = new Date(), plannedHours = 0, cycleLabel = "", blocks = [], reviews = [], reinforcementCandidates = [], examContext = null } = {}) {
    const bounds = weekBounds(now);
    const targetHours = Math.max(0, Number(plannedHours) || 0);
    const reinforcements = selectReinforcements(reinforcementCandidates, 2);
    const reinforcementKeys = new Set(reinforcements.map((item) => item.blockKey));
    const availableReviews = uniqueBy(reviews, (item) => item.id)
      .filter((item) => {
        const due = asDate(item.dueDate);
        return !due || due <= bounds.end;
      });
    const maxReviewHours = targetHours ? targetHours * 0.3 : 0;
    const plannedReviews = availableReviews.slice(0, Math.max(0, Math.floor(maxReviewHours / 0.5)) || (availableReviews.length && targetHours >= 1 ? 1 : 0));
    const reviewHours = Math.min(maxReviewHours, plannedReviews.length * 0.5);
    const orderedBlocks = uniqueBy(blocks, (item) => item.key)
      .filter((item) => item.key && item.status !== "Concluído")
      .sort((a, b) => Number(b.status === "Em andamento") - Number(a.status === "Em andamento") || Number(a.order || 0) - Number(b.order || 0));
    const capacity = Math.max(0, targetHours - reviewHours);
    const selected = [];
    let selectedHours = 0;
    const preferred = [
      ...orderedBlocks.filter((item) => item.status === "Em andamento"),
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

  function closeWeeklyGoal(goal = {}, progress = {}, performance = null, now = new Date()) {
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
    };
  }

  const api = { weekBounds, withinWeek, selectReinforcements, buildWeeklyGoal, weeklyProgress, closeWeeklyGoal };
  global.WeeklyGoalEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
