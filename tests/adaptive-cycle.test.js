const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const StudyDerivedState = require("../js/study-derived-state.js");
const ContinueRecommendation = require("../js/continue-recommendation.js");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

assert.ok(app.includes("const ALLOWED_BLOCK_MINUTES = [30, 45, 60, 90, 120]"), "As durações permitidas devem ser centralizadas.");
assert.ok(app.includes("const MAX_CONSECUTIVE_BLOCKS_PER_SUBJECT = 1"), "O limite de repetição consecutiva deve existir.");
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
const runtimeSource = `${app.slice(0, cut)}\nglobalThis.__adaptiveCycleTest = { state, createAdaptiveCycleBlocks, estimateBlockDuration, normalizeReferenceDurationHours, rankedContinueEntries, buildContinueRecommendation, explainStudySuggestion, continueRecommendationFilters, entryDateValue, entryHasRecordedStudyContact, entryContactDateValue, evolutionEntryDate, evolutionEntryFromBlock, alertDaysWithoutContact, distributeBlocks, buildAlternatingQueue, cycleFairnessDiagnostics, normalSubjectBlockCap, canAddCycleBlock, fairnessExceptionReason, assignBlocksToDailyCapacity, cycleAbsenceForSubject, pedagogicalFrontier, pedagogicalProgression, pedagogicalReconciliationInput, rankStudyUnitsByAdaptivePriority, invalidateDerivedStudyCaches };`;
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
  window: { setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, addEventListener: noop, matchMedia: () => ({ matches: false }), innerWidth: 1200, StudyDerivedState, ContinueRecommendation },
  Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, structuredClone,
};
vm.createContext(context);
vm.runInContext(runtimeSource, context);
const runtime = context.__adaptiveCycleTest;
assert.strictEqual(runtime.entryDateValue({ savedAt: "1970-01-01T00:00:00.000Z" }), 0, "Data de época não pode entrar no histórico de estudo.");
assert.strictEqual(runtime.entryHasRecordedStudyContact({ status: "Não iniciado", savedAt: "2026-09-03T12:00:00.000Z" }), false, "Bloco apenas criado não representa contato de estudo.");
assert.strictEqual(runtime.entryContactDateValue({ status: "Não iniciado", savedAt: "1970-01-01T00:00:00.000Z" }), 0, "Bloco pendente não pode gerar dias sem contato.");
assert.strictEqual(runtime.entryContactDateValue({ status: "Concluído", completedAt: "2026-09-02T12:00:00.000Z" }), Date.parse("2026-09-02T12:00:00.000Z"), "Conclusão real deve continuar registrando o último contato.");
assert.strictEqual(runtime.evolutionEntryDate({ status: "Não iniciado", savedAt: "1970-01-01T00:00:00.000Z" }), null, "A evolução deve descartar datas de época legadas.");
const untouchedEvolutionEntry = runtime.evolutionEntryFromBlock({ materia: "Nova", assunto: "Tema", status: "Não iniciado", savedAt: "1970-01-01T00:00:00.000Z" }, { current: true });
assert.strictEqual(untouchedEvolutionEntry.hasContact, false, "Bloco apenas criado não pode ser tratado como contato no painel.");
assert.strictEqual(runtime.alertDaysWithoutContact("Nova", [untouchedEvolutionEntry]), null, "Tema novo deve permanecer sem contagem de dias até o primeiro contato real.");
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

runtime.state.planningBase.materias = [{ materia: "Única", assuntos: ["Tema único"], peso: 5, dominio: 3 }];
runtime.state.rows = [{ materia: "Única", assunto: "Tema único", estudar: "Sim", tamanhoEstimado: "Curto", blocosSugeridos: 1 }];
runtime.state.generatedBlocks = [];
runtime.state.completedHistory = [];
runtime.state.cycleHistory = [];
runtime.state.cycleResults = [];
runtime.state.reviews = [];
const noDuplicateCycle = runtime.createAdaptiveCycleBlocks(runtime.state.planningBase.materias, { horasSemanaCronograma: 3, duracaoBloco: 1.5 }, {});
assert.strictEqual(noDuplicateCycle.blocks.length, 1, "Um tema com uma única parte não deve ser repetido para preencher a carga do ciclo.");

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

