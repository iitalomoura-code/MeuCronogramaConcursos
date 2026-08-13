"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

const startup = app.slice(app.indexOf("async function startMeuCronogramaApp"));
const newEntry = startup.indexOf('if (entryAction === "new")');
const regularRestore = startup.indexOf("restoreAppState({ cacheOnly: true })");
assert.ok(newEntry >= 0 && newEntry < regularRestore, "Novo cronograma deve abrir antes de restaurar qualquer planejamento anterior.");
assert.ok(startup.includes("applyAppSnapshot(blankAppSnapshot())"), "A tela de criação deve usar um snapshot vazio.");
assert.ok(startup.includes("openNewPlanModal({ returnToPlans: true })"), "Cancelar a criação iniciada pela seleção deve retornar à lista.");
assert.ok(app.includes("async function initializeNewPlanCloudSource") && app.includes("newPlanCloudReadyPromise = initializeNewPlanCloudSource()"), "A lista online deve carregar sem abrir os dados de outro planejamento.");

const openModal = app.slice(app.indexOf("function openNewPlanModal"), app.indexOf("async function createNewPlan"));
assert.ok(openModal.includes('els.newPlanStartDate.value = ""'), "A data inicial não deve ser herdada.");
assert.ok(openModal.includes('els.newPlanWeeklyHours.value = "24"'), "A carga deve usar o padrão de um planejamento novo.");
assert.ok(!openModal.includes("els.weeklyHours?.value"), "O formulário novo não deve copiar valores do cronograma atual.");
assert.ok(styles.includes(".new-plan-creation-mode .app-shell") && styles.includes("visibility: hidden"), "O ambiente anterior não deve aparecer ao fundo da criação.");
assert.ok(app.includes('addEventListener("click", () => closeNewPlanModal())'), "Cancelar deve fechar a criação no primeiro clique.");

console.log("OK - novo cronograma abre imediatamente com estado vazio e sem herdar o planejamento atual.");
