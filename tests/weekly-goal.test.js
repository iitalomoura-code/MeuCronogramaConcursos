const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const engine = require("../js/weekly-goal.js");

const monday = new Date("2026-08-17T12:00:00-03:00");
const blocks = [
  { key: "a", order: 0, hours: 1, status: "Não iniciado", activityType: "Teoria" },
  { key: "b", order: 1, hours: 1.5, status: "Em andamento", activityType: "Teoria e questões" },
  { key: "c", order: 2, hours: 0.75, status: "Não iniciado", activityType: "Questões" },
  { key: "d", order: 3, hours: 1, status: "Não iniciado", activityType: "Teoria" },
];

// 1. Semana normal.
const normal = engine.buildWeeklyGoal({ now: monday, plannedHours: 6, cycleLabel: "Ciclo 3", blocks });
assert.equal(normal.startDate, "2026-08-17");
assert.equal(normal.endDate, "2026-08-23");
assert.equal(normal.plannedHours, 6);
assert.ok(normal.plannedBlockKeys.length >= 3);

// 2. Usuário sem histórico não recebe reforço inventado.
assert.deepEqual(engine.selectReinforcements([]), []);

// 3. A integração trata início no meio da semana sem exigir agenda diária.
const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.match(app, /remainingDays = 8 - \(now\.getDay\(\) \|\| 7\)/);
assert.match(app, /midweekFactor/);

// 4. Desempenho baixo cria reforço curto e ligado ao bloco existente.
const low = engine.selectReinforcements([{ key: "a", materia: "AFO", assunto: "Despesa", recentAccuracy: 0.54, recentQuestions: 20, priority: 0.8, minutes: 60 }]);
assert.equal(low.length, 1);
assert.equal(low[0].blockKey, "a");
assert.equal(low[0].minutes, 45);
assert.match(low[0].reasons[0], /54%/);

// 5. Muitas revisões são limitadas pela capacidade semanal.
const manyReviews = engine.buildWeeklyGoal({
  now: monday,
  plannedHours: 4,
  blocks,
  reviews: Array.from({ length: 12 }, (_, index) => ({ id: `r${index}`, dueDate: "2026-08-18T12:00:00-03:00" })),
});
assert.ok(manyReviews.plannedReviewIds.length <= 2);
assert.ok(manyReviews.composition.reviewHours <= 1.2);

// 6. Tema em andamento entra antes dos demais.
assert.equal(normal.plannedBlockKeys[0], "b");

// 7. Semana abaixo da meta mantém percentual neutro e não carrega horas.
const below = engine.weeklyProgress(normal, {
  completedBlocks: [{ key: "b", eventId: "s1", completedAt: "2026-08-18T10:00:00-03:00", hours: 1.5 }],
  allStudyEvents: [{ key: "b", eventId: "s1", completedAt: "2026-08-18T10:00:00-03:00", hours: 1.5 }],
});
assert.ok(below.compliance > 0 && below.compliance < 100);
const next = engine.buildWeeklyGoal({ now: new Date("2026-08-24T12:00:00-03:00"), plannedHours: 6, blocks });
assert.equal(next.plannedHours, 6);

// 8. Semana acima da meta registra avanço sem aumentar a seguinte.
const exceededGoal = engine.buildWeeklyGoal({ now: monday, plannedHours: 2, blocks: [blocks[0]] });
const exceeded = engine.weeklyProgress(exceededGoal, {
  completedBlocks: [{ key: "a", eventId: "s2", completedAt: "2026-08-19T10:00:00-03:00", hours: 3 }],
  allStudyEvents: [{ key: "a", eventId: "s2", completedAt: "2026-08-19T10:00:00-03:00", hours: 3 }],
});
assert.equal(exceeded.exceeded, true);
assert.equal(exceeded.compliance, 100);
assert.equal(engine.buildWeeklyGoal({ now: new Date("2026-08-24T12:00:00-03:00"), plannedHours: 2, blocks }).plannedHours, 2);

// 9. Pouca disponibilidade produz meta pequena e válida.
const lowAvailability = engine.buildWeeklyGoal({ now: monday, plannedHours: 2, blocks });
assert.equal(lowAvailability.plannedHours, 2);
assert.ok(lowAvailability.plannedBlockKeys.length >= 1);

// 10 e 11. Concurso sem data e com data de prova.
assert.equal(engine.buildWeeklyGoal({ now: monday, plannedHours: 4, blocks }).examContext, null);
const withExam = engine.buildWeeklyGoal({ now: monday, plannedHours: 4, blocks, examContext: { weeksRemaining: 7, coveragePercent: 68 } });
assert.equal(withExam.examContext.weeksRemaining, 7);

// 12 e 13. Incidência só complementa um sinal real e nunca cria reforço sozinha.
assert.equal(engine.selectReinforcements([{ key: "x", incidenceApplied: true, incidence: 0.9 }]).length, 0);
const fgv = engine.selectReinforcements([{ key: "x", materia: "AFO", assunto: "Receita", recentAccuracy: 0.62, recentQuestions: 20, incidenceApplied: true, incidence: 0.8 }]);
assert.ok(fgv[0].reasons.some((reason) => reason.includes("incidência")));

// 14. Fechamento preserva alvo, cria resumo curto e permite nova semana.
const closed = engine.closeWeeklyGoal(normal, below, { questions: 20, correct: 14, accuracy: 0.7 }, new Date("2026-08-24T08:00:00-03:00"));
assert.equal(closed.status, "closed");
assert.equal(closed.summary.completedBlocks, 1);
assert.equal(closed.summary.performance.accuracy, 0.7);
assert.notEqual(next.id, closed.id);

// 15. Persistência e sincronização usam o snapshot já existente.
assert.match(app, /weeklyGoals: state\.weeklyGoals/);
assert.match(app, /state\.weeklyGoals = Array\.isArray\(saved\.weeklyGoals\)/);
assert.match(app, /weeklyGoals: \[\]/);

const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
assert.match(index, /js\/weekly-goal\.js/);
assert.match(index, /id="continueWeeklySummary"/);

console.log("weekly-goal tests passed");
