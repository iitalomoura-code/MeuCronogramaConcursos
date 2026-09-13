"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

const app = fs.readFileSync("app.js", "utf8");
const memory = fs.readFileSync("js/ai-coach-memory.js", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260913_add_ai_coach_study_context.sql", "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

assert.ok(migration.includes("add column if not exists study_context_id text"));
assert.ok(migration.includes("user_id, study_context_id, created_at desc"));
assert.ok(migration.includes("user_id, study_context_id, mode, created_at desc"));
assert.ok(migration.includes("user_id, study_context_id, cycle_id"));
assert.ok(memory.includes('.eq("user_id", userId).eq("study_context_id", context)'), "histórico deve filtrar usuário e cronograma");
assert.ok(memory.includes("study_context_id: context"), "novos reviews devem persistir o contexto");
assert.ok(memory.includes("isForStudyContext(previousReview, context)"), "links anteriores precisam respeitar a mesma fronteira");

const contextSource = section("function aiCoachStudyContextId", "const els = {");
const runtime = {
  state: { currentPlanId: "plan-tce", activeStudyPlanId: "plan-tce" },
  aiCoachUIState: {
    reviews: [{ id: "review-tce" }], studyContextId: "plan-tce", selectedReviewId: "review-tce", loading: true,
    loaded: true, busy: true, busyLabel: "Consultando", lastResponse: { review: {} }, lastError: "erro", saveWarning: "aviso",
  },
  aiCoachContextRevision: 0,
};
vm.createContext(runtime);
vm.runInContext(`${contextSource}; globalThis.contextApi = { aiCoachStudyContextId, resetAICoachContext, aiCoachContextIsCurrent };`, runtime);

assert.equal(runtime.contextApi.aiCoachStudyContextId(), "plan-tce");
runtime.state.currentPlanId = "plan-receita";
runtime.state.activeStudyPlanId = "plan-receita";
assert.equal(runtime.contextApi.resetAICoachContext(), true, "troca de cronograma precisa limpar a memória em cache");
assert.equal(runtime.aiCoachUIState.reviews.length, 0);
assert.equal(runtime.aiCoachUIState.loaded, false);
assert.equal(runtime.aiCoachUIState.lastResponse, null);
assert.equal(runtime.contextApi.aiCoachContextIsCurrent("plan-tce", 0), false, "uma resposta tardia do cronograma anterior não pode atualizar a tela atual");
assert.equal(runtime.contextApi.aiCoachContextIsCurrent("plan-receita", 1), true);
assert.equal(runtime.contextApi.resetAICoachContext(), false, "renders repetidos no mesmo cronograma não devem limpar novamente o contexto");

const requestSource = section("async function requestAICoachAnalysis", "function registerStrategicAdvisorSnapshot");
assert.ok(requestSource.includes("const studyContextId = aiCoachStudyContextId();"));
assert.ok(requestSource.includes("if (!contextIsCurrent()) return;"), "a resposta tardia deve sair silenciosamente da UI atual");
assert.ok(requestSource.includes("studyContextId, previousReview: latest"), "a persistência precisa manter o contexto capturado no começo da requisição");
assert.ok(requestSource.includes("isForStudyContext?.(record, studyContextId)"), "reviews anteriores não podem cruzar cronogramas");

function coachResult() {
  return {
    review: {
      periodDiagnosis: { summary: "Leitura", confidence: "low" }, facts: [], interpretation: [], recommendation: [], advances: [], bottlenecks: [], priorities: [], maintenance: [], avoidForNow: [], uncertainties: [], strategicNotes: [], sinceLastReview: null, cycleEvaluation: null, answerToQuestion: null,
    },
    meta: {},
  };
}

function requestRuntime({ activeContext = "plan-receita", reviews = [], onProvider = null } = {}) {
  const runtime = {
    aiCoachUIState: { reviews, studyContextId: activeContext, busy: false, busyLabel: "", lastError: "", saveWarning: "", lastResponse: null, selectedReviewId: "" },
    els: { strategicAdvisorModal: null },
    window: {
      AIStrategicSnapshot: { buildStrategicSnapshot: () => ({}) },
      AIStrategicCoachClient: { checkProgress: async (_snapshot, context) => { onProvider?.(context, runtime); return coachResult(); }, translatedMessage: () => "erro" },
      AICoachDelta: { compare: () => null },
      AICoachMemory: {
        isForStudyContext: (record, context) => record.study_context_id === context,
        compactCoachReviewForContext: (record) => ({ id: record.id }),
        saveReview: async (options) => { runtime.saved = options; return { id: "saved", study_context_id: options.studyContextId }; },
      },
    },
    getAICoachReviewableCycle: () => null,
    createFocusPerformanceTrace: () => ({}),
    measureFocusPerformance: (_trace, _label, work) => work(),
    markFocusPerformance: () => {},
    reportFocusPerformance: () => {},
    yieldForPaint: async () => {},
    buildCurrentAIStrategicSnapshotAsync: async () => ({ generatedAt: "2026-09-13T00:00:00.000Z", signature: "current" }),
    aiCoachRecordCheckpoint: (record) => record?.checkpoint_json || null,
    renderAICoachSection: () => true,
    scrollAICoachResultIntoView: () => {},
    showToast: () => {},
    aiCoachErrorMessage: () => "erro",
    aiCoachPreparationFailure: () => "erro",
    aiCoachContextRevision: 0,
  };
  runtime.aiCoachStudyContextId = () => activeContext;
  runtime.aiCoachContextIsCurrent = (context) => context === activeContext;
  vm.createContext(runtime);
  vm.runInContext(`${requestSource}; globalThis.request = requestAICoachAnalysis;`, runtime);
  return runtime;
}

test("TCE não fornece histórico, checkpoint ou delta ao primeiro review da Receita", async () => {
  let providerContext;
  const runtime = requestRuntime({
    reviews: [{ id: "tce-review", study_context_id: "plan-tce", checkpoint_json: { totals: { sessions: 215, questions: 2986 } } }],
    onProvider: (context) => { providerContext = context; },
  });
  await runtime.request("progress-check");
  assert.equal(providerContext.previousCoachReview, null);
  assert.equal(providerContext.previousCoachCheckpoint, null);
  assert.equal(providerContext.deltaSinceLastCoachReview, null);
  assert.equal(runtime.saved.studyContextId, "plan-receita");
});

test("resposta tardia permanece arquivada no cronograma de origem e não aparece no novo", async () => {
  const runtime = requestRuntime({
    activeContext: "plan-tce",
    onProvider: (_context, currentRuntime) => { activeContext = "plan-receita"; currentRuntime.aiCoachUIState.studyContextId = "plan-receita"; },
  });
  let activeContext = "plan-tce";
  runtime.aiCoachStudyContextId = () => activeContext;
  runtime.aiCoachContextIsCurrent = (context) => context === activeContext;
  await runtime.request("progress-check");
  assert.equal(runtime.saved.studyContextId, "plan-tce");
  assert.equal(runtime.aiCoachUIState.lastResponse, null);
});

console.log("OK - memória do Coach é isolada por planejamento, preserva legado sem contexto e bloqueia respostas tardias na UI.");
