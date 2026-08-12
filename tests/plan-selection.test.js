"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const app = read("app.js");
const index = read("index.html");
const auth = read("auth.js");

assert.ok(index.includes('id="planSelectionScreen"'), "A seleção de cronogramas deve ter uma tela própria.");
assert.ok(index.includes('id="planSelectionContent"'), "A seleção deve renderizar os cards de cronograma.");
assert.ok(app.includes('data-create-plan-from-selection'), "A seleção deve manter a criação de cronograma.");
assert.ok(index.includes('id="returnToPlanSelectionButton"'), "A lateral deve permitir trocar de cronograma.");
assert.ok(app.includes("function renderPlanSelection"), "Os cards de cronograma devem ser renderizados em uma função isolada.");
assert.ok(app.includes("function enterStudyPlan"), "A abertura de um cronograma deve ser controlada de forma isolada.");
assert.ok(app.includes("function shouldOpenPlanSelection"), "A seleção deve preservar seu estado após recarregar.");
assert.ok(app.includes("activeStudyPlanId"), "O cronograma escolhido deve ter estado de seleção próprio.");
assert.ok(app.includes('initializeCloudPlanSource({ loadActivePlan'), "A fonte online não deve carregar um plano antes da escolha quando o seletor estiver aberto.");
assert.ok(auth.includes("meuCronogramaAbrirSelecaoAposLogin"), "Um novo login deve abrir a seleção de cronogramas.");

console.log("OK - seleção de cronogramas, entrada do estudo e retomada por planejamento presentes.");
