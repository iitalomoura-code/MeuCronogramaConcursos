"use strict";

(function initStrategicPriorityConfig(global) {
  const config = Object.freeze({
    weights: Object.freeze({
      importance: .14,
      difficulty: .07,
      masteryNeed: .18,
      recentPerformance: .15,
      historicalPerformance: .05,
      trend: .09,
      recurringErrors: .10,
      recency: .07,
      coverage: .10,
      examUrgency: .03,
      incidence: .02,
    }),
    confidence: Object.freeze({
      maintenance: .55,
      recovery: .48,
      evidenceFloor: .42,
    }),
    thresholds: Object.freeze({
      strongReference: .85,
      recoveryHistoricalAccuracy: .80,
      recoveryDrop: .12,
      recentContactDays: 5,
      buildingContactDays: 12,
      maintenancePenalty: .34,
      strongPenalty: .08,
    }),
    bands: Object.freeze([
      ["very-high", .68],
      ["high", .43],
      ["medium", .25],
      ["low", .12],
      ["very-low", 0],
    ]),
    sessions: Object.freeze({
      diagnostic: Object.freeze({ kind: "theory_questions", label: "Teoria e questões", minutes: 30, questions: 10 }),
      building: Object.freeze({ kind: "theory_questions", label: "Teoria direcionada e questões", minutes: 45, questions: 12 }),
      consolidating: Object.freeze({ kind: "review_questions", label: "Revisão direcionada e questões", minutes: 30, questions: 12 }),
      practice: Object.freeze({ kind: "questions", label: "Questões e análise de erros", minutes: 30, questions: 15 }),
      maintenance: Object.freeze({ kind: "maintenance", label: "Manutenção com questões", minutes: 30, questions: 10 }),
      recovery: Object.freeze({ kind: "review_questions", label: "Revisão e questões", minutes: 45, questions: 15 }),
    }),
  });

  global.StrategicPriorityConfig = config;
  if (typeof module !== "undefined" && module.exports) module.exports = config;
})(typeof window !== "undefined" ? window : globalThis);
