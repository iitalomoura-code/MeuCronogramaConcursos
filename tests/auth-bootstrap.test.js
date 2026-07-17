"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const login = read("login.html");
const auth = read("auth.js");
const config = read("supabase-config.js");
const cloud = read("cloud-storage.js");
const app = read("app.js");

assert.ok(index.includes('class="auth-pending"'), "O aplicativo deve iniciar oculto durante a verifica\u00e7\u00e3o.");
assert.ok(index.includes("Verificando acesso..."), "O aplicativo deve informar a verifica\u00e7\u00e3o de acesso.");
assert.ok(index.includes("@supabase/supabase-js@2"), "O cliente Supabase v2 deve ser carregado antes do app.");
assert.ok(index.indexOf("supabase-config.js") < index.indexOf("auth.js"), "A configura\u00e7\u00e3o deve carregar antes da autentica\u00e7\u00e3o.");
assert.ok(index.indexOf("auth.js") < index.indexOf("cloud-storage.js"), "A autentica\u00e7\u00e3o deve carregar antes do armazenamento online.");
assert.ok(index.indexOf("cloud-storage.js") < index.indexOf("app.js"), "O armazenamento online deve carregar antes do aplicativo.");
assert.ok(login.includes('autocomplete="email"'), "O e-mail deve usar autocomplete adequado.");
assert.ok(login.includes('autocomplete="current-password"'), "A senha deve usar autocomplete adequado.");
assert.ok(config.includes("https://gupctlwkjffhntmeimug.supabase.co"), "A URL p\u00fablica do projeto deve estar configurada.");
assert.ok(config.includes("sb_publishable_"), "A chave public\u00e1vel deve estar configurada.");
assert.ok(!/const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_A_PUBLISHABLE_KEY"/.test(config), "O placeholder da chave n\u00e3o deve permanecer como configura\u00e7\u00e3o ativa.");
assert.ok(config.includes("sua_publishable_key"), "Placeholders alternativos tamb\u00e9m devem ser recusados.");
assert.ok(!/service_role|secret key|SUPABASE_SERVICE/i.test(config), "A configura\u00e7\u00e3o n\u00e3o pode conter chave privilegiada.");
["getCurrentSession", "getCurrentUser", "signInWithEmail", "signOutUser", "requireAuthenticatedUser", "redirectAuthenticatedUser", "watchAuthState", "translateAuthError"].forEach((name) => {
  assert.ok(auth.includes(name), `A fun\u00e7\u00e3o ${name} deve existir.`);
});
assert.ok(auth.includes("signInWithPassword"), "O login deve usar senha no Supabase.");
assert.ok(auth.includes("A integra\\u00e7\\u00e3o com o banco ainda n\\u00e3o foi configurada."), "A configura\u00e7\u00e3o ausente deve ter mensagem clara.");
["listCloudPlans", "loadCloudPlan", "createCloudPlan", "saveCloudPlan", "deleteCloudPlan"].forEach((name) => {
  assert.ok(cloud.includes(`function ${name}`), `A consulta ${name} deve existir.`);
});
assert.ok(app.includes("function startMeuCronogramaApp"), "A inicializa\u00e7\u00e3o do aplicativo deve ser controlada.");
assert.ok(app.includes("auth:ready"), "O aplicativo deve aguardar a sess\u00e3o confirmada.");
assert.ok(app.includes("signOutButton"), "O logout deve estar conectado ao aplicativo.");

console.log("OK - autentica\u00e7\u00e3o, prote\u00e7\u00e3o de tela e camada online isolada presentes.");
