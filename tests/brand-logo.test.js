"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const styles = read("styles.css");
const component = read("js/brand-logo.js");

assert.ok(index.includes('<brand-logo class="brand-logo" variant="compact"></brand-logo>'), "A sidebar deve usar o componente de marca compacto.");
assert.ok(index.includes('js/brand-logo.js?v=20260812-brand-logo'), "O componente deve ser carregado com cache-busting.");
assert.ok(component.includes('customElements.define("brand-logo", BrandLogo)'), "A marca deve ser registrada como Web Component.");
assert.ok(component.includes('["compact", "default", "large"]'), "As três variantes devem estar disponíveis.");
assert.ok(component.includes("Meu Cronograma") && component.includes("CONCURSOS"), "A grafia oficial da marca deve ser preservada.");
assert.ok(component.includes("var(--brand-logo-accent)"), "Checks e relógio devem usar a cor de destaque herdada.");
assert.ok(!/<image\b|href=["'](?:https?:|data:)/i.test(component), "A marca deve ser SVG nativo, sem imagem externa.");
assert.ok(styles.includes("--brand-logo-ink: var(--sidebar-text)"), "A variante da sidebar deve herdar o texto lateral.");
assert.ok(styles.includes("--brand-logo-accent: var(--primary)"), "A marca deve reutilizar a cor principal atual.");

console.log("OK - logo SVG reutilizável usa a identidade e as variáveis atuais.");
