"use strict";

const assert = require("assert");
const fs = require("fs");
const advisor = require("../js/strategic-advisor.js");
const index = fs.readFileSync("index.html", "utf8");
const app = fs.readFileSync("app.js", "utf8");

const topic = (materia, assunto, diagnosis, strategic = {}, extra = {}) => ({
  materia,
  assunto,
  diagnosis: { confidence: .75, trend: { label: "stable" }, hasContact: true, ...diagnosis },
  strategic: { score: .35, scoreComponents: { importance: .5, difficulty: .5 }, learningState: { key: "practice" }, ...strategic },
  ...extra,
});

const input = [
  topic("Contabilidade", "Lançamentos", { level: "deficiency", accuracy: .55, overallAccuracy: .7 }, { score: .86, scoreComponents: { importance: .9, difficulty: .8 } }, { errorSignals: { recurrence: "high" } }),
  topic("RLM", "Lógica", { level: "strong", accuracy: .9 }, { score: .2, scoreComponents: { importance: .8, difficulty: .5 } }),
  topic("Português", "Reescrita", { level: "attention", accuracy: .64, overallAccuracy: .78, trend: { label: "falling" } }, { score: .5 }),
  topic("Aduaneiro", "Regimes", { level: "insufficient", hasContact: false, confidence: .1 }, { score: .6 }, { historyInheritance: { level: "none" }, initialProfile: { level: "never-studied" } }),
  topic("Administrativo", "Atos", { level: "insufficient", hasContact: false, confidence: .2 }, { score: .7 }, { historyInheritance: { level: "strong" } }),
];

const before = JSON.stringify(input);
const model = advisor.build({ topics: input });
assert.equal(model.priorities[0].materia, "Contabilidade", "Matéria importante e deficiente deve liderar a orientação.");
assert.equal(model.reduceLoad[0].materia, "RLM", "Domínio forte e estável deve sugerir redução de carga.");
assert.ok([...model.watch, ...model.priorities].some((item) => item.materia === "Português"), "Queda recente deve gerar observação ou recuperação.");
assert.equal(model.building[0].materia, "Aduaneiro", "Conteúdo nunca estudado deve construir base.");
assert.equal(model.insufficientEvidence[0].materia, "Administrativo", "Base herdada sem dados atuais deve pedir diagnóstico.");
assert.ok(model.priorities[0].reasons.includes("erros recorrentes"), "A recomendação deve preservar os motivos estruturados.");
assert.ok(model.summary.length <= 4, "O resumo estratégico deve permanecer curto.");
assert.ok(model.priorities.length <= 3 && model.reduceLoad.length <= 3 && model.watch.length <= 3, "As seções devem respeitar o limite de itens.");
assert.equal(JSON.stringify(input), before, "O Orientador não pode alterar dados ou scores de origem.");

const localized = advisor.build({ topics: [
  topic("AFO", "Despesa", { level: "strong", accuracy: .9 }, { score: .2, scoreComponents: { importance: .8, difficulty: .9 } }),
  topic("AFO", "Receita", { level: "critical", accuracy: .4 }, { score: .75, scoreComponents: { importance: .4, difficulty: .4 } }),
] });
assert.ok(localized.priorities[0].title.includes("AFO:") && localized.priorities[0].title.includes("Receita"), "Problema localizado deve apontar o assunto sem generalizar a matéria.");
assert.notEqual(advisor.categoryFor(input[3]), "prioritize", "Poucos dados não podem ser classificados como deficiência automaticamente.");
assert.ok(index.includes("js/strategic-advisor.js") && index.indexOf("js/strategic-advisor.js") < index.indexOf("app.js?v="), "O módulo do Orientador deve carregar antes da aplicação.");
assert.ok(index.includes("strategicAdvisorModal") && app.includes("strategicAdvisorCompactMarkup") && app.includes("data-open-strategic-advisor"), "O card compacto e a análise completa devem estar integrados sem nova aba.");
const advisorModalPosition = index.indexOf('id="strategicAdvisorModal"');
const evolutionPanelStart = index.indexOf('id="tab-evolucao"');
const evolutionPanelEnd = index.indexOf("\n        </section>", evolutionPanelStart);
assert.ok(advisorModalPosition > index.lastIndexOf("</main>", advisorModalPosition), "O Orientador completo deve ficar fora da área principal das abas.");
assert.ok(advisorModalPosition > evolutionPanelEnd, "O modal do Orientador não deve ficar dentro de #tab-evolucao.");
assert.ok(!index.slice(advisorModalPosition, index.indexOf("<script", advisorModalPosition)).match(/class="tab-panel"/), "O modal global não deve pertencer a outra aba.");
assert.ok(app.includes('document.body.classList.add("strategic-advisor-open")') && app.includes('document.body.classList.remove("strategic-advisor-open")'), "A visão completa deve controlar o scroll global enquanto estiver aberta.");
assert.ok(index.includes("js/strategic-advisor-history.js") && app.includes("strategicAdvisorSnapshots") && app.includes("data-register-strategic-advisor"), "Marcos estratégicos devem usar a persistência do planejamento e uma ação explícita.");
assert.ok(app.includes("modalPriorities") && app.includes("independentPriorityChanges"), "O modal deve deduplicar matérias mistas e exibir mudanças independentes de prioridade.");
assert.ok(app.includes("strategicAdvisorExecutiveMarkup") && app.includes("Ver análise detalhada"), "O modal deve priorizar uma leitura executiva e manter os detalhes recolhidos.");
assert.ok(app.includes("Maior oportunidade") && app.includes("Monitorar") && app.includes("Manutenção"), "A visão rápida deve apresentar cartões apenas para categorias disponíveis.");
assert.ok(app.indexOf('data-ai-coach-mode="progress-check"') < app.indexOf('data-ai-coach-mode="cycle-review"'), "A evolução deve ser a ação principal do AI Coach.");

