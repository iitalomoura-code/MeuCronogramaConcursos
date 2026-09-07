const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("styles.css", "utf8");
const plansCss = fs.readFileSync("plans.css", "utf8");
const html = fs.readFileSync("index.html", "utf8");

[
  "--color-bg", "--color-surface", "--color-text", "--color-text-muted",
  "--color-border", "--color-accent", "--space-1", "--space-10",
  "--radius-sm", "--radius-md", "--radius-lg", "--shadow-soft", "--shadow-floating",
  "--color-intelligence", "--color-study", "--color-review", "--color-positive", "--color-attention", "--color-critical",
  "--surface-violet-soft", "--surface-blue-soft", "--surface-cyan-soft", "--surface-teal-soft", "--surface-amber-soft", "--surface-coral-soft",
].forEach((token) => assert.ok(css.includes(token), `token ausente: ${token}`));

[".ds-page-header", ".ds-section-header", ".ds-surface", ".ds-list-row", ".ds-badge", ".ds-search", ".ds-empty-state", ".ds-metric"].forEach((component) => {
  assert.ok(css.includes(component), `primitivo ausente: ${component}`);
});

assert.ok((html.match(/ds-page-header/g) || []).length >= 10, "principais headers devem usar o padrão de página");
assert.ok(!css.includes("var(--accent)"), "componentes não podem depender de token inexistente");
assert.ok(css.includes("button:focus-visible"), "controles precisam de foco visível");
assert.ok(css.includes("--primary: #695CFF"), "o modo claro deve usar violeta como cor principal");
assert.ok(css.includes("--color-study: #3B82F6") && css.includes("--color-review: #06B6D4"), "estudo e revisão devem ter cores semânticas próprias");
assert.ok(css.includes(':root[data-theme="night"]') && css.includes("--bg-main: #0B1020"), "o modo escuro deve possuir tokens próprios");
assert.ok(css.includes("--sidebar: #111827"), "a sidebar deve adotar a superfície midnight");
assert.ok(css.includes(".semantic-activity.activity-study") && css.includes(".semantic-activity.activity-recovery"), "tipos de atividade devem usar indicadores semânticos reutilizáveis");
assert.ok(css.includes(".priority-level-1") && css.includes(".priority-level-5"), "prioridades devem ter gradação visual de 1 a 5");
assert.ok(css.includes(".continue-phase-chip.phase-pre-notice") && css.includes(".continue-phase-chip.phase-urgent"), "a fase do concurso deve comunicar contexto e urgência visualmente");
assert.ok(css.includes(".study-play-button"), "a ação de iniciar estudo deve ter tratamento semântico próprio");
assert.ok(css.includes(":is(.continue-meta-grid, .goal-card-meta) .priority-indicator.priority-level-5"), "a prioridade deve preservar sua cor dentro das grades de metadados");
assert.ok(css.includes("@media (max-width: 560px)"), "deve existir comportamento mobile");
assert.ok(/@media \(max-width: 680px\)[\s\S]*min-height: 44px/.test(css), "ações mobile precisam de alvo de toque confortável");
assert.ok(/@media \(max-width: 620px\)[\s\S]*min-height: 44px/.test(plansCss), "lista de cronogramas precisa de alvos de toque confortáveis");

console.log("design-system: ok (tokens, componentes, foco e responsividade)");
