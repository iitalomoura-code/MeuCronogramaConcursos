"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const section = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));

const startupPerf = section("function startupPerformanceEnabled", "function focusPerformanceEnabled");
["planOpenStart", "snapshotLoadStart", "snapshotLoadEnd", "applyAppSnapshotStart", "applyAppSnapshotEnd", "firstShellPaint", "firstUsefulPaint", "firstInteractive", "secondaryHydrationStart", "secondaryHydrationEnd"].forEach((mark) => {
  assert.ok(app.includes(`"${mark}"`), `A medição de abertura deve registrar ${mark}.`);
});
assert.ok(startupPerf.includes('entryTypes: ["longtask"]') && startupPerf.includes("maxNoYieldMs"), "A medição deve expor long tasks e o maior intervalo sem ceder ao navegador.");
assert.ok(startupPerf.includes("calls") && startupPerf.includes("avgMs") && startupPerf.includes("renders"), "A medição deve consolidar custo por função e contagem de renderizações.");

const cloudInit = section("async function initializeCloudPlanSource", "async function initializeNewPlanCloudSource");
assert.ok(cloudInit.includes("currentCacheIsFresh") && cloudInit.includes("return true;"), "Uma cópia de nuvem na mesma versão deve encerrar a confirmação sem nova reidratação.");
assert.ok(cloudInit.indexOf("currentCacheIsFresh") < cloudInit.indexOf("await loadCloudPlanIntoState"), "O teste da cópia fresca deve acontecer antes da leitura completa da nuvem.");
assert.ok(cloudInit.includes("const matchingCache = readCloudCache(active.id)") && cloudInit.includes("restoreCloudCacheState(matchingCache)"), "A cópia local só pode ser restaurada depois de sua versão ser confirmada pela lista online.");

const applySnapshot = section("function applyAppSnapshot", "function updateSaveStatus");
assert.ok(!applySnapshot.includes("refreshStudyAlerts();"), "Alertas derivados não podem bloquear a aplicação do snapshot inicial.");
assert.ok(app.includes("function scheduleStartupBackgroundWork") && app.includes('"refresh study alerts"'), "Alertas devem ser recalculados apenas no período ocioso posterior à primeira tela.");

const startupShell = section("function renderStartupHydrationShell", "function scheduleStartupBackgroundWork");
const immediateStartupShell = section("function presentStartupHydrationShell", "function scheduleStartupBackgroundWork");
const deferredHydration = section("async function completeStartupHydration", "function scheduleActiveTabRender");
const tabScheduler = section("function scheduleActiveTabRender", "function activateTab");
assert.ok(startupShell.includes("continue-startup-shell") && deferredHydration.includes("yieldForPaint({ frames: 2 })"), "A abertura deve pintar um shell de Continuar antes da montagem completa.");
assert.ok(immediateStartupShell.includes('const tabName = "continuar"') && immediateStartupShell.includes("els.panels.forEach"), "O shell inicial deve substituir o painel de configuração antes da restauração pesada.");
assert.ok(tabScheduler.indexOf("firstInteractive") < tabScheduler.indexOf("secondaryHydrationStart"), "A tela precisa registrar interatividade antes da hidratação secundária.");

const appStart = section("async function startMeuCronogramaApp", "window.startMeuCronogramaApp");
assert.ok(!appStart.includes("loadAICoachHistory"), "O histórico do Coach não pode estar no caminho crítico de entrada.");
assert.ok(appStart.indexOf("presentStartupHydrationShell(startupTrace)") < appStart.indexOf("restoreAppState({ cacheOnly: true })") && appStart.indexOf("await yieldForPaint({ frames: 1 })") < appStart.indexOf("restoreAppState({ cacheOnly: true })"), "A tela Continuar precisa ser exibida e pintada antes de restaurar o planejamento.");
assert.ok(appStart.includes("const cloudAvailableAtStartup = cloudIsAvailable()") && appStart.includes("!cloudAvailableAtStartup && restoreAppState"), "Uma cópia local não confirmada não deve abrir o setup antes do planejamento online.");
assert.ok(index.includes('app.js?v=20260917-cycle-tab-render'), "A página publicada deve receber uma versão nova do app ao atualizar o shell de abertura.");
assert.ok(!index.includes('src="./vendor/lucide.min.js"') && !index.includes('src="./vendor/mammoth.browser.min.js"') && !index.includes('src="./vendor/quill.js"'), "Bibliotecas de ícones, DOCX e resumos não devem bloquear a entrada no cronograma.");
assert.ok(app.includes("function loadOnDemandVendor") && app.includes('"load interface icons"'), "Recursos opcionais devem ser carregados fora da fase crítica da abertura.");
assert.ok(app.includes("async function ensureMammothReader") && app.includes("const mammoth = await ensureMammothReader()"), "A importação DOCX deve carregar seu leitor apenas quando o usuário escolher um arquivo.");
assert.ok(app.includes('if (getActiveTabName() === "erros") initQuillEditor()'), "O editor de resumos só deve ser preparado ao abrir seu próprio caderno.");
const advisorHistory = section("function scheduleAICoachHistoryForAdvisor", "function openStrategicAdvisorModal");
assert.ok(advisorHistory.includes("loadAICoachHistory") && advisorHistory.includes("requestIdleCallback"), "O histórico do Coach deve carregar apenas de forma ociosa após abrir o Orientador.");

const continuePanel = section("function renderContinuePanel", "function shortText");
assert.ok(!continuePanel.includes("renderContinueCycleProgress();") && !continuePanel.includes("renderContinueWeeklySummary(null, null)"), "Continuar não deve fazer renderizações provisórias duplicadas antes de montar a recomendação.");

console.log("OK - inicialização usa shell imediato, cache de mesma versão e hidratação secundária mensurável.");
