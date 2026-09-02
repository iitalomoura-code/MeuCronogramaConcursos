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

// 4b. A meta semanal consome o diagnóstico central, sem criar outro threshold paralelo.
const central = engine.selectReinforcements([
  { key: "critical", materia: "AFO", assunto: "Despesa", minutes: 45, priority: 0.7, adaptiveScore: 120, adaptiveReasons: ["tema crítico segundo o diagnóstico"] },
  { key: "diagnostic", materia: "Português", assunto: "Pontuação", minutes: 30, priority: 0.6, adaptiveScore: 16, adaptiveType: "diagnostic", adaptiveReasons: ["sessão diagnóstica necessária"] },
]);
assert.equal(central[0].blockKey, "critical");
assert.equal(central[1].activityType, "Questões diagnósticas");
assert.match(central[0].reasons.join(" "), /tema crítico/);

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

// 16. Semana 100% concluída gera fechamento objetivo.
const completeProgress = engine.weeklyProgress(normal, {
  completedBlocks: normal.plannedBlockKeys.map((key, index) => ({ key, eventId: `complete-${index}`, completedAt: "2026-08-20T10:00:00-03:00", hours: 2 })),
  allStudyEvents: normal.plannedBlockKeys.map((key, index) => ({ key, eventId: `complete-${index}`, completedAt: "2026-08-20T10:00:00-03:00", hours: 2 })),
});
assert.equal(completeProgress.compliance, 100);

// 17. Melhoras e quedas usam pontos percentuais e exigem amostra mínima.
const performance = {
  questions: 40,
  accuracy: 0.745,
  subjects: [
    { materia: "Português", questions: 20, accuracy: 0.81 },
    { materia: "RLM", questions: 20, accuracy: 0.68 },
    { materia: "AFO", questions: 4, accuracy: 0.25 },
  ],
};
const previousPerformance = {
  questions: 40,
  accuracy: 0.73,
  subjects: [
    { materia: "Português", questions: 20, accuracy: 0.74 },
    { materia: "RLM", questions: 20, accuracy: 0.72 },
    { materia: "AFO", questions: 30, accuracy: 0.8 },
  ],
};
const comparisons = engine.subjectPerformanceComparisons(performance, previousPerformance);
assert.equal(comparisons.find((item) => item.materia === "Português").deltaPoints, 7);
assert.equal(comparisons.find((item) => item.materia === "RLM").deltaPoints, -4);
assert.equal(comparisons.some((item) => item.materia === "AFO"), false);

// 18. O fechamento reúne cobertura, pendências, reforços e ajuste para a semana seguinte.
const closure = engine.buildWeeklyClosure({
  goal: normal,
  progress: below,
  performance,
  previousPerformance,
  previousProgress: { realizedHours: 4 },
  coverage: { totalTopics: 20, beforeContact: 10, afterContact: 13, beforePercent: 50, afterPercent: 65, newTopics: 3, completedTopics: 2, inProgressTopics: 1 },
  pending: {
    ongoing: [{ blockKey: "b", materia: "Administração Pública", assunto: "Planejamento" }],
    reprogrammed: [{ blockKey: "c", materia: "RLM", assunto: "Lógica" }],
    relevantReviews: [{ id: "r1", materia: "Português" }],
    reinforcements: [{ blockKey: "a", materia: "Português" }],
  },
  contactGaps: [{ materia: "Controle Externo", days: 9 }],
  interventions: [
    { materia: "Licitações", assunto: "Contratos", result: "resolved", detail: "O desempenho se manteve após o reforço." },
    { materia: "RLM", assunto: "Lógica", result: "unchanged", detail: "Ainda não há melhora suficiente." },
  ],
  errorInsights: [{ materia: "RLM", assunto: "Lógica", recurrence: "high", postInterventionErrors: 2 }],
  examContext: { examDate: "2026-10-01", weeksRemaining: 6, coveragePercent: 65 },
});
assert.equal(closure.version, 2);
assert.equal(closure.coverage.newTopics, 3);
assert.ok(closure.highlights.length <= 4);
assert.ok(closure.highlights.some((item) => item.detail.includes("p.p.")));
assert.ok(closure.adjustments.some((item) => item.blockKey === "b" && item.type === "continue"));
assert.ok(closure.adjustments.some((item) => item.materia === "Controle Externo"));
assert.ok(closure.continuity.some((item) => item.title === "Tema em andamento"));
assert.ok(closure.continuity.some((item) => item.title === "Reforço continua relevante"));
assert.equal(closure.summary.questions, 40);
assert.equal(closure.summary.coverageAdded, 3);
assert.equal(closure.summary.hoursDelta, -2.5);
assert.equal(closure.summary.performanceDeltaPoints, 2);
assert.equal(closure.examContext.weeksRemaining, 6);

