(function initializeAuthentication() {
  const LOGIN_PAGE = "./login.html";
  const APP_PAGE = "./index.html";
  let authSubscription = null;
  let authenticatedState = { user: null, session: null };

  function configurationError() {
    const error = new Error("A integra\u00e7\u00e3o com o banco ainda n\u00e3o foi configurada.");
    error.code = "config_missing";
    return error;
  }

  function isConfigured() {
    return Boolean(window.supabaseConfiguration?.isConfigured && window.supabaseClient);
  }

  function currentPage() {
    return document.body?.dataset.authPage || "";
  }

  function safeRedirect(path) {
    const destination = new URL(path, window.location.href).href;
    if (window.location.href !== destination) window.location.replace(destination);
  }

  function translateAuthError(error) {
    if (!error) return "N\u00e3o foi poss\u00edvel concluir o acesso. Tente novamente.";
    if (error.code === "config_missing" || !isConfigured()) {
      return "A integra\u00e7\u00e3o com o banco ainda n\u00e3o foi configurada.";
    }
    if (navigator.onLine === false || error.name === "TypeError") {
      return "Sem conex\u00e3o. Verifique sua internet e tente novamente.";
    }
    const message = String(error.message || "").toLowerCase();
    if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
      return "E-mail ou senha incorretos.";
    }
    if (message.includes("email not confirmed") || message.includes("email not confirmed")) {
      return "Confirme seu e-mail antes de entrar.";
    }
    if (message.includes("network") || message.includes("fetch") || message.includes("failed to fetch")) {
      return "Sem conex\u00e3o. Verifique sua internet e tente novamente.";
    }
    if (message.includes("rate limit") || message.includes("temporarily unavailable") || message.includes("service unavailable")) {
      return "O servi\u00e7o est\u00e1 indispon\u00edvel no momento. Tente novamente em instantes.";
    }
    if (message.includes("refresh token") || message.includes("session")) {
      return "Sua sess\u00e3o expirou. Entre novamente.";
    }
    return "N\u00e3o foi poss\u00edvel concluir o acesso. Tente novamente.";
  }

  async function getCurrentSession() {
    if (!isConfigured()) return { session: null, error: configurationError() };
    const { data, error } = await window.supabaseClient.auth.getSession();
    return { session: data?.session || null, error: error || null };
  }

  async function getCurrentUser() {
    const { session, error } = await getCurrentSession();
    return { user: session?.user || null, session, error };
  }

  async function signInWithEmail(email, password) {
    if (!isConfigured()) return { data: null, error: configurationError() };
    const cleanEmail = String(email || "").trim();
    return window.supabaseClient.auth.signInWithPassword({ email: cleanEmail, password });
  }

  async function signOutUser() {
    if (!isConfigured()) return { error: configurationError() };
    const { error } = await window.supabaseClient.auth.signOut();
    return { error: error || null };
  }

  function releaseProtectedApplication(user, session) {
    authenticatedState = { user: user || null, session: session || null };
    if (currentPage() !== "app") return;
    document.body.classList.remove("auth-pending");
    document.body.classList.add("auth-verified");
    window.dispatchEvent(new CustomEvent("auth:ready", { detail: authenticatedState }));
  }

  async function requireAuthenticatedUser() {
    const result = await getCurrentUser();
    if (result.user) {
      releaseProtectedApplication(result.user, result.session);
      return result.user;
    }
    const suffix = result.error?.code === "config_missing" ? "?config=1" : "";
    safeRedirect(`${LOGIN_PAGE}${suffix}`);
    return null;
  }

  async function redirectAuthenticatedUser() {
    const result = await getCurrentUser();
    if (result.user) safeRedirect(APP_PAGE);
    return result.user || null;
  }

  function watchAuthState() {
    if (!isConfigured() || authSubscription) return authSubscription;
    const { data } = window.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && currentPage() === "app") {
        authenticatedState = { user: null, session: null };
        safeRedirect(LOGIN_PAGE);
        return;
      }
      if (session?.user) {
        authenticatedState = { user: session.user, session };
        if (currentPage() === "app") releaseProtectedApplication(session.user, session);
      }
    });
    authSubscription = data?.subscription || null;
    return authSubscription;
  }

  function setLoginMessage(message, kind = "error") {
    const feedback = document.querySelector("#loginFeedback");
    if (!feedback) return;
    feedback.hidden = !message;
    feedback.dataset.kind = kind;
    feedback.textContent = message || "";
  }

  function setLoginBusy(isBusy) {
    const form = document.querySelector("#loginForm");
    const submit = document.querySelector("#loginSubmitButton");
    if (!form || !submit) return;
    form.dataset.loading = isBusy ? "true" : "false";
    submit.disabled = isBusy;
    submit.querySelector("span").textContent = isBusy ? "Entrando..." : "Entrar";
  }

  function prepareLoginPage() {
    const form = document.querySelector("#loginForm");
    const emailInput = document.querySelector("#loginEmail");
    const passwordInput = document.querySelector("#loginPassword");
    const togglePassword = document.querySelector("#togglePasswordButton");
    const submit = document.querySelector("#loginSubmitButton");
    if (!form || !emailInput || !passwordInput || !togglePassword || !submit) return;

    togglePassword.addEventListener("click", () => {
      const hidden = passwordInput.type === "password";
      passwordInput.type = hidden ? "text" : "password";
      togglePassword.setAttribute("aria-label", hidden ? "Ocultar senha" : "Mostrar senha");
      togglePassword.setAttribute("aria-pressed", hidden ? "true" : "false");
    });

    if (!isConfigured()) {
      setLoginMessage(translateAuthError(configurationError()));
      submit.disabled = true;
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.loading === "true") return;
      const email = emailInput.value.trim();
      let password = passwordInput.value;
      setLoginMessage("");

      if (!email) {
        setLoginMessage("Informe seu e-mail.");
        emailInput.focus();
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        setLoginMessage("Informe um e-mail v\u00e1lido.");
        emailInput.focus();
        return;
      }
      if (!password) {
        setLoginMessage("Informe sua senha.");
        passwordInput.focus();
        return;
      }

      setLoginBusy(true);
      const { error } = await signInWithEmail(email, password);
      password = "";
      passwordInput.value = "";
      if (error) {
        setLoginBusy(false);
        setLoginMessage(translateAuthError(error));
        return;
      }
      setLoginMessage("");
      safeRedirect(APP_PAGE);
    });
  }

  window.authGate = {
    getCurrentSession,
    getCurrentUser,
    signInWithEmail,
    signOutUser,
    requireAuthenticatedUser,
    redirectAuthenticatedUser,
    watchAuthState,
    translateAuthError,
    isAuthenticated: () => Boolean(authenticatedState.user),
  };

  watchAuthState();
  if (currentPage() === "login") {
    prepareLoginPage();
    void redirectAuthenticatedUser();
  } else if (currentPage() === "app") {
    void requireAuthenticatedUser();
  }
})();