// A prioridade estratégica só desempata conteúdos dentro da fronteira pedagógica.
runtime.state.planningBase.materias = [{ materia: "Direito Administrativo", assuntos: [], peso: 5, dominio: 3, familiarity: "never-studied" }];
runtime.state.rows = [];
runtime.state.generatedBlocks = [];
runtime.state.completedHistory = [];
runtime.state.cycleHistory = [];
runtime.state.cycleResults = [];
runtime.state.reviews = [];
const administrativeSequence = [
  { assunto: "Serviços Públicos", ordem: 4, blocosSugeridos: 1 },
  { assunto: "Estado, Governo e Administração Pública", ordem: 1, blocosSugeridos: 1 },
  { assunto: "Organização Administrativa", ordem: 2, blocosSugeridos: 1 },
  { assunto: "Entidades da Administração Indireta e Terceiro Setor", ordem: 3, blocosSugeridos: 1 },
];
const administrativeFrontier = runtime.pedagogicalFrontier(runtime.state.planningBase.materias[0], administrativeSequence);
assert.deepStrictEqual([...administrativeFrontier.map((unit) => unit.assunto)], ["Estado, Governo e Administração Pública"], "Quem nunca estudou deve receber somente o primeiro fundamento pendente.");
assert.ok(administrativeFrontier.every((unit) => unit.pedagogicalReason), "Cada tema da fronteira precisa registrar a razão pedagógica.");
const administrativeRank = runtime.rankStudyUnitsByAdaptivePriority(runtime.state.planningBase.materias[0], administrativeSequence);
assert.equal(administrativeRank[0].assunto, "Estado, Governo e Administração Pública", "Pontuação estratégica não pode inverter a base e o próximo passo pedagógico.");
runtime.state.reviews = [{ materia: "Direito Administrativo", assunto: "Serviços Públicos", status: "Pendente", dataPrevista: "01/01/2020", tipo: "comum" }];
runtime.state.completedHistory = [{ materia: "Direito Administrativo", assunto: "Serviços Públicos", status: "Concluído", questoes: 20, acertos: 12, tempoEstudado: 1 }];
runtime.invalidateDerivedStudyCaches();
const exceptionalFrontier = runtime.pedagogicalFrontier(runtime.state.planningBase.materias[0], administrativeSequence);
assert.ok(exceptionalFrontier.some((unit) => unit.assunto === "Serviços Públicos" && unit.pedagogicalException.toLowerCase().includes("revisão vencida")), "Revisão vencida permanece uma exceção explícita e auditável.");
runtime.state.reviews = [];

