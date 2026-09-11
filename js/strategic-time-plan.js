"use strict";

(function initStrategicTimePlan(global) {
  function localDayKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function completedAllocationsForToday(events = [], now = new Date()) {
    const today = localDayKey(now);
    const seen = new Set();
    return (Array.isArray(events) ? events : []).reduce((allocations, event = {}) => {
      if (event.status !== "Concluído" || localDayKey(event.completedAt) !== today) return allocations;
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

  const api = { localDayKey, completedAllocationsForToday, build };
  global.StrategicTimePlan = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
