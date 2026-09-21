(function initializeCloudStorage() {
  const PLAN_FIELDS = "id, user_id, name, data, version, created_at, updated_at";
  const PLAN_LIST_FIELDS = "id, user_id, name, version, created_at, updated_at";
  const KNOWLEDGE_BASE_FIELDS = "user_id, data, version, created_at, updated_at";

  function cloudError(message, code = "cloud_storage_unavailable") {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function cloudConflict(latestPlan) {
    const error = cloudError("Este planejamento foi atualizado em outro aparelho.", "cloud_conflict");
    error.latestPlan = latestPlan || null;
    return error;
  }

  function isDevelopmentEnvironment() {
    const host = String(window.location?.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  }

  function reportCloudFailure(operation, error, context = {}) {
    if (!isDevelopmentEnvironment() || !window.console?.error) return;
    window.console.error(`[Meu Cronograma · nuvem] ${operation} falhou`, {
      code: error?.code || null,
      status: Number(error?.status) || null,
      message: String(error?.message || "Erro sem mensagem"),
      table: context.table || null,
      hasAuthenticatedUser: Boolean(context.userId),
      hasPlanId: Boolean(context.planId),
    });
  }

  function throwCloudFailure(operation, error, context = {}) {
    reportCloudFailure(operation, error, context);
    throw error;
  }

  function requireConfirmedRecord(record, operation, context = {}) {
    if (record?.id || (context.table === "user_knowledge_bases" && record?.user_id)) return record;
    throwCloudFailure(operation, cloudError("O banco não confirmou a gravação.", "cloud_confirmation_missing"), context);
  }

  async function requireCloudUser(expectedUserId = "") {
    if (!window.supabaseConfiguration?.isConfigured || !window.supabaseClient) {
      throw cloudError("A integra\u00e7\u00e3o com o banco ainda n\u00e3o foi configurada.", "config_missing");
    }
    const result = await window.authGate.getCurrentUser();
    if (result.error || !result.user) {
      throw result.error || cloudError("Sua sess\u00e3o expirou. Entre novamente.", "session_expired");
    }
    if (expectedUserId && result.user.id !== expectedUserId) {
      throw cloudError("N\u00e3o foi poss\u00edvel acessar os dados de outro usu\u00e1rio.", "cloud_user_mismatch");
    }
    return result.user;
  }

  function normalizePlanInput(planOrUserId, possiblePlan) {
    if (typeof planOrUserId === "string") return { expectedUserId: planOrUserId, plan: possiblePlan || {} };
    return { expectedUserId: "", plan: planOrUserId || {} };
  }

  function planPayload(plan = {}) {
    return {
      name: String(plan.name || "Novo concurso").trim() || "Novo concurso",
      data: plan.data || plan.snapshot || {},
      version: Number(plan.version) || 1,
    };
  }

  async function listCloudPlans() {
    const user = await requireCloudUser();
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .select(PLAN_LIST_FIELDS)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throwCloudFailure("listar planejamentos", error, { table: "study_plans", userId: user.id });
    return data || [];
  }

  async function loadCloudPlan(planId) {
    const user = await requireCloudUser();
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .select(PLAN_FIELDS)
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();
    if (error) throwCloudFailure("carregar planejamento", error, { table: "study_plans", userId: user.id, planId });
    return requireConfirmedRecord(data, "carregar planejamento", { table: "study_plans", userId: user.id, planId });
  }

  async function getCloudPlanVersion(planId) {
    const user = await requireCloudUser();
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .select("id, version, updated_at")
      .eq("id", planId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throwCloudFailure("consultar versão do planejamento", error, { table: "study_plans", userId: user.id, planId });
    return data || null;
  }

  async function createCloudPlan(planOrUserId, possiblePlan) {
    const { expectedUserId, plan } = normalizePlanInput(planOrUserId, possiblePlan);
    const user = await requireCloudUser(expectedUserId);
    const payload = {
      user_id: user.id,
      ...planPayload(plan),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .insert(payload)
      .select(PLAN_FIELDS)
      .single();
    if (error) throwCloudFailure("criar planejamento", error, { table: "study_plans", userId: user.id });
    return requireConfirmedRecord(data, "criar planejamento", { table: "study_plans", userId: user.id });
  }

  async function updateCloudPlan(planId, payload = {}) {
    const user = await requireCloudUser();
    const expectedVersion = Number(payload.version);
    if (!planId) throw cloudError("O planejamento online precisa de um identificador.", "cloud_plan_missing");
    if (!Number.isFinite(expectedVersion) || expectedVersion < 1) {
      throw cloudError("A vers\u00e3o do planejamento online n\u00e3o foi informada.", "cloud_version_missing");
    }
    const update = {
      name: String(payload.name || "Novo concurso").trim() || "Novo concurso",
      data: payload.data || payload.snapshot || {},
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .update(update)
      .eq("id", planId)
      .eq("user_id", user.id)
      .eq("version", expectedVersion)
      .select(PLAN_FIELDS)
      .maybeSingle();
    if (error) throwCloudFailure("atualizar planejamento", error, { table: "study_plans", userId: user.id, planId });
    if (data) return requireConfirmedRecord(data, "atualizar planejamento", { table: "study_plans", userId: user.id, planId });

    let latestPlan = null;
    try {
      latestPlan = await loadCloudPlan(planId);
    } catch (loadError) {
      if (loadError?.code === "PGRST116") throw cloudError("O planejamento online n\u00e3o foi encontrado.", "cloud_plan_missing");
      throwCloudFailure("confirmar atualização do planejamento", loadError, { table: "study_plans", userId: user.id, planId });
    }
    if (Number(latestPlan?.version) > expectedVersion) throw cloudConflict(latestPlan);
    throw cloudError("N\u00e3o foi poss\u00edvel atualizar o planejamento online.", "cloud_update_failed");
  }

  async function saveCloudPlan(planOrUserId, possiblePlan) {
    const { expectedUserId, plan } = normalizePlanInput(planOrUserId, possiblePlan);
    if (expectedUserId) await requireCloudUser(expectedUserId);
    return updateCloudPlan(plan.id, plan);
  }

  async function deleteCloudPlan(planId) {
    const user = await requireCloudUser();
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    if (error) throwCloudFailure("excluir planejamento", error, { table: "study_plans", userId: user.id, planId });
    if (!data?.id) throwCloudFailure("excluir planejamento", cloudError("O planejamento online não foi encontrado.", "cloud_plan_missing"), { table: "study_plans", userId: user.id, planId });
    return true;
  }

  async function testCloudConnection() {
    const user = await requireCloudUser();
    const { error } = await window.supabaseClient
      .from("study_plans")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    if (error) throwCloudFailure("testar conexão com planejamentos", error, { table: "study_plans", userId: user.id });
    return true;
  }

  async function loadCloudKnowledgeBase() {
    const user = await requireCloudUser();
    const { data, error } = await window.supabaseClient
      .from("user_knowledge_bases")
      .select(KNOWLEDGE_BASE_FIELDS)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throwCloudFailure("carregar base permanente", error, { table: "user_knowledge_bases", userId: user.id });
    return data || null;
  }

  async function saveCloudKnowledgeBase(payload = {}) {
    const user = await requireCloudUser();
    const expectedVersion = Number(payload.version);
    const existing = await loadCloudKnowledgeBase();
    if (!existing) {
      const { data, error } = await window.supabaseClient
        .from("user_knowledge_bases")
        .insert({ user_id: user.id, data: payload.data || {}, version: 1, updated_at: new Date().toISOString() })
        .select(KNOWLEDGE_BASE_FIELDS)
        .single();
      if (error) throwCloudFailure("criar base permanente", error, { table: "user_knowledge_bases", userId: user.id });
      return requireConfirmedRecord(data, "criar base permanente", { table: "user_knowledge_bases", userId: user.id });
    }
    const version = Number.isFinite(expectedVersion) && expectedVersion > 0 ? expectedVersion : Number(existing.version) || 1;
    const { data, error } = await window.supabaseClient
      .from("user_knowledge_bases")
      .update({ data: payload.data || {}, version: version + 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("version", version)
      .select(KNOWLEDGE_BASE_FIELDS)
      .maybeSingle();
    if (error) throwCloudFailure("atualizar base permanente", error, { table: "user_knowledge_bases", userId: user.id });
    if (data) return requireConfirmedRecord(data, "atualizar base permanente", { table: "user_knowledge_bases", userId: user.id });
    throw cloudConflict(await loadCloudKnowledgeBase());
  }

  window.listCloudPlans = listCloudPlans;
  window.loadCloudPlan = loadCloudPlan;
  window.getCloudPlanVersion = getCloudPlanVersion;
  window.createCloudPlan = createCloudPlan;
  window.updateCloudPlan = updateCloudPlan;
  window.saveCloudPlan = saveCloudPlan;
  window.deleteCloudPlan = deleteCloudPlan;
  window.testCloudConnection = testCloudConnection;
  window.loadCloudKnowledgeBase = loadCloudKnowledgeBase;
  window.saveCloudKnowledgeBase = saveCloudKnowledgeBase;
})();