const mixedSubject = advisor.build({ topics: [
  topic("AFO", "Receita Pública", { level: "deficiency", accuracy: .55 }, { score: .8 }),
  topic("AFO", "Despesa Pública", { level: "strong", accuracy: .9 }, { score: .2 }),
] });
assert.equal(mixedSubject.reduceLoad.length, 0, "Uma matéria com gargalo não pode receber redução global de carga.");
assert.ok(mixedSubject.priorities[0].title.includes("AFO: Receita Pública"), "A orientação deve permanecer localizada no assunto problemático.");
assert.ok(mixedSubject.mixedSubjects.length, "A matéria mista deve manter sua síntese sem remover a prioridade do modelo.");

const stable = advisor.build({ topics: [
  topic("RLM", "Lógica", { level: "adequate", accuracy: .86 }, { score: .3 }),
  topic("RLM", "Conjuntos", { level: "adequate", accuracy: .84 }, { score: .25 }),
] });
assert.equal(stable.reduceLoad.length, 0, "Uma matéria adequada e estável não deve ser forçada a reduzir carga.");
assert.ok(stable.stability && stable.summary[0].includes("preparação está estável"), "O Orientador deve concluir estabilidade quando nenhuma mudança for necessária.");

const buildingOrder = advisor.build({ topics: [
  topic("Edital A", "Tema", { level: "insufficient", hasContact: false, confidence: 0 }, { score: .3 }, { historyInheritance: { level: "none" } }),
  topic("Edital B", "Tema", { level: "insufficient", hasContact: false, confidence: 0 }, { score: .8 }, { historyInheritance: { level: "none" } }),
  topic("Edital C", "Tema", { level: "insufficient", hasContact: false, confidence: 0 }, { score: .55 }, { historyInheritance: { level: "none" } }),
] });
assert.deepEqual(buildingOrder.building.map((item) => item.materia), ["Edital B", "Edital C", "Edital A"], "Conteúdos em construção devem ser ordenados pelo score estratégico.");
assert.ok(buildingOrder.awaitingEvidence && buildingOrder.summary[0].includes("poucos dados"), "Poucos dados devem gerar orientação cautelosa, não estabilidade.");

const diagnosisOrder = advisor.build({ topics: [
  topic("Legislação A", "Tema", { level: "insufficient", hasContact: false, confidence: .1 }, { score: .25 }, { historyInheritance: { level: "strong" } }),
  topic("Legislação B", "Tema", { level: "insufficient", hasContact: false, confidence: .1 }, { score: .7 }, { historyInheritance: { level: "partial" } }),
  topic("Legislação C", "Tema", { level: "insufficient", hasContact: false, confidence: .1 }, { score: .5 }, { historyInheritance: { level: "strong" } }),
] });
assert.deepEqual(diagnosisOrder.insufficientEvidence.map((item) => item.materia), ["Legislação B", "Legislação C", "Legislação A"], "Conteúdos que pedem diagnóstico devem ser ordenados pelo score estratégico.");

const partiallyCoveredTopics = Array.from({ length: 200 }, (_, index) => topic(`Edital ${index + 1}`, "Tema", { level: "insufficient", hasContact: false, confidence: 0 }, { score: .2 }, { historyInheritance: { level: "none" } }));
partiallyCoveredTopics[0] = topic("Contabilidade", "Lançamentos", { level: "deficiency", accuracy: .55, questions: 80 }, { score: .9 }, { errorSignals: { recurrence: "high" } });
partiallyCoveredTopics[1] = topic("RLM", "Lógica", { level: "strong", accuracy: .9, questions: 50 }, { score: .2 });
for (let index = 2; index < 40; index += 1) {
  partiallyCoveredTopics[index] = topic(`Matéria avaliada ${index}`, "Tema", { level: "adequate", accuracy: .8, questions: 15 }, { score: .4 });
}
const partialCoverage = advisor.build({ topics: partiallyCoveredTopics });
assert.equal(partialCoverage.coverage.level, "partial", "Uma parte relevante de um edital grande deve gerar cobertura parcial.");
assert.equal(partialCoverage.globalAssessment, "partial", "A avaliação global precisa registrar cobertura parcial sem bloquear as decisões locais.");
assert.ok(partialCoverage.summary[0].includes("visão global ainda é parcial"), "O resumo deve contextualizar a cobertura parcial.");
assert.ok(partialCoverage.priorities.some((item) => item.materia === "Contabilidade"), "Deficiência com evidência local forte deve continuar recomendada sob cobertura parcial.");
assert.ok(partialCoverage.reduceLoad.some((item) => item.materia === "RLM"), "Sinal local forte também deve permitir manutenção ou redução sob cobertura parcial.");

