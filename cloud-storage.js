(function initializeCloudStorage() {
  const PLAN_FIELDS = "id, user_id, name, data, version, created_at, updated_at";
  const PLAN_LIST_FIELDS = "id, user_id, name, version, created_at, updated_at";

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
    if (error) throw error;
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
    if (error) throw error;
    return data;
  }

  async function getCloudPlanVersion(planId) {
    const user = await requireCloudUser();
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .select("id, version, updated_at")
      .eq("id", planId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
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
    if (error) throw error;
    return data;
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
    if (error) throw error;
    if (data) return data;

    let latestPlan = null;
    try {
      latestPlan = await loadCloudPlan(planId);
    } catch (loadError) {
      if (loadError?.code === "PGRST116") throw cloudError("O planejamento online n\u00e3o foi encontrado.", "cloud_plan_missing");
      throw loadError;
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
    const { error } = await window.supabaseClient
      .from("study_plans")
      .delete()
      .eq("id", planId)
      .eq("user_id", user.id);
    if (error) throw error;
    return true;
  }

  async function testCloudConnection() {
    const user = await requireCloudUser();
    const { error } = await window.supabaseClient
      .from("study_plans")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    if (error) throw error;
    return true;
  }

  window.listCloudPlans = listCloudPlans;
  window.loadCloudPlan = loadCloudPlan;
  window.getCloudPlanVersion = getCloudPlanVersion;
  window.createCloudPlan = createCloudPlan;
  window.updateCloudPlan = updateCloudPlan;
  window.saveCloudPlan = saveCloudPlan;
  window.deleteCloudPlan = deleteCloudPlan;
  window.testCloudConnection = testCloudConnection;
})();
