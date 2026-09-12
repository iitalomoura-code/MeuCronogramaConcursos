"use strict";

const assert = require("node:assert/strict");
const CapacityPlanning = require("../js/capacity-planning.js");
const WeeklyStudyCycle = require("../js/weekly-study-cycle.js");
const allocator = require("../js/strategic-time-allocation.js");

const now = new Date("2026-09-14T12:00:00.000Z");
const capacity21 = CapacityPlanning.capacityFor({ weeklyHours: 21 });
const capacity24 = CapacityPlanning.capacityFor({ weeklyHours: 24 });
const signature21 = WeeklyStudyCycle.configurationSignature({ weeklyHours: 21, safetyMargin: capacity21.safetyMargin });
const cycle21 = WeeklyStudyCycle.create({ weeklyHours: 21, capacity: capacity21, now, sourceConfigurationSignature: signature21 });

assert.equal(cycle21.weeklyCapacityMinutes, 1260);
assert.equal(cycle21.plannedMinutes, 1159);
assert.equal(cycle21.reserveMinutes, 101);
assert.equal(cycle21.status, "active");
assert.equal(new Date(cycle21.endsAt).getTime() - new Date(cycle21.startedAt).getTime(), 7 * WeeklyStudyCycle.DAY_MS);
assert.equal(WeeklyStudyCycle.create({ weeklyHours: 24, capacity: capacity24, now }).plannedMinutes, 1325);
assert.equal(WeeklyStudyCycle.create({ weeklyHours: 0, capacity: CapacityPlanning.capacityFor({ weeklyHours: 0 }), now }).plannedMinutes, 0);

const blocks = [{ id: "modern", tempoEstudado: 3 }, { id: "short", tempoEstudado: .5 }, { id: "pending", tempoEstudado: 0 }];
const progress = WeeklyStudyCycle.summarize(cycle21, blocks);
assert.equal(progress.completedMinutes, 210);
assert.equal(progress.remainingPlannedMinutes, 949);

const legacyCycle = WeeklyStudyCycle.create({
  weeklyHours: 21,
  capacity: capacity21,
  now,
  blocks: [{ id: "legacy", tempoEstudado: 45 }, { id: "prior", tempoEstudado: 1 }],
});
assert.equal(legacyCycle.executionBaselineByBlock.legacy, 45, "Registro legado inteiro deve manter a unidade em minutos.");
assert.equal(WeeklyStudyCycle.summarize(legacyCycle, [{ id: "legacy", tempoEstudado: 45 }, { id: "prior", tempoEstudado: 1 }]).completedMinutes, 0, "Tempo anterior ao ciclo não pode ser contado novamente.");
assert.equal(WeeklyStudyCycle.summarize(legacyCycle, [{ id: "legacy", tempoEstudado: 75 }, { id: "prior", tempoEstudado: 1 }]).completedMinutes, 30, "Somente a execução nova do ciclo deve reduzir a capacidade restante.");
assert.equal(WeeklyStudyCycle.summarize(legacyCycle, [{ id: "legacy", tempoEstudado: 45 }, { id: "prior", tempoEstudado: 1 }, { id: "carried", tempoEstudado: 0 }]).completedMinutes, 0, "Bloco carregado e ainda não iniciado não pode reduzir a capacidade.");

const baselineBlocks = [{ id: "immutable", tempoEstudado: 1 }];
const baselineBefore = structuredClone(baselineBlocks);
WeeklyStudyCycle.create({ weeklyHours: 21, capacity: capacity21, now, blocks: baselineBlocks });
assert.deepEqual(baselineBlocks, baselineBefore, "Capturar baseline não pode mutar os blocos existentes.");

const reduced = WeeklyStudyCycle.reconcileCapacity(cycle21, { weeklyHours: 15, capacity: CapacityPlanning.capacityFor({ weeklyHours: 15 }) }, blocks);
assert.equal(reduced.completedMinutes, 210);
assert.equal(reduced.plannedMinutes, 828);
assert.equal(reduced.remainingPlannedMinutes, 618);
assert.equal(cycle21.plannedMinutes, 1159, "A reconciliação não pode mutar o ciclo anterior.");

const plannedOnlyCycle = WeeklyStudyCycle.create({ weeklyHours: 21, capacity: capacity21, now });
const plannedAllocation = WeeklyStudyCycle.allocate({ cycle: plannedOnlyCycle, topics: [
  { materia: "Português", assunto: "Sintaxe", strategic: { score: .95, recommendedSession: { minutes: 30, label: "Questões" } } },
  { materia: "Direito", assunto: "Atos", strategic: { score: .9, recommendedSession: { minutes: 30, label: "Estudo" } } },
], allocator });
assert.ok(plannedAllocation.allocatedMinutes <= cycle21.plannedMinutes, "A geração-base não pode ocupar a reserva semanal.");

const inputs = [{ materia: "Português", assunto: "Sintaxe", strategic: { score: .9, recommendedSession: { minutes: 30, label: "Questões" } } }];
const before = structuredClone(inputs);
const allocation = WeeklyStudyCycle.allocate({ cycle: cycle21, topics: inputs, allocator });
assert.ok(allocation.sessions.length > 0);
assert.deepEqual(inputs, before, "Gerar o ciclo não pode criar evidência nem mutar prioridades.");
assert.equal(WeeklyStudyCycle.shouldClose(cycle21, new Date(new Date(cycle21.endsAt).getTime() - 1)), false);
assert.equal(WeeklyStudyCycle.shouldClose(cycle21, new Date(cycle21.endsAt)), true);
assert.equal(WeeklyStudyCycle.close(cycle21, blocks, now).status, "closed");

console.log("OK - ciclo semanal usa capacidade canônica, preserva execução real e não cria dívida.");