const trulyEarly = advisor.build({ topics: [
  topic("Início A", "Tema", { level: "insufficient", hasContact: false, confidence: .1 }, { score: .2 }, { historyInheritance: { level: "none" } }),
  topic("Início B", "Tema", { level: "insufficient", hasContact: false, confidence: .1 }, { score: .2 }, { historyInheritance: { level: "none" } }),
] });
assert.equal(trulyEarly.globalAssessment, "low-evidence", "Pouca evidência sem recomendação local deve manter o fallback cauteloso.");
assert.ok(trulyEarly.summary[0].includes("poucos dados"), "O fallback de poucos dados deve ser preservado quando ele for realmente necessário.");

const lowCoverageWithLocalEvidence = advisor.build({ topics: [
  topic("Contabilidade", "Lançamentos", { level: "deficiency", accuracy: .5, questions: 100 }, { score: .88 }),
  ...Array.from({ length: 199 }, (_, index) => topic(`Sem contato ${index}`, "Tema", { level: "insufficient", hasContact: false, confidence: 0 }, { score: .2 }, { historyInheritance: { level: "none" } })),
] });
assert.equal(lowCoverageWithLocalEvidence.coverage.level, "low", "Pouca cobertura em edital grande deve continuar classificada como baixa.");
assert.ok(lowCoverageWithLocalEvidence.priorities.some((item) => item.materia === "Contabilidade"), "Evidência local forte deve manter a prioridade sob cobertura baixa.");
assert.ok(lowCoverageWithLocalEvidence.summary[0].includes("visão global ainda é limitada"), "Cobertura baixa com evidência local deve ser contextualizada, não descartada.");

const broadCoverage = advisor.build({
  topics: Array.from({ length: 10 }, (_, index) => topic(
    `Coberta ${index}`,
    "Tema",
    { level: index === 0 ? "deficiency" : "adequate", questions: 20, accuracy: index === 0 ? .55 : .82 },
    { score: index === 0 ? .8 : .3 },
  )),
});
assert.equal(broadCoverage.coverage.level, "broad", "Cobertura ampla deve ser reconhecida separadamente.");
assert.ok(!broadCoverage.summary.join(" ").includes("visão global ainda é parcial"), "Cobertura ampla não deve usar linguagem de cobertura parcial.");

const completeMixed = advisor.build({ topics: [
  topic("AFO", "Receita", { level: "deficiency", accuracy: .52, questions: 40 }, { score: .82 }),
  topic("AFO", "Despesa", { level: "strong", accuracy: .9, questions: 40 }, { score: .2 }),
  topic("AFO", "Créditos", { level: "adequate", accuracy: .82, questions: 35 }, { score: .35 }),
] });
assert.equal(completeMixed.reduceLoad.length, 0, "Matéria mista não pode aparecer como redução global de carga.");
assert.equal(completeMixed.mixedSubjects.length, 1, "A matéria com foco e manutenção deve ganhar uma síntese derivada de situação mista.");
assert.deepEqual(completeMixed.mixedSubjects[0].focus, ["Receita"], "A síntese mista deve destacar o assunto que exige reforço.");
assert.deepEqual(completeMixed.mixedSubjects[0].maintain, ["Despesa", "Créditos"], "A síntese mista deve preservar os temas que seguem em manutenção.");
assert.ok(completeMixed.mixedSubjects[0].explanation.includes("enquanto"), "A explicação mista deve ligar o gargalo localizado aos sinais positivos.");

const localizedPositive = advisor.build({ topics: [
  topic("Contabilidade", "Lançamentos", { level: "critical", accuracy: .4, questions: 50 }, { score: .9 }),
  ...["Estoques", "Demonstrações", "Custos", "Ativo", "Passivo"].map((assunto) => topic("Contabilidade", assunto, { level: "strong", accuracy: .9, questions: 35 }, { score: .2 })),
] });
assert.equal(localizedPositive.priorities[0].title, "Contabilidade: Lançamentos", "A prioridade deve continuar localizada no tema crítico.");
assert.equal(localizedPositive.mixedSubjects[0].maintain.length, 5, "Sinais positivos do restante da matéria devem continuar disponíveis na síntese mista.");

const categoryBeforeCoverage = partiallyCoveredTopics.map((item) => advisor.categoryFor(item));
advisor.build({ topics: partiallyCoveredTopics });
assert.deepEqual(partiallyCoveredTopics.map((item) => advisor.categoryFor(item)), categoryBeforeCoverage, "Cobertura global não pode alterar categorias, scores ou diagnósticos existentes.");

console.log("OK - Orientador Estratégico interpreta diagnósticos existentes sem criar novo score ou alterar a origem.");
