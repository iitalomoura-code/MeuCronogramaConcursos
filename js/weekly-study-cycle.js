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

  function blockKey(block = {}, index = 0) {
    return String(block.weeklyCycleBlockId || block.id || block.sessaoId || [block.materia, block.assunto || block.titulo, block.metaPartKey, block.bloco, index].join("::"));
  }

  function recordedMinutes(block = {}) {
    const explicitMinutes = block.studiedMinutes ?? block.tempoEstudadoMinutes ?? block.tempoEstudadoMinutos;
    if (explicitMinutes !== undefined) return Math.round(number(explicitMinutes));
    const value = block.tempoEstudado;
    if (typeof value === "string" && /(?:h|hora|min|:)/i.test(value)) {
      const clock = value.match(/^(\d{1,2})\s*:\s*(\d{2})$/);
      if (clock) return Math.round(Number(clock[1]) * 60 + Number(clock[2]));
      const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:h|hora|horas)\b/i);
      const minutes = value.match(/(\d+(?:\.\d+)?)\s*(?:min|minuto|minutos)\b/i);
      return Math.round((Number(hours?.[1]) || 0) * 60 + (Number(minutes?.[1]) || 0));
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    // O formato corrente guarda horas decimais; backups sem unidade podem ter
    // minutos inteiros. Esta regra e igual a da base de conhecimento legada.
    if (numeric <= 4) return Math.round(numeric * 60);
    if (Number.isInteger(numeric) && numeric >= 15 && numeric <= 240) return Math.round(numeric);
    return Math.round(numeric);
  }

  function executionBaseline(blocks = [], keyFor = blockKey) {
    return (Array.isArray(blocks) ? blocks : []).reduce((baseline, block, index) => {
      baseline[keyFor(block, index)] = recordedMinutes(block);
      return baseline;
    }, {});
  }

  function create({ weeklyHours = 0, capacity = {}, now = new Date(), sourceConfigurationSignature = "", blocks = [], blockKey: keyFor = blockKey } = {}) {
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
      executionBaselineByBlock: executionBaseline(blocks, keyFor),
    };
  }

  function executionMinutes(blocks = [], { baselineByBlock = {}, blockKey: keyFor = blockKey } = {}) {
    return (Array.isArray(blocks) ? blocks : []).reduce((total, block = {}, index) => {
      const baseline = number(baselineByBlock?.[keyFor(block, index)]);
      return total + Math.max(0, recordedMinutes(block) - baseline);
    }, 0);
  }

  function summarize(cycle = {}, blocks = [], options = {}) {
    const completedMinutes = executionMinutes(blocks, {
      ...options,
      baselineByBlock: cycle.executionBaselineByBlock || options.baselineByBlock || {},
    });
    const plannedMinutes = number(cycle.plannedMinutes);
    return {
      ...cycle,
      completedMinutes,
      remainingPlannedMinutes: Math.max(0, plannedMinutes - completedMinutes),
      progress: plannedMinutes ? Math.min(1, completedMinutes / plannedMinutes) : 0,
    };
  }

  function reconcileCapacity(cycle = {}, { weeklyHours = 0, capacity = {}, sourceConfigurationSignature = "" } = {}, blocks = [], options = {}) {
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
    }, blocks, options);
  }

  function shouldClose(cycle = {}, now = new Date()) {
    if (!cycle?.endsAt || cycle.status === "closed" || cycle.status === "completed") return false;
    const endsAt = new Date(cycle.endsAt).getTime();
    return Number.isFinite(endsAt) && new Date(now).getTime() >= endsAt;
  }

  function close(cycle = {}, blocks = [], now = new Date(), options = {}) {
    return { ...summarize(cycle, blocks, options), status: "closed", closedAt: iso(now) };
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

  const api = { DAY_MS, cycleWindow, configurationSignature, blockKey, recordedMinutes, executionBaseline, create, executionMinutes, summarize, reconcileCapacity, shouldClose, close, allocate };
  global.WeeklyStudyCycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