// Cenário CGU: duas matérias muito fortes não podem ocupar um ciclo inteiro
// quando a capacidade comporta uma primeira exposição das 13 ativas.
const cguSubjects = [
  "Língua Portuguesa", "Direito Administrativo", "Direito Constitucional", "AFO", "Administração Pública",
  "Auditoria", "Contabilidade", "Finanças Públicas", "Língua Inglesa", "Discursiva", "Políticas Públicas", "Controle Interno", "Legislação CGU",
].map((materia, index) => {
  const assuntos = [`${materia} base`, `${materia} aprofundamento`];
  return { materia, assuntos, temas: assuntos.map((assunto) => ({ materia, assunto, titulo: assunto, conteudosOriginais: ["conteúdo operacional"], blocosSugeridos: 1 })), peso: index < 2 ? 5 : index < 6 ? 4 : 3, dominio: index < 2 ? 4 : 3 };
});
runtime.state.planningBase.materias = cguSubjects;
runtime.state.rows = cguSubjects.flatMap((subject) => subject.assuntos.map((assunto) => ({ materia: subject.materia, assunto, estudar: "Sim", tamanhoEstimado: "Médio", blocosSugeridos: 1 })));
runtime.state.generatedBlocks = [];
runtime.state.completedHistory = [];
runtime.state.cycleHistory = [];
runtime.state.cycleResults = [];
runtime.state.reviews = [];
const cguCycle = runtime.createAdaptiveCycleBlocks(cguSubjects, { capacidade: { plannedMinutes: 1020 }, horasSemanaCronograma: 17, duracaoBloco: 1 }, {});
const cguFairness = runtime.cycleFairnessDiagnostics(cguCycle.blocks, cguSubjects);
const cguRepeat = cguCycle.blocks.findIndex((block, index) => index && block.materia === cguCycle.blocks[index - 1].materia);
assert.equal(cguFairness.totalBlocks, 17, "A capacidade de 17 horas deve gerar 17 blocos, inclusive etapas futuras reservadas.");
assert.equal(cguFairness.coveredSubjects, 13, "Todas as 13 matérias ativas precisam receber a primeira exposição antes de qualquer avanço.");
assert.equal(cguCycle.diagnostics.executableBlocks, 13, "Somente os fundamentos iniciais ficam executáveis no primeiro momento.");
assert.equal(cguCycle.diagnostics.reservedBlocks, 4, "Os quatro blocos adicionais ficam reservados em cadeia.");
assert.equal(cguCycle.diagnostics.allocatedMinutes, 1020, "A carga planejada de 1.020 minutos precisa ser totalmente aproveitada.");
assert.ok(cguCycle.remainingMinutes < 30, "Não pode sobrar meia hora quando existem conteúdos reserváveis.");
assert.ok((cguFairness.blocksBySubject["Língua Portuguesa"] || 0) <= 2, "Português não pode monopolizar o ciclo inicial.");
assert.ok((cguFairness.blocksBySubject["Direito Administrativo"] || 0) <= 2, "Direito Administrativo não pode monopolizar o ciclo inicial.");
assert.ok(Math.max(...Object.values(cguFairness.blocksBySubject)) <= 3, "O teto normal do cenário CGU vale para toda matéria, não só para as duas mais prioritárias.");
assert.ok(cguFairness.topTwoCombinedShare <= .55, "As duas matérias mais frequentes não podem dominar a semana.");
assert.equal(cguRepeat, -1, "Matérias iguais não podem ficar consecutivas quando há alternativas.");
assert.deepStrictEqual([...cguFairness.fairnessViolations], [], "O cenário CGU normal não pode aceitar violação de fairness.");
assert.deepStrictEqual(runtime.createAdaptiveCycleBlocks(cguSubjects, { capacidade: { plannedMinutes: 1020 }, horasSemanaCronograma: 17, duracaoBloco: 1 }, {}).blocks.map((block) => [block.materia, block.assunto, block.duracao]), cguCycle.blocks.map((block) => [block.materia, block.assunto, block.duracao]), "A mesma entrada CGU deve gerar a mesma composição.");

const smallCapacityDistribution = runtime.distributeBlocks(cguSubjects, 5, { adaptive: true });
assert.equal(smallCapacityDistribution.filter((item) => item.rotationDebt).length, 8, "Capacidade menor registra quais matérias ficam para a próxima rotação.");
runtime.state.cycleHistory = [{ distribution: smallCapacityDistribution, generatedBlocks: [] }];
assert.ok(runtime.cycleAbsenceForSubject(smallCapacityDistribution.find((item) => item.rotationDebt).materia) > runtime.cycleAbsenceForSubject(smallCapacityDistribution.find((item) => !item.rotationDebt).materia), "A dívida de rotação deve aumentar a chance da matéria omitida no ciclo seguinte.");

const sameDay = runtime.assignBlocksToDailyCapacity([
  { materia: "Português", duracao: 1 }, { materia: "Português", duracao: 1 }, { materia: "Direito", duracao: 1 },
], { capacidade: { safetyMargin: 1, dailyHours: { segunda: 2, terca: 1, quarta: 0, quinta: 0, sexta: 0, sabado: 0, domingo: 0 } } });
assert.notEqual(sameDay[0].plannedDay, sameDay[1].plannedDay, "Repetições da mesma matéria devem ir para dias diferentes quando houver alternativa de capacidade.");

