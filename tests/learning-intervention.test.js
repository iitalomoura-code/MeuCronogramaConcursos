"use strict";

const assert = require("assert");
const engine = require("../js/learning-intervention.js");

function diagnosis(level, accuracy, questions, confidence = .55, trend = "stable") {
  return { level, accuracy, questions, confidence, trend: { label: trend }, action: { kind: "targeted-reinforcement", questions: 10, text: "Faça questões direcionadas." } };
}

function first(before) {
  return engine.update(null, { materia: "Português", assunto: "Pontuação", diagnosis: before, now: new Date("2026-01-01") }).state;
}

function follow(intervention, after, intensidade = "prioritaria") {
  return engine.update({ materia: "Português", assunto: "Pontuação", intensidade, intervencao: intervention }, {
    materia: "Português", assunto: "Pontuação", diagnosis: after, now: new Date("2026-01-04"),
  });
}

let outcome = follow(first(diagnosis("deficiency", .65, 40)), diagnosis("attention", .83, 65));
assert.equal(outcome.outcome.status, "improved", "65% para 83% com amostra adicional deve indicar melhora.");
assert.equal(outcome.state.ineffectiveInterventions, 0, "Melhora deve reduzir a pressão adicional.");

outcome = follow(first(diagnosis("attention", .65, 40)), diagnosis("deficiency", .64, 58), "curta");
assert.equal(outcome.outcome.status, "worse", "Queda com agravamento do diagnóstico deve indicar piora relevante.");
assert.equal(outcome.recommendation.intensity, "prioritaria", "Persistência deve escalar gradualmente a intensidade.");

outcome = follow(first(diagnosis("critical", .50, 45)), diagnosis("critical", .52, 65));
assert.equal(outcome.outcome.status, "unchanged", "Melhora mínima em estado crítico não pode encerrar a recuperação.");

outcome = follow(first(diagnosis("attention", .70, 40)), diagnosis("adequate", .90, 44, .38, "improving"));
assert.equal(outcome.outcome.status, "improving-signal", "Quatro questões excelentes são apenas sinal, não recuperação confirmada.");

outcome = follow(first(diagnosis("attention", .70, 40)), diagnosis("strong", .88, 65, .6, "improving"));
assert.equal(outcome.outcome.status, "resolved", "88% com 25 novas questões e confiança adequada deve confirmar recuperação.");

outcome = follow(first(diagnosis("strong", .88, 50)), diagnosis("attention", .70, 70, .6, "falling"));
assert.equal(outcome.outcome.status, "worse", "Um tema forte deve poder voltar a exigir atenção depois de queda relevante.");

console.log("OK - intervenções adaptativas registram resposta, evitam falsa melhora e escalam com limite.");
