(function initializeCloudStorage() {
  function cloudError(message) {
    const error = new Error(message);
    error.code = "cloud_storage_unavailable";
    return error;
  }

  async function requireCloudUser(expectedUserId) {
    if (!window.supabaseConfiguration?.isConfigured || !window.supabaseClient) {
      throw cloudError("A integra\u00e7\u00e3o com o banco ainda n\u00e3o foi configurada.");
    }
    const result = await window.authGate.getCurrentUser();
    if (result.error || !result.user) throw result.error || cloudError("Sua sess\u00e3o expirou. Entre novamente.");
    if (expectedUserId && result.user.id !== expectedUserId) {
      throw cloudError("N\u00e3o foi poss\u00edvel acessar os dados de outro usu\u00e1rio.");
    }
    return result.user;
  }

  async function listCloudPlans(userId) {
    const user = await requireCloudUser(userId);
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .select("id, user_id, name, version, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function loadCloudPlan(planId) {
    const user = await requireCloudUser();
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .select("id, user_id, name, data, version, created_at, updated_at")
      .eq("id", planId)
      .eq("user_id", user.id)
      .single();
    if (error) throw error;
    return data;
  }

  async function createCloudPlan(userId, plan) {
    const user = await requireCloudUser(userId);
    const payload = {
      user_id: user.id,
      name: String(plan?.name || "Novo concurso").trim() || "Novo concurso",
      data: plan?.data || plan || {},
      version: Number(plan?.version) || 1,
    };
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .insert(payload)
      .select("id, user_id, name, data, version, created_at, updated_at")
      .single();
    if (error) throw error;
    return data;
  }

  async function saveCloudPlan(userId, plan) {
    const user = await requireCloudUser(userId);
    if (!plan?.id) throw cloudError("O planejamento online precisa de um identificador.");
    const payload = {
      name: String(plan.name || "Novo concurso").trim() || "Novo concurso",
      data: plan.data || plan,
      version: Number(plan.version) || 1,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await window.supabaseClient
      .from("study_plans")
      .update(payload)
      .eq("id", plan.id)
      .eq("user_id", user.id)
      .select("id, user_id, name, data, version, created_at, updated_at")
      .single();
    if (error) throw error;
    return data;
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

  window.listCloudPlans = listCloudPlans;
  window.loadCloudPlan = loadCloudPlan;
  window.createCloudPlan = createCloudPlan;
  window.saveCloudPlan = saveCloudPlan;
  window.deleteCloudPlan = deleteCloudPlan;
})();
