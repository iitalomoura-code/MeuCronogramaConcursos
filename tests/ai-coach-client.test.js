"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const source = fs.readFileSync(require.resolve("../js/ai-coach-client.js"), "utf8");
const client = require("../js/ai-coach-client.js");

const snapshot = { aiReadContractVersion: 1, signature: { value: "client-signature" } };
const responseBody = {
  review: {
    periodDiagnosis: { summary: "Resumo", confidence: "medium" },
    facts: [], interpretation: [], recommendation: [], advances: [], bottlenecks: [], priorities: [], maintenance: [], avoidForNow: [], uncertainties: [], strategicNotes: [],
  },
  meta: { model: "gpt-5.6-terra", snapshotSignature: "client-signature", contractVersion: 1 },
};

test("envia snapshot explícito com Authorization e não contém segredo de provider", async () => {
  const originalFetch = global.fetch;
  const originalConfig = global.supabaseConfiguration;
  const originalClient = global.supabaseClient;
  const originalDateNow = Date.now;
  let calls = 0;
  let received;
  global.supabaseConfiguration = { url: "https://example.supabase.co", publishableKey: "publishable-key" };
  global.supabaseClient = { auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } }, error: null }) } };
  global.fetch = async (url, options) => {
    calls += 1;
    received = { url, options };
    return new Response(JSON.stringify(responseBody), { status: 200 });
  };
  Date.now = () => 1000;
  try {
    const before = JSON.stringify(snapshot);
    const [first, second] = await Promise.all([client.analyze(snapshot), client.analyze(snapshot)]);
    assert.deepEqual(first, second);
    assert.equal(calls, 1, "duas chamadas simultâneas da mesma assinatura devem compartilhar a requisição");
    assert.equal(received.url, "https://example.supabase.co/functions/v1/ai-strategic-coach");
    assert.equal(received.options.headers.Authorization, "Bearer user-token");
    const sent = JSON.parse(received.options.body);
    assert.equal(sent.snapshot.signature.value, "client-signature");
    assert.equal(sent.mode, "progress-check");
    assert.equal(JSON.stringify(snapshot), before, "o cliente não pode mutar o snapshot");
    assert.equal(source.includes("OPENAI_API_KEY"), false, "a chave da OpenAI não pode aparecer no cliente");
  } finally {
    global.fetch = originalFetch;
    global.supabaseConfiguration = originalConfig;
    global.supabaseClient = originalClient;
    Date.now = originalDateNow;
  }
});

test("traduz erro de autorização sem expor payload interno", async () => {
  const originalFetch = global.fetch;
  const originalConfig = global.supabaseConfiguration;
  const originalClient = global.supabaseClient;
  global.supabaseConfiguration = { url: "https://example.supabase.co", publishableKey: "publishable-key" };
  global.supabaseClient = { auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } }, error: null }) } };
  global.fetch = async () => new Response(JSON.stringify({ error: { code: "AI_ACCESS_DENIED", internal: "hidden" } }), { status: 403 });
  try {
    await assert.rejects(() => client.analyze({ signature: { value: "error-signature" } }), (error) => error.code === "AI_ACCESS_DENIED" && error.message.includes("não está liberado"));
  } finally {
    global.fetch = originalFetch;
    global.supabaseConfiguration = originalConfig;
    global.supabaseClient = originalClient;
  }
});

test("transforma falha de rede em erro estável do provider", async () => {
  const originalFetch = global.fetch;
  const originalConfig = global.supabaseConfiguration;
  const originalClient = global.supabaseClient;
  global.supabaseConfiguration = { url: "https://example.supabase.co", publishableKey: "publishable-key" };
  global.supabaseClient = { auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } }, error: null }) } };
  global.fetch = async () => { throw new TypeError("network failure"); };
  try {
    await assert.rejects(() => client.analyze({ signature: { value: "network-signature" } }), (error) => error.code === "AI_PROVIDER_ERROR" && error.status === 502);
  } finally {
    global.fetch = originalFetch;
    global.supabaseConfiguration = originalConfig;
    global.supabaseClient = originalClient;
  }
});

