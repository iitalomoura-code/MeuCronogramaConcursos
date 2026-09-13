"use strict";

(function initAICoachMemory(global) {
  const TABLE = "ai_coach_reviews";
  const MAX_HISTORY = 10;
  const text = (value = "") => String(value ?? "").trim();
  const selectFields = "id,user_id,study_context_id,mode,question,snapshot_signature,ai_read_contract_version,created_at,review_json,meta_json,checkpoint_json,previous_review_id,previous_cycle_review_id,cycle_id,cycle_reference_at,model,status";

  function reviewBody(record = {}) { return record.review_json || record.reviewJson || record.review || {}; }
  function checkpointBody(record = {}) { return record.checkpoint_json || record.checkpointJson || record.checkpoint || null; }
  function createdAt(record = {}) { return record.created_at || record.createdAt || reviewBody(record).generatedAt || null; }
  function compactCoachReviewForContext(review = {}) {
    const source = reviewBody(review);
    return {
      periodDiagnosis: source.periodDiagnosis || null,
      facts: Array.isArray(source.facts) ? source.facts.slice(0, 6) : [],
      interpretation: Array.isArray(source.interpretation) ? source.interpretation.slice(0, 6) : [],
      recommendation: Array.isArray(source.recommendation) ? source.recommendation.slice(0, 6) : [],
      advances: Array.isArray(source.advances) ? source.advances.slice(0, 6) : [],
      bottlenecks: Array.isArray(source.bottlenecks) ? source.bottlenecks.slice(0, 6) : [],
      priorities: Array.isArray(source.priorities) ? source.priorities.slice(0, 3) : [],
      maintenance: Array.isArray(source.maintenance) ? source.maintenance.slice(0, 6) : [],
      avoidForNow: Array.isArray(source.avoidForNow) ? source.avoidForNow.slice(0, 6) : [],
      uncertainties: Array.isArray(source.uncertainties) ? source.uncertainties.slice(0, 6) : [],
      cycleEvaluation: source.cycleEvaluation || null,
      sinceLastReview: source.sinceLastReview || null,
      answerToQuestion: source.answerToQuestion || null,
    };
  }

  function cycleLink(snapshot = {}, mode = "") {
    const cycle = mode === "cycle-review" && snapshot.comparison?.previousCycle
      ? snapshot.comparison.previousCycle
      : snapshot.weeklyCycle || {};
    return {
      cycleId: text(cycle.cycleId || cycle.id) || null,
      cycleReferenceAt: cycle.closedAt || cycle.finalizedAt || cycle.endsAt || null,
    };
  }

  function isForStudyContext(record = {}, studyContextId = "") {
    const context = text(studyContextId);
    return Boolean(context && text(record?.study_context_id ?? record?.studyContextId) === context);
  }

  function buildPersistencePayload({ response = {}, snapshot = {}, mode, question = null, studyContextId = "", previousReview = null, previousCycleReview = null } = {}) {
    const context = text(studyContextId);
    if (!context) throw new Error("O contexto de estudo do Coach é obrigatório.");
    const link = cycleLink(snapshot, mode);
    const checkpoint = global.AICoachCheckpoint?.fromSnapshot?.(snapshot) || null;
    return {
      user_id: null,
      study_context_id: context,
      mode,
      question: mode === "question" ? question : null,
      snapshot_signature: text(response.meta?.snapshotSignature || snapshot.signature?.value || snapshot.signature) || null,
      ai_read_contract_version: Number(response.meta?.contractVersion || snapshot.aiReadContractVersion) || 1,
      created_at: response.meta?.generatedAt || snapshot.generatedAt || new Date().toISOString(),
      review_json: response.review || response,
      meta_json: response.meta || {},
      checkpoint_json: checkpoint,
      previous_review_id: isForStudyContext(previousReview, context) ? previousReview.id || null : null,
      previous_cycle_review_id: isForStudyContext(previousCycleReview, context) ? previousCycleReview.id || null : null,
      cycle_id: link.cycleId,
      cycle_reference_at: link.cycleReferenceAt,
      model: response.meta?.model || null,
      status: "completed",
    };
  }

  async function currentUserId() {
    const auth = global.supabaseClient?.auth;
    if (!auth?.getUser) throw new Error("AI Coach requer uma sessão autenticada.");
    const result = await auth.getUser();
    const userId = result?.data?.user?.id;
    if (result?.error || !userId) throw new Error("Sua sessão expirou. Entre novamente.");
    return userId;
  }

  async function listReviews({ studyContextId = "", limit = MAX_HISTORY } = {}) {
    if (!global.supabaseClient) return [];
    const context = text(studyContextId);
    if (!context) return [];
    const userId = await currentUserId();
    const { data, error } = await global.supabaseClient.from(TABLE)
      .select(selectFields)
      .eq("user_id", userId).eq("study_context_id", context).order("created_at", { ascending: false }).limit(Math.min(MAX_HISTORY, Math.max(1, Number(limit) || MAX_HISTORY)));
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  async function saveReview({ response, snapshot, mode, question = null, studyContextId = "", previousReview = null, previousCycleReview = null } = {}) {
    if (!global.supabaseClient) throw new Error("Histórico do Coach indisponível.");
    const userId = await currentUserId();
    const payload = buildPersistencePayload({ response, snapshot, mode, question, studyContextId, previousReview, previousCycleReview });
    payload.user_id = userId;
    const { data, error } = await global.supabaseClient.from(TABLE).insert(payload).select(selectFields).single();
    if (error) throw error;
    return data;
  }

  const api = { TABLE, MAX_HISTORY, reviewBody, checkpointBody, createdAt, compactCoachReviewForContext, isForStudyContext, buildPersistencePayload, listReviews, saveReview };
  global.AICoachMemory = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
