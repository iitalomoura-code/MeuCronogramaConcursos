"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const cloud = read("cloud-storage.js");
const index = read("index.html");

["listCloudPlans", "loadCloudPlan", "createCloudPlan", "updateCloudPlan", "saveCloudPlan", "deleteCloudPlan", "testCloudConnection"].forEach((name) => {
  assert.ok(cloud.includes(`function ${name}`), `${name} deve existir na camada online.`);
});
assert.ok(cloud.includes('.eq("version", expectedVersion)'), "A atualiza\u00e7\u00e3o deve usar versionamento otimista.");
assert.ok(cloud.includes('.eq("user_id", user.id)'), "As consultas devem respeitar o usu\u00e1rio autenticado.");
assert.ok(app.includes('dataSource: "local-migration"'), "O aplicativo deve distinguir a origem dos dados.");
assert.ok(app.includes("ACTIVE_CLOUD_PLAN_KEY"), "O \u00faltimo planejamento online deve ser lembrado separadamente.");
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

console.log("OK - camada online, migra\u00e7\u00e3o controlada e versionamento otimista presentes.");
