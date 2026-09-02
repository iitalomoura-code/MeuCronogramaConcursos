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
assert.ok(app.includes("function shouldShowToast"), "Avisos de rotina devem ser filtrados antes de criar elementos na tela.");
assert.ok(app.includes("function renderLucideIcons(root = document)"), "A renderização de ícones deve aceitar um painel específico.");
assert.ok(app.includes("renderLucideIcons(els.continuePanel);"), "A tela Continuar não deve varrer o documento inteiro ao atualizar seus ícones.");
assert.ok(app.includes("buildContinueRecommendation(pending, continueAlternativesOpen)"), "A recomendação deve reutilizar a ordenação já calculada no mesmo render.");
assert.ok(!app.includes("showToast((focusedStudySession?.context || context.context)"), "Iniciar estudo não deve abrir uma notificação de rotina.");
assert.ok(!app.includes("if (focusedStudyIndex === index) renderContinuePanel();"), "Abrir o modo foco não deve reconstruir a tela Continuar por trás do painel.");
assert.ok(!app.includes("document.startViewTransition(run)"), "A troca de aba não deve capturar a página inteira antes de responder.");
assert.ok(app.includes("function yieldForInteraction()"), "Salvamentos pesados devem ceder a primeira pintura ao navegador.");
assert.ok(app.includes('if (activeTab === "conteudo") syncRowsFromTable();'), "A leitura da árvore do edital deve ocorrer somente em sua tela.");
assert.ok(app.includes("focusedStudyPersistenceTimer = window.setTimeout(() => scheduleAutoSave()"), "A sessão focada deve compartilhar o autosave debounced.");
assert.ok(app.includes("function scheduleCloudCacheWrite"), "A cópia local grande deve aguardar um período ocioso do navegador.");
assert.ok(app.includes("function invalidateDerivedStudyCaches"), "Cálculos derivados devem ter invalidação explícita.");
assert.ok(app.includes("let masteryDiagnosisCache = new Map()"), "Diagnósticos repetidos devem reutilizar um cache por estado.");
assert.ok(app.includes("let adaptiveHistoryCache = null"), "O histórico adaptativo não deve ser remontado para cada tema.");
assert.ok(app.includes("let reviewAttentionCache = new Map()"), "Atenção de revisões deve reutilizar a leitura no mesmo estado.");
assert.ok(app.includes("pendingSecondaryTabRender = window.setTimeout"), "O mapa secundário deve renderizar após a primeira pintura do Painel de Evolução.");
assert.ok(app.includes("void persistFocusedSession({ immediate: true, label: \"Sessão salva\" })"), "Fechar o modo foco deve persistir em segundo plano.");
assert.ok(app.includes('if (getActiveTabName() !== "cronograma") return;'), "Cronômetros dos cards não devem varrer blocos enquanto a tela do ciclo está oculta.");
assert.ok(app.includes('if (target.closest(".focused-study-modal, .performance-modal, .ql-editor")) return false;'), "Editores com persistência própria não devem disparar autosave global duplicado.");
assert.ok(app.includes('if (tabName === "conteudo") safeRender("Conteúdo Programático", () => renderRows({ preserveState: true }))'), "A árvore extensa do edital deve ser montada somente quando sua tela for aberta.");
assert.ok(!app.includes("state.pendingContentMigrationBackup = saved.pendingContentMigrationBackup?.rows\n    ? saved.pendingContentMigrationBackup\n    : null;\n  renderRows();"), "A restauração não deve montar todos os temas antes da primeira tela.");

console.log("OK - interações críticas respondem antes do autosave e evitam renderizações globais repetidas.");
