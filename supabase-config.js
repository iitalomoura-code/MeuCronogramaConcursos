const SUPABASE_URL = "https://gupctlwkjffhntmeimug.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_A_PUBLISHABLE_KEY";

(function initializeSupabaseClient() {
  const placeholders = [
    "COLE_AQUI_A_PROJECT_URL",
    "COLE_AQUI_A_PUBLISHABLE_KEY",
    "sua_publishable_key",
  ];
  const isConfigured = Boolean(
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    !placeholders.includes(SUPABASE_URL) &&
    !placeholders.includes(SUPABASE_PUBLISHABLE_KEY)
  );

  window.supabaseConfiguration = {
    isConfigured,
    message: "A integra\u00e7\u00e3o com o banco ainda n\u00e3o foi configurada.",
  };
  window.supabaseClient = null;

  if (!isConfigured || !window.supabase?.createClient) return;

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
})();
