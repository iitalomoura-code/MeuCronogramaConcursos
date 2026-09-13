"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const cloud = read("cloud-storage.js");
const auth = read("auth.js");
const index = read("index.html");

["listCloudPlans", "loadCloudPlan", "createCloudPlan", "updateCloudPlan", "saveCloudPlan", "deleteCloudPlan", "testCloudConnection"].forEach((name) => {
  assert.ok(cloud.includes(`function ${name}`), `${name} deve existir na camada online.`);
});
assert.ok(cloud.includes('.eq("version", expectedVersion)'), "A atualiza\u00e7\u00e3o deve usar versionamento otimista.");
assert.ok(cloud.includes('.eq("user_id", user.id)'), "As consultas devem respeitar o usu\u00e1rio autenticado.");
assert.ok(app.includes('dataSource: "local-migration"'), "O aplicativo deve distinguir a origem dos dados.");
assert.ok(app.includes("ACTIVE_CLOUD_PLAN_KEY"), "O \u00faltimo planejamento online deve ser lembrado separadamente.");
assert.ok(app.includes("function readCloudCache"), "O cache online deve ter leitura isolada.");
assert.ok(app.includes("function restoreCloudCacheState"), "O cache online deve servir apenas para a primeira pintura.");
assert.ok(app.includes("cache.userId !== currentUserId"), "O cache deve ser associado ao usu\u00e1rio autenticado.");
assert.ok(app.includes("restoreAppState({ cacheOnly: true })"), "A inicializa\u00e7\u00e3o deve usar apenas o cache online antes da consulta remota.");
assert.ok(!app.includes("Dados salvos localmente"), "A interface n\u00e3o deve tratar armazenamento local como estado normal.");
assert.ok(!index.includes("Salvar dados localmente"), "Os controles n\u00e3o devem anunciar salvamento local como destino principal.");
assert.ok(auth.includes("getAuthenticatedUser"), "A sess\u00e3o autenticada deve estar dispon\u00edvel para validar o cache local.");
assert.ok(app.includes("initializeCloudPlanSource"), "A inicializa\u00e7\u00e3o deve tentar a fonte online primeiro.");
assert.ok(app.includes("migrateSelectedLocalPlans"), "A migra\u00e7\u00e3o local deve ser controlada pelo usu\u00e1rio.");
assert.ok(app.includes("scheduleCloudSave"), "O salvamento online deve usar um controlador central.");
assert.ok(app.includes("handleCloudConflict"), "Conflitos entre aparelhos devem pedir uma decis\u00e3o ao usu\u00e1rio.");
assert.ok(app.includes("hasUnsavedChanges"), "O aplicativo deve distinguir altera\u00e7\u00f5es locais reais de um cache antigo.");
assert.ok(app.includes("refreshCloudPlanIfNeeded"), "A vers\u00e3o online deve poder ser atualizada ao retornar para a aba.");
assert.ok(app.includes("visibilitychange"), "O retorno para a aba deve verificar atualiza\u00e7\u00f5es online.");
assert.ok(cloud.includes("getCloudPlanVersion"), "A checagem de retorno deve consultar apenas a vers\u00e3o remota.");
assert.ok(index.includes("cloudMigrationModal"), "A interface deve oferecer a migra\u00e7\u00e3o local controlada.");
assert.ok(app.includes("function snapshotFromDriveDataBundle"), "O importador deve reconhecer o formato completo de dados salvos.");
assert.ok(app.includes("bundle.planSnapshots"), "O importador deve usar planSnapshots nos backups completos.");
assert.ok(cloud.includes("function loadCloudKnowledgeBase") && cloud.includes("function saveCloudKnowledgeBase"), "A base permanente deve usar a mesma autenticação da nuvem, em armazenamento independente.");
assert.ok(app.includes("function knowledgeBaseStorageKey") && app.includes("function bootstrapKnowledgeBase"), "A base permanente deve manter cache isolado por usuário e bootstrap não bloqueante.");
assert.ok(index.includes("js/knowledge-base.js?v=20260912-live-ingestion"), "O motor puro da base permanente deve carregar antes do aplicativo.");
assert.ok(index.includes("js/diagnostic-confidence.js?v=20260912-ai-coach-local-smoke") && index.includes("js/ai-strategic-snapshot.js?v=20260912-ai-coach-local-smoke"), "O contrato de leitura da IA deve carregar como módulo explícito antes do aplicativo.");
assert.ok(index.includes("js/readiness.js?v=20260912-ai-coach-local-smoke"), "Readiness deve carregar como módulo local antes do contrato do snapshot.");
assert.ok(app.includes("function buildCurrentAIStrategicSnapshot") && app.includes("window.buildCurrentAIStrategicSnapshot"), "O aplicativo deve expor somente o adaptador estratégico explícito, sem serializar o state bruto.");
assert.ok(app.includes("function previousStrategicAdvisorTopics") && app.includes("previousTopics: previousStrategicAdvisorTopics({ referenceAt: previousCycleReferenceAt })"), "O adaptador deve fornecer o último estado estratégico registrado por tópico.");
assert.ok(app.includes("const currentRanks = aiStrategicRankMap(planningTopics)") && app.includes("rank: currentRanks.get(index)"), "A comparação deve receber ranking estratégico atual e anterior.");
assert.ok(app.includes("const config = scheduleConfig()") && app.includes("contestName: config.concurso") && app.includes("role: config.cargo") && app.includes("banca: config.banca || config.examBoardName"), "O snapshot deve usar a configuração canônica do planejamento.");
assert.ok(app.includes("learningState: topic.strategic?.learningState"), "O adaptador deve transportar explicitamente o estado calculado pelo motor.");
assert.ok(app.includes("function previousStrategicAdvisorSnapshot(referenceAt = \"\")") && app.includes("previousCycleReferenceAt") && app.includes("previousTopicSnapshotAt"), "A comparação deve ancorar o snapshot de tópicos na referência temporal do ciclo anterior.");

console.log("OK - camada online, migra\u00e7\u00e3o controlada e versionamento otimista presentes.");
