"use strict";

const assert = require("assert");
const engine = require("../js/evolution-diagnosis.js");

function diagnosis(level, options = {}) {
  return { level, confidence: .75, trend: { label: "stable" }, reasons: [], action: { kind: "maintain", label: "Manter contato", text: "Mantenha o contato normal." }, ...options };
}

const controlled = engine.subjectRisk({ coverage: .95, priority: .9, incidence: .8, remainingHours: .5, diagnosis: diagnosis("strong"), topicDiagnoses: [{ assunto: "Interpretação", diagnosis: diagnosis("strong") }] }, { weeksToExam: 4 });
assert.equal(controlled.level, "Sob controle", "Prioridade alta não deve gerar risco com domínio e cobertura bons.");

const specificWeakness = engine.subjectRisk({ coverage: .8, priority: .7, diagnosis: diagnosis("strong"), topicDiagnoses: [{ assunto: "Pontuação", diagnosis: diagnosis("deficiency") }, { assunto: "Semântica", diagnosis: diagnosis("attention") }] }, { weeksToExam: 12 });
assert.equal(specificWeakness.level, "Atenção", "Deficiência específica não pode ser escondida pela média da matéria.");
assert.equal(specificWeakness.diagnosis.assunto, "Pontuação");

const urgent = engine.subjectRisk({ coverage: .3, priority: .85, incidence: .8, remainingHours: 8, diagnosis: diagnosis("critical"), topicDiagnoses: [{ assunto: "Controle", diagnosis: diagnosis("critical") }] }, { weeksToExam: 4 });
assert.equal(urgent.level, "Prioridade", "Tema crítico, cobertura baixa e pouco prazo exigem prioridade.");

const lowIncidence = engine.subjectRisk({ coverage: .88, priority: .3, incidence: .2, daysWithoutContact: 16, diagnosis: diagnosis("strong"), topicDiagnoses: [{ assunto: "Tema estável", diagnosis: diagnosis("strong") }] }, { weeksToExam: 12 });
assert.equal(lowIncidence.level, "Sob controle", "Tempo moderado sem contato não deve elevar matéria de baixa relevância bem coberta.");

const insufficient = engine.deficiencyTopics([{ materia: "AFO", relevance: .8, topicDiagnoses: [{ assunto: "Receita", relevance: .8, diagnosis: diagnosis("insufficient", { confidence: .15, action: { kind: "diagnostic", label: "Sessão diagnóstica", text: "Faça 10 questões diagnósticas." } }) }] }]);
assert.equal(insufficient[0].assunto, "Receita", "Tema importante com poucos dados deve aparecer no mapa de deficiências.");

console.log("OK - diagnóstico de evolução combina domínio central, cobertura e prazo sem nova régua de desempenho.");
