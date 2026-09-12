"use strict";

(function initWeeklyStudyCycle(global) {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function number(value) {
    return Math.max(0, Number(value) || 0);
  }

  function iso(value) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function startOfLocalDay(value = new Date()) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function cycleWindow(now = new Date()) {
    const started = startOfLocalDay(now);
    const ends = new Date(started.getTime() + 7 * DAY_MS);
    return { startedAt: started.toISOString(), endsAt: ends.toISOString() };
  }

  function configurationSignature({ weeklyHours = 0, safetyMargin = .92, source = "weekly-hours" } = {}) {
    return JSON.stringify({ weeklyHours: number(weeklyHours), safetyMargin: Number(safetyMargin) || .92, source });
  }

  function create({ weeklyHours = 0, capacity = {}, now = new Date(), sourceConfigurationSignature = "" } = {}) {
    const window = cycleWindow(now);
    const weeklyCapacityMinutes = Math.round(number(capacity.availableHours ?? weeklyHours) * 60);
    const plannedMinutes = Math.min(weeklyCapacityMinutes, Math.round(number(capacity.plannedMinutes ?? weeklyCapacityMinutes)));
    const reserveMinutes = Math.max(0, weeklyCapacityMinutes - plannedMinutes);
    return {
      id: `weekly-cycle:${window.startedAt.slice(0, 10)}:${sourceConfigurationSignature || configurationSignature({ weeklyHours, safetyMargin: capacity.safetyMargin })}`,
      startedAt: window.startedAt,
      endsAt: window.endsAt,
      weeklyCapacityMinutes,
      plannedMinutes,
      reserveMinutes,
      completedMinutes: 0,
      status: "active",
      generatedAt: iso(now),
      sourceConfigurationSignature: sourceConfigurationSignature || configurationSignature({ weeklyHours, safetyMargin: capacity.safetyMargin }),
    };
  }

  function executionMinutes(blocks = []) {
    return (Array.isArray(blocks) ? blocks : []).reduce((total, block = {}) => total + number(block.tempoEstudado) * 60, 0);
  }

  function summarize(cycle = {}, blocks = []) {
    const completedMinutes = executionMinutes(blocks);
    const plannedMinutes = number(cycle.plannedMinutes);
    return {
      ...cycle,
      completedMinutes,
      remainingPlannedMinutes: Math.max(0, plannedMinutes - completedMinutes),
      progress: plannedMinutes ? Math.min(1, completedMinutes / plannedMinutes) : 0,
    };
  }

  function reconcileCapacity(cycle = {}, { weeklyHours = 0, capacity = {}, sourceConfigurationSignature = "" } = {}, blocks = []) {
    const weeklyCapacityMinutes = Math.round(number(capacity.availableHours ?? weeklyHours) * 60);
    const plannedMinutes = Math.min(weeklyCapacityMinutes, Math.round(number(capacity.plannedMinutes ?? weeklyCapacityMinutes)));
    const reserveMinutes = Math.max(0, weeklyCapacityMinutes - plannedMinutes);
    return summarize({
      ...cycle,
      weeklyCapacityMinutes,
      plannedMinutes,
      reserveMinutes,
      sourceConfigurationSignature: sourceConfigurationSignature || cycle.sourceConfigurationSignature,
      status: cycle.status === "closed" ? "closed" : "active",
    }, blocks);
  }

  function shouldClose(cycle = {}, now = new Date()) {
    if (!cycle?.endsAt || cycle.status === "closed" || cycle.status === "completed") return false;
    const endsAt = new Date(cycle.endsAt).getTime();
    return Number.isFinite(endsAt) && new Date(now).getTime() >= endsAt;
  }

  function close(cycle = {}, blocks = [], now = new Date()) {
    return { ...summarize(cycle, blocks), status: "closed", closedAt: iso(now) };
  }

  // Allocation remains an adapter over the existing strategic allocator: it does
  // not introduce a second priority score or persist any execution evidence.
  function allocate({ cycle = {}, topics = [], recentAllocations = [], allocator = global.StrategicTimeAllocation } = {}) {
    if (!allocator?.allocate) return null;
    const summary = summarize(cycle);
    return allocator.allocate({
      availableMinutes: summary.remainingPlannedMinutes,
      topics,
      recentAllocations,
    });
  }

  const api = { DAY_MS, cycleWindow, configurationSignature, create, executionMinutes, summarize, reconcileCapacity, shouldClose, close, allocate };
  global.WeeklyStudyCycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
