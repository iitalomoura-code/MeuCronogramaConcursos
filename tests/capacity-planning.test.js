const assert = require("assert");
const CapacityPlanning = require("../js/capacity-planning.js");

const regular = CapacityPlanning.capacityFor({
  dailyHours: { segunda: 3, terca: 3, quarta: 3, quinta: 3, sexta: 3, sabado: 3, domingo: 3 },
});
assert.strictEqual(regular.availableHours, 21, "A disponibilidade diária deve determinar a capacidade semanal.");
assert.strictEqual(regular.plannedHours, 19.32, "A capacidade planejada deve preservar a margem de segurança de 8%.");
assert.strictEqual(regular.reserveHours, 1.68, "A reserva deve ficar fora das metas geradas.");

const irregular = CapacityPlanning.capacityFor({
  dailyHours: { segunda: 2, terca: 2, quarta: 2, quinta: 2, sexta: 2, sabado: 8, domingo: 3 },
});
assert.strictEqual(irregular.availableHours, 21, "Disponibilidade irregular deve manter o total real informado.");
assert.strictEqual(irregular.dailyHours.sabado, 8, "A distribuição diária não pode ser nivelada ao aplicar a margem.");

const legacy = CapacityPlanning.capacityFor({ weeklyHours: 14 });
assert.strictEqual(legacy.availableHours, 14, "Planos legados sem horas diárias devem continuar utilizáveis.");
assert.ok(legacy.plannedHours < legacy.availableHours, "Planos legados também recebem margem de segurança.");

const active = CapacityPlanning.normalizeSubject({ materia: "Português", peso: 5 });
const paused = CapacityPlanning.normalizeSubject({ materia: "Inglês", active: false, peso: 2 });
assert.strictEqual(active.active, true, "Matérias legadas devem permanecer ativas por padrão.");
assert.strictEqual(paused.status, "paused", "Matéria pausada deve manter um estado explícito.");
assert.strictEqual(active.examImportance.confidence, "manual", "Peso legado deve ser uma importância manual compatível.");

const criticalPressure = CapacityPlanning.studyPressure({
  importance: { importanceScore: .85 },
  diagnosis: { level: "critical", trend: { label: "falling" }, daysWithoutContact: 20 },
  urgency: .5,
});
const strongPressure = CapacityPlanning.studyPressure({
  importance: { importanceScore: .3 },
  diagnosis: { level: "strong", trend: { label: "stable" }, daysWithoutContact: 0 },
  urgency: 0,
  hasContact: true,
});
assert.ok(criticalPressure > strongPressure, "Importância e necessidade pessoal devem permanecer dimensões combinadas, não confundidas.");

const merged = CapacityPlanning.mergeNeeds([
  { materia: "Contabilidade", assunto: "CPC 25", duracao: .5, reviewIntegrated: true, integratedNeeds: ["review"] },
  { materia: "Contabilidade", assunto: "CPC 25", duracao: .75, reinforcementIntegrated: true, integratedNeeds: ["reinforcement"] },
]);
assert.strictEqual(merged.length, 1, "Revisão e reforço do mesmo assunto devem virar uma única meta.");
assert.deepStrictEqual(merged[0].integratedNeeds.sort(), ["reinforcement", "review"], "A meta fundida deve explicar todas as necessidades atendidas.");

const cap = CapacityPlanning.capIntracycleAdaptations(
  Array.from({ length: 20 }, () => ({ category: "flexible" })),
  Array.from({ length: 7 }, (_, index) => ({ id: index }))
);
assert.strictEqual(cap.limit, 5, "Adaptação intraciclo deve ficar limitada a 25% dos blocos.");
assert.strictEqual(cap.accepted.length, 5, "Necessidades além do limite devem ficar para o próximo ciclo.");
assert.strictEqual(cap.deferred.length, 2, "Itens além do teto precisam continuar identificáveis.");

console.log("OK - planejamento por capacidade preserva margem, matérias pausadas, fusão e limite adaptativo.");
