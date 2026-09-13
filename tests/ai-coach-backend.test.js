"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let backend;
test.before(async () => {
  backend = await import(pathToFileURL(path.resolve(__dirname, "..", "supabase/functions/ai-strategic-coach/index.ts")).href);
});

const snapshot = {
  aiReadContractVersion: 1,
  signature: { value: "snapshot-signature" },
  topics: [],
  subjects: [],
  readiness: { exam: null, subjects: [], topics: [] },
  evidenceAuthority: { order: [] },
  instructions: { rules: [] },
  weeklyCycle: { plannedMinutes: 0, remainingMeaning: "capacidade planejada ainda não utilizada" },
};

function body(overrides = {}) {
  return JSON.stringify({
    aiReadContractVersion: 1,
    snapshotSignature: "snapshot-signature",
    snapshot,
    ...overrides,
  });
}

function request({ authorization = "Bearer valid-token", payload = body(), headers = {} } = {}) {
  return new Request("https://example.test/functions/v1/ai-strategic-coach", {
    method: "POST",
    headers: { authorization, "content-type": "application/json", ...headers },
    body: payload,
  });
}

function authClient(userId = "allowed-user", error = null) {
  return { auth: { getUser: async () => ({ data: error ? null : { user: { id: userId } }, error }) } };
}

function review() {
  return {
    periodDiagnosis: { summary: "Leitura estruturada", confidence: "medium" },
    facts: [],
    interpretation: [],
    recommendation: [],
    advances: [],
    bottlenecks: [],
    priorities: [],
    maintenance: [],
    avoidForNow: [],
    uncertainties: [],
    strategicNotes: [],
    answerToQuestion: null,
    sinceLastReview: {
      summary: "",
      advances: [],
      declines: [],
      unchangedImportantAreas: [],
      newRisks: [],
      resolvedRisks: [],
    },
    cycleEvaluation: {
      executionSummary: "",
      strategyEffectiveness: "",
      whatWorked: [],
      whatDidNotWork: [],
      interventionsToKeep: [],
      interventionsToChange: [],
      comparisonWithPreviousCycle: "",
    },
  };
}

function providerResponse(status = 200, value = review()) {
  return new Response(JSON.stringify({ output_text: JSON.stringify(value) }), { status });
}

function handler({ userId = "allowed-user", env = { AI_ALLOWED_USER_ID: "allowed-user", OPENAI_API_KEY: "server-only-key" }, providerFetch = async () => providerResponse(), timeoutMs = 40_000, logger = () => {}, clock = () => new Date("2026-09-12T00:00:00.000Z") } = {}) {
  return backend.createCoachHandler({ authClient: authClient(userId), env, providerFetch, timeoutMs, logger, clock });
}

test("exige Authorization e diferencia autenticação de autorização", async () => {
  const missing = await handler().call(null, request({ authorization: "" }));
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).error.code, "AI_AUTH_REQUIRED");

  const invalid = await backend.createCoachHandler({ authClient: authClient("", new Error("invalid jwt")), env: { AI_ALLOWED_USER_ID: "allowed-user", OPENAI_API_KEY: "key" }, logger: () => {} })(request());
  assert.equal(invalid.status, 401);

  const throwingAuth = await backend.createCoachHandler({ authClient: { auth: { getUser: async () => { throw new Error("auth unavailable"); } } }, env: { AI_ALLOWED_USER_ID: "allowed-user", OPENAI_API_KEY: "key" }, logger: () => {} })(request());
  assert.equal(throwingAuth.status, 401);

  const denied = await handler({ userId: "other-user" })(request());
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, "AI_ACCESS_DENIED");
});

