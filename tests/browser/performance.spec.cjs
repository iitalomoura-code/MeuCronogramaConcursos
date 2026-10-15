"use strict";

const { test, expect } = require("@playwright/test");

function largePlanSnapshot() {
  const subjects = Array.from({ length: 15 }, (_, subjectIndex) => {
    const materia = `Matéria ${subjectIndex + 1}`;
    const temas = Array.from({ length: 10 }, (_, topicIndex) => ({
      materia,
      assunto: `Tema ${subjectIndex + 1}.${topicIndex + 1}`,
      subarea: "Base",
      dificuldade: topicIndex % 3 === 0 ? "Alta" : "Média",
      importancia: 3 + (subjectIndex % 3),
      prioridade: 0.5 + ((subjectIndex + topicIndex) % 5) / 10,
    }));
    return { materia, importancia: 3 + (subjectIndex % 3), dificuldade: "Média", prioridade: 0.6, temas, assuntos: temas };
  });
  const rows = subjects.flatMap((subject) => subject.temas);
  const generatedBlocks = Array.from({ length: 25 }, (_, index) => {
    const subject = subjects[index % subjects.length];
    const topic = subject.temas[Math.floor(index / subjects.length) % subject.temas.length];
    return {
      id: `block-${index + 1}`,
      bloco: index + 1,
      materia: subject.materia,
      assunto: topic.assunto,
      conteudoBloco: `${topic.assunto}: conteúdo de referência para o planejamento grande`,
      status: index === 0 ? "Em andamento" : "Não iniciado",
      prioridade: topic.prioridade,
      prioridadeBase: topic.prioridade,
      duracao: [0.5, 0.75, 1, 1.5][index % 4],
      tipoAtividade: index % 5 === 0 ? "Questões" : "Estudo",
      atividadeSugerida: index % 5 === 0 ? "Questões" : "Estudo",
      questoes: 0,
      acertos: 0,
    };
  });
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    activeTab: "continuar",
    form: { contestName: "Fixture CGU", examBoard: "FGV", examBoardId: "fgv", examBoardName: "FGV", useHistoricalIncidence: true, examPhase: "PRE_NOTICE", weeklyHours: "30", blockDuration: "1", referenceWeek: "2026-W42", overrideWeeklyHours: "", overrideCycleEnabled: false, allowResidualBlock: true, reviewFilter: "all", dailyHours: { segunda: "5", terca: "5", quarta: "5", quinta: "5", sexta: "5", sabado: "3", domingo: "2" } },
    rows,
    contentOriginalRows: rows,
    programText: rows.map((row) => `${row.materia} — ${row.assunto}`).join("\n"),
    contentDraftPendingConfirmation: false,
    programVersions: [], currentProgramVersionId: "", confirmed: true,
    planningBase: { materias: subjects }, distribution: [], generatedBlocks,
    completedHistory: [], cycleHistory: [], cycleResults: [], weeklyStudyCycle: null, weeklyGoals: [], studyAlerts: [], initialDiagnosis: [], reviews: [], errors: [], interventionHistory: [], strategicAdvisorSnapshots: [], notebook: {}, activeFocusSession: null, adaptiveSelection: null, locked: false,
    setup: { status: "complete", flowVersion: 2, currentStep: 6, completedSteps: [1, 2, 3, 4, 5, 6] }, showPendingOnly: false,
  };
}

