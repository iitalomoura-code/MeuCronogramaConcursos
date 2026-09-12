const AI_COACH_MODEL = "gpt-5.6-terra";
const SUPPORTED_CONTRACT_VERSION = 1;
const MAX_SNAPSHOT_BYTES = 500 * 1024;
const PROVIDER_TIMEOUT_MS = 40_000;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_COACH_INSTRUCTIONS = `Você é um orientador estratégico de estudos para concursos.
Responda em português do Brasil, com clareza técnica, objetividade e sem motivação vazia.

Governança: a IA recomenda, o motor local calcula e o usuário decide.
Leia o snapshot na seguinte hierarquia: CURRENT FACTUAL EVIDENCE, PERMANENT KNOWLEDGE BASE,
LEGACY HISTORY FALLBACK, SELF-ASSESSMENT. Não recalcule diagnóstico, confiança, readiness,
prioridade ou ciclo.

Readiness é uma interpretação determinística local de preparação, não uma probabilidade de aprovação.
Unknown não é fraqueza nem desempenho zero. Histórico forte é baseline, não desempenho atual.
Partial mapping é somente conhecimento parcial. Maintenance não é deficiência.
remainingPlannedMinutes é capacidade planejada ainda não utilizada, não dívida.
Respeite comparison.basis e só use linguagem de ciclo anterior quando temporallyAligned for true.
Separe fatos, interpretação e recomendação. strategic.rank e strategic.score são autoridade operacional.
Se divergir do ranking, use relationToEngine=override-suggestion e informe engineRank, reason e aiSuggestedImportance.
Priorize ganho esperado de pontos por unidade de tempo, respeitando a capacidade semanal e sem criar calendário diário rígido.
Retorne no máximo três prioridades principais.`;

const nullableText = { type: ["string", "null"] };
const reviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["periodDiagnosis", "facts", "interpretation", "recommendation", "advances", "bottlenecks", "priorities", "maintenance", "avoidForNow", "uncertainties", "strategicNotes"],
  properties: {
    periodDiagnosis: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "confidence"],
      properties: {
        summary: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
    },
    facts: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "subject", "topic"], properties: { text: { type: "string" }, subject: nullableText, topic: nullableText } } },
    interpretation: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "confidence"], properties: { text: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] } } } },
    recommendation: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "reason"], properties: { text: { type: "string" }, reason: { type: "string" } } } },
    advances: { type: "array", items: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } } },
    bottlenecks: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "subject", "topic"], properties: { text: { type: "string" }, subject: nullableText, topic: nullableText } } },
    priorities: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["subject", "topic", "recommendation", "reason", "relationToEngine", "confidence", "engineRank", "aiSuggestedImportance"],
        properties: {
          subject: { type: "string" },
          topic: { type: "string" },
          recommendation: { type: "string" },
          reason: { type: "string" },
          relationToEngine: { type: "string", enum: ["aligned", "override-suggestion"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          engineRank: { type: ["integer", "null"] },
          aiSuggestedImportance: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
        },
      },
    },
    maintenance: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "subject", "topic"], properties: { text: { type: "string" }, subject: nullableText, topic: nullableText } } },
    avoidForNow: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "reason"], properties: { text: { type: "string" }, reason: { type: "string" } } } },
    uncertainties: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "subject", "topic"], properties: { text: { type: "string" }, subject: nullableText, topic: nullableText } } },
    strategicNotes: { type: "array", items: { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } } },
  },
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(status, code) {
  return jsonResponse({ error: { code } }, status);
}