function buildFairCycle(subjectCount, topicCount, plannedMinutes, sizeForTopic = () => "Médio") {
  const subjects = Array.from({ length: subjectCount }, (_, index) => {
    const materia = `Matéria ${index + 1}`;
    const assuntos = Array.from({ length: topicCount }, (_, topicIndex) => `${materia} — tema ${topicIndex + 1}`);
    return { materia, assuntos, temas: assuntos.map((assunto) => ({ materia, assunto, titulo: assunto, conteudosOriginais: ["conteúdo"], blocosSugeridos: 1 })), peso: 3, dominio: 3 };
  });
  runtime.state.planningBase.materias = subjects;
  runtime.state.rows = subjects.flatMap((subject) => subject.assuntos.map((assunto, index) => ({ materia: subject.materia, assunto, estudar: "Sim", tamanhoEstimado: sizeForTopic(index), blocosSugeridos: 1 })));
  runtime.state.generatedBlocks = [];
  runtime.state.completedHistory = [];
  runtime.state.cycleHistory = [];
  runtime.state.cycleResults = [];
  runtime.state.reviews = [];
  return runtime.createAdaptiveCycleBlocks(subjects, { capacidade: { plannedMinutes }, horasSemanaCronograma: plannedMinutes / 60, duracaoBloco: 1 }, {});
}

const sixSubjectCycle = buildFairCycle(6, 3, 1080);
const sixSubjectFairness = runtime.cycleFairnessDiagnostics(sixSubjectCycle.blocks, runtime.state.planningBase.materias);
assert.equal(sixSubjectFairness.totalBlocks, 18, "Seis matérias com 18 horas devem preencher os 18 blocos reais.");
assert.equal(sixSubjectFairness.coveredSubjects, 6, "As seis matérias devem aparecer antes de repetições.");
assert.ok(Math.max(...Object.values(sixSubjectFairness.blocksBySubject)) <= 3, "O teto real de três blocos por matéria vale para o ciclo de seis matérias.");
assert.deepStrictEqual([...sixSubjectFairness.fairnessViolations], [], "Um ciclo normal de seis matérias não pode terminar com violação de fairness.");
assert.equal(sixSubjectFairness.longestSubjectSequence, 1, "O ciclo de seis matérias deve alternar matérias quando houver opções.");

const mixedDurationCycle = buildFairCycle(8, 5, 720, (index) => ["Curto", "Médio", "Longo", "Médio", "Curto"][index]);
const mixedDurationFairness = runtime.cycleFairnessDiagnostics(mixedDurationCycle.blocks, runtime.state.planningBase.materias);
assert.ok(mixedDurationCycle.remainingMinutes < 30, "Durações misturadas devem preencher a capacidade até o menor bloco permitido quando houver candidatos.");
assert.deepStrictEqual([...mixedDurationFairness.fairnessViolations], [], "Os limites devem considerar os minutos e blocos reais das oito matérias.");

const smallSubjectCycle = buildFairCycle(3, 5, 675);
assert.equal(smallSubjectCycle.diagnostics.allocatedMinutes, 675, "Com poucas matérias o teto se adapta e não desperdiça capacidade viável.");
assert.deepStrictEqual([...smallSubjectCycle.fairness.fairnessViolations], [], "Poucas matérias não criam uma divisão impossível por regra rígida.");
const fairnessException = runtime.canAddCycleBlock([{ materia: "Crítica", duracao: 1 }, { materia: "Crítica", duracao: 1 }, { materia: "Alternativa", duracao: 1 }, { materia: "Alternativa", duracao: 1 }], { materia: "Crítica", duracao: 1 }, [{ materia: "Crítica" }, { materia: "Alternativa" }, { materia: "Outra" }, { materia: "Quarta" }], "deficiência crítica comprovada", 300);
assert.equal(fairnessException.exception, "deficiência crítica comprovada", "Exceção real de deficiência fica registrada para o bloco que ultrapassa o teto normal.");
assert.equal(runtime.fairnessExceptionReason({}, { level: "critical" }, {}), "deficiência crítica comprovada", "A exceção permitida deve ter justificativa concreta, nunca apenas peso alto.");

console.log("OK - ciclo adaptativo usa cobertura, rotação, duração discreta e filtros da tela Continuar.");
