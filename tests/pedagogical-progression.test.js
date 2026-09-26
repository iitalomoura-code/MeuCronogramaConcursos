"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const StudyDerivedState = require("../js/study-derived-state.js");
const ContinueRecommendation = require("../js/continue-recommendation.js");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const cut = app.indexOf("els.tabs.forEach((button) => button.addEventListener");
const runtimeSource = `${app.slice(0, cut)}\nglobalThis.__pedagogicalTest = { state, pedagogicalOrderWithDependencies, pedagogicalProgression, pedagogicalFrontier, pedagogicalDependencyKey, reliableTopicHistory, pedagogicalExceptionFor, isPedagogicallyExecutable, assignBlocksToDailyCapacity, rankedContinueEntries };`;
const noop = () => {};
const context = {
  console, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, structuredClone,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: { querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, documentElement: { dataset: {}, style: { setProperty: noop } }, body: {} },
  window: { setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, addEventListener: noop, matchMedia: () => ({ matches: false }), innerWidth: 1200, StudyDerivedState, ContinueRecommendation },
};
vm.createContext(context);
vm.runInContext(runtimeSource, context);
const runtime = context.__pedagogicalTest;

function reset() {
  runtime.state.rows = [];
  runtime.state.planningBase = { materias: [] };
  runtime.state.generatedBlocks = [];
  runtime.state.completedHistory = [];
  runtime.state.cycleHistory = [];
  runtime.state.cycleResults = [];
  runtime.state.reviews = [];
  runtime.state.initialDiagnosis = [];
}

function subject(materia, familiarity = "unknown") {
  return { materia, assuntos: [], peso: 5, dominio: 3, familiarity };
}

const administrativeTopics = [
  "Estado, Governo e Administração Pública",
  "Organização Administrativa",
  "Poderes Administrativos",
  "Atos Administrativos",
  "Agentes Públicos",
  "Responsabilidade Civil do Estado",
  "Serviços Públicos",
].map((assunto, index) => ({ assunto, ordem: index + 1, blocosSugeridos: 1 }));

const accountingTopics = [
  "Fundamentos e Estrutura Conceitual",
  "Contas, Débito e Crédito",
  "Patrimônio, reconhecimento e mensuração",
  "Fatos contábeis e lançamentos",
  "Demonstrações Contábeis",
].map((assunto, index) => ({ assunto, ordem: index + 1, blocosSugeridos: 1 }));

reset();
assert.deepStrictEqual([...runtime.pedagogicalFrontier(subject("Direito Administrativo", "never-studied"), administrativeTopics).map((item) => item.assunto)], [administrativeTopics[0].assunto], "Direito Administrativo nunca estudado recebe apenas o primeiro fundamento.");
const basicAdministrative = runtime.pedagogicalFrontier(subject("Direito Administrativo", "basic"), administrativeTopics);
assert.deepStrictEqual([...basicAdministrative.map((item) => item.assunto)], [administrativeTopics[0].assunto], "Base fraca mantém apenas o fundamento atual executável.");
const reservedAdministrative = runtime.pedagogicalProgression(subject("Direito Administrativo", "basic"), administrativeTopics);
assert.equal(reservedAdministrative.filter((item) => item.pedagogicalEligibleNow).length, 1, "Somente o primeiro fundamento fica executável imediatamente.");
assert.ok(reservedAdministrative.slice(1).every((item) => item.pedagogicalReservable && item.pedagogicalBlocked), "Conteúdos posteriores podem ser reservados sem serem liberados antes da hora.");
assert.ok(reservedAdministrative[1].pedagogicalPrerequisiteKeys.includes(runtime.pedagogicalDependencyKey(reservedAdministrative[0])), "O próximo conteúdo reservado registra o pré-requisito explícito no bloco.");
const unknownAdministrative = runtime.pedagogicalFrontier(subject("Direito Administrativo", "unknown"), administrativeTopics);
assert.equal(unknownAdministrative[0].pedagogicalReason, "Histórico insuficiente: mantida a sequência inicial");
assert.deepStrictEqual([...runtime.pedagogicalFrontier(subject("Direito Administrativo", "advanced"), administrativeTopics).map((item) => item.assunto)], [administrativeTopics[0].assunto], "Autoavaliação avançada sem evidência específica não libera assuntos aleatórios.");
assert.deepStrictEqual([...runtime.pedagogicalFrontier(subject("Direito Administrativo", "intermediate"), administrativeTopics).map((item) => item.assunto)], [administrativeTopics[0].assunto], "Autoavaliação intermediária sem evidência específica também mantém os fundamentos.");
assert.deepStrictEqual([...runtime.pedagogicalOrderWithDependencies(subject("Direito Administrativo"), administrativeTopics).map((item) => item.assunto)], administrativeTopics.map((item) => item.assunto), "Serviços Públicos permanece depois dos conteúdos intermediários não reconhecidos pelo mapa relativo.");

