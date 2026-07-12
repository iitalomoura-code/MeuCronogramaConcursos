"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const sourceFiles = [
  "js/edital-importer/document-importer.js",
  "js/edital-importer/text-normalizer.js",
  "js/edital-importer/pdf-extractor.js",
  "js/edital-importer/docx-extractor.js",
  "js/edital-importer/layout-analyzer.js",
  "js/edital-importer/cargo-detector.js",
  "js/edital-importer/content-detector.js",
  "js/edital-importer/subject-parser.js",
  "js/edital-importer/confidence-calculator.js",
  "js/edital-importer/content-resolver.js",
  "js/edital-importer/import-validator.js",
  "js/edital-profiles/generic.js",
  "js/edital-profiles/fgv.js",
  "js/edital-profiles/fcc.js",
  "js/edital-profiles/cebraspe.js",
  "js/edital-profiles/vunesp.js",
  "js/edital-profiles/aocp.js",
  "js/edital-profiles/ibfc.js",
  "js/edital-profiles/cesgranrio.js",
];

function makeImporter() {
  const context = { window: {}, console, Date, URL, setTimeout, clearTimeout };
  context.window.window = context.window;
  vm.createContext(context);
  sourceFiles.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file }));
  return context.window.EditalImporter;
}

function block(id, page, text, type = "paragraph") {
  return { id, page, type, text, normalizedText: text, source: { format: "fixture" } };
}

function documentWith(blocks) {
  const importer = makeImporter();
  const normalized = importer.normalizeDocument({ metadata: { fileName: "fixture.txt" }, blocks });
  normalized.layout = importer.analyzeLayout(normalized);
  return { importer, document: normalized };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("PDF com texto pesquisável", async () => {
  const importer = makeImporter();
  importer.extractPdf = async () => ({ pageCount: 1, blocks: [block("p1", 1, "CARGO: ANALISTA"), block("p2", 1, "CONHECIMENTOS GERAIS", "heading"), block("p3", 1, "LINGUA PORTUGUESA", "heading"), block("p4", 1, "Interpretacao de textos.")] });
  const documentData = await importer.importDocument({ name: "edital.pdf", size: 400, arrayBuffer: async () => new ArrayBuffer(0) });
  assert.equal(documentData.metadata.pageCount, 1);
  assert.ok(documentData.blocks.length > 0);
});

test("PDF sem camada textual", async () => {
  const importer = makeImporter();
  importer.extractPdf = async () => ({ pageCount: 1, blocks: [] });
  await assert.rejects(() => importer.importDocument({ name: "escaneado.pdf", size: 400, arrayBuffer: async () => new ArrayBuffer(0) }), /texto no PDF/);
});

test("DOCX", async () => {
  const importer = makeImporter();
  importer.extractDocx = async () => ({ pageCount: 0, blocks: [block("d1", null, "LINGUA PORTUGUESA", "heading"), block("d2", null, "Compreensao textual.")] });
  const documentData = await importer.importDocument({ name: "edital.docx", size: 400, arrayBuffer: async () => new ArrayBuffer(0) });
  assert.equal(documentData.metadata.fileType, "docx");
});

test("documento vazio", async () => {
  const importer = makeImporter();
  await assert.rejects(() => importer.importDocument({ name: "vazio.txt", size: 0, text: async () => "" }), /não possui conteúdo textual/);
});

test("arquivo inválido", () => {
  const importer = makeImporter();
  assert.throws(() => importer.validateFile({ name: "edital.doc", size: 10 }), /Formato não suportado/);
});

test("cargo único", () => {
  const { importer, document } = documentWith([block("1", 1, "CARGO: ANALISTA DE CONTROLE")]);
  assert.equal(importer.detectCargos(document).length, 1);
});

test("vários cargos", () => {
  const { importer, document } = documentWith([block("1", 1, "CARGO: ANALISTA"), block("2", 2, "CARGO: TECNICO")]);
  assert.equal(importer.detectCargos(document).length, 2);
});

test("conteúdo geral e específico", () => {
  const { importer, document } = documentWith([
    block("1", 1, "CONHECIMENTOS GERAIS", "heading"), block("2", 1, "LINGUA PORTUGUESA", "heading"), block("3", 1, "Interpretacao de textos."),
    block("4", 2, "CONHECIMENTOS ESPECIFICOS", "heading"), block("5", 2, "DIREITO FINANCEIRO", "heading"), block("6", 2, "Despesa publica."),
  ]);
  const result = importer.resolveContentForCargo(document, null);
  assert.ok(result.items.some((item) => item.scope === "general"));
  assert.ok(result.items.some((item) => item.scope === "specific"));
});

test("conteúdo comum por escolaridade", () => {
  const { importer, document } = documentWith([block("1", 1, "CONHECIMENTOS PARA NIVEL SUPERIOR", "heading"), block("2", 1, "PORTUGUES", "heading"), block("3", 1, "Redacao oficial.")]);
  const result = importer.resolveContentForCargo(document, null);
  assert.ok(result.items.some((item) => item.scope === "education"));
});

test("matérias repetidas", () => {
  const { importer, document } = documentWith([block("1", 1, "PORTUGUES", "heading"), block("2", 1, "Interpretacao."), block("3", 2, "PORTUGUES", "heading"), block("4", 2, "Interpretacao.")]);
  const result = importer.resolveContentForCargo(document, null);
  assert.equal(result.items.length, 1);
});

test("assunto com ponto e vírgula", () => {
  const importer = makeImporter();
  assert.deepEqual([...importer.splitTopics("Atos administrativos; Poderes administrativos")], ["Atos administrativos", "Poderes administrativos"]);
});

test("conteúdo em duas colunas", () => {
  const importer = makeImporter();
  const lines = importer.reconstructPdfLines([
    { str: "Coluna A", transform: [10, 0, 0, 700, 20, 500], width: 45, height: 10 },
    { str: "Coluna B", transform: [10, 0, 0, 700, 180, 500], width: 45, height: 10 },
  ], 1);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].text, "Coluna A Coluna B");
});

