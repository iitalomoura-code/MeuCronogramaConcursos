"use strict";

const assert = require("assert");
const engine = require("../js/mastery-diagnosis.js");

function entry(correct, questions, options = {}) {
  return { acertos: correct, questoes: questions, dificuldade: "Média", status: "Concluído", ...options };
}

const lowSample = engine.diagnose({ entries: [entry(6, 7)], importance: .8 });
assert.equal(lowSample.level, "insufficient", "Poucas questões não podem determinar domínio.");
assert.equal(lowSample.action.questions, 10, "Amostra insuficiente deve sugerir sessão diagnóstica.");

const strong = engine.diagnose({ entries: [entry(17, 20), entry(18, 20), entry(17, 20)], importance: .7 });
assert.equal(strong.level, "strong", "Desempenho consistente acima de 85% deve indicar domínio forte.");

const falling = engine.diagnose({ entries: [entry(18, 20), entry(17, 20), entry(9, 20), entry(8, 20)], importance: .8 });
assert.equal(falling.trend.label, "falling", "A queda recente deve ser detectada.");
assert.ok(["deficiency", "critical"].includes(falling.level), "Queda forte não pode ficar escondida pela média histórica.");

const critical = engine.diagnose({ entries: [entry(2, 20, { dificuldade: "Alta" }), entry(3, 20, { dificuldade: "Alta" })], importance: .9, incidence: .8, urgency: .7 });
assert.equal(critical.level, "critical", "Baixo desempenho consistente em tema relevante deve ser crítico.");
assert.equal(critical.action.kind, "deep-recovery");

console.log("OK - motor de domínio pondera amostra, tendência, relevância e desempenho recente.");
