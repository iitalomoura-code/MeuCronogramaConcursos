const assert = require("assert");
const fs = require("fs");

const css = fs.readFileSync("styles.css", "utf8");
const plansCss = fs.readFileSync("plans.css", "utf8");
const html = fs.readFileSync("index.html", "utf8");

[
  "--color-bg", "--color-surface", "--color-text", "--color-text-muted",
  "--color-border", "--color-accent", "--space-1", "--space-10",
  "--radius-sm", "--radius-md", "--radius-lg", "--shadow-soft", "--shadow-floating",
].forEach((token) => assert.ok(css.includes(token), `token ausente: ${token}`));

[".ds-page-header", ".ds-section-header", ".ds-surface", ".ds-list-row", ".ds-badge", ".ds-search", ".ds-empty-state", ".ds-metric"].forEach((component) => {
  assert.ok(css.includes(component), `primitivo ausente: ${component}`);
});

assert.ok((html.match(/ds-page-header/g) || []).length >= 10, "principais headers devem usar o padrão de página");
assert.ok(!css.includes("var(--accent)"), "componentes não podem depender de token inexistente");
assert.ok(css.includes("button:focus-visible"), "controles precisam de foco visível");
assert.ok(css.includes("@media (max-width: 560px)"), "deve existir comportamento mobile");
assert.ok(/@media \(max-width: 680px\)[\s\S]*min-height: 44px/.test(css), "ações mobile precisam de alvo de toque confortável");
assert.ok(/@media \(max-width: 620px\)[\s\S]*min-height: 44px/.test(plansCss), "lista de cronogramas precisa de alvos de toque confortáveis");

console.log("design-system: ok (tokens, componentes, foco e responsividade)");
