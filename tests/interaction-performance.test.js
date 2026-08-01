"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

assert.ok(app.includes("function scheduleActiveTabRender"), "A troca de aba deve postergar a montagem do painel ativo.");
assert.ok(app.includes("function renderActiveTabContent"), "A renderização por aba deve permanecer isolada.");
assert.ok(app.includes("pendingTabRenderTimer = window.setTimeout"), "A tela deve responder visualmente antes da renderização mais pesada.");
assert.ok(!app.includes("const snapshot = captureAppState();\n  saveLocalSafetyCopy(snapshot);\n  if (cloudSavePromise)"), "O autosave em nuvem não deve capturar todo o estado já no clique.");
assert.ok(app.includes("toggle.dataset.timerState !== label"), "Cronômetros não devem recriar o ícone a cada segundo.");
assert.ok(app.includes("void persistFocusedSession({ label: \"Cronômetro iniciado\" })"), "O cronômetro deve persistir em segundo plano.");
assert.ok(app.includes("if (getActiveTabName() === \"continuar\") renderContinuePanel();"), "O resultado do modo foco deve atualizar somente o painel necessário.");
assert.ok(app.includes("if (focusedStudyIndex < 0) removeFocusedStudyOverlay();"), "O modo foco não deve reabrir automaticamente ao renderizar a tela Continuar.");
assert.ok(!app.includes("renderAppViews();\n  applyLockState();\n  const restoredTab"), "A restauração não deve renderizar todos os painéis antes da aba ativa.");
assert.ok(app.includes("void initializeCloudPlanSource().then"), "A sincronização remota deve iniciar sem bloquear a primeira tela.");

console.log("OK - interações críticas respondem antes do autosave e evitam renderizações globais repetidas.");
