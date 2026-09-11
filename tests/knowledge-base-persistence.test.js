"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const cloud = read("cloud-storage.js");
const migration = read("supabase/migrations/20260911_create_user_knowledge_bases.sql");

assert.ok(migration.includes("create table if not exists public.user_knowledge_bases"));
assert.ok(migration.includes("enable row level security"));
assert.ok(migration.includes("auth.uid() = user_id"), "A base permanente deve permanecer isolada por usuário.");
assert.ok(cloud.includes(".from(\"user_knowledge_bases\")"));
assert.ok(cloud.includes("requireCloudUser"), "A base não pode criar uma segunda autenticação.");
assert.ok(app.includes("knowledgeBaseStorageKey(userId = knowledgeBaseUserId())"));
assert.ok(app.includes("requestIdleCallback(run, { timeout: 2500 })"), "O bootstrap deve ceder prioridade à primeira interação.");
assert.ok(app.includes("restoreKnowledgeBaseFromBackup"), "O backup deve preservar a base independente.");
assert.ok(app.includes("function knowledgeBaseNeedsCloudSync") && app.includes("if (!cloudRecord?.data) return true;"), "Uma base local existente deve ir para a nuvem ainda vazia.");
assert.ok(app.includes("mergeKnowledgeBases(cloud, local, imported)"), "A restauração deve reconciliar cloud, local e backup sem apagar evidências.");
assert.ok(app.includes("knowledgeBaseNeedsCloudSync(cloudRecord, knowledgeBaseState)"), "A assinatura factual deve sincronizar a correção do snapshot para a nuvem.");
assert.ok(!app.includes("historyInheritanceSources = sources;\n    knowledgeBase"), "A base não deve reusar o cache visual da herança entre planos.");

console.log("OK - persistência da base permanente usa armazenamento próprio, autenticação existente e backup compatível.");
