"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const index = read("index.html");
const login = read("login.html");
const plans = read("plans.html");
const styles = read("styles.css");
const plansStyles = read("plans.css");
const component = read("js/brand-logo.js");

assert.ok(index.includes('class="brand-tagline institutional-slogan"'), "O slogan da sidebar deve reutilizar a classe institucional.");
assert.ok(login.includes('class="brand-slogan institutional-slogan"'), "O slogan do login deve reutilizar a classe institucional.");
assert.ok(plans.includes('class="institutional-slogan"'), "O slogan da selecao deve reutilizar a classe institucional.");
assert.ok(styles.includes('font-family: "Source Sans 3", "Segoe UI", Arial, sans-serif;'), "O slogan deve usar Source Sans 3 com fallback local.");
assert.ok(styles.includes("font-weight: 300"), "O slogan deve usar apenas o peso Light.");

assert.ok(index.includes('<brand-logo class="brand-logo" variant="compact"></brand-logo>'), "A sidebar deve usar o componente de marca compacto.");
assert.ok(index.includes('js/brand-logo.js?v=20260812-brand-logo'), "O componente deve ser carregado com cache-busting.");
assert.ok(component.includes('customElements.define("brand-logo", BrandLogo)'), "A marca deve ser registrada como Web Component.");
assert.ok(component.includes('["compact", "default", "large"]'), "As três variantes devem estar disponíveis.");
assert.ok(component.includes("Meu Cronograma") && component.includes("CONCURSOS"), "A grafia oficial da marca deve ser preservada.");
assert.ok(component.includes("var(--brand-logo-accent)"), "Checks e relógio devem usar a cor de destaque herdada.");
assert.ok(!/<image\b|href=["'](?:https?:|data:)/i.test(component), "A marca deve ser SVG nativo, sem imagem externa.");
assert.ok(styles.includes("--brand-logo-ink: var(--sidebar-text)"), "A variante da sidebar deve herdar o texto lateral.");
assert.ok(styles.includes("--brand-logo-accent: var(--primary)"), "A marca deve reutilizar a cor principal atual.");
assert.ok(login.includes('<brand-logo variant="default"></brand-logo>'), "O login deve usar a variante padrão.");
assert.ok(plans.includes('<brand-logo variant="large"></brand-logo>'), "A seleção de cronogramas deve usar a variante grande.");
assert.strictEqual((login.match(/Seu edital em ciclos inteligentes de estudo\./g) || []).length, 1, "O slogan deve aparecer uma vez no login.");
assert.strictEqual((plans.match(/Seu edital em ciclos inteligentes de estudo\./g) || []).length, 1, "O slogan deve aparecer uma vez na seleção.");
assert.ok(styles.includes(".login-brand-area .brand-slogan") && styles.includes("color: var(--muted)"), "O slogan do login deve usar texto secundário.");
assert.ok(plansStyles.includes(".plans-brand-area > p"), "O slogan da seleção deve ter estilo próprio e discreto.");

console.log("OK - logo SVG reutilizável usa a identidade e as variáveis atuais.");
