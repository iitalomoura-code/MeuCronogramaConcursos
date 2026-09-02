"use strict";

const assert = require("assert");
const view = require("../js/learning-diagnosis-view.js");

const topic = (materia, assunto, level, extras = {}) => ({
  materia,
  assunto,
  diagnosis: { level, action: { label: "Manter contato", minutes: 45, questions: 10, text: "Acompanhe pelo próximo ciclo." }, trend: { label: "stable" }, confidence: .8, accuracy: .82 },
  errorSignals: { available: true, ...extras.errorSignals },
  ...extras,
});

const model = view.build({ topics: [
  topic("Português", "Pontuação", "critical", { errorSignals: { recurrence: "high", sessionsWithErrors: 5, postInterventionErrors: 2 } }),
  topic("Português", "Interpretação", "strong"),
  topic("AFO", "Despesa pública", "adequate"),
  topic("AFO", "Receita pública", "insufficient"),
] });

assert.equal(model.counts.strong, 1, "Domínio forte deve ter contagem própria.");
assert.equal(model.counts.deficiency, 1, "Crítico e deficiência devem ficar na mesma leitura de atenção prioritária.");
assert.equal(model.counts.insufficient, 1, "A falta de dados não pode virar domínio ou deficiência automaticamente.");
assert.equal(model.priorities[0].assunto, "Pontuação", "Persistência após reforço deve aparecer antes das demais prioridades.");
assert.equal(model.errorPatterns[0].assunto, "Pontuação", "Erros recorrentes devem alimentar a área de padrões.");

const filtered = view.render(model, { subject: "Português", status: "deficiency", escape: (value) => String(value) });
assert.ok(filtered.includes("Pontuação"), "O filtro de deficiência deve manter o tema crítico.");
assert.ok(!filtered.includes("Interpretação"), "O filtro de deficiência não deve misturar temas fortes.");

console.log("OK - diagnóstico de aprendizagem organiza prioridades, evidências e filtros sem recalcular o motor de domínio.");
