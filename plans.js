(function initializePlansPage() {
  const ACTIVE_CLOUD_PLAN_KEY = "meuCronogramaPlanoNuvemAtivo";
  const ACTIVE_STUDY_PLAN_KEY = "meuCronogramaCronogramaAtivo";
  const APP_ENTRY_ACTION_KEY = "meuCronogramaAcaoEntrada";
  const APP_ENTRY_TAB_KEY = "meuCronogramaAbaEntrada";
  const CLOUD_CACHE_PREFIX = "meuCronogramaCloudCache";
  const THEME_KEY = "meu-cronograma-theme";

  const elements = {
    main: document.querySelector("#plansMain"),
    grid: document.querySelector("#plansGrid"),
    loading: document.querySelector("#plansLoading"),
    create: document.querySelector("#createPlanCard"),
    feedback: document.querySelector("#plansFeedback"),
    greeting: document.querySelector("#plansGreeting"),
    theme: document.querySelector("#plansThemeButton"),
    signOut: document.querySelector("#plansSignOutButton"),
    modal: document.querySelector("#planActionModal"),
    modalTitle: document.querySelector("#planActionTitle"),
    modalMessage: document.querySelector("#planActionMessage"),
    modalField: document.querySelector("#planActionField"),
    modalInput: document.querySelector("#planActionInput"),
    modalConfirm: document.querySelector("#confirmPlanActionButton"),
  };

  let initialized = false;
  let plans = [];
  let actionState = null;
  let actionBusy = false;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function normalizeStatus(value) {
    const status = normalizeText(value);
    if (status.includes("conclu")) return "Concluído";
    if (status.includes("andamento")) return "Em andamento";
    if (status.includes("reprogram")) return "Reprogramar";
    return "Não iniciado";
  }

  function topicKey(subject, topic) {
    return `${normalizeText(subject)}::${normalizeText(topic)}`;
  }

  function themeTitle(value) {
    return String(value || "").split(":")[0].trim();
  }

  function planSummary(snapshot = {}, fallbackUpdatedAt = "") {
    const form = snapshot.form || {};
    const rows = Array.isArray(snapshot.rows) ? snapshot.rows.filter((row) => row?.selecionado !== false) : [];
    const blocks = Array.isArray(snapshot.generatedBlocks) ? snapshot.generatedBlocks : [];
    const history = Array.isArray(snapshot.completedHistory) ? snapshot.completedHistory : [];
    const topics = new Set(rows.map((row) => topicKey(row.materia, themeTitle(row.assunto))).filter((key) => key !== "::"));
    const contacted = new Set();

    history.forEach((item) => contacted.add(topicKey(item.materia, themeTitle(item.assunto || item.tema))));
    blocks.forEach((item) => {
      if (normalizeStatus(item.status) !== "Não iniciado") contacted.add(topicKey(item.materia, themeTitle(item.assunto || item.tema)));
    });

    const covered = [...topics].filter((key) => contacted.has(key)).length;
    const coverage = topics.size ? Math.round((covered / topics.size) * 100) : 0;
    const studyDates = history
      .map((item) => item.completedAt || item.dataConclusao || item.data || item.updatedAt)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()));
    const lastStudy = studyDates.length
      ? new Date(Math.max(...studyDates.map((date) => date.getTime())))
      : fallbackUpdatedAt ? new Date(fallbackUpdatedAt) : null;

    return {
      role: String(form.jobRole || "").trim(),
      board: String(form.examBoardName || form.examBoard || "").trim(),
      coverage,
      lastStudy,
    };
  }

  function relativeDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Ainda sem estudo registrado";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    const difference = Math.round((today - day) / 86400000);
    if (difference === 0) return "Último estudo: hoje";
    if (difference === 1) return "Último estudo: ontem";
    if (difference > 1 && difference < 7) return `Último estudo: há ${difference} dias`;
    return `Último estudo: ${date.toLocaleDateString("pt-BR")}`;
  }

  function applyTheme(theme) {
    const nextTheme = theme === "night" ? "night" : "day";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem(THEME_KEY, nextTheme);
    if (elements.theme) {
      elements.theme.setAttribute("aria-label", nextTheme === "night" ? "Usar modo claro" : "Usar modo escuro");
      elements.theme.innerHTML = `<i data-lucide="${nextTheme === "night" ? "sun" : "moon"}"></i>`;
    }
    window.lucide?.createIcons?.();
  }

  function showFeedback(message) {
    if (!elements.feedback) return;
    elements.feedback.textContent = message || "";
    elements.feedback.hidden = !message;
  }

  function planCardTemplate(plan) {
    const name = plan.name || "Novo concurso";
    return `
      <article class="plan-card" data-plan-card="${escapeHtml(plan.id)}">
        <button class="plan-card-open" type="button" data-open-plan="${escapeHtml(plan.id)}" aria-label="Abrir ${escapeHtml(name)}">
          <span class="plan-card-heading">
            <span class="plan-card-icon"><i data-lucide="book-open"></i></span>
            <span class="plan-card-coverage" data-plan-coverage>Carregando detalhes...</span>
          </span>
          <strong data-plan-name>${escapeHtml(name)}</strong>
          <span class="plan-card-role" data-plan-role>Planejamento de estudos</span>
          <span class="plan-card-board" data-plan-board></span>
          <span class="plan-card-footer">
            <span data-plan-last>Atualizado recentemente</span>
            <small>Selecionar cronograma</small>
          </span>
        </button>
        <details class="plan-card-menu">
          <summary aria-label="Ações de ${escapeHtml(name)}"><i data-lucide="ellipsis"></i></summary>
          <div class="plan-card-actions">
            <button type="button" data-plan-action="rename" data-plan-id="${escapeHtml(plan.id)}">Renomear</button>
            <button type="button" data-plan-action="configure" data-plan-id="${escapeHtml(plan.id)}">Configurar</button>
            <button type="button" data-plan-action="duplicate" data-plan-id="${escapeHtml(plan.id)}">Duplicar</button>
            <button class="danger" type="button" data-plan-action="delete" data-plan-id="${escapeHtml(plan.id)}">Excluir</button>
          </div>
        </details>
      </article>`;
  }

  function renderPlans() {
    elements.grid?.querySelectorAll("[data-plan-card]").forEach((card) => card.remove());
    elements.loading.hidden = true;
    plans.forEach((plan) => elements.loading.insertAdjacentHTML("beforebegin", planCardTemplate(plan)));
    window.lucide?.createIcons?.();
  }

  function updatePlanCard(record) {
    const card = elements.grid?.querySelector(`[data-plan-card="${CSS.escape(record.id)}"]`);
    if (!card) return;
    const summary = planSummary(record.data || {}, record.updated_at);
    const coverage = card.querySelector("[data-plan-coverage]");
    const role = card.querySelector("[data-plan-role]");
    const board = card.querySelector("[data-plan-board]");
    const last = card.querySelector("[data-plan-last]");
    if (coverage) coverage.textContent = `${summary.coverage}% do edital percorrido`;
    if (role) role.textContent = summary.role || "Planejamento de estudos";
    if (board) {
      board.textContent = summary.board || "";
      board.hidden = !summary.board;
    }
    if (last) last.textContent = relativeDate(summary.lastStudy);
  }

  function saveCloudCache(record) {
    const userId = record.user_id || window.authGate?.getAuthenticatedUser?.()?.id || "";
    if (!record?.id || !record?.data || !userId) return;
    try {
      localStorage.setItem(`${CLOUD_CACHE_PREFIX}:${record.id}`, JSON.stringify({
        source: "cloud-cache",
        id: record.id,
        userId,
        name: record.name || "Novo concurso",
        version: Number(record.version) || 1,
        updatedAt: record.updated_at || new Date().toISOString(),
        data: record.data,
      }));
    } catch {}
  }

  async function hydratePlan(plan) {
    try {
      const record = await window.loadCloudPlan(plan.id);
      const index = plans.findIndex((item) => item.id === record.id);
      if (index >= 0) plans[index] = record;
      saveCloudCache(record);
      updatePlanCard(record);
    } catch {
      const card = elements.grid?.querySelector(`[data-plan-card="${CSS.escape(plan.id)}"]`);
      const coverage = card?.querySelector("[data-plan-coverage]");
      if (coverage) coverage.textContent = "Detalhes indisponíveis";
    }
  }

  async function loadPlans() {
    elements.loading.hidden = false;
    showFeedback("");
    try {
      plans = await window.listCloudPlans();
      renderPlans();
      await Promise.allSettled(plans.map(hydratePlan));
    } catch (error) {
      elements.loading.hidden = true;
      showFeedback(window.authGate?.translateAuthError?.(error) || "Não foi possível carregar seus cronogramas.");
    }
  }

  function enterPlan(planId, { action = "", tab = "" } = {}) {
    if (!planId || actionBusy) return;
    actionBusy = true;
    localStorage.setItem(ACTIVE_CLOUD_PLAN_KEY, planId);
    localStorage.setItem(ACTIVE_STUDY_PLAN_KEY, planId);
    if (action) sessionStorage.setItem(APP_ENTRY_ACTION_KEY, action);
    else sessionStorage.removeItem(APP_ENTRY_ACTION_KEY);
    if (tab) sessionStorage.setItem(APP_ENTRY_TAB_KEY, tab);
    else sessionStorage.removeItem(APP_ENTRY_TAB_KEY);
    window.location.assign("./index.html");
  }

  function openActionModal(action, planId) {
    const plan = plans.find((item) => item.id === planId);
    if (!plan || !elements.modal) return;
    actionState = { action, planId };
    const deleting = action === "delete";
    elements.modalTitle.textContent = deleting ? "Excluir cronograma" : "Renomear cronograma";
    elements.modalMessage.textContent = deleting
      ? `Excluir o cronograma “${plan.name || "Novo concurso"}”? Esta ação não pode ser desfeita.`
      : "Altere apenas o nome exibido. Seus estudos e histórico serão preservados.";
    elements.modalField.hidden = deleting;
    elements.modalInput.value = plan.name || "Novo concurso";
    elements.modalConfirm.textContent = deleting ? "Excluir cronograma" : "Salvar nome";
    elements.modalConfirm.classList.toggle("danger", deleting);
    elements.modal.hidden = false;
    (deleting ? elements.modalConfirm : elements.modalInput).focus();
  }

  function closeActionModal() {
    if (!elements.modal || actionBusy) return;
    elements.modal.hidden = true;
    actionState = null;
  }

  async function confirmPlanAction() {
    if (!actionState || actionBusy) return;
    const { action, planId } = actionState;
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    actionBusy = true;
    elements.modalConfirm.disabled = true;
    try {
      if (action === "delete") {
        await window.deleteCloudPlan(planId);
        localStorage.removeItem(`${CLOUD_CACHE_PREFIX}:${planId}`);
        if (localStorage.getItem(ACTIVE_CLOUD_PLAN_KEY) === planId) localStorage.removeItem(ACTIVE_CLOUD_PLAN_KEY);
        if (localStorage.getItem(ACTIVE_STUDY_PLAN_KEY) === planId) localStorage.removeItem(ACTIVE_STUDY_PLAN_KEY);
        plans = plans.filter((item) => item.id !== planId);
        renderPlans();
        showFeedback("Cronograma excluído.");
      } else {
        const name = elements.modalInput.value.trim();
        if (!name) {
          elements.modalInput.focus();
          return;
        }
        const fullPlan = plan.data ? plan : await window.loadCloudPlan(planId);
        const updated = await window.updateCloudPlan(planId, {
          name,
          data: fullPlan.data || {},
          version: Number(fullPlan.version) || 1,
        });
        const index = plans.findIndex((item) => item.id === planId);
        if (index >= 0) plans[index] = updated;
        saveCloudCache(updated);
        renderPlans();
        updatePlanCard(updated);
        showFeedback("Cronograma renomeado.");
      }
      elements.modal.hidden = true;
      actionState = null;
    } catch (error) {
      showFeedback(window.authGate?.translateAuthError?.(error) || "Não foi possível concluir esta ação.");
    } finally {
      actionBusy = false;
      elements.modalConfirm.disabled = false;
    }
  }

  function handleGridClick(event) {
    const actionButton = event.target.closest("[data-plan-action]");
    if (actionButton) {
      event.preventDefault();
      const planId = actionButton.dataset.planId;
      const action = actionButton.dataset.planAction;
      actionButton.closest("details")?.removeAttribute("open");
      if (action === "configure") enterPlan(planId, { tab: "concurso" });
      else if (action === "duplicate") enterPlan(planId, { action: "duplicate" });
      else openActionModal(action, planId);
      return;
    }
    const openButton = event.target.closest("[data-open-plan]");
    if (openButton) enterPlan(openButton.dataset.openPlan);
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    localStorage.removeItem(ACTIVE_STUDY_PLAN_KEY);
    elements.main.hidden = false;
    const user = window.authGate?.getAuthenticatedUser?.();
    const displayName = user?.user_metadata?.name || user?.email?.split("@")[0] || "";
    elements.greeting.textContent = displayName ? `Olá, ${displayName}` : "Olá";
    applyTheme(localStorage.getItem(THEME_KEY) || "day");
    await loadPlans();
  }

  elements.grid?.addEventListener("click", handleGridClick);
  elements.create?.addEventListener("click", () => {
    localStorage.removeItem(ACTIVE_STUDY_PLAN_KEY);
    sessionStorage.setItem(APP_ENTRY_ACTION_KEY, "new");
    sessionStorage.removeItem(APP_ENTRY_TAB_KEY);
    window.location.assign("./index.html");
  });
  elements.theme?.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "night" ? "day" : "night"));
  elements.signOut?.addEventListener("click", async () => {
    if (actionBusy) return;
    actionBusy = true;
    const result = await window.authGate?.signOutUser?.();
    if (result?.error) {
      actionBusy = false;
      showFeedback(window.authGate.translateAuthError(result.error));
    }
  });
  elements.modal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-plan-action]")) closeActionModal();
  });
  elements.modalConfirm?.addEventListener("click", confirmPlanAction);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.modal?.hidden) closeActionModal();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".plan-card-menu")) {
      document.querySelectorAll(".plan-card-menu[open]").forEach((menu) => menu.removeAttribute("open"));
    }
  });
  window.addEventListener("auth:ready", initialize, { once: true });
  if (window.authGate?.isAuthenticated?.()) void initialize();
})();