test("valida contrato, registra etapas seguras, chama Responses API com schema e devolve metadata segura", async () => {
  let providerRequest;
  const logs = [];
  const response = await handler({ logger: (event) => logs.push(event), providerFetch: async (url, options) => {
    providerRequest = { url, options };
    return providerResponse();
  } })(request());
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.meta.model, "gpt-5.6-terra");
  assert.equal(payload.meta.snapshotSignature, "snapshot-signature");
  assert.equal(payload.meta.contractVersion, 1);
  assert.equal(providerRequest.url, "https://api.openai.com/v1/responses");
  assert.equal(providerRequest.options.headers.Authorization, "Bearer server-only-key");
  const sent = JSON.parse(providerRequest.options.body);
  assert.equal(sent.model, "gpt-5.6-terra");
  assert.equal(sent.store, false);
  assert.equal(sent.text.format.type, "json_schema");
  assert.equal(sent.text.format.strict, true);
  assert.equal(sent.text.format.schema.additionalProperties, false);
  const providerInput = JSON.parse(sent.input[0].content[0].text);
  assert.equal(providerInput.request.mode, "progress-check");
  assert.deepEqual(providerInput.currentSnapshot, snapshot);
  assert.equal(payload.meta.mode, "progress-check");
  assert.equal(payload.meta.questionIncluded, false);
  assert.deepEqual(logs.map((event) => event.stage), [
    "request-received",
    "auth-ok",
    "allowed-user-ok",
    "openai-key-present",
    "provider-call-start",
    "openai-fetch-start",
    "openai-fetch-response",
  ]);
  assert.deepEqual(logs[0], {
    stage: "request-received",
    mode: "progress-check",
    model: "gpt-5.6-terra",
    timestamp: "2026-09-12T00:00:00.000Z",
    snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
  });
  assert.equal(logs.at(-1).status, 200);
  assert.equal(logs.at(-1).responseOk, true);
});

test("aceita progress-check sob demanda e pergunta com continuidade, sem depender do ciclo", async () => {
  let received;
  const coach = handler({ providerFetch: async (_url, options) => {
    received = JSON.parse(options.body);
    const requestPayload = JSON.parse(received.input[0].content[0].text);
    const answer = requestPayload.request.mode === "question"
      ? { directAnswer: "Leitura baseada nos dados atuais.", supportingFacts: ["Há evidência no snapshot."], interpretation: ["A evolução deve ser lida com o contexto atual."], recommendation: ["Continue acompanhando o diagnóstico."] }
      : null;
    const sinceLastReview = requestPayload.request.mode === "progress-check"
      ? { summary: "Mudanças desde a última análise.", advances: [], declines: [], unchangedImportantAreas: [], newRisks: [], resolvedRisks: [] }
      : null;
    return providerResponse(200, { ...review(), answerToQuestion: answer, sinceLastReview });
  } });
  const context = {
    previousCoachReview: { generatedAt: "2026-09-01T00:00:00.000Z", summary: "Revisão anterior" },
    previousCoachCheckpoint: { snapshotSignature: "previous-signature", generatedAt: "2026-09-01T00:00:00.000Z" },
    deltaSinceLastCoachReview: { newSessions: 1, newQuestions: 10 },
  };
  const progress = await coach(request({ payload: body({ mode: "progress-check", ...context }) }));
  assert.equal(progress.status, 200);
  assert.equal(JSON.parse(received.input[0].content[0].text).request.mode, "progress-check");
  const question = await handler({ providerFetch: async (_url, options) => {
    received = JSON.parse(options.body);
    return providerResponse(200, { ...review(), answerToQuestion: { directAnswer: "Resposta", supportingFacts: [], interpretation: [], recommendation: [] } });
  } })(request({ payload: body({ mode: "question", question: "Como estou evoluindo?", ...context }) }));
  assert.equal(question.status, 200);
  assert.equal((await question.clone().json()).meta.questionIncluded, true);
  const questionPayload = JSON.parse(received.input[0].content[0].text);
  assert.equal(questionPayload.request.question, "Como estou evoluindo?");
  assert.deepEqual(questionPayload.request.previousCoachReview, context.previousCoachReview);
  assert.deepEqual(questionPayload.request.deltaSinceLastCoachReview, context.deltaSinceLastCoachReview);
  assert.deepEqual(questionPayload.request.previousCycleSnapshot, null);
  assert.deepEqual((await question.json()).review.answerToQuestion, { directAnswer: "Resposta", supportingFacts: [], interpretation: [], recommendation: [] });
});