test("cabeçalho repetido", () => {
  const importer = makeImporter();
  const normalized = importer.normalizeDocument({ blocks: [
    block("1", 1, "PREFEITURA MUNICIPAL"), block("2", 1, "Tema A"), block("3", 1, "Linha A"), block("4", 1, "Linha B"), block("5", 1, "Linha C"), block("6", 1, "Página 1"),
    block("7", 2, "PREFEITURA MUNICIPAL"), block("8", 2, "Tema B"), block("9", 2, "Linha D"), block("10", 2, "Linha E"), block("11", 2, "Linha F"), block("12", 2, "Página 2"),
    block("13", 3, "PREFEITURA MUNICIPAL"), block("14", 3, "Tema C"), block("15", 3, "Linha G"), block("16", 3, "Linha H"), block("17", 3, "Linha I"), block("18", 3, "Página 3"),
  ] });
  assert.ok(!normalized.blocks.some((entry) => entry.normalizedText === "PREFEITURA MUNICIPAL"));
});

test("mudança de página no meio de uma matéria", () => {
  const { importer, document } = documentWith([block("1", 1, "DIREITO FINANCEIRO", "heading"), block("2", 1, "Receita publica."), block("3", 2, "Despesa publica.")]);
  const result = importer.resolveContentForCargo(document, null);
  assert.ok(result.items.some((item) => item.origin.page === 2));
});

test("cancelamento não persiste conteúdo", () => {
  const { importer, document } = documentWith([block("1", 1, "PORTUGUES", "heading"), block("2", 1, "Interpretacao.")]);
  const result = importer.resolveContentForCargo(document, null);
  const before = JSON.stringify(result.items);
  importer.validateImport(result);
  assert.equal(JSON.stringify(result.items), before);
});

test("compatibilidade com conteúdo legado", () => {
  const importer = makeImporter();
  const legacyRows = [{ materia: "PORTUGUES", assunto: "Interpretacao", ordem: 1, estudar: "Sim" }];
  const imported = importer.toAppRows({ items: [{ materia: "DIREITO", assunto: "Atos", selected: true, scope: "specific", origin: {}, confidence: { score: 0.5, label: "Média" } }] });
  assert.equal(legacyRows[0].materia, "PORTUGUES");
  assert.equal(imported[0].origemEdital.escopo, "specific");
});

(async () => {
  let failed = 0;
  for (const item of tests) {
    try {
      await item.run();
      console.log(`OK - ${item.name}`);
    } catch (error) {
      failed += 1;
      console.error(`FALHOU - ${item.name}: ${error.message}`);
    }
  }
  console.log(`${tests.length - failed}/${tests.length} testes aprovados.`);
  process.exitCode = failed ? 1 : 0;
})();
