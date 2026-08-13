"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const app = read("app.js");
const plans = read("plans.js");

assert.ok(index.includes('id="planningSetupHeader"'), "O assistente deve mostrar progresso entre as cinco etapas.");
assert.strictEqual((index.match(/data-setup-step="[1-5]"/g) || []).length, 5, "O indicador principal deve possuir cinco etapas.");
assert.ok(index.includes('id="tab-revisar-planejamento"'), "A revisão deve ocorrer antes da geração do primeiro ciclo.");
assert.ok(index.includes('id="tab-configuracoes"'), "Configurações deve existir como seção interna.");
assert.ok(!index.includes('aria-label="Planejamento"><h2>Planejamento</h2>'), "Planejamento não deve permanecer como grupo da sidebar.");
assert.ok(index.includes('aria-label="Sistema"><h2>Sistema</h2>'), "A sidebar deve separar as ações de sistema.");
assert.ok(app.includes("function normalizedSetupState") && app.includes("legacy: !Object.prototype.hasOwnProperty.call(saved, \"setup\")"), "Snapshots antigos devem ser tratados como configuração concluída.");
assert.ok(app.includes('setup: { status: "incomplete", currentStep: 1'), "Novos snapshots devem começar incompletos.");
assert.ok(app.includes("function finishSetup") && app.includes("completeSetup: true"), "A configuração só deve terminar ao gerar o primeiro ciclo.");
assert.ok(app.includes("activePanel.id.slice(4)") && app.includes('planningSettingsContextTab) return "configuracoes"'), "A etapa ativa e as configurações devem restaurar uma rota estável no F5.");
assert.ok(app.includes("function markPlanningSettingsActionDirty"), "Ações estruturais devem exibir o aviso de impacto nas configurações.");
assert.ok(plans.includes("Continuar configuração") && plans.includes("planSetupSummary"), "A seleção deve identificar cronogramas incompletos.");
assert.ok(plans.includes('enterPlan(planId, { tab: "configuracoes" })'), "Configurar deve abrir a seção consolidada.");

console.log("OK - configuração guiada, menu enxuto e compatibilidade legada presentes.");