// 18b. Um reforço recuperado não volta a ser priorizado só pelo resultado antigo.
const recoveredClosure = engine.buildWeeklyClosure({
  goal: normal,
  progress: below,
  performance: { subjects: [{ materia: "Licitações", questions: 20, accuracy: 0.55 }] },
  interventions: [{ materia: "Licitações", assunto: "Contratos", result: "resolved", detail: "Recuperação confirmada." }],
});
assert.equal(recoveredClosure.adjustments.some((item) => item.type === "reinforce" && item.materia === "Licitações"), false);

// 19. Semana sem estudo não acumula dívida nem inventa tendência.
const emptyClosure = engine.buildWeeklyClosure({ goal: normal, progress: { compliance: 0 }, coverage: { totalTopics: 20 } });
assert.equal(emptyClosure.noActivity, true);
assert.equal(emptyClosure.highlights.length, 0);
assert.match(emptyClosure.headline, /Não houve atividades/);

// 20. Ajustes estruturados mudam a precedência sem recriar bloco concluído.
const adjusted = engine.buildWeeklyGoal({
  now: new Date("2026-08-24T12:00:00-03:00"),
  plannedHours: 4,
  blocks: [
    { key: "first", materia: "Português", order: 0, hours: 1, status: "Não iniciado" },
    { key: "return", materia: "Controle Externo", order: 3, hours: 1, status: "Não iniciado" },
    { key: "done", materia: "AFO", order: 1, hours: 1, status: "Concluído" },
  ],
  adjustments: [{ type: "return", materia: "Controle Externo", weight: 55, reason: "retomar Controle Externo" }],
  sourceWeekId: normal.id,
});
assert.equal(adjusted.plannedBlockKeys[0], "return");
assert.equal(adjusted.plannedBlockKeys.includes("done"), false);
assert.equal(adjusted.sourceWeekId, normal.id);

// 21. A nova disponibilidade é respeitada em vez de copiar a carga anterior.
const changedAvailability = engine.buildWeeklyGoal({ now: new Date("2026-08-24T12:00:00-03:00"), plannedHours: 8, blocks });
assert.equal(changedAvailability.plannedHours, 8);
assert.equal(next.plannedHours, 6);

// 22. O snapshot completo permanece serializável e ligado ao fechamento.
const closedWithClosure = engine.closeWeeklyGoal(normal, below, performance, new Date("2026-08-24T08:00:00-03:00"), closure);
assert.equal(closedWithClosure.closure.coverage.afterPercent, 65);
assert.doesNotThrow(() => JSON.stringify(closedWithClosure));

// 23. Integração: fechamento pendente, prévia e confirmação não alteram ciclos encerrados.
assert.match(app, /function weeklyClosureSnapshot/);
assert.match(app, /function previousWeeklyProgress/);
assert.match(app, /weekly-summary-grid/);
assert.match(app, /function pendingWeeklyClosure/);
assert.match(app, /function confirmNextWeeklyGoal/);
assert.match(app, /data-prepare-next-week/);
assert.match(app, /data-confirm-next-week/);
assert.match(app, /nextWeekPreparedAt/);
assert.match(app, /weeklyAdjustmentForBlock/);
assert.match(app, /function weeklyReinforcementCandidates\(\{ plannedHours = 0, examContext = null \} = \{\}\)/);
assert.match(app, /weeklyReinforcementCandidates\(\{ plannedHours, examContext \}\)/);

console.log("weekly-goal tests passed");
