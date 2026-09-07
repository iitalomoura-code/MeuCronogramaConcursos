"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Mastery = require("../js/mastery-diagnosis.js");
const Policy = require("../js/adaptive-learning-policy.js");
const Intervention = require("../js/learning-intervention.js");
const ErrorAnalysis = require("../js/error-analysis.js");
const Composer = require("../js/study-plan-composer.js");
const Weekly = require("../js/weekly-goal.js");
const Continue = require("../js/continue-recommendation.js");

function entry(correct, questions, extra = {}) {
  return { acertos: correct, questoes: questions, dificuldade: "Média", ...extra };
}

function diagnose(entries, extra = {}) {
  return Mastery.diagnose({ entries, importance: .8, coverage: 1, ...extra });
}

function diagnosis(level, accuracy, questions, confidence = .7, extra = {}) {
  return {
    level, accuracy, questions, confidence, trend: { label: "stable" }, reasons: [`${Math.round((accuracy || 0) * 100)}% nas questões mais recentes`],
    action: { kind: level === "critical" ? "deep-recovery" : level === "insufficient" ? "diagnostic" : "targeted-reinforcement", minutes: 30, questions: 10 },
    ...extra,
  };
}

function adaptiveReviewEngine() {
  const source = fs.readFileSync(path.resolve(__dirname, "../js/adaptive-review.js"), "utf8");
  const context = { window: { LearningIntervention: Intervention }, Date };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.AdaptiveReviewEngine;
}

test("1. novo usuário recebe diagnóstico curto, não estado crítico", () => {
  const result = diagnose([]);
  const decision = Policy.decision({ diagnosis: result });
  assert.equal(result.level, "insufficient");
  assert.equal(decision.kind, "diagnostic");
  assert.equal(decision.questions, 10);
});

test("2. 9/20 cria necessidade adaptativa e chega à recomendação e à semana", () => {
  const result = diagnose([entry(9, 20)]);
  const planning = Policy.decision({ diagnosis: result });
  assert.ok(["deficiency", "critical"].includes(result.level));
  assert.equal(planning.active, true);
  const composed = Composer.composeAdaptiveCandidates({ plannedHours: 4, candidates: [{ key: "pt", materia: "Português", assunto: "Interpretação", diagnosis: result }] });
  assert.equal(composed[0].key, "pt");
  const weekly = Weekly.selectReinforcements(composed);
  assert.equal(weekly[0].blockKey, "pt");
  const ranked = Continue.rank({ entries: [
    { index: 0, block: { materia: "Português", assunto: "Interpretação", status: "Não iniciado" }, derived: { adaptive: { adjustment: result.priorityAdjustment }, diagnosticRecovery: { planning }, review: {}, rotation: {} } },
    { index: 1, block: { materia: "AFO", assunto: "Receita", status: "Não iniciado" }, derived: { adaptive: { adjustment: 0 }, review: {}, rotation: {} } },
  ] });
  assert.equal(ranked[0].block.assunto, "Interpretação");
});

test("3. 6/7 é bom sinal com confiança limitada, não domínio consolidado", () => {
  const result = diagnose([entry(6, 7)]);
  assert.equal(result.level, "insufficient");
  assert.ok(result.confidence < .35);
});

test("4. 60 questões estáveis a 90% produzem domínio forte sem pressão", () => {
  const result = diagnose(Array.from({ length: 6 }, () => entry(9, 10)));
  assert.equal(result.level, "strong");
  assert.equal(Policy.decision({ diagnosis: result }).score, 0);
});

test("5. queda recente é detectada mesmo com histórico anterior forte", () => {
  const result = diagnose([...Array.from({ length: 4 }, () => entry(9, 10)), entry(6, 10), entry(6, 10)]);
  assert.equal(result.trend.label, "falling");
  assert.equal(Policy.decision({ diagnosis: result }).active, true);
});

test("6. melhora após intervenção reduz pressão e pode encerrar recuperação", () => {
  const first = Intervention.update(null, { materia: "AFO", assunto: "Despesa", diagnosis: diagnosis("critical", .55, 20, .6) });
  const improved = Intervention.update({ intervencao: first.state, intensidade: "reforcada" }, { materia: "AFO", assunto: "Despesa", diagnosis: diagnosis("attention", .78, 35, .72) });
  assert.equal(improved.outcome.status, "improved");
  const resolved = Intervention.update({ intervencao: improved.state, intensidade: "prioritaria" }, { materia: "AFO", assunto: "Despesa", diagnosis: diagnosis("strong", .88, 55, .85) });
  assert.equal(resolved.outcome.status, "resolved");
  assert.equal(Policy.decision({ diagnosis: diagnosis("strong", .88, 55, .85), intervention: resolved.state }).active, false);
});

test("7. intervenção sem resposta escala e não repete indefinidamente", () => {
  const first = Intervention.update(null, { materia: "Direito", assunto: "Agentes", diagnosis: diagnosis("critical", .48, 20) });
  const second = Intervention.update({ intervencao: first.state, intensidade: "reforcada" }, { materia: "Direito", assunto: "Agentes", diagnosis: diagnosis("critical", .50, 35) });
  const third = Intervention.update({ intervencao: second.state, intensidade: "reforcada" }, { materia: "Direito", assunto: "Agentes", diagnosis: diagnosis("critical", .49, 50) });
  assert.equal(third.state.ineffectiveInterventions, 2);
  assert.equal(third.recommendation.mode, "deep-recovery");
});

