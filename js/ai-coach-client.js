"use strict";

(function initAIStrategicCoachClient(global) {
  const FUNCTION_NAME = "ai-strategic-coach";
  const DEDUPE_WINDOW_MS = 30_000;
  const DEFAULT_COACH_MODE = "progress-check";
  const COACH_MODES = ["cycle-review", "progress-check", "question"];
  const MAX_QUESTION_CHARS = 2000;
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
      AI_FUNCTION_UNAVAILABLE: "A função do AI Coach não está disponível no momento. Tente novamente mais tarde.",
      AI_PROVIDER_ERROR: "O orientador estratégico está indisponível no momento.",
      AI_CONFIG_MISSING: "O orientador estratégico ainda não foi configurado.",
      AI_INVALID_REQUEST: "Não foi possível validar o pedido ao orientador estratégico.",
      AI_INVALID_QUESTION: "A pergunta precisa ser preenchida e ter no máximo 2.000 caracteres.",
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

  function normalizeQuestion(question) {
    return String(question || "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
  }

  function normalizeOptions(options = {}) {
    const mode = options.mode || DEFAULT_COACH_MODE;
    if (!COACH_MODES.includes(mode)) throw clientError("AI_INVALID_REQUEST", translatedMessage("AI_INVALID_REQUEST"), 422);
    const question = options.question;
    if (mode === "question") {
      if (typeof question !== "string" || !question.trim() || question.trim().length > MAX_QUESTION_CHARS) {
        throw clientError("AI_INVALID_QUESTION", translatedMessage("AI_INVALID_QUESTION"), 422);
      }
    } else if (question !== undefined && question !== null && String(question).trim()) {
      throw clientError("AI_INVALID_REQUEST", translatedMessage("AI_INVALID_REQUEST"), 422);
    }
    return {
      mode,
      question: mode === "question" ? question.trim() : null,
      previousCoachReview: options.previousCoachReview || null,
      previousCoachCheckpoint: options.previousCoachCheckpoint || null,
      deltaSinceLastCoachReview: options.deltaSinceLastCoachReview || null,
      previousCycleSnapshot: options.previousCycleSnapshot || null,
      previousCycleReview: options.previousCycleReview || null,
    };
  }

  function requestKey(signature, options) {
    return `${signature}\u0000${options.mode}\u0000${normalizeQuestion(options.question)}`;
  }

  async function send(snapshot, options) {
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
          requestId: requestKey(signature, options),
          mode: options.mode,
          ...(options.question ? { question: options.question } : {}),
          ...(options.previousCoachReview ? { previousCoachReview: options.previousCoachReview } : {}),
          ...(options.previousCoachCheckpoint ? { previousCoachCheckpoint: options.previousCoachCheckpoint } : {}),
          ...(options.deltaSinceLastCoachReview ? { deltaSinceLastCoachReview: options.deltaSinceLastCoachReview } : {}),
          ...(options.previousCycleSnapshot ? { previousCycleSnapshot: options.previousCycleSnapshot } : {}),
          ...(options.previousCycleReview ? { previousCycleReview: options.previousCycleReview } : {}),
          snapshot,
        }),
      });
    } catch {
      throw clientError("AI_PROVIDER_ERROR", translatedMessage("AI_PROVIDER_ERROR"), 502);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = payload?.error?.code || (response.status === 404 ? "AI_FUNCTION_UNAVAILABLE" : "AI_PROVIDER_ERROR");
      throw clientError(code, translatedMessage(code), response.status);
    }
    if (!validateResponse(payload) || payload.meta.snapshotSignature !== signature) {
      throw clientError("AI_PROVIDER_ERROR", translatedMessage("AI_PROVIDER_ERROR"), 502);
    }
    return { review: payload.review, meta: payload.meta };
  }

  async function analyze(snapshot, options = {}) {
    if (!snapshot || typeof snapshot !== "object") throw clientError("AI_INVALID_SNAPSHOT", translatedMessage("AI_INVALID_SNAPSHOT"), 422);
    const signature = String(snapshot.signature?.value || snapshot.signature || "");
    if (!signature) throw clientError("AI_INVALID_SNAPSHOT", translatedMessage("AI_INVALID_SNAPSHOT"), 422);
    const normalizedOptions = normalizeOptions(options);
    const key = requestKey(signature, normalizedOptions);
    const now = Date.now();
    const cached = recentResults.get(key);
    if (cached && now - cached.createdAt < DEDUPE_WINDOW_MS) return cached.value;
    if (inFlight.has(key)) return inFlight.get(key);
    const request = send(snapshot, normalizedOptions).then((value) => {
      recentResults.set(key, { createdAt: Date.now(), value });
      return value;
    }).finally(() => inFlight.delete(key));
    inFlight.set(key, request);
    return request;
  }

  async function analyzeCycle(snapshot, previousContext = {}) {
    return analyze(snapshot, { ...previousContext, mode: "cycle-review" });
  }

  async function checkProgress(snapshot, previousContext = {}) {
    return analyze(snapshot, { ...previousContext, mode: "progress-check" });
  }

  async function reanalyze(snapshot, previousContext = {}) {
    return checkProgress(snapshot, previousContext);
  }

  async function ask(snapshot, question, previousContext = {}) {
    return analyze(snapshot, { ...previousContext, mode: "question", question });
  }

  const api = { analyze, analyzeCycle, checkProgress, reanalyze, ask, validateResponse, translatedMessage };
  global.AIStrategicCoachClient = api;
  global.requestAIStrategicCoachReview = async function requestAIStrategicCoachReview() {
    if (typeof global.buildCurrentAIStrategicSnapshot !== "function") throw clientError("AI_INVALID_SNAPSHOT", translatedMessage("AI_INVALID_SNAPSHOT"), 422);
    return api.analyze(global.buildCurrentAIStrategicSnapshot());
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