test("rejeita modos e perguntas inválidos", async () => {
  const invalidMode = await handler()(request({ payload: body({ mode: "chat" }) }));
  assert.equal(invalidMode.status, 422);
  const missingQuestion = await handler()(request({ payload: body({ mode: "question" }) }));
  assert.equal(missingQuestion.status, 422);
  assert.equal((await missingQuestion.json()).error.code, "AI_INVALID_QUESTION");
  const oversizedQuestion = await handler()(request({ payload: body({ mode: "question", question: "x".repeat(2001) }) }));
  assert.equal(oversizedQuestion.status, 422);
  assert.equal((await oversizedQuestion.json()).error.code, "AI_INVALID_QUESTION");
});

test("exige resposta específica para o modo question", async () => {
  const response = await handler({ providerFetch: async () => providerResponse(200, review()) })(request({ payload: body({ mode: "question", question: "Como estou evoluindo?" }) }));
  assert.equal(response.status, 502);
});

test("cycle-review recebe snapshot do ciclo anterior separado do contexto do Coach", async () => {
  let received;
  const previousCycleSnapshot = { signature: "previous-cycle-signature", weeklyCycle: { plannedMinutes: 600, executedMinutes: 540 } };
  const cycleEvaluation = { executionSummary: "Execução registrada.", strategyEffectiveness: "A avaliar.", whatWorked: [], whatDidNotWork: [], interventionsToKeep: [], interventionsToChange: [], comparisonWithPreviousCycle: "Comparação disponível." };
  const response = await handler({ providerFetch: async (_url, options) => {
    received = JSON.parse(options.body);
    return providerResponse(200, { ...review(), cycleEvaluation });
  } })(request({ payload: body({ mode: "cycle-review", previousCycleSnapshot }) }));
  assert.equal(response.status, 200);
  const sent = JSON.parse(received.input[0].content[0].text);
  assert.deepEqual(sent.request.previousCycleSnapshot, previousCycleSnapshot);
  assert.deepEqual((await response.json()).review.cycleEvaluation, cycleEvaluation);
});

test("rejeita versão, snapshot e payload grande sem expor detalhes internos", async () => {
  const wrongVersion = await handler()(request({ payload: body({ aiReadContractVersion: 99 }) }));
  assert.equal(wrongVersion.status, 422);
  assert.equal((await wrongVersion.json()).error.code, "AI_CONTRACT_VERSION_UNSUPPORTED");

  const invalid = await handler()(request({ payload: body({ snapshot: { ...snapshot, readiness: null } }) }));
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error.code, "AI_INVALID_SNAPSHOT");

  const large = await handler()(request({ payload: "x".repeat(500 * 1024 + 1) }));
  assert.equal(large.status, 413);
  assert.equal((await large.json()).error.code, "AI_SNAPSHOT_TOO_LARGE");
});