async function preparePage(page) {
  const snapshot = largePlanSnapshot();
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.addInitScript((plan) => {
    localStorage.setItem("meuCronogramaPlanoNuvemAtivo", "browser-perf-plan");
    localStorage.setItem("meuCronogramaCronogramaAtivo", "browser-perf-plan");
    window.__browserPerfPlan = plan;
  }, snapshot);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "cdn.jsdelivr.net") {
      await route.fulfill({ contentType: "text/javascript", body: "window.supabase = window.supabase || {};" });
      return;
    }
    if (url.pathname.endsWith("/auth.js")) {
      await route.fulfill({ contentType: "text/javascript", body: `window.authGate={isAuthenticated:()=>true,getAuthenticatedUser:()=>({id:"browser-user"}),signOutUser:async()=>({error:null}),translateAuthError:()=>""};document.body?.classList.remove("auth-pending");document.body?.classList.add("auth-verified");` });
      return;
    }
    if (url.pathname.endsWith("/cloud-storage.js")) {
      await route.fulfill({ contentType: "text/javascript", body: `(() => { const meta=()=>({id:"browser-perf-plan",name:"Fixture CGU",version:1,updated_at:new Date().toISOString(),created_at:new Date().toISOString()}); window.__browserCloudSaves=0; window.listCloudPlans=async()=>[meta()]; window.loadCloudPlan=async()=>({...meta(),data:window.__browserPerfPlan}); window.getCloudPlanVersion=async()=>meta(); window.saveCloudPlan=async plan=>{window.__browserCloudSaves+=1;return {...meta(),version:(Number(plan.version)||1)+1,data:plan.data};}; window.createCloudPlan=async plan=>({...meta(),...plan}); window.deleteCloudPlan=async()=>true; })();` });
      return;
    }
    await route.continue();
  });
  await page.goto(`${process.env.PERF_BASE_URL || "http://127.0.0.1:4250"}/index.html?cyclePerf=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  expect(browserErrors.filter((message) => !message.includes("ERR_NETWORK_ACCESS_DENIED"))).toEqual([]);
  await expect(page.locator("[data-start-continue]")).toBeVisible({ timeout: 8_000 });
}

test("mede interações reais em planejamento com 150 temas e 25 blocos", async ({ page }) => {
  test.setTimeout(45_000);
  await preparePage(page);
  const beforeResources = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "script").length);

  await page.waitForTimeout(1_000);
  await page.getByRole("button", { name: "Escolher outro tema" }).click();
  if (process.env.PERF_BASELINE === "1") await page.getByRole("button", { name: "Escolher outro tema" }).click();
  await expect(page.locator(".continue-alternatives")).toBeVisible();
  const alternatives = await page.evaluate(() => window.__continueInteractionPerf);
  const rapidAlternatives = await page.evaluate(async () => {
    const results = [];
    for (let click = 0; click < 20; click += 1) {
      window.__continueInteractionWork = null;
      document.querySelector("[data-toggle-alternatives]")?.click();
      results.push(window.__continueInteractionWork);
    }
    return { results, cloudSaves: window.__browserCloudSaves };
  });
  const rapidWorkMs = rapidAlternatives.results.map((result) => result?.workMs || Infinity).sort((a, b) => a - b);
  const rapidP95WorkMs = rapidWorkMs[Math.ceil(rapidWorkMs.length * .95) - 1];

  await page.locator("[data-study-alternative]").first().click();
  await expect(page.locator("[data-start-continue]")).toBeVisible();
  const selection = await page.evaluate(() => window.__continueInteractionPerf);

  await page.locator('[data-tab-target="cronograma"]').first().click();
  await expect(page.locator(".cycle-goal-card").first()).toBeVisible({ timeout: 10_000 });
  const firstCard = await page.evaluate(() => window.__cycleRenderPerf);
  await expect(page.locator(".cycle-goal-card")).toHaveCount(25, { timeout: 10_000 });
  const cycle = await page.evaluate(() => window.__cycleRenderPerf);

  if (process.env.PERF_SMOKE === "1") {
    const metrics = { alternatives, rapidAlternatives: { p95WorkMs: rapidP95WorkMs, cloudSaves: rapidAlternatives.cloudSaves }, firstCard, cycle };
    console.log(`BROWSER_SMOKE_METRICS ${JSON.stringify(metrics)}`);
    expect(rapidP95WorkMs).toBeLessThan(100);
    expect(rapidAlternatives.cloudSaves).toBe(0);
    expect(cycle.interactiveMs).toBeLessThan(500);
    return;
  }

  if (process.env.PERF_BASELINE === "1") {
    const metrics = { resources: { before: beforeResources }, alternatives, selection, firstCard, cycle };
    console.log(`BROWSER_BASELINE_METRICS ${JSON.stringify(metrics)}`);
    expect(cycle.interactiveMs).toBeLessThan(10_000);
    return;
  }

  await page.locator('[data-tab-target="continuar"]').first().click();
  await expect(page.locator("[data-start-continue]")).toBeVisible();
  await page.locator("[data-start-continue]").click();
  await expect(page.locator(".focused-study-modal")).toBeVisible({ timeout: 5_000 });
  const focus = await page.evaluate(() => window.__continueInteractionPerf);
  await page.locator(".focused-study-panel [data-close-focused]").first().click();
  await page.getByRole("button", { name: "Ver análise completa" }).click();
  await expect(page.locator("#strategicAdvisorModal")).toBeVisible();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "script").length)).toBeGreaterThan(beforeResources);
  const afterResources = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "script").length);

  const metrics = { resources: { before: beforeResources, after: afterResources }, alternatives, rapidAlternatives: { p95WorkMs: rapidP95WorkMs, cloudSaves: rapidAlternatives.cloudSaves }, selection, firstCard, cycle, focus };
  console.log(`BROWSER_METRICS ${JSON.stringify(metrics)}`);
  expect(alternatives.visualMs).toBeLessThan(1_000);
  expect(rapidP95WorkMs).toBeLessThan(100);
  expect(rapidAlternatives.cloudSaves).toBe(0);
  expect(selection.visualMs).toBeLessThan(1_000);
  expect(focus.visualMs).toBeLessThan(1_000);
  expect(cycle.interactiveMs).toBeLessThan(10_000);
});
