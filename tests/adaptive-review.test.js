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

function diagnosis(level, confidence = .7, trend = "stable") {
  return { level, confidence, trend: { label: trend }, reasons: ["resultado de teste"], action: { kind: "test", text: "Ação indicada pelo diagnóstico." } };
}

test("fallback legado segue disponível quando não há diagnóstico", () => assert.equal(engine.classification(0.6, 10).intensity, "prioritaria"));
test("domínio forte não cria revisão extraordinária", () => {
  const result = engine.mergeReview(null, reviewContext(), { ...session(44, 50), diagnosis: diagnosis("strong", .8) }, now);
  assert.equal(result.record, null);
});
test("82% não é considerado resolvido só por superar a antiga régua de 80%", () => {
  const result = engine.mergeReview(null, reviewContext(), { ...session(41, 50), diagnosis: diagnosis("attention", .8) }, now);
  assert.equal(result.record.intensidade, "curta");
});
test("deficiência gera reforço direcionado", () => {
  const result = engine.mergeReview(null, reviewContext(), { ...session(36, 50), diagnosis: diagnosis("deficiency") }, now);
  assert.equal(result.record.intensidade, "prioritaria");
});
test("estado crítico gera revisão aprofundada", () => {
  const result = engine.mergeReview(null, reviewContext(), { ...session(20, 50), diagnosis: diagnosis("critical") }, now);
  assert.equal(result.record.intensidade, "reforcada");
});
test("dados insuficientes não criam revisão automática", () => {
  const result = engine.mergeReview(null, reviewContext(), { ...session(5, 5), diagnosis: diagnosis("insufficient", .15) }, now);
  assert.equal(result.record, null);
  assert.equal(result.insufficient, true);
});
test("menos de 10 questões permite criação manual", () => {
  const result = engine.mergeReview(null, reviewContext(), session(4, 9), now, true);
  assert.equal(result.record.intensidade, "curta");
});
test("revisão existente é atualizada sem duplicidade", () => {
  const first = engine.mergeReview(null, reviewContext(), { ...session(6, 10), diagnosis: diagnosis("attention") }, now).record;
  const updated = engine.mergeReview(first, reviewContext(), { ...session(5, 10), diagnosis: diagnosis("attention") }, now).record;
  assert.equal(updated.id, first.id);
  assert.equal(updated.tentativas.length, 2);
});
test("melhora posterior reduz intensidade", () => {
  const first = engine.mergeReview(null, reviewContext(), { ...session(3, 10), diagnosis: diagnosis("critical") }, now).record;
  const updated = engine.mergeReview(first, reviewContext(), { ...session(6, 10), diagnosis: diagnosis("deficiency") }, now).record;
  assert.equal(updated.intensidade, "prioritaria");
});
test("apenas domínio forte confirmado encerra revisão existente", () => {
  const first = engine.mergeReview(null, reviewContext(), { ...session(5, 10), diagnosis: diagnosis("deficiency") }, now).record;
  const updated = engine.mergeReview(first, reviewContext(), { ...session(9, 10), diagnosis: diagnosis("strong", .8) }, now).record;
  assert.equal(updated.status, "Concluída");
});
test("piora posterior aumenta intensidade", () => {
  const first = engine.mergeReview(null, reviewContext(), { ...session(7, 10), diagnosis: diagnosis("attention") }, now).record;
  const updated = engine.mergeReview(first, reviewContext(), { ...session(2, 10), diagnosis: diagnosis("critical") }, now).record;
  assert.equal(updated.intensidade, "reforcada");
});
test("registro legado sem tentativas continua compatível", () => {
  const legacy = { id: reviewContext().id, sourceKey: reviewContext().sourceKey, tipo: "adaptativa", materia: "Direito Financeiro", assunto: "Despesa Pública", intensidade: "curta", status: "Pendente" };
  const updated = engine.mergeReview(legacy, reviewContext(), { ...session(6, 10), diagnosis: diagnosis("attention") }, now).record;
  assert.equal(updated.tentativas.length, 1);
});
test("assunto inválido não gera registro", () => {
  const result = engine.mergeReview(null, { id: "", materia: "", assunto: "" }, session(4, 10), now);
  assert.equal(result.invalid, true);
  assert.equal(result.record, null);
});
test("cancelamento preserva histórico em nova tentativa", () => {
  const first = engine.mergeReview(null, reviewContext(), { ...session(5, 10), diagnosis: diagnosis("deficiency") }, now).record;
  first.status = "Cancelada";
  const updated = engine.mergeReview(first, reviewContext(), { ...session(5, 10), diagnosis: diagnosis("deficiency") }, now).record;
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
