"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const plansHtml = read("plans.html");
const plansJs = read("plans.js");
const plansCss = read("plans.css");
const index = read("index.html");
const app = read("app.js");
const auth = read("auth.js");

assert.ok(plansHtml.includes('data-auth-page="plans"'), "A seleção deve exigir autenticação.");
assert.ok(plansHtml.includes('id="createPlanCard"'), "A ação de criar cronograma deve existir mesmo sem registros.");
assert.ok(plansHtml.includes("plans.js?v=20260812-plan-page"), "A página deve carregar seu controlador isolado.");
assert.ok(!plansHtml.includes("app.js"), "A seleção não deve carregar o aplicativo completo.");
assert.ok(!plansHtml.includes("quill.js"), "A seleção não deve carregar o editor de resumos.");
assert.ok(plansJs.includes('window.addEventListener("auth:ready", initialize, { once: true })'), "A inicialização deve ocorrer uma única vez.");
assert.strictEqual((plansJs.match(/elements\.grid\?\.addEventListener\("click"/g) || []).length, 1, "O grid deve ter um único listener delegado.");
assert.ok(plansJs.includes("Promise.allSettled(plans.map(hydratePlan))"), "Os detalhes devem carregar sem bloquear a renderização dos cards.");
assert.ok(plansJs.includes("localStorage.setItem(ACTIVE_STUDY_PLAN_KEY, planId)"), "A seleção deve registrar o cronograma ativo.");
assert.ok(plansJs.includes('window.location.assign("./index.html")'), "Um clique deve entrar no aplicativo.");
assert.ok(!/\.plan-card[^\{]*:hover[^\{]*\{[^}]*transform\s*:/s.test(plansCss), "O hover dos cards não deve provocar movimento de layout.");
assert.ok(index.includes('href="./plans.html"'), "A sidebar deve permitir trocar de cronograma.");
assert.ok(app.includes('window.location.replace("./plans.html")'), "O app não deve abrir sem escolha explícita.");
assert.ok(auth.includes("safeRedirect(PLANS_PAGE)"), "O login deve terminar na seleção de cronogramas.");

console.log("OK - seleção de cronogramas isolada, estável e acionada por clique único.");
