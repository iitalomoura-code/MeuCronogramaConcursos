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
  };
}

function providerResponse(status = 200, value = review()) {
  return new Response(JSON.stringify({ output_text: JSON.stringify(value) }), { status });
}

function handler({ userId = "allowed-user", env = { AI_ALLOWED_USER_ID: "allowed-user", OPENAI_API_KEY: "server-only-key" }, providerFetch = async () => providerResponse(), timeoutMs = 40_000 } = {}) {
  return backend.createCoachHandler({ authClient: authClient(userId), env, providerFetch, timeoutMs });
}

test("exige Authorization e diferencia autenticação de autorização", async () => {
  const missing = await handler().call(null, request({ authorization: "" }));
  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).error.code, "AI_AUTH_REQUIRED");

  const invalid = await backend.createCoachHandler({ authClient: authClient("", new Error("invalid jwt")), env: { AI_ALLOWED_USER_ID: "allowed-user", OPENAI_API_KEY: "key" } })(request());
  assert.equal(invalid.status, 401);

  const throwingAuth = await backend.createCoachHandler({ authClient: { auth: { getUser: async () => { throw new Error("auth unavailable"); } } }, env: { AI_ALLOWED_USER_ID: "allowed-user", OPENAI_API_KEY: "key" } })(request());
  assert.equal(throwingAuth.status, 401);

  const denied = await handler({ userId: "other-user" })(request());
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, "AI_ACCESS_DENIED");
});

test("valida contrato, chama Responses API com schema e devolve metadata segura", async () => {
  let providerRequest;
  const response = await handler({ providerFetch: async (url, options) => {
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

test("mapeia configuração ausente, timeout, 429, provider 500 e resposta fora do schema", async () => {
  const missingKey = await handler({ env: { AI_ALLOWED_USER_ID: "allowed-user" } })(request());
  assert.equal(missingKey.status, 500);
  assert.equal((await missingKey.json()).error.code, "AI_CONFIG_MISSING");

  const timeout = await handler({ timeoutMs: 5, providerFetch: () => new Promise(() => {}) })(request());
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error.code, "AI_PROVIDER_TIMEOUT");

  const limited = await handler({ providerFetch: async () => providerResponse(429) })(request());
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "AI_RATE_LIMITED");

  const providerFailure = await handler({ providerFetch: async () => providerResponse(500) })(request());
  assert.equal(providerFailure.status, 502);
  assert.equal((await providerFailure.json()).error.code, "AI_PROVIDER_ERROR");

  const invalidResponse = await handler({ providerFetch: async () => providerResponse(200, { periodDiagnosis: {} }) })(request());
  assert.equal(invalidResponse.status, 502);
});

test("aplica rate limit best-effort por usuário", async () => {
  const coach = handler();
  const results = [];
  for (let index = 0; index < 6; index += 1) results.push(await coach(request()));
  assert.deepEqual(results.slice(0, 5).map((item) => item.status), [200, 200, 200, 200, 200]);
  assert.equal(results[5].status, 429);
});

console.log("OK - Edge Function do AI Coach valida JWT, usuário permitido, contrato, provider e resposta estruturada com mocks.");
