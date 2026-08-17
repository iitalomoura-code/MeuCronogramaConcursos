"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const app = read("app.js");
const plans = read("plans.js");

assert.ok(index.includes('id="planningSetupHeader"'), "O assistente deve mostrar progresso entre as seis etapas.");
assert.strictEqual((index.match(/data-setup-step="[1-6]"/g) || []).length, 6, "O indicador principal deve possuir seis etapas.");
assert.ok(index.includes('id="tab-diagnostico"'), "O diagnóstico deve existir como etapa interna, sem virar item permanente da sidebar.");
assert.ok(index.includes('data-settings-tab="diagnostico"'), "O diagnóstico deve continuar acessível pelas configurações.");
assert.ok(index.includes('id="tab-revisar-planejamento"'), "A revisão deve ocorrer antes da geração do primeiro ciclo.");
assert.ok(index.includes('id="tab-configuracoes"'), "Configurações deve existir como seção interna.");
assert.ok(!index.includes('aria-label="Planejamento"><h2>Planejamento</h2>'), "Planejamento não deve permanecer como grupo da sidebar.");
assert.ok(!index.includes('aria-label="Sistema"><h2>Sistema</h2>'), "Configurações e troca de cronograma não devem se repetir na sidebar.");
assert.ok(!index.includes('data-tab-target="configuracoes"'), "A tela de configurações deve ser aberta apenas pela engrenagem.");
assert.ok(index.includes('id="settingsToggleButton"') && app.includes('switchTab("configuracoes")'), "A engrenagem deve continuar abrindo a tela interna de configurações.");
assert.ok(app.includes("function normalizedSetupState") && app.includes("legacy: !Object.prototype.hasOwnProperty.call(saved, \"setup\")"), "Snapshots antigos devem ser tratados como configuração concluída.");
assert.ok(app.includes('setup: { status: "incomplete", flowVersion: SETUP_FLOW_VERSION, currentStep: 1'), "Novos snapshots devem começar incompletos no fluxo atual.");
assert.ok(app.includes("const legacyStepMap = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 6 }"), "Configurações incompletas do fluxo anterior devem migrar para a etapa equivalente.");
assert.ok(app.includes("function finishSetup") && app.includes("completeSetup: true"), "A configuração só deve terminar ao gerar o primeiro ciclo.");
assert.ok(app.includes("activePanel.id.slice(4)") && app.includes('planningSettingsContextTab) return "configuracoes"'), "A etapa ativa e as configurações devem restaurar uma rota estável no F5.");
assert.ok(app.includes("function markPlanningSettingsActionDirty"), "Ações estruturais devem exibir o aviso de impacto nas configurações.");
assert.ok(plans.includes("Continuar configuração") && plans.includes("planSetupSummary"), "A seleção deve identificar cronogramas incompletos.");
assert.ok(plans.includes('enterPlan(planId, { tab: "configuracoes" })'), "Configurar deve abrir a seção consolidada.");

const normalizeStart = app.indexOf("function normalizedSetupState");
const normalizeEnd = app.indexOf("function setupIsIncomplete", normalizeStart);
const normalizedSetupState = new Function(`const SETUP_FLOW_VERSION = 2; ${app.slice(normalizeStart, normalizeEnd)}; return normalizedSetupState;`)();
assert.strictEqual(normalizedSetupState({ status: "incomplete", currentStep: 3, completedSteps: [1, 2] }).currentStep, 4, "A etapa antiga de prioridades deve migrar para a nova etapa 4.");
assert.strictEqual(normalizedSetupState({ status: "incomplete", flowVersion: 2, currentStep: 3, completedSteps: [1, 2] }).currentStep, 3, "O F5 no diagnóstico atual deve restaurar a etapa 3.");
assert.deepStrictEqual(normalizedSetupState(null, { legacy: true }).completedSteps, [1, 2, 3, 4, 5, 6], "Planejamentos sem setup devem continuar concluídos.");

console.log("OK - configuração guiada, menu enxuto e compatibilidade legada presentes.");
