"use strict";

const assert = require("assert");
const view = require("../js/learning-diagnosis-view.js");

const topic = (materia, assunto, level, extras = {}) => {
  const { diagnosis: diagnosisExtras = {}, errorSignals = {}, ...rest } = extras;
  return {
    materia,
    assunto,
    diagnosis: { level, action: { label: "Manter contato", minutes: 45, questions: 10, text: "Acompanhe pelo próximo ciclo." }, trend: { label: "stable" }, confidence: .8, accuracy: .82, ...diagnosisExtras },
    errorSignals: { available: true, ...errorSignals },
    ...rest,
  };
};

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

const filtered = view.render(model, { subject: "Português", status: "deficiency", expandedSubjects: new Set(["Português"]), escape: (value) => String(value) });
assert.ok(filtered.includes("Pontuação"), "O filtro de deficiência deve manter o tema crítico.");
assert.ok(!filtered.includes("Interpretação"), "O filtro de deficiência não deve misturar temas fortes.");

const mainView = view.render(model, { escape: (value) => String(value) });
assert.ok(mainView.includes("Domínio forte") && mainView.includes("Atenção") && mainView.includes("Mais dados"), "O resumo principal deve consolidar a leitura em três grupos.");
assert.ok(!mainView.includes("Onde agir agora"), "A página principal não deve renderizar prioridades de melhoria.");
assert.ok(!mainView.includes("Meus padrões de erro") && !mainView.includes("Resposta aos reforços"), "Padrões de erro e resposta aos reforços não devem aparecer como seções principais.");
assert.ok(!mainView.includes("Próxima ação</span>"), "Ações detalhadas não devem dominar a visualização inicial.");
assert.ok(mainView.includes("aria-expanded=\"false\"") && mainView.includes("Ver mapa completo de assuntos"), "Matérias e mapa completo devem iniciar recolhidos.");
assert.match(mainView, /<details class="learning-diagnosis-map[\s\S]*80%/, "A confiança numérica deve permanecer acessível apenas no mapa recolhido.");

const expanded = view.render(model, { subject: "Português", expandedSubjects: new Set(["Português"]), escape: (value) => String(value) });
assert.ok(expanded.includes("aria-expanded=\"true\"") && expanded.includes("Interpretação"), "Uma matéria expandida deve revelar seus assuntos.");
assert.ok(expanded.includes("Ver detalhes") && expanded.includes("Desempenho recente") && expanded.includes("Confiança"), "Os dados técnicos devem continuar acessíveis dentro dos detalhes do assunto.");

const severityOrder = view.build({ topics: [
  topic("AFO", "Poucos dados", "insufficient"),
  topic("AFO", "Tema crítico", "critical"),
] });
assert.equal(severityOrder.priorities[0].assunto, "Tema crítico", "Um tema crítico não pode ficar atrás de um tema com poucos dados em condições equivalentes.");

const origins = view.build({ topics: [
  topic("Histórico", "Tema anterior", "adequate", { diagnosis: { diagnosisOrigin: "previous-history" }, daysWithoutContact: 15 }),
  topic("Misto", "Tema atual", "adequate", { diagnosis: { diagnosisOrigin: "mixed" }, daysWithoutContact: 0 }),
] });
const originDetails = view.render(origins, { expandedSubjects: new Set(["Histórico", "Misto"]), escape: (value) => String(value) });
assert.ok(originDetails.includes("Histórico de ciclos anteriores"), "A origem anterior deve vir do diagnóstico do assunto.");
assert.ok(originDetails.includes("Histórico + dados atuais"), "A origem mista deve vir do diagnóstico do assunto.");
assert.ok(originDetails.includes("15 dias atrás") && originDetails.includes("Hoje ou sem registro anterior"), "Cada assunto deve mostrar a própria recência.");

const mostlyConsistent = view.build({ topics: [
  ...Array.from({ length: 8 }, (_, index) => topic("Contabilidade", `Forte ${index}`, "strong")),
  ...Array.from({ length: 4 }, (_, index) => topic("Contabilidade", `Adequado ${index}`, "adequate")),
  topic("Contabilidade", "Gargalo", "critical"),
] });
const contabilidade = mostlyConsistent.subjects[0];
assert.equal(contabilidade.visualState.label, "Com pontos de atenção", "Uma exceção crítica não pode virar rótulo absoluto da matéria.");
const consistent = view.build({ topics: [topic("AFO", "Receita", "strong"), topic("AFO", "Despesa", "adequate")] });
assert.equal(consistent.subjects[0].visualState.label, "Base consistente", "Matéria predominantemente consolidada deve mostrar base consistente.");
const building = view.build({ topics: [topic("Direito", "Tema 1", "insufficient"), topic("Direito", "Tema 2", "insufficient"), topic("Direito", "Tema 3", "insufficient"), topic("Direito", "Tema 4", "adequate")] });
assert.equal(building.subjects[0].visualState.label, "Em construção", "Predomínio de falta de evidência deve ser apresentado como construção.");
const criticalTopic = view.render(mostlyConsistent, { expandedSubjects: new Set(["Contabilidade"]), escape: (value) => String(value) });
assert.ok(criticalTopic.includes("Gargalo") && criticalTopic.includes(">Crítico<"), "O estado crítico deve permanecer visível no assunto expandido.");

console.log("OK - diagnóstico de aprendizagem organiza prioridades, evidências e filtros sem recalcular o motor de domínio.");
