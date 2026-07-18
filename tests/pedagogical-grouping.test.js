const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projectRoot = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(projectRoot, "js", "content-taxonomy.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(projectRoot, "js", "pedagogical-grouping.js"), "utf8"), context);

const { groupRows, restoreOriginalRows } = context.window.PedagogicalGrouping;
const row = (materia, assunto, ordem = 1) => ({ materia, assunto, ordem, estudar: "Sim", observacoes: "" });
const names = (rows) => rows.map((item) => String(item.assunto || ""));

assert.ok(appSource.includes("function pedagogicallyOrganizeRows"), "A aplicação deve integrar o agrupador pedagógico.");
assert.ok(appSource.includes("function restorePedagogicalOriginalRows"), "A restauração da leitura original deve existir.");
assert.ok(appSource.includes("rowFromInputs(item, state.rows[index])"), "A edição visual deve preservar metadados pedagógicos.");

{
  const result = groupRows([
    row("Informática", "Internet e navegadores"),
    row("Informática", "Mecanismos de busca"),
    row("Informática", "Arquivos eletrônicos"),
    row("Informática", "Armazenamento em nuvem"),
    row("Informática", "Segurança da informação"),
    row("Informática", "Phishing e engenharia social"),
    row("Informática", "Malware e antivírus"),
  ]);
  assert(names(result).some((item) => item.startsWith("Internet, arquivos e serviços digitais:")));
  assert(names(result).some((item) => item.startsWith("Segurança da Informação:")));
  const security = result.find((item) => item.assunto.startsWith("Segurança da Informação:"));
  assert(!security.assunto.toLowerCase().includes("armazenamento em nuvem"));
}

{
  const result = groupRows([
    row("Administração Geral e Pública", "Missão, visão e valores"),
    row("Administração Geral e Pública", "Objetivos e metas"),
    row("Administração Geral e Pública", "Indicadores estratégicos"),
  ]);
  assert(names(result).some((item) => item.startsWith("Planejamento estratégico:")));
}

{
  const result = groupRows([
    row("Licitações e Contratos Administrativos", "Plano de Contratações Anual"),
    row("Licitações e Contratos Administrativos", "Estudo Técnico Preliminar"),
    row("Licitações e Contratos Administrativos", "Termo de Referência"),
    row("Licitações e Contratos Administrativos", "Matriz de riscos"),
  ]);
  assert(names(result).some((item) => item.startsWith("Planejamento das contratações:")));
}

{
  const result = groupRows([
    row("Direito Administrativo", "Atos administrativos"),
    row("Direito Administrativo", "Poderes administrativos"),
    row("Direito Administrativo", "Agentes públicos"),
  ]);
  assert.strictEqual(result.length, 3);
  assert(!result.some((item) => item.agrupamentoPedagogico));
}

{
  const result = groupRows([
    row("Informática", "Navegadores"),
    row("Informática", "Navegadores"),
  ]);
  assert.strictEqual(result.length, 1, "A importação não deve manter temas idênticos em duplicidade.");
}

{
  const original = [
    row("Língua Portuguesa", "Substantivos"),
    row("Língua Portuguesa", "Adjetivos"),
    row("Língua Portuguesa", "Pronomes"),
  ];
  const grouped = groupRows(original);
  assert(names(grouped).some((item) => item.startsWith("Classes de palavras:")));
  const restored = restoreOriginalRows(grouped);
  assert.deepStrictEqual(Array.from(names(restored)), names(original));
}

console.log("pedagogical-grouping.test.js: ok");
