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

const eightyTwo = engine.diagnose({ entries: [entry(41, 50)], importance: .7 });
assert.notEqual(eightyTwo.level, "strong", "82% não pode ser tratado como domínio forte somente pela antiga régua de 80%.");
assert.ok(["attention", "adequate"].includes(eightyTwo.level), "82% estável deve seguir o estado central de atenção ou adequado.");

const targeted = engine.diagnose({
  entries: [entry(16, 20), entry(16, 20), entry(16, 20), entry(15, 20), entry(15, 20), entry(15, 20), entry(15, 20), entry(12, 20, { status: "Reprogramar" }), entry(12, 20, { status: "Reprogramar" }), entry(12, 20)],
  importance: .9,
  incidence: .8,
});
assert.equal(targeted.level, "deficiency", "72% com relevância alta e erros recorrentes deve pedir reforço direcionado.");
assert.equal(targeted.action.kind, "targeted-reinforcement");

const tinyExcellentSample = engine.diagnose({ entries: [entry(4.5, 5)], importance: .8 });
assert.equal(tinyExcellentSample.level, "insufficient", "Cinco ou poucas questões excelentes não devem declarar domínio forte.");
assert.ok(tinyExcellentSample.confidence < .45, "A confiança deve continuar baixa com pouca evidência.");

const highButFalling = engine.diagnose({ entries: [entry(19, 20), entry(18, 20), entry(16, 20), entry(16, 20)], importance: .8 });
assert.equal(highButFalling.trend.label, "falling", "A queda consistente precisa ser preservada no diagnóstico.");
assert.notEqual(highButFalling.level, "strong", "Uma queda recente não pode ser ignorada por uma média acima de 85%.");

const falling = engine.diagnose({ entries: [entry(18, 20), entry(17, 20), entry(9, 20), entry(8, 20)], importance: .8 });
assert.equal(falling.trend.label, "falling", "A queda recente deve ser detectada.");
assert.ok(["deficiency", "critical"].includes(falling.level), "Queda forte não pode ficar escondida pela média histórica.");

const critical = engine.diagnose({ entries: [entry(2, 20, { dificuldade: "Alta" }), entry(3, 20, { dificuldade: "Alta" })], importance: .9, incidence: .8, urgency: .7 });
assert.equal(critical.level, "critical", "Baixo desempenho consistente em tema relevante deve ser crítico.");
assert.equal(critical.action.kind, "deep-recovery");

const recurringErrors = engine.diagnose({
  entries: [entry(15, 20), entry(15, 20), entry(15, 20)],
  importance: .7,
  errorSignals: { available: true, recurrence: "high", sessionsWithErrors: 5, postInterventionErrors: 3, concentration: .4, trend: "stable" },
});
assert.ok(recurringErrors.reasons.some((reason) => reason.includes("erros persistentes após reforço")), "Erros posteriores ao reforço devem alimentar o diagnóstico central.");
assert.equal(recurringErrors.action.kind, "deep-recovery", "Persistência após reforço deve orientar uma abordagem aprofundada.");

console.log("OK - motor de domínio pondera amostra, tendência, relevância e desempenho recente.");