test("8. distração recorrente muda a natureza da intervenção", () => {
  const result = diagnose(Array.from({ length: 5 }, () => entry(9, 10)), { errorSignals: { available: true, recurrence: "high", postInterventionErrors: 2, concentration: .4, trend: "stable", types: ["Distração"] } });
  assert.equal(result.level, "attention");
  assert.equal(result.action.kind, "attention-training");
});

test("9. recuperação não bloqueia a diversidade de conteúdo novo", () => {
  const critical = diagnosis("critical", .4, 30, .8);
  const reinforcements = Weekly.selectReinforcements([{ key: "critical", materia: "Português", assunto: "Pontuação", minutes: 30, diagnosis: critical }]);
  const blocks = [{ key: "critical", materia: "Português", hours: .5, status: "Não iniciado", order: 0 }, ...Array.from({ length: 8 }, (_, index) => ({ key: `new-${index}`, materia: `Matéria ${index}`, hours: .5, status: "Não iniciado", order: index + 1 }))];
  const goal = Weekly.buildWeeklyGoal({ plannedHours: 3, blocks, reinforcementCandidates: [{ key: "critical", materia: "Português", assunto: "Pontuação", minutes: 30, diagnosis: critical }] });
  assert.equal(reinforcements.length, 1);
  assert.ok(goal.plannedBlockKeys.some((key) => key.startsWith("new-")));
});

test("10. prova próxima amplia a camada adaptativa sem mudar o diagnóstico", () => {
  const candidates = ["A", "B", "C"].map((materia) => ({ key: materia, materia, assunto: "Tema", diagnosis: diagnosis("deficiency", .6, 30) }));
  const pre = Composer.composeAdaptiveCandidates({ candidates, plannedHours: 3, examContext: { examPhase: "PRE_NOTICE" } });
  const post = Composer.composeAdaptiveCandidates({ candidates, plannedHours: 3, examContext: { examPhase: "POST_NOTICE", urgency: { value: 1 } } });
  assert.ok(post.length > pre.length);
  assert.equal(post[0].diagnosis.level, pre[0].diagnosis.level);
});

test("11. revisão ruim vira evidência e reduz o domínio", () => {
  const before = diagnose(Array.from({ length: 5 }, () => entry(9, 10)));
  const after = diagnose([...Array.from({ length: 5 }, () => entry(9, 10)), entry(4, 10, { tipoAtividade: "Revisão" })]);
  assert.equal(before.level, "strong");
  assert.notEqual(after.level, "strong");
  assert.equal(Policy.decision({ diagnosis: after }).active, true);
});

test("12. revisão boa mantém domínio e não cria intervenção extraordinária", () => {
  const engine = adaptiveReviewEngine();
  const result = diagnose(Array.from({ length: 6 }, () => entry(9, 10, { tipoAtividade: "Revisão" })));
  const merged = engine.mergeReview(null, { id: "r", sourceKey: "r", materia: "Português", assunto: "Pontuação" }, { percentual: .9, acertos: 9, totalQuestoes: 10, diagnosis: result }, new Date("2026-09-01T12:00:00Z"));
  assert.equal(result.level, "strong");
  assert.equal(merged.record, null);
});

test("13. seleção manual preserva alvo exato e criação é idempotente", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../app.js"), "utf8");
  assert.match(source, /normalizeForMatch\(item\.assunto\) === normalizeForMatch\(assunto\)/);
  assert.match(source, /findIndex\(\(block\) => block\.manualAdaptiveSession === selectionId\)/);
  assert.match(source, /interventionOrigin: "diagnostico"/);
});

test("14. seleção e sessão adaptativa ativa sobrevivem ao snapshot", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../app.js"), "utf8");
  assert.match(source, /adaptiveSelection: state\.adaptiveSelection/);
  assert.match(source, /continueManualOverride = state\.adaptiveSelection/);
  assert.match(source, /persistStandalone: Boolean\(context\.persistStandalone\)/);
  assert.match(source, /!block\.reviewSessionOnly \|\| block\.manualAdaptiveSession/);
});

test("15. tarefa omitida não vira dívida automática no fechamento", () => {
  const closure = Weekly.buildWeeklyClosure({
    performance: { subjects: [] },
    pending: { ongoing: [{ blockKey: "keep", materia: "AFO", assunto: "Receita" }], reprogrammed: [], relevantReviews: [], reinforcements: [] },
  });
  assert.ok(closure.adjustments.some((item) => item.blockKey === "keep"));
  assert.ok(!closure.adjustments.some((item) => item.blockKey === "dropped"));
});

test("invariantes: erro manual e automático da mesma sessão não contam duas vezes", () => {
  const snapshot = ErrorAnalysis.aggregate([
    { id: "auto", materia: "AFO", assunto: "Despesa", sessaoId: "s1", quantidade: 4, automatic: true, data: "2026-09-01" },
    { id: "manual", materia: "AFO", assunto: "Despesa", sessaoId: "s1", quantidade: 1, tipoErro: "Confusão conceitual", data: "2026-09-01" },
  ], [], new Date("2026-09-02").getTime());
  assert.equal(snapshot.byTopic.values().next().value.totalErrors, 4);
});

test("invariantes: mesma entrada produz a mesma recomendação e o histórico não é mutado", () => {
  const input = { entries: [{ index: 0, block: { materia: "A", status: "Não iniciado" }, derived: { adaptive: { adjustment: .2 }, review: {}, rotation: {} } }] };
  const copy = JSON.stringify(input);
  const first = Continue.rank(input);
  const second = Continue.rank(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), copy);
});
