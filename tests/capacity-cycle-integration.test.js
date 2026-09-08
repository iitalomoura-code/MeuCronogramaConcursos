const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const CapacityPlanning = require("../js/capacity-planning.js");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const cut = app.indexOf("els.tabs.forEach((button) => button.addEventListener");
const runtimeSource = `${app.slice(0, cut)}\nglobalThis.__capacityIntegration = { state, integrateCycleNeed, cycleNeedCandidate, mergeCycleNeedIntoBlock, assignBlocksToDailyCapacity, refreshExamImportance, priorityScore };`;
const noop = () => {};
const context = {
  console, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, structuredClone,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: { querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, documentElement: { dataset: {}, style: { setProperty: noop } }, body: {} },
  window: { setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, addEventListener: noop, matchMedia: () => ({ matches: false }), innerWidth: 1200, CapacityPlanning },
};
vm.createContext(context);
vm.runInContext(runtimeSource, context);
const runtime = context.__capacityIntegration;

const blocks = Array.from({ length: 20 }, (_, index) => ({
  bloco: index + 1,
  materia: index === 0 ? "Contabilidade" : `Matéria ${index}`,
  assunto: index === 0 ? "CPC 25" : `Tema ${index}`,
  duracao: 1,
  prioridade: .45,
  studyPressure: .25,
  status: "Não iniciado",
  category: "flexible",
}));
runtime.state.generatedBlocks = blocks;
runtime.state.interventionHistory = [];

const review = { materia: "Contabilidade", assunto: "CPC 25", integratedNeeds: ["review"], reviewIntegrated: true, duracao: .5, category: "flexible", adaptiveReason: "revisão de 7 dias" };
const reinforcement = { materia: "Contabilidade", assunto: "CPC 25", integratedNeeds: ["reinforcement"], reinforcementIntegrated: true, duracao: .75, category: "adaptive", adaptiveReason: "desempenho baixo" };
assert.ok(runtime.integrateCycleNeed(review).merged, "Revisão deve procurar a meta futura do mesmo assunto.");
assert.ok(runtime.integrateCycleNeed(reinforcement).merged, "Reforço deve ser fundido à meta futura do mesmo assunto.");
assert.strictEqual(blocks.length, 20, "Fusão de revisão e reforço não pode aumentar o ciclo.");
assert.deepStrictEqual(Array.from(blocks[0].integratedNeeds).sort(), ["reinforcement", "review"], "A meta única deve preservar as duas necessidades.");

// Cenário independente: um ciclo novo de vinte blocos recebe sete candidatos.
blocks[0].category = "flexible";
blocks[0].adaptive = false;

const outcomes = Array.from({ length: 7 }, (_, index) => runtime.integrateCycleNeed({
  materia: `Adaptação ${index}`,
  assunto: `Alvo ${index}`,
  integratedNeeds: ["reinforcement"],
  reinforcementIntegrated: true,
  status: "Não iniciado",
  duracao: .5,
  category: "adaptive",
  studyPressure: .9,
  adaptiveReason: "necessidade adaptativa",
}));
assert.strictEqual(blocks.length, 20, "Substituições adaptativas não podem criar blocos extras.");
assert.strictEqual(outcomes.filter((item) => item.applied).length, 5, "Em 20 blocos, no máximo cinco adaptações devem ser aplicadas.");
assert.strictEqual(outcomes.filter((item) => item.deferred).length, 2, "Necessidades além do limite devem ficar adiadas.");
assert.strictEqual(blocks.filter((item) => item.category === "adaptive").length, 5, "O ciclo precisa refletir o teto de 25% de adaptação.");

const days = runtime.assignBlocksToDailyCapacity([
  { duracao: 2 }, { duracao: 1 }, { duracao: 2 },
], { capacidade: { safetyMargin: 1, dailyHours: { segunda: 1, terca: 0, quarta: 0, quinta: 0, sexta: 0, sabado: 8, domingo: 0 } } });
assert.strictEqual(days[0].plannedDay, "sabado", "Bloco de duas horas não pode ser colocado no dia com uma hora disponível.");
assert.strictEqual(days[1].plannedDay, "sabado", "A alocação deve respeitar a capacidade diária restante.");

runtime.state.planningBase = { materias: [
  ["Português", 15, 3], ["Dados", 15, 3], ["Constitucional", 14, 3], ["Administrativo", 12, 3],
  ["Contabilidade", 10, 3], ["Tributário", 8, 3], ["Previdenciário", 8, 4], ["Legislação Tributária", 14, 3], ["Legislação Aduaneira", 14, 3],
].map(([materia, questionCount, dominio]) => ({ materia, peso: 1, dominio, examImportance: { questionCount, weight: 1 } })) };
runtime.refreshExamImportance();
const structure = Object.fromEntries(runtime.state.planningBase.materias.map((subject) => [subject.materia, subject.examImportance]));
const closeTo = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .002, `${label}: esperado ${expected}, recebido ${actual}`);
closeTo(structure.Português.importanceScore, 1, "Português deve ser a referência relativa");
closeTo(structure.Dados.importanceScore, 1, "Dados deve dividir a referência relativa");
closeTo(structure.Constitucional.importanceScore, 14 / 15, "Constitucional deve usar peso relativo");
closeTo(structure.Administrativo.importanceScore, .8, "Administrativo deve usar peso relativo");
closeTo(structure.Contabilidade.importanceScore, 10 / 15, "Contabilidade deve usar peso relativo");
closeTo(structure.Tributário.importanceScore, 8 / 15, "Tributário deve usar peso relativo");
closeTo(structure.Previdenciário.importanceScore, 8 / 15, "Previdenciário deve usar peso relativo");
closeTo(structure.Previdenciário.estimatedPercentage, 8 / 110, "Participação deve continuar absoluta dentro da prova");
assert.notStrictEqual(structure.Previdenciário.estimatedPercentage, structure.Previdenciário.importanceScore, "Participação percentual e importância relativa precisam continuar separadas.");
const previdenciario = runtime.state.planningBase.materias.find((subject) => subject.materia === "Previdenciário");
closeTo(runtime.priorityScore(previdenciario), .6 * (8 / 15) + .4 * .8, "A prioridade deve combinar importância relativa e dificuldade na mesma escala");
assert.ok(runtime.priorityScore(previdenciario) >= .6, "Previdenciário com dificuldade alta não pode aparecer como baixa prioridade.");

console.log("OK - capacidade integrada funde necessidades, limita adaptações, respeita dias e usa estrutura de prova.");