assert.deepStrictEqual([...runtime.pedagogicalFrontier(subject("Contabilidade", "never-studied"), accountingTopics).map((item) => item.assunto)], [accountingTopics[0].assunto], "Contabilidade nunca estudada inicia pelos fundamentos.");
assert.deepStrictEqual([...runtime.pedagogicalFrontier(subject("Contabilidade", "basic"), accountingTopics).map((item) => item.assunto)], [accountingTopics[0].assunto], "Base fraca em Contabilidade não pula para demonstrações.");
assert.deepStrictEqual([...runtime.pedagogicalOrderWithDependencies(subject("Contabilidade"), accountingTopics).map((item) => item.assunto)], accountingTopics.map((item) => item.assunto), "Contas, fatos e outros conteúdos não reconhecidos conservam a ordem canônica antes das demonstrações.");
const genericTopics = ["Fundamento A", "Aplicação B", "Avançado C"].map((assunto, index) => ({ assunto, ordem: index + 1 }));
assert.deepStrictEqual([...runtime.pedagogicalFrontier(subject("Economia", "basic"), genericTopics).map((item) => item.assunto)], [genericTopics[0].assunto], "Matéria sem mapa explícito usa a ordem canônica de forma conservadora.");

const reliableAttentionDiagnosis = {
  hasContact: true, questions: 30, sessionCount: 3, confidence: .65, accuracy: .72, level: "attention", relevance: .7, daysWithoutContact: 0,
  initialEvidence: { questions: 30, sessions: 3 }, historyInheritance: { level: "none" }, errorSignals: {},
};
const reliableAttention = runtime.reliableTopicHistory({ materia: "Direito Administrativo", assunto: "Serviços Públicos" }, { diagnosis: reliableAttentionDiagnosis, evidence: reliableAttentionDiagnosis.initialEvidence });
assert.equal(reliableAttention.reliable, true, "Atenção com amostra específica suficiente é confiável.");
assert.match(runtime.pedagogicalExceptionFor({ materia: "Direito Administrativo", assunto: "Serviços Públicos" }, { history: reliableAttention }), /atenção com evidência confiável/, "Atenção confiável pode priorizar o ponto fraco específico.");
const weakAttentionDiagnosis = { ...reliableAttentionDiagnosis, hasContact: true, questions: 5, sessionCount: 1, confidence: .1, accuracy: .72, initialEvidence: { questions: 5, sessions: 1 } };
const weakAttention = runtime.reliableTopicHistory({ materia: "Direito Administrativo", assunto: "Serviços Públicos" }, { diagnosis: weakAttentionDiagnosis, evidence: weakAttentionDiagnosis.initialEvidence });
assert.equal(weakAttention.reliable, false, "Amostra fraca de atenção não fura a sequência.");
const deficiencyDiagnosis = { ...reliableAttentionDiagnosis, questions: 24, accuracy: .5, level: "deficiency", initialEvidence: { questions: 24, sessions: 3 } };
const reliableDeficiency = runtime.reliableTopicHistory({ materia: "Contabilidade", assunto: "Demonstrações Contábeis" }, { diagnosis: deficiencyDiagnosis, evidence: deficiencyDiagnosis.initialEvidence });
assert.match(runtime.pedagogicalExceptionFor({ materia: "Contabilidade", assunto: "Demonstrações Contábeis" }, { history: reliableDeficiency }), /desempenho baixo/, "Deficiência específica confiável pode trazer um ponto distante para reforço.");
const recurrentDiagnosis = { ...reliableAttentionDiagnosis, level: "adequate", errorSignals: { recurrence: "high" } };
const recurrentHistory = runtime.reliableTopicHistory({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, { diagnosis: recurrentDiagnosis, evidence: recurrentDiagnosis.initialEvidence });
assert.match(runtime.pedagogicalExceptionFor({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, { history: recurrentHistory }), /erros recorrentes/, "Usuário avançado com histórico específico e erros recorrentes pode reforçar um assunto distante.");

const inheritedDiagnosis = {
  hasContact: false, questions: 0, sessionCount: 0, confidence: 0, accuracy: null, level: "insufficient", initialEvidence: { questions: 0, sessions: 0 }, errorSignals: {},
  historyInheritance: { level: "strong", sources: [{ matchConfidence: "high", matchDirection: "equivalent", confidence: .7, questions: 40, sessions: 3, accuracy: .78, hours: 3 }] },
};
assert.equal(runtime.reliableTopicHistory({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, { diagnosis: inheritedDiagnosis, evidence: inheritedDiagnosis.initialEvidence }).reliable, true, "Histórico herdado equivalente e com evidência real é aproveitado sem contato no plano atual.");
const weakInherited = { ...inheritedDiagnosis, historyInheritance: { level: "partial", sources: [{ matchConfidence: "medium", matchDirection: "partial", confidence: .7, questions: 40, sessions: 3, accuracy: .78, hours: 3 }] } };
assert.equal(runtime.reliableTopicHistory({ materia: "Direito Administrativo", assunto: "Atos Administrativos" }, { diagnosis: weakInherited, evidence: weakInherited.initialEvidence }).reliable, false, "Correspondência herdada fraca não libera o assunto.");

const metaPartOne = { materia: "Contabilidade", assunto: "Patrimônio", metaId: "patrimonio", metaPartKey: "1", ordem: 1 };
const metaPartTwo = { ...metaPartOne, metaPartKey: "2" };
assert.deepStrictEqual([...runtime.pedagogicalFrontier(subject("Contabilidade", "basic"), [metaPartOne, metaPartTwo]).map((item) => item.metaPartKey)], ["1"], "Partes da mesma meta aguardam a conclusão da parte anterior.");
reset();
const firstBlock = { ...metaPartOne, status: "Não iniciado" };
const secondBlock = { ...metaPartTwo, status: "Não iniciado", pedagogicalPrerequisiteKeys: [runtime.pedagogicalDependencyKey(firstBlock)] };
runtime.state.generatedBlocks = [firstBlock, secondBlock];
assert.equal(runtime.isPedagogicallyExecutable(secondBlock), false, "Bloco posterior não pode ser recomendado ou executado antes do pré-requisito.");
assert.deepStrictEqual([...runtime.rankedContinueEntries().map((entry) => entry.block.metaPartKey)], ["1"], "A tela Continuar oculta a parte posterior até o pré-requisito ser concluído.");
firstBlock.status = "Concluído";
assert.equal(runtime.isPedagogicallyExecutable(secondBlock), true, "Conclusão do pré-requisito libera o bloco posterior.");
const thirdBlock = { ...secondBlock, metaPartKey: "3", pedagogicalPrerequisiteKeys: [runtime.pedagogicalDependencyKey(secondBlock)] };
runtime.state.generatedBlocks = [firstBlock, secondBlock, thirdBlock];
assert.equal(runtime.isPedagogicallyExecutable(thirdBlock), false, "A conclusão do primeiro não libera indevidamente o terceiro bloco.");
secondBlock.status = "Concluído";
assert.equal(runtime.isPedagogicallyExecutable(thirdBlock), true, "A conclusão do segundo libera exatamente o terceiro bloco da cadeia.");
const dailyBlocks = [
  { ...firstBlock, status: "Não iniciado", duracao: 1 },
  { ...secondBlock, duracao: 1, pedagogicalPrerequisiteKeys: [runtime.pedagogicalDependencyKey(firstBlock)] },
];
runtime.assignBlocksToDailyCapacity(dailyBlocks, { capacidade: { safetyMargin: 1, dailyHours: { segunda: 1, terca: 1, quarta: 0, quinta: 0, sexta: 0, sabado: 0, domingo: 0 } } });
assert.deepStrictEqual(dailyBlocks.map((block) => block.plannedDay), ["segunda", "terca"], "A distribuição diária coloca o dependente depois do pré-requisito.");
const unorderedDailyBlocks = [
  { ...secondBlock, status: "Não iniciado", duracao: 1, pedagogicalPrerequisiteKeys: [runtime.pedagogicalDependencyKey(firstBlock)] },
  { ...firstBlock, status: "Não iniciado", duracao: 1 },
];
runtime.assignBlocksToDailyCapacity(unorderedDailyBlocks, { capacidade: { safetyMargin: 1, dailyHours: { segunda: 1, terca: 1, quarta: 0, quinta: 0, sexta: 0, sabado: 0, domingo: 0 } } });
assert.deepStrictEqual(unorderedDailyBlocks.map((block) => block.plannedDay), ["terca", "segunda"], "Uma entrada fora de ordem é ordenada topologicamente antes da distribuição diária.");

console.log("OK - progressão pedagógica distingue base, histórico específico, dependências e exceções confiáveis.");
