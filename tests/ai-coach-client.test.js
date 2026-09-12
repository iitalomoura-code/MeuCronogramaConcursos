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
    assert.equal(JSON.parse(received.options.body).snapshot.signature.value, "client-signature");
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

console.log("OK - cliente do AI Coach envia somente o snapshot, usa JWT e bloqueia chamadas duplicadas por assinatura.");
