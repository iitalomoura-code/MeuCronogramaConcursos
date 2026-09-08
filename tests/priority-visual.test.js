"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const CapacityPlanning = require("../js/capacity-planning.js");

const app = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");
const cut = app.indexOf("els.tabs.forEach((button) => button.addEventListener");
const runtimeSource = `${app.slice(0, cut)}\nglobalThis.__priorityVisual = { state, priorityScore, priorityVisualLevel, displayPriorityForBlock, priorityDots };`;
const noop = () => {};
const context = {
  console, Date, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, RegExp, Error, structuredClone,
  setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, requestAnimationFrame: noop,
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  document: { querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, documentElement: { dataset: {}, style: { setProperty: noop } }, body: {} },
  window: { setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop, addEventListener: noop, matchMedia: () => ({ matches: false }), innerWidth: 1200, CapacityPlanning },
};
vm.createContext(context);
vm.runInContext(runtimeSource, context);
const runtime = context.__priorityVisual;

[
  [.15, 1, "verde"],
  [.35, 2, "verde"],
  [.53, 3, "amarelo"],
  [.72, 4, "amarelo"],
  [.88, 5, "vermelho"],
].forEach(([score, level, tone]) => {
  assert.strictEqual(runtime.priorityVisualLevel(score), level, `${Math.round(score * 100)}% deve usar nível ${level}.`);
  const markup = runtime.priorityDots(score);
  assert.ok(markup.includes(`priority-level-${level}`), `${Math.round(score * 100)}% deve conservar a classe visual ${tone}.`);
  assert.strictEqual((markup.match(/dot filled/g) || []).length, level, "O componente deve preencher somente as bolinhas do nível atual.");
  assert.strictEqual((markup.match(/class=\"dot/g) || []).length, 5, "O componente deve sempre renderizar cinco bolinhas.");
});

runtime.state.planningBase = {
  materias: [{
    materia: "Direito Constitucional",
    peso: 3,
    dominio: 2,
    examImportance: { questionCount: 14, weight: 1, importanceScore: 14 / 15, sourceType: "current-edital" },
  }],
};

const adaptedBlock = {
  materia: "Direito Constitucional",
  prioridadeBase: .72,
  prioridade: .95,
  studyPressure: .9,
  adaptiveAdjustment: .23,
};
assert.strictEqual(runtime.displayPriorityForBlock(adaptedBlock), .72, "A prioridade estrutural deve prevalecer na apresentação do bloco.");
assert.strictEqual(runtime.priorityVisualLevel(runtime.displayPriorityForBlock(adaptedBlock)), 4, "Um bloco estruturalmente alto deve permanecer no nível 4, mesmo com pressão adaptativa alta.");
assert.ok(runtime.priorityDots(runtime.displayPriorityForBlock(adaptedBlock)).includes("Prioridade alta - 72% - nível 4 de 5"), "O tooltip deve expor percentual e nível da prioridade estrutural.");

const recalculatedBlock = { materia: "Direito Constitucional", prioridade: .95, studyPressure: .9 };
assert.strictEqual(runtime.displayPriorityForBlock(recalculatedBlock), runtime.priorityScore(runtime.state.planningBase.materias[0]), "Sem prioridade-base, a visualização deve recalcular a prioridade estrutural da matéria.");
assert.strictEqual(runtime.displayPriorityForBlock({ materia: "Legado", prioridade: .53 }), .53, "Dados legados sem matéria planejada devem usar a prioridade registrada como fallback.");

assert.ok((app.match(/priorityDots\(displayPriorityForBlock\(/g) || []).length >= 3, "Ciclo Atual e Continuar devem reutilizar o mesmo componente de prioridade.");
assert.ok(/\.priority-dots \.dot\s*\{[\s\S]*?border:\s*1px solid var\(--border\)/.test(styles), "Bolinhas vazias devem manter uma borda neutra nos dois temas.");
assert.ok(/\.continue-meta-grid > \.continue-meta-priority\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/.test(styles), "A prioridade do Continuar não deve aparecer dentro de um card próprio.");
assert.ok(/\.goal-priority\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/.test(styles), "A prioridade do Ciclo Atual não deve aparecer dentro de um card próprio.");

console.log("OK - prioridade visual usa a base estrutural e mantém cinco bolinhas canônicas.");
