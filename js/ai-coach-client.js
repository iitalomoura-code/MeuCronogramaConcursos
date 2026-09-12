"use strict";

(function initAIStrategicCoachClient(global) {
  const FUNCTION_NAME = "ai-strategic-coach";
  const DEDUPE_WINDOW_MS = 30_000;
  const inFlight = new Map();
  const recentResults = new Map();

  function clientError(code, message, status = 0) {
    const error = new Error(message);
    error.code = code;
    error.status = status;
    return error;
  }

  function translatedMessage(code) {
    return {
      AI_AUTH_REQUIRED: "Sua sessão expirou. Entre novamente.",
      AI_ACCESS_DENIED: "O orientador estratégico ainda não está liberado para este usuário.",
      AI_SNAPSHOT_TOO_LARGE: "A análise ficou grande demais. Tente novamente após atualizar a tela.",
      AI_CONTRACT_VERSION_UNSUPPORTED: "A análise precisa de uma atualização do aplicativo.",
      AI_INVALID_SNAPSHOT: "Não foi possível validar os dados estratégicos desta análise.",
      AI_RATE_LIMITED: "O limite de análises foi atingido. Tente novamente mais tarde.",
      AI_PROVIDER_TIMEOUT: "A análise demorou mais que o esperado. Tente novamente.",
      AI_PROVIDER_ERROR: "O orientador estratégico está indisponível no momento.",
      AI_CONFIG_MISSING: "O orientador estratégico ainda não foi configurado.",
    }[code] || "Não foi possível concluir a análise estratégica.";
  }

  function validateResponse(payload) {
    if (!payload || typeof payload !== "object" || !payload.review || !payload.meta) return false;
    const review = payload.review;
    const arrays = ["facts", "interpretation", "recommendation", "advances", "bottlenecks", "priorities", "maintenance", "avoidForNow", "uncertainties", "strategicNotes"];
    return Boolean(review.periodDiagnosis && typeof review.periodDiagnosis === "object")
      && arrays.every((field) => Array.isArray(review[field]))
      && typeof payload.meta.snapshotSignature === "string"
      && typeof payload.meta.contractVersion === "number";
  }

  async function currentAccessToken() {
    if (!global.supabaseClient?.auth?.getSession) throw clientError("AI_AUTH_REQUIRED", translatedMessage("AI_AUTH_REQUIRED"), 401);
    const { data, error } = await global.supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !token) throw clientError("AI_AUTH_REQUIRED", translatedMessage("AI_AUTH_REQUIRED"), 401);
    return token;
  }

  async function send(snapshot) {
    const token = await currentAccessToken();
    const baseUrl = String(global.supabaseConfiguration?.url || "").replace(/\/$/, "");
    if (!baseUrl) throw clientError("AI_CONFIG_MISSING", translatedMessage("AI_CONFIG_MISSING"));
    const signature = String(snapshot.signature?.value || snapshot.signature || "");
    let response;
    try {
      response = await fetch(`${baseUrl}/functions/v1/${FUNCTION_NAME}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: global.supabaseConfiguration?.publishableKey || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aiReadContractVersion: snapshot.aiReadContractVersion,
          snapshotSignature: signature,
          requestId: signature,
          snapshot,
        }),
      });
    } catch {
      throw clientError("AI_PROVIDER_ERROR", translatedMessage("AI_PROVIDER_ERROR"), 502);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload?.error?.code || "AI_PROVIDER_ERROR";
      throw clientError(code, translatedMessage(code), response.status);
    }
    if (!validateResponse(payload) || payload.meta.snapshotSignature !== signature) {
      throw clientError("AI_PROVIDER_ERROR", translatedMessage("AI_PROVIDER_ERROR"), 502);
    }
    return { review: payload.review, meta: payload.meta };
  }

  async function analyze(snapshot) {
    if (!snapshot || typeof snapshot !== "object") throw clientError("AI_INVALID_SNAPSHOT", translatedMessage("AI_INVALID_SNAPSHOT"), 422);
    const signature = String(snapshot.signature?.value || snapshot.signature || "");
    if (!signature) throw clientError("AI_INVALID_SNAPSHOT", translatedMessage("AI_INVALID_SNAPSHOT"), 422);
    const now = Date.now();
    const cached = recentResults.get(signature);
    if (cached && now - cached.createdAt < DEDUPE_WINDOW_MS) return cached.value;
    if (inFlight.has(signature)) return inFlight.get(signature);
    const request = send(snapshot).then((value) => {
      recentResults.set(signature, { createdAt: Date.now(), value });
      return value;
    }).finally(() => inFlight.delete(signature));
    inFlight.set(signature, request);
    return request;
  }

  const api = { analyze, validateResponse, translatedMessage };
  global.AIStrategicCoachClient = api;
  global.requestAIStrategicCoachReview = async function requestAIStrategicCoachReview() {
    if (typeof global.buildCurrentAIStrategicSnapshot !== "function") throw clientError("AI_INVALID_SNAPSHOT", translatedMessage("AI_INVALID_SNAPSHOT"), 422);
    return api.analyze(global.buildCurrentAIStrategicSnapshot());
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