test("diferencia falhas HTTP, rede, parse e schema do provider com logs seguros", async () => {
  const missingKey = await handler({ env: { AI_ALLOWED_USER_ID: "allowed-user" }, logger: () => {} })(request());
  assert.equal(missingKey.status, 500);
  assert.equal((await missingKey.json()).error.code, "AI_CONFIG_MISSING");

  const timeout = await handler({ timeoutMs: 5, providerFetch: () => new Promise(() => {}) })(request());
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error.code, "AI_PROVIDER_TIMEOUT");

  const limited = await handler({ providerFetch: async () => providerResponse(429) })(request());
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "AI_RATE_LIMITED");

  const logs = [];
  const providerFailure = await handler({ logger: (event) => logs.push(event), providerFetch: async () => new Response(JSON.stringify({ error: { code: "model_not_found", type: "invalid_request_error", message: "Modelo indisponível" } }), { status: 400 }) })(request());
  assert.equal(providerFailure.status, 502);
  assert.equal((await providerFailure.json()).error.code, "AI_PROVIDER_HTTP_ERROR");
  assert.deepEqual(logs.find((event) => event.stage === "openai-http"), {
    service: "ai-strategic-coach",
    stage: "openai-http",
    status: 400,
    responseStatus: 400,
    model: "gpt-5.6-terra",
    mode: "progress-check",
    snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
    responseOk: false,
    providerCode: "model_not_found",
    providerType: "invalid_request_error",
    providerMessage: "Modelo indisponível",
  });
  assert.equal(JSON.stringify(logs).includes("server-only-key"), false);
  assert.equal(JSON.stringify(logs).includes("snapshot-signature"), false);

  const network = await handler({ providerFetch: async () => { throw new TypeError("network failure"); } })(request());
  assert.equal(network.status, 502);
  assert.equal((await network.json()).error.code, "AI_PROVIDER_NETWORK_ERROR");

  const parseLogs = [];
  const unreadable = await handler({ logger: (event) => parseLogs.push(event), providerFetch: async () => new Response("not json", { status: 200 }) })(request());
  assert.equal(unreadable.status, 502);
  assert.equal((await unreadable.json()).error.code, "AI_PROVIDER_INVALID_RESPONSE");
  assert.deepEqual(parseLogs.find((event) => event.stage === "provider-parse"), {
    service: "ai-strategic-coach",
    stage: "provider-parse",
    status: 200,
    responseStatus: 200,
    model: "gpt-5.6-terra",
    mode: "progress-check",
    snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
    responseOk: true,
    hasOutputText: false,
    hasOutput: false,
  });

  const schemaLogs = [];
  const invalidResponse = await handler({ logger: (event) => schemaLogs.push(event), providerFetch: async () => providerResponse(200, { periodDiagnosis: {} }) })(request());
  assert.equal(invalidResponse.status, 502);
  assert.equal((await invalidResponse.json()).error.code, "AI_PROVIDER_SCHEMA_MISMATCH");
  const schemaLog = schemaLogs.find((event) => event.stage === "provider-schema-validation");
  assert.equal(schemaLog.stage, "provider-schema-validation");
  assert.equal(schemaLog.hasAnswerToQuestion, false);
  assert.equal(schemaLog.hasSinceLastReview, false);
  assert.equal(schemaLog.hasCycleEvaluation, false);
});

test("registra o disparo do timeout interno antes de responder 504", async () => {
  const logs = [];
  const timeout = await handler({ logger: (event) => logs.push(event), timeoutMs: 5, providerFetch: () => new Promise(() => {}) })(request());
  assert.equal(timeout.status, 504);
  assert.deepEqual(logs.map((event) => event.stage), [
    "request-received",
    "auth-ok",
    "allowed-user-ok",
    "openai-key-present",
    "provider-call-start",
    "openai-fetch-start",
    "openai-timeout-triggered",
  ]);
  assert.deepEqual(logs.at(-1), {
    stage: "openai-timeout-triggered",
    mode: "progress-check",
    model: "gpt-5.6-terra",
    timestamp: "2026-09-12T00:00:00.000Z",
    snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot)),
  });
});

test("aplica rate limit best-effort por usuário", async () => {
  const coach = handler();
  const results = [];
  for (let index = 0; index < 6; index += 1) results.push(await coach(request()));
  assert.deepEqual(results.slice(0, 5).map((item) => item.status), [200, 200, 200, 200, 200]);
  assert.equal(results[5].status, 429);
});

console.log("OK - Edge Function do AI Coach valida JWT, usuário permitido, contrato, provider e resposta estruturada com mocks.");