test("informa quando a Edge Function do Coach não está acessível", async () => {
  const originalFetch = global.fetch;
  const originalConfig = global.supabaseConfiguration;
  const originalClient = global.supabaseClient;
  global.supabaseConfiguration = { url: "https://example.supabase.co", publishableKey: "publishable-key" };
  global.supabaseClient = { auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } }, error: null }) } };
  global.fetch = async () => new Response("Not found", { status: 404 });
  try {
    await assert.rejects(() => client.checkProgress({ signature: { value: "missing-function-signature" } }), (error) => error.code === "AI_FUNCTION_UNAVAILABLE" && error.status === 404 && error.message.includes("função do AI Coach"));
  } finally {
    global.fetch = originalFetch;
    global.supabaseConfiguration = originalConfig;
    global.supabaseClient = originalClient;
  }
});

test("expõe ciclo, progress-check e ask, encaminha contexto e deduplica por modo e pergunta normalizada", async () => {
  const originalFetch = global.fetch;
  const originalConfig = global.supabaseConfiguration;
  const originalClient = global.supabaseClient;
  const calls = [];
  global.supabaseConfiguration = { url: "https://example.supabase.co", publishableKey: "publishable-key" };
  global.supabaseClient = { auth: { getSession: async () => ({ data: { session: { access_token: "user-token" } }, error: null }) } };
  global.fetch = async (_url, options) => {
    const sent = JSON.parse(options.body);
    calls.push(sent);
    return new Response(JSON.stringify({ ...responseBody, meta: { ...responseBody.meta, snapshotSignature: sent.snapshotSignature } }), { status: 200 });
  };
  const reanalysisSnapshot = { aiReadContractVersion: 1, signature: { value: "progress-signature" } };
  const questionSnapshot = { aiReadContractVersion: 1, signature: { value: "question-signature" } };
  const context = {
    previousCoachReview: { generatedAt: "2026-09-01T00:00:00.000Z", summary: "Contexto anterior" },
    previousCoachCheckpoint: { snapshotSignature: "old-signature", generatedAt: "2026-09-01T00:00:00.000Z" },
    deltaSinceLastCoachReview: { newSessions: 2, newQuestions: 20 },
    previousCycleSnapshot: { signature: "previous-cycle-signature" },
    previousCycleReview: { summary: "Revisão oficial anterior" },
  };
  try {
    await client.analyzeCycle(reanalysisSnapshot, context);
    await client.checkProgress(reanalysisSnapshot, context);
    await client.ask(questionSnapshot, "Como estou evoluindo?", context);
    await client.ask(questionSnapshot, "  como   estou evoluindo? ", context);
    await client.ask(questionSnapshot, "O que mudou desde a última análise?", context);
    assert.equal(calls.length, 4, "modo diferente e perguntas diferentes devem permanecer independentes");
    assert.equal(calls[0].mode, "cycle-review");
    assert.equal(calls[1].mode, "progress-check");
    assert.equal(calls[2].mode, "question");
    assert.equal(calls[2].question, "Como estou evoluindo?");
    assert.deepEqual(calls[2].previousCoachCheckpoint, context.previousCoachCheckpoint);
    assert.deepEqual(calls[2].previousCycleSnapshot, context.previousCycleSnapshot);
    assert.deepEqual(calls[2].previousCycleReview, context.previousCycleReview);
    assert.deepEqual(calls[2].deltaSinceLastCoachReview, context.deltaSinceLastCoachReview);
    assert.equal(calls[3].question, "O que mudou desde a última análise?");
    assert.deepEqual(reanalysisSnapshot, { aiReadContractVersion: 1, signature: { value: "progress-signature" } });
  } finally {
    global.fetch = originalFetch;
    global.supabaseConfiguration = originalConfig;
    global.supabaseClient = originalClient;
  }
});

test("valida pergunta não vazia e com limite de tamanho", async () => {
  const invalidSnapshot = { aiReadContractVersion: 1, signature: { value: "invalid-question-signature" } };
  await assert.rejects(() => client.ask(invalidSnapshot, "   "), (error) => error.code === "AI_INVALID_QUESTION" && error.status === 422);
  await assert.rejects(() => client.ask(invalidSnapshot, "x".repeat(2001)), (error) => error.code === "AI_INVALID_QUESTION" && error.status === 422);
});

console.log("OK - cliente do AI Coach usa os três modos, contexto incremental, JWT e deduplicação contextual.");
