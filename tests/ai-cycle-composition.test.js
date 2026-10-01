"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let backend;
test.before(async () => {
  backend = await import(pathToFileURL(path.resolve(__dirname, "..", "supabase/functions/ai-strategic-coach/index.ts")).href);
});

test("Edge Function aceita somente o modo de composição com a estratégia estruturada", () => {
  assert.ok(backend.COACH_MODES.includes("cycle-composition"));
  assert.ok(backend.reviewSchema.properties.nextCycleStrategy);
  const valid = {
    periodDiagnosis: { summary: "Resumo", confidence: "medium" }, facts: [], interpretation: [], recommendation: [], advances: [], bottlenecks: [], priorities: [], maintenance: [], avoidForNow: [], uncertainties: [], strategicNotes: [], answerToQuestion: null, sinceLastReview: null, cycleEvaluation: null,
    nextCycleStrategy: { summary: "Começar pela base.", recommendations: [] },
  };
  assert.equal(backend.validateReview(valid, "cycle-composition"), true);
  assert.equal(backend.validateReview({ ...valid, nextCycleStrategy: null }, "cycle-composition"), false);
  assert.equal(backend.validateReview({ ...valid, nextCycleStrategy: { summary: "", recommendations: [{ subject: "A" }] } }, "cycle-composition"), false);
});

test("a página carrega o validador de estratégia antes do aplicativo", () => {
  const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /ai-cycle-strategy\.js/);
  assert.ok(html.indexOf("ai-cycle-strategy.js") < html.indexOf("app.js"));
});
