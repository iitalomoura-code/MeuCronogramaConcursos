const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

assert.ok(app.includes("const ALLOWED_BLOCK_MINUTES = [30, 45, 60, 90, 120]"), "As durações permitidas devem ser centralizadas.");
assert.ok(app.includes("const MAX_CONSECUTIVE_BLOCKS_PER_SUBJECT = 2"), "O limite de repetição consecutiva deve existir.");
assert.ok(app.includes("const MAX_RECENT_SHARE_PER_SUBJECT = 0.4"), "O limite de concentração recente deve existir.");
assert.ok(app.includes("function estimateBlockDuration"), "A estimativa central de duração deve existir.");
assert.ok(app.includes("function createAdaptiveCycleBlocks"), "A geração por capacidade em minutos deve existir.");
assert.ok(app.includes("cycleAbsenceForSubject"), "A rotação por recência deve ser considerada.");
assert.ok(app.includes("CURRENT_CYCLE_COVERAGE_WEIGHT"), "A cobertura mínima do ciclo deve ser considerada.");
assert.ok(app.includes("function recommendationRotationFor"), "A tela Continuar deve usar uma regra de equilíbrio.");
assert.ok(app.includes("function buildContinueRecommendation"), "A tela Continuar deve centralizar o resultado da recomendação.");
assert.ok(app.includes("daysSinceLastSubjectContact"), "A tela Continuar deve considerar tempo sem contato.");
assert.ok(app.includes("data-continue-duration"), "A tela Continuar deve permitir ajustar a duração sugerida.");
assert.ok(app.includes("data-continue-filter-minutes"), "A tela Continuar deve oferecer filtro de tempo disponível.");
assert.ok(app.includes("data-continue-filter-activity"), "A tela Continuar deve oferecer filtro por atividade.");
assert.ok(!app.includes("state.generatedBlocks = rebalanceGoalDurations(distributeAcrossSlots(queue, slots)"), "A geração nova não deve rebalancear todos os blocos pela duração padrão.");

const cut = app.indexOf("els.tabs.forEach((button) => button.addEventListener");
const runtimeSource = `${app.slice(0, cut)}\nglobalThis.__adaptiveCycleTest = { state, createAdaptiveCycleBlocks, estimateBlockDuration, normalizeReferenceDurationHours, rankedContinueEntries, buildContinueRecommendation, explainStudySuggestion, continueRecommendationFilters };`;
const noop = () => {};
const context = {
  console,
  setTimeout: noop,
  clearTimeout: noop,
  setInterval: noop,
  clearInterval: noop,
  requestAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: { querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, documentElement: { dataset: {}, style: { setProperty: noop } }, body: {} },
  window: { setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, addEventListener: noop, matchMedia: () => ({ matches: false }), innerWidth: 1200 },
  Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, structuredClone,
};
vm.createContext(context);
vm.runInContext(runtimeSource, context);
const runtime = context.__adaptiveCycleTest;
runtime.state.rows = [
  { materia: "Alta", assunto: "Tema curto", estudar: "Sim", tamanhoEstimado: "Curto", blocosSugeridos: 1 },
  { materia: "Baixa", assunto: "Tema longo com vários itens e exceções", estudar: "Sim", tamanhoEstimado: "Longo", blocosSugeridos: 2 },
];
runtime.state.planningBase = {
  materias: [
    { materia: "Alta", assuntos: ["Tema curto"], peso: 5, dominio: 4 },
    { materia: "Baixa", assuntos: ["Tema longo com vários itens e exceções"], peso: 1, dominio: 2 },
  ],
};
runtime.state.reviews = [];
runtime.state.completedHistory = [];
runtime.state.cycleHistory = [];
runtime.state.cycleResults = [];
runtime.state.planningBase.materias[0].dominio = 3;
assert.strictEqual(runtime.estimateBlockDuration({ subject: runtime.state.planningBase.materias[0], topic: "Tema curto", activityType: "Teoria", estimatedSize: "Curto", referenceDuration: 0.5 }).minutes, 45, "Tema curto deve manter 45 minutos mesmo com referência menor.");
assert.strictEqual(runtime.estimateBlockDuration({ subject: runtime.state.planningBase.materias[0], topic: "Tema médio", activityType: "Teoria", estimatedSize: "Médio", referenceDuration: 1.5 }).minutes, 60, "Tema médio deve sugerir 60 minutos.");
assert.strictEqual(runtime.estimateBlockDuration({ subject: runtime.state.planningBase.materias[0], topic: "Tema difícil", activityType: "Teoria", estimatedSize: "Médio", difficulty: "Alta", referenceDuration: 1 }).minutes, 90, "Tema difícil deve sugerir 90 minutos.");
assert.strictEqual(runtime.estimateBlockDuration({ subject: runtime.state.planningBase.materias[0], topic: "Tema curto", activityType: "Questões", estimatedSize: "Curto", referenceDuration: 1.5 }).minutes, 30, "Questões de tema curto devem sugerir 30 minutos.");
assert.strictEqual(runtime.normalizeReferenceDurationHours("1.5"), 1.5, "1h30 legado deve continuar equivalente a 90 minutos.");
assert.strictEqual(runtime.normalizeReferenceDurationHours("2.5"), 2, "2h30 legado deve mapear para a exceção compatível de 120 minutos.");
const cycle = runtime.createAdaptiveCycleBlocks(runtime.state.planningBase.materias, { horasSemanaCronograma: 3, duracaoBloco: 1.5 }, {});
const shortWindowCycle = runtime.createAdaptiveCycleBlocks(runtime.state.planningBase.materias, { horasSemanaCronograma: 0.75, duracaoBloco: 1.5 }, {});
assert.ok(shortWindowCycle.blocks.reduce((sum, block) => sum + block.duracao, 0) <= 0.75, "Pouco tempo restante deve gerar apenas blocos que caibam na carga.");
assert.ok(cycle.blocks.some((block) => block.materia === "Baixa"), "A cobertura mínima deve incluir matéria de menor prioridade quando a carga permitir.");
assert.ok(cycle.blocks.reduce((sum, block) => sum + block.duracao, 0) <= 3, "O ciclo não pode ultrapassar a carga disponível.");
assert.ok(cycle.blocks.every((block) => [0.5, 0.75, 1, 1.5, 2].includes(block.duracao)), "A duração deve usar faixas discretas.");
assert.strictEqual(runtime.estimateBlockDuration({ subject: runtime.state.planningBase.materias[1], topic: "Tema longo com vários itens e exceções", activityType: "Revisão", referenceDuration: 1.5 }).minutes, 30, "Revisões curtas devem sugerir 30 minutos.");

