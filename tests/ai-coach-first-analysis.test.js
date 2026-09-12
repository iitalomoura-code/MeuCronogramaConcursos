"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const app = fs.readFileSync("app.js", "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const helperSource = section("function aiCoachRecordReview", "function getAICoachReviewableCycle");
const helperContext = { window: {} };
vm.createContext(helperContext);
vm.runInContext(`${helperSource}; globalThis.helpers = { aiCoachRecordReview, aiCoachRecordCheckpoint, aiCoachRecordDate };`, helperContext);

assert.equal(Object.keys(helperContext.helpers.aiCoachRecordReview(null)).length, 0, "review nulo deve ter corpo neutro");
assert.equal(helperContext.helpers.aiCoachRecordCheckpoint(null), null, "checkpoint nulo deve permanecer nulo");
assert.equal(helperContext.helpers.aiCoachRecordDate(null), "", "data nula deve permanecer vazia");

const requestSource = section("async function requestAICoachAnalysis", "function registerStrategicAdvisorSnapshot");
let calls = 0;
let receivedContext;
const runtime = {
  aiCoachUIState: { reviews: [], busy: false, busyLabel: "", lastError: "", saveWarning: "", lastResponse: null },
  els: { strategicAdvisorModal: null },
  window: {
    AIStrategicCoachClient: {
      checkProgress: async (_snapshot, context) => {
        calls += 1;
        receivedContext = context;
        return { review: { periodDiagnosis: { summary: "Leitura inicial", confidence: "medium" }, facts: [], interpretation: [], recommendation: [], advances: [], bottlenecks: [], priorities: [], maintenance: [], avoidForNow: [], uncertainties: [], strategicNotes: [], sinceLastReview: null, cycleEvaluation: null, answerToQuestion: null }, meta: {} };
      },
      translatedMessage: () => "Não foi possível concluir a análise agora.",
    },
    AICoachDelta: { compare: () => null },
    AICoachMemory: {
      compactCoachReviewForContext: () => null,
      saveReview: async () => ({ id: "first-review" }),
    },
  },
  getAICoachReviewableCycle: () => null,
  createFocusPerformanceTrace: () => ({}),
  measureFocusPerformance: (_trace, _label, work) => work(),
  reportFocusPerformance: () => {},
  yieldForInteraction: async () => {},
  buildCurrentAIStrategicSnapshot: () => ({ generatedAt: "2026-09-12T00:00:00.000Z", signature: "initial" }),
  aiCoachRecordCheckpoint: () => null,
  renderAICoachSection: () => true,
  scrollAICoachResultIntoView: () => {},
  showToast: () => {},
  aiCoachErrorMessage: () => "Não foi possível concluir a análise agora.",
};
vm.createContext(runtime);
vm.runInContext(`${requestSource}; globalThis.requestAICoachAnalysis = requestAICoachAnalysis;`, runtime);

(async () => {
  await runtime.requestAICoachAnalysis("progress-check");
  assert.equal(calls, 1, "a primeira análise deve chamar checkProgress uma única vez");
  assert.equal(receivedContext.previousCoachReview, null);
  assert.equal(receivedContext.previousCoachCheckpoint, null);
  assert.equal(receivedContext.deltaSinceLastCoachReview, null);
  assert.equal(runtime.aiCoachUIState.lastResponse.review.periodDiagnosis.summary, "Leitura inicial", "o resultado inicial precisa ser exibível");
  assert.equal(runtime.aiCoachUIState.lastError, "", "a primeira análise não pode gerar erro");
  console.log("OK - primeira análise do Coach aceita ausência de histórico e cria o primeiro checkpoint.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