function getEnv(name, env) {
  if (env && Object.prototype.hasOwnProperty.call(env, name)) return String(env[name] ?? "");
  return globalThis.Deno?.env?.get(name) || "";
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateSnapshotRequest(body) {
  if (!isObject(body) || !isObject(body.snapshot)) return false;
  const snapshot = body.snapshot;
  if (body.aiReadContractVersion !== SUPPORTED_CONTRACT_VERSION || snapshot.aiReadContractVersion !== SUPPORTED_CONTRACT_VERSION) return false;
  const embeddedSignature = typeof snapshot.signature === "string" ? snapshot.signature : snapshot.signature?.value;
  if (!embeddedSignature || typeof body.snapshotSignature !== "string" || body.snapshotSignature !== embeddedSignature) return false;
  return Array.isArray(snapshot.topics)
    && Array.isArray(snapshot.subjects)
    && isObject(snapshot.readiness)
    && isObject(snapshot.evidenceAuthority)
    && isObject(snapshot.instructions)
    && isObject(snapshot.weeklyCycle);
}

function validateReview(review) {
  if (!isObject(review) || !isObject(review.periodDiagnosis)) return false;
  const requiredArrays = ["facts", "interpretation", "recommendation", "advances", "bottlenecks", "priorities", "maintenance", "avoidForNow", "uncertainties", "strategicNotes"];
  if (requiredArrays.some((field) => !Array.isArray(review[field]))) return false;
  if (!review.periodDiagnosis.summary || !["high", "medium", "low"].includes(review.periodDiagnosis.confidence)) return false;
  if (review.priorities.length > 3) return false;
  return review.priorities.every((item) => isObject(item)
    && typeof item.subject === "string"
    && typeof item.topic === "string"
    && typeof item.recommendation === "string"
    && typeof item.reason === "string"
    && ["aligned", "override-suggestion"].includes(item.relationToEngine)
    && ["high", "medium", "low"].includes(item.confidence)
    && (item.engineRank === null || Number.isInteger(item.engineRank))
    && (item.aiSuggestedImportance === null || ["high", "medium", "low"].includes(item.aiSuggestedImportance)));
}

function createRateLimiter({ limit = RATE_LIMIT_MAX, windowMs = RATE_LIMIT_WINDOW_MS, now = () => Date.now() } = {}) {
  const buckets = new Map();
  return {
    allow(userId) {
      const current = now();
      const previous = buckets.get(userId) || { startedAt: current, count: 0 };
      const bucket = current - previous.startedAt >= windowMs ? { startedAt: current, count: 0 } : previous;
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      buckets.set(userId, bucket);
      return true;
    },
  };
}

function providerErrorCode(status) {
  if (status === 429) return { status: 429, code: "AI_RATE_LIMITED" };
  return { status: 502, code: "AI_PROVIDER_ERROR" };
}

async function readProviderReview(response) {
  const payload = await response.json().catch(() => null);
  if (!payload) return null;
  if (typeof payload.output_text === "string") {
    try { return JSON.parse(payload.output_text); } catch { return null; }
  }
  const text = payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text;
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function callProvider({ snapshot, apiKey, providerFetch, timeoutMs = PROVIDER_TIMEOUT_MS }) {
  const controller = new AbortController();
  let timeoutId;
  try {
    const request = providerFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_COACH_MODEL,
        instructions: AI_COACH_INSTRUCTIONS,
        input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(snapshot) }] }],
        text: { format: { type: "json_schema", name: "ai_coach_review", strict: true, schema: reviewSchema } },
        store: false,
      }),
    });
    const timeout = new Promise((_, reject) => { timeoutId = setTimeout(() => { controller.abort(); const error = new Error("provider timeout"); error.name = "AI_PROVIDER_TIMEOUT"; reject(error); }, timeoutMs); });
    const response = await Promise.race([request, timeout]);
    if (!response?.ok) throw Object.assign(new Error("provider error"), { name: "AI_PROVIDER_HTTP", status: response?.status });
    return await readProviderReview(response);
  } catch (error) {
    if (error?.name === "AI_PROVIDER_TIMEOUT" || error?.name === "AbortError") throw Object.assign(new Error("provider timeout"), { name: "AI_PROVIDER_TIMEOUT" });
    if (error?.name === "AI_PROVIDER_HTTP") throw error;
    throw Object.assign(new Error("provider unavailable"), { name: "AI_PROVIDER_NETWORK" });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function createCoachHandler({ authClient, providerFetch = fetch, env = null, rateLimiter = createRateLimiter(), clock = () => new Date(), timeoutMs = PROVIDER_TIMEOUT_MS } = {}) {
  return async function handleCoachRequest(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "POST") return errorResponse(405, "AI_INVALID_SNAPSHOT");
    const authorization = request.headers.get("authorization") || "";
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) return errorResponse(401, "AI_AUTH_REQUIRED");
    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_SNAPSHOT_BYTES) return errorResponse(413, "AI_SNAPSHOT_TOO_LARGE");
    let body;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_SNAPSHOT_BYTES) return errorResponse(413, "AI_SNAPSHOT_TOO_LARGE");
      body = JSON.parse(raw);
    } catch {
      return errorResponse(422, "AI_INVALID_SNAPSHOT");
    }
    if (body.aiReadContractVersion !== SUPPORTED_CONTRACT_VERSION) return errorResponse(422, "AI_CONTRACT_VERSION_UNSUPPORTED");
    if (!validateSnapshotRequest(body)) return errorResponse(422, "AI_INVALID_SNAPSHOT");
    if (!authClient?.auth?.getUser) return errorResponse(500, "AI_CONFIG_MISSING");
    let authResult;
    try {
      authResult = await authClient.auth.getUser(tokenMatch[1]);
    } catch {
      return errorResponse(401, "AI_AUTH_REQUIRED");
    }
    const { data, error } = authResult || {};
    if (error || !data?.user?.id) return errorResponse(401, "AI_AUTH_REQUIRED");
    const authenticatedUserId = data.user.id;
    const allowedUserId = getEnv("AI_ALLOWED_USER_ID", env);
    if (!allowedUserId) return errorResponse(500, "AI_CONFIG_MISSING");
    if (authenticatedUserId !== allowedUserId) return errorResponse(403, "AI_ACCESS_DENIED");
    if (!rateLimiter.allow(authenticatedUserId)) return errorResponse(429, "AI_RATE_LIMITED");
    const apiKey = getEnv("OPENAI_API_KEY", env);
    if (!apiKey) return errorResponse(500, "AI_CONFIG_MISSING");
    let review;
    try {
      review = await callProvider({ snapshot: body.snapshot, apiKey, providerFetch, timeoutMs });
    } catch (providerError) {
      if (providerError?.name === "AI_PROVIDER_TIMEOUT") return errorResponse(504, "AI_PROVIDER_TIMEOUT");
      if (providerError?.status === 429) return errorResponse(429, "AI_RATE_LIMITED");
      return errorResponse(502, "AI_PROVIDER_ERROR");
    }
    if (!validateReview(review)) return errorResponse(502, "AI_PROVIDER_ERROR");
    return jsonResponse({
      review,
      meta: {
        model: AI_COACH_MODEL,
        snapshotSignature: body.snapshotSignature,
        contractVersion: SUPPORTED_CONTRACT_VERSION,
        generatedAt: clock().toISOString(),
      },
    });
  };
}

async function createDefaultHandler() {
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const supabaseUrl = getEnv("SUPABASE_URL");
  const publishableKeys = getEnv("SUPABASE_PUBLISHABLE_KEYS");
  let key = getEnv("SUPABASE_PUBLISHABLE_KEY") || getEnv("SUPABASE_ANON_KEY");
  if (!key && publishableKeys) {
    try { key = JSON.parse(publishableKeys).default || ""; } catch { key = ""; }
  }
  const authClient = createClient(supabaseUrl, key);
  return createCoachHandler({ authClient });
}

let defaultHandlerPromise;
const defaultExport = {
  fetch(request) {
    defaultHandlerPromise ||= createDefaultHandler();
    return defaultHandlerPromise.then((handler) => handler(request));
  },
};

export { AI_COACH_MODEL, AI_COACH_INSTRUCTIONS, reviewSchema, validateSnapshotRequest, validateReview, createRateLimiter, MAX_SNAPSHOT_BYTES };
export default defaultExport;
