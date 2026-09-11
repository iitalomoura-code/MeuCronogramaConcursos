"use strict";

const assert = require("assert");
const plan = require("../js/strategic-time-plan.js");

const now = new Date(2026, 8, 11, 15, 0, 0);
const today = new Date(2026, 8, 11, 10, 0, 0).toISOString();
const yesterday = new Date(2026, 8, 10, 10, 0, 0).toISOString();

const concludedYesterdayUpdatedToday = {
  materia: "Contabilidade",
  assunto: "Lançamentos",
  status: "Concluído",
  completedAt: yesterday,
  atualizadoEm: today,
};
assert.equal(plan.canonicalExecutionCompletedAt(concludedYesterdayUpdatedToday), yesterday, "A data de execução deve preferir completedAt, não atualizadoEm.");
assert.equal(plan.completedAllocationsForToday([{
  eventId: "old-updated",
  ...concludedYesterdayUpdatedToday,
  completedAt: today,
  executionCompletedAt: plan.canonicalExecutionCompletedAt(concludedYesterdayUpdatedToday),
}], now).length, 0, "Um bloco concluído ontem e atualizado hoje não pode entrar na alocação de hoje.");

const closedTodayButStudiedEarlier = {
  materia: "Português",
  assunto: "Reescrita",
  status: "Concluído",
  concluidoEm: "10/09/2026",
  savedAt: today,
  cicloFinalizadoEm: today,
};
assert.equal(plan.canonicalExecutionCompletedAt(closedTodayButStudiedEarlier), new Date(2026, 8, 10, 12).toISOString(), "O fechamento do ciclo não pode substituir a data da execução.");

const realStrategicSession = {
  eventId: "strategic-real",
  materia: "AFO",
  assunto: "Receita Pública",
  status: "Concluído",
  strategicPlanSession: true,
  completedAt: today,
  executionCompletedAt: today,
  durationMinutes: 45,
};
assert.deepEqual(plan.completedAllocationsForToday([realStrategicSession], now), [{ materia: "AFO", assunto: "Receita Pública", durationMinutes: 45 }], "Uma sessão estratégica realmente concluída hoje deve alimentar a próxima alocação.");

assert.equal(plan.completedAllocationsForToday([
  { eventId: "generated", materia: "Direito", assunto: "Atos", status: "Não iniciado", executionCompletedAt: today, durationMinutes: 30 },
  { eventId: "opened", materia: "Direito", assunto: "Atos", status: "Em andamento", executionCompletedAt: today, durationMinutes: 30 },
  { eventId: "discarded", materia: "Direito", assunto: "Atos", status: "Não iniciado", executionCompletedAt: today, durationMinutes: 30 },
], now).length, 0, "Blocos gerados, abertos ou descartados não contam como execução recente.");

console.log("strategic-time-plan stabilization tests passed");
