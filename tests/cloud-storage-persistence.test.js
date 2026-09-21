"use strict";

const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const path = require("node:path");

const storagePath = path.resolve(__dirname, "..", "cloud-storage.js");
const originalWindow = global.window;

afterEach(() => {
  delete require.cache[storagePath];
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
});

function installStorage({ user = { id: "user-1" }, cachedUser = null, authError = null, client, logs = [] } = {}) {
  delete require.cache[storagePath];
  global.window = {
    location: { hostname: "localhost" },
    console: { error: (...args) => logs.push(args) },
    supabaseConfiguration: { isConfigured: true },
    supabaseClient: client,
    authGate: {
      getCurrentUser: async () => ({ user, error: authError }),
      getAuthenticatedUser: () => cachedUser,
    },
  };
  require(storagePath);
  return global.window;
}

test("cria planejamento somente após receber o registro confirmado do Supabase", async () => {
  let inserted = null;
  const chain = {
    insert(payload) { inserted = payload; return this; },
    select() { return this; },
    single: async () => ({ data: { id: "plan-1", user_id: "user-1", name: inserted.name, data: inserted.data, version: 1 }, error: null }),
  };
  const app = installStorage({ client: { from: (table) => { assert.equal(table, "study_plans"); return chain; } } });

  const saved = await app.createCloudPlan({ name: "Receita", data: { ready: true }, version: 1 });

  assert.equal(inserted.user_id, "user-1");
  assert.equal(saved.id, "plan-1");
  assert.equal(saved.version, 1);
});

test("rejeita gravação sem sessão antes de chamar o banco", async () => {
  let calledDatabase = false;
  const app = installStorage({
    user: null,
    client: { from: () => { calledDatabase = true; throw new Error("não deveria consultar o banco"); } },
  });

  await assert.rejects(() => app.createCloudPlan({ name: "Receita", data: {}, version: 1 }), /sessão expirou/i);
  assert.equal(calledDatabase, false);
});

test("propaga o erro do Supabase e registra diagnóstico apenas em desenvolvimento", async () => {
  const logs = [];
  const failure = Object.assign(new Error("new row violates row-level security policy"), { code: "42501", status: 403 });
  const chain = {
    update() { return this; },
    eq() { return this; },
    select() { return this; },
    maybeSingle: async () => ({ data: null, error: failure }),
  };
  const app = installStorage({ client: { from: () => chain }, logs });

  await assert.rejects(
    () => app.updateCloudPlan("plan-1", { name: "Receita", data: {}, version: 1 }),
    (error) => error === failure
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0][1].code, "42501");
  assert.equal(logs[0][1].hasAuthenticatedUser, true);
  assert.equal(logs[0][1].hasPlanId, true);
});

test("não permite salvar um planejamento em nome de outro usuário", async () => {
  let calledDatabase = false;
  const app = installStorage({
    client: { from: () => { calledDatabase = true; throw new Error("não deveria consultar o banco"); } },
  });

  await assert.rejects(
    () => app.saveCloudPlan("user-2", { id: "plan-2", name: "Outro", data: {}, version: 1 }),
    (error) => error?.code === "cloud_user_mismatch"
  );
  assert.equal(calledDatabase, false);
});

test("atualiza e exclui somente depois da confirmação do registro pertencente ao usuário", async () => {
  let updatePayload = null;
  let updateResponseFields = "";
  const updateChain = {
    update(payload) { updatePayload = payload; return this; },
    eq() { return this; },
    select(fields) { updateResponseFields = fields; return this; },
    maybeSingle: async () => ({ data: { id: "plan-1", user_id: "user-1", name: "Receita", data: { saved: true }, version: 2 }, error: null }),
  };
  const deleteChain = {
    delete() { return this; },
    eq() { return this; },
    select() { return this; },
    maybeSingle: async () => ({ data: { id: "plan-1" }, error: null }),
  };
  const app = installStorage({
    client: {
      from: () => ({
        update: updateChain.update.bind(updateChain),
        delete: deleteChain.delete.bind(deleteChain),
      }),
    },
  });

  const saved = await app.updateCloudPlan("plan-1", { name: "Receita", data: { saved: true }, version: 1 });
  const deleted = await app.deleteCloudPlan("plan-1");

  assert.equal(updatePayload.version, 2);
  assert.equal(saved.version, 2);
  assert.equal(updateResponseFields, "id, user_id, name, version, created_at, updated_at", "o UPDATE devolve somente os metadados necessários, sem baixar o JSONB novamente.");
  assert.equal(deleted, true);
});

test("reutiliza a identidade autenticada em memória sem consultar a sessão de novo", async () => {
  let getCurrentUserCalls = 0;
  const chain = {
    update() { return this; },
    eq() { return this; },
    select() { return this; },
    maybeSingle: async () => ({ data: { id: "plan-1", user_id: "user-1", name: "Receita", version: 2 }, error: null }),
  };
  const app = installStorage({
    cachedUser: { id: "user-1" },
    client: { from: () => chain },
  });
  global.window.authGate.getCurrentUser = async () => {
    getCurrentUserCalls += 1;
    return { user: null, error: new Error("não deveria ser chamado") };
  };

  await app.updateCloudPlan("plan-1", { name: "Receita", data: { saved: true }, version: 1 });
  assert.equal(getCurrentUserCalls, 0);
});
