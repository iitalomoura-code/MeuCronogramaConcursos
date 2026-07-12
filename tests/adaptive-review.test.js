"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "../js/adaptive-review.js"), "utf8");
const context = { window: {}, Date };
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(source, context, { filename: "adaptive-review.js" });
const engine = context.window.AdaptiveReviewEngine;

const tests = [];
function test(name, run) { tests.push({ name, run }); }
function session(correct, total, dificuldade = "Média") {
  return { percentual: total ? correct / total : 0, acertos: correct, totalQuestoes: total, dificuldade };
}
function reviewContext() {
  return { id: "adaptive::plan::direito::despesa", sourceKey: "adaptive::plan::direito::despesa", concursoId: "plan", materia: "Direito Financeiro", assunto: "Despesa Pública", ciclo: "Ciclo 1" };
}
const now = new Date("2026-07-11T12:00:00");

test("81% não cria revisão", () => assert.equal(engine.classification(0.81, 10).automatic, false));
test("80% cria revisão curta", () => assert.equal(engine.classification(0.8, 10).intensity, "curta"));
test("61% cria revisão curta", () => assert.equal(engine.classification(0.61, 10).intensity, "curta"));
test("60% cria revisão prioritária", () => assert.equal(engine.classification(0.6, 10).intensity, "prioritaria"));
test("41% cria revisão prioritária", () => assert.equal(engine.classification(0.41, 10).intensity, "prioritaria"));
test("40% cria revisão reforçada", () => assert.equal(engine.classification(0.4, 10).intensity, "reforcada"));
test("menos de 10 questões não cria automaticamente", () => assert.equal(engine.mergeReview(null, reviewContext(), session(4, 9), now).record, null));
test("menos de 10 questões permite criação manual", () => {
  const result = engine.mergeReview(null, reviewContext(), session(4, 9), now, true);
  assert.equal(result.record.intensidade, "curta");
});
test("revisão existente é atualizada sem duplicidade", () => {
  const first = engine.mergeReview(null, reviewContext(), session(6, 10), now).record;
  const updated = engine.mergeReview(first, reviewContext(), session(5, 10), now).record;
  assert.equal(updated.id, first.id);
  assert.equal(updated.tentativas.length, 2);
});
test("melhora posterior reduz intensidade", () => {
  const first = engine.mergeReview(null, reviewContext(), session(3, 10), now).record;
  const updated = engine.mergeReview(first, reviewContext(), session(6, 10), now).record;
  assert.equal(updated.intensidade, "prioritaria");
});
test("acima de 80% conclui revisão existente", () => {
  const first = engine.mergeReview(null, reviewContext(), session(5, 10), now).record;
  const updated = engine.mergeReview(first, reviewContext(), session(9, 10), now).record;
  assert.equal(updated.status, "Concluída");
});
test("piora posterior aumenta intensidade", () => {
  const first = engine.mergeReview(null, reviewContext(), session(7, 10), now).record;
  const updated = engine.mergeReview(first, reviewContext(), session(2, 10), now).record;
  assert.equal(updated.intensidade, "reforcada");
});
test("registro legado sem tentativas continua compatível", () => {
  const legacy = { id: reviewContext().id, sourceKey: reviewContext().sourceKey, tipo: "adaptativa", materia: "Direito Financeiro", assunto: "Despesa Pública", intensidade: "curta", status: "Pendente" };
  const updated = engine.mergeReview(legacy, reviewContext(), session(6, 10), now).record;
  assert.equal(updated.tentativas.length, 1);
});
test("assunto inválido não gera registro", () => {
  const result = engine.mergeReview(null, { id: "", materia: "", assunto: "" }, session(4, 10), now);
  assert.equal(result.invalid, true);
  assert.equal(result.record, null);
});
test("cancelamento preserva histórico em nova tentativa", () => {
  const first = engine.mergeReview(null, reviewContext(), session(5, 10), now).record;
  first.status = "Cancelada";
  const updated = engine.mergeReview(first, reviewContext(), session(5, 10), now).record;
  assert.equal(updated.tentativas.length, 1);
});
test("impacto na prioridade possui limite", () => {
  assert.ok(engine.priorityImpact("reforcada") <= 0.14);
  assert.equal(engine.priorityImpact("inexistente"), 0);
});

let failed = 0;
tests.forEach((item) => {
  try {
    item.run();
    console.log("OK - " + item.name);
  } catch (error) {
    failed += 1;
    console.error("FALHOU - " + item.name + ": " + error.message);
  }
});
console.log((tests.length - failed) + "/" + tests.length + " testes aprovados.");
process.exitCode = failed ? 1 : 0;
