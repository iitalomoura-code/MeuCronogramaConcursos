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

console.log("OK - Orientador Estratégico interpreta diagnósticos existentes sem criar novo score ou alterar a origem.");
