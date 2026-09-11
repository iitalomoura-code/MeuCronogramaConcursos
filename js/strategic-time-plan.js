"use strict";

(function initStrategicTimePlan(global) {
  function localDayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function validExecutionDate(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const brazilian = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const date = brazilian
      ? new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]), 12)
      : new Date(value);
    return Number.isNaN(date.getTime()) || date.getTime() < new Date(2000, 0, 1).getTime() ? null : date;
  }

  function canonicalExecutionCompletedAt(block = {}) {
    const status = String(block.status || "").toLocaleLowerCase();
    if (!status.includes("conclu")) return "";
    const candidates = [
      block.completedAt,
      block.concluidoEm,
      block.sessionCompletedAt,
      (block.sessaoId || block.lastSavedSessionId) ? block.savedAt : null,
    ];
    for (const value of candidates) {
      const date = validExecutionDate(value);
      if (date) return date.toISOString();
    }
    return "";
  }

  function completedAllocationsForToday(events = [], now = new Date()) {
    const today = localDayKey(now);
    const seen = new Set();
    return (Array.isArray(events) ? events : []).reduce((allocations, event = {}) => {
      if (event.status !== "Concluído" || localDayKey(event.executionCompletedAt || event.actualCompletedAt) !== today) return allocations;
      const materia = String(event.materia || "").trim();
      const assunto = String(event.assunto || "").trim();
      if (!materia || !assunto) return allocations;
      const identity = String(event.eventId || `${materia}::${assunto}::${event.completedAt}`);
      if (seen.has(identity)) return allocations;
      seen.add(identity);
      allocations.push({
        materia,
        assunto,
        // A ausência de duração em registros antigos preserva a repetição, sem inventar minutos.
        durationMinutes: Math.max(0, Number(event.durationMinutes) || 0),
      });
      return allocations;
    }, []);
  }

  function build({ availableMinutes = 0, topics = [], recentAllocations = [], allocator = global.StrategicTimeAllocation } = {}) {
    if (!allocator?.allocate) return null;
    return allocator.allocate({ availableMinutes, topics, recentAllocations });
  }

  const api = { localDayKey, canonicalExecutionCompletedAt, completedAllocationsForToday, build };
  global.StrategicTimePlan = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
