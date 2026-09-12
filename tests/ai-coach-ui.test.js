"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const app = fs.readFileSync("app.js", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260912_create_ai_coach_reviews.sql", "utf8");
const docs = fs.readFileSync("docs/ai-coach.md", "utf8");

assert.ok(index.includes("ai-coach-checkpoint.js") && index.includes("ai-coach-delta.js") && index.includes("ai-coach-memory.js"));
assert.ok(app.includes("Analisar ciclo") && app.includes("Ver minha evolução") && app.includes("Perguntar ao Coach"));
assert.ok(app.includes("async function requestAICoachAnalysis") && app.includes("saveReview"));
assert.ok(app.includes("Analisando sua estratégia...") && app.includes("Analisando sua evolução..."));
assert.ok(app.includes("Converse sobre sua estratégia de estudo.") && app.includes("Faça uma leitura inicial para criar seu primeiro ponto de comparação."));
assert.ok(migration.includes("enable row level security") && migration.includes("auth.uid() = user_id"));
assert.ok(!migration.includes("service_role"));
assert.ok(docs.includes("Fase 4.3B") && docs.includes("checkpoint") && docs.includes("delta"));

console.log("OK - integração do AI Coach possui ações sob demanda, histórico compacto, RLS e documentação.");