runtime.state.planningBase.materias = [
  { materia: "Financeiro", assuntos: ["Receita"], peso: 3, dominio: 3 },
  { materia: "Português", assuntos: ["Sintaxe"], peso: 5, dominio: 3 },
  { materia: "Informática", assuntos: ["Internet"], peso: 3, dominio: 3 },
  { materia: "Administração", assuntos: ["Pessoas"], peso: 2, dominio: 3 },
];
runtime.state.rows = runtime.state.planningBase.materias.map((subject) => ({ materia: subject.materia, assunto: subject.assuntos[0], estudar: "Sim", tamanhoEstimado: "Médio", blocosSugeridos: 1 }));
runtime.state.generatedBlocks = [
  { materia: "Financeiro", assunto: "Receita", duracao: 1, prioridade: 3, status: "Em andamento", tipoAtividade: "Teoria" },
  { materia: "Português", assunto: "Sintaxe", duracao: 1, prioridade: 5, status: "Não iniciado", tipoAtividade: "Teoria" },
  { materia: "Informática", assunto: "Internet", duracao: 0.5, prioridade: 3, status: "Não iniciado", tipoAtividade: "Questões" },
  { materia: "Administração", assunto: "Pessoas", duracao: 0.75, prioridade: 2, status: "Não iniciado", tipoAtividade: "Teoria" },
];
runtime.state.completedHistory = [
  { materia: "Informática", assunto: "Internet", questoes: 10, acertos: 5, status: "Concluído", concluidoEm: "2026-07-01" },
];
runtime.state.cycleHistory = [];
runtime.state.cycleResults = [];
runtime.state.reviews = [];
runtime.continueRecommendationFilters.minutes = 0;
runtime.continueRecommendationFilters.activity = "";
let recommendation = runtime.buildContinueRecommendation();
assert.strictEqual(recommendation.recommendation.block.materia, "Financeiro", "Tema em andamento deve ganhar vantagem de conclusão.");
assert.ok(recommendation.reasons.includes("tema em andamento"), "A justificativa deve indicar o tema em andamento.");
runtime.state.reviews = [{ materia: "Informática", assunto: "Internet", status: "Pendente", dataPrevista: "01/01/2020", tipo: "comum" }];
recommendation = runtime.buildContinueRecommendation();
assert.strictEqual(recommendation.recommendation.block.materia, "Informática", "Revisão vencida deve competir com estudo novo.");
assert.ok(recommendation.reasons.some((reason) => reason.includes("revisão merece atenção")), "A explicação deve mencionar a revisão disponível.");
runtime.state.reviews = [];
runtime.continueRecommendationFilters.minutes = 30;
const shortOptions = runtime.rankedContinueEntries();
assert.deepStrictEqual(shortOptions.map((entry) => entry.block.materia), ["Informática"], "Filtro de 30 minutos deve respeitar apenas blocos compatíveis.");
runtime.continueRecommendationFilters.minutes = 0;
runtime.continueRecommendationFilters.activity = "Questões";
assert.deepStrictEqual(runtime.rankedContinueEntries().map((entry) => entry.block.materia), ["Informática"], "Filtro de questões deve respeitar a atividade do bloco.");
runtime.continueRecommendationFilters.activity = "";
recommendation = runtime.buildContinueRecommendation();
assert.ok(recommendation.alternatives.every((entry, index, list) => list.findIndex((item) => item.block.materia === entry.block.materia) === index), "Alternativas iniciais devem priorizar matérias diferentes.");

console.log("OK - ciclo adaptativo usa cobertura, rotação, duração discreta e filtros da tela Continuar.");
