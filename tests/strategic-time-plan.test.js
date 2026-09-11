"use strict";

const assert = require("assert");
const plan = require("../js/strategic-time-plan.js");
const allocator = require("../js/strategic-time-allocation.js");

const now = new Date(2026, 8, 11, 14, 0, 0);
const today = new Date(2026, 8, 11, 9, 30, 0).toISOString();
const yesterday = new Date(2026, 8, 10, 19, 0, 0).toISOString();
const events = [
  { eventId: "completed-1", materia: "Contabilidade", assunto: "Lançamentos", status: "Concluído", completedAt: today, executionCompletedAt: today, durationMinutes: 60 },
  { eventId: "completed-1", materia: "Contabilidade", assunto: "Lançamentos", status: "Concluído", completedAt: today, executionCompletedAt: today, durationMinutes: 60 },
  { eventId: "planned", materia: "Português", assunto: "Reescrita", status: "Não iniciado", completedAt: today, executionCompletedAt: today, durationMinutes: 45 },
  { eventId: "progress", materia: "AFO", assunto: "Receita", status: "Em andamento", completedAt: today, executionCompletedAt: today, durationMinutes: 30 },
  { eventId: "snapshot", materia: "Direito", assunto: "Atos", status: "Concluído", completedAt: yesterday, executionCompletedAt: yesterday, durationMinutes: 45 },
  { eventId: "legacy", materia: "Legislação", assunto: "Normas", status: "Concluído", completedAt: today, executionCompletedAt: today },
];

const before = JSON.stringify(events);
const allocations = plan.completedAllocationsForToday(events, now);
assert.deepEqual(allocations, [
  { materia: "Contabilidade", assunto: "Lançamentos", durationMinutes: 60 },
  { materia: "Legislação", assunto: "Normas", durationMinutes: 0 },
], "Somente sessões concluídas hoje entram como contexto recente, sem duplicidade.");
assert.equal(JSON.stringify(events), before, "O adaptador de execução não deve mutar a fonte canônica.");

let received = null;
const result = plan.build({
  availableMinutes: 90,
  topics: [{ materia: "Contabilidade", assunto: "Lançamentos", strategic: { score: .9, learningState: { key: "recovery" }, recommendedSession: { label: "Revisão", kind: "review", minutes: 45 } } }],
  recentAllocations: allocations,
  allocator: { allocate(input) { received = input; return allocator.allocate(input); } },
});
assert.equal(received.availableMinutes, 90, "A capacidade informada agora não deve ser reduzida pelo que já foi estudado antes.");
assert.equal(received.recentAllocations[0].durationMinutes, 60, "A conclusão real de hoje deve chegar ao allocator.");
assert.ok(result && Array.isArray(result.sessions), "O plano deve delegar a alocação ao motor existente.");

assert.equal(plan.completedAllocationsForToday([{ materia: "A", assunto: "B", status: "Concluído", executionCompletedAt: "invalido" }], now).length, 0, "Datas inválidas não podem virar execução recente.");

console.log("strategic-time-plan tests passed");
