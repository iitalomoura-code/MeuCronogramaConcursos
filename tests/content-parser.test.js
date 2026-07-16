"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("function uppercaseRatio");
const end = source.indexOf("function prefersReducedMotion");
if (start < 0 || end < 0) throw new Error("Parser de conteudo nao encontrado em app.js.");

function normalizeForMatch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function loadParser() {
  const context = {
    normalizeForMatch,
    normalizeTopic: (value) => String(value || "").trim().replace(/\s*[.;]$/, ""),
    stripEnumerator: (value) => String(value || "")
      .replace(/^\s*(?:\d+(?:\.\d+)*|[IVXLCDM]+|[A-Z])[\).\-\s]+/i, "")
      .replace(/^\s*[-\u2022*]\s+/, "")
      .trim(),
    enrichThemeRow: (row) => row,
  };
  vm.createContext(context);
  vm.runInContext("let lastProgramParseMeta = { subjects: [], subjectsWithoutTopics: [] };\n" + source.slice(start, end), context);
  return context;
}

const parser = loadParser();
const tcePeFixture = `
MAT\u00c9RIA: L\u00edngua Portuguesa
Compreens\u00e3o e interpreta\u00e7\u00e3o de textos: tipologias, coes\u00e3o e coer\u00eancia
Morfologia e classes gramaticais: emprego e flex\u00e3o das palavras

MAT\u00c9RIA: Administra\u00e7\u00e3o Geral e P\u00fablica
Administra\u00e7\u00e3o e Processo Administrativo: n\u00edveis hier\u00e1rquicos, compet\u00eancias gerenciais, planejamento, organiza\u00e7\u00e3o, dire\u00e7\u00e3o e controle
Fundamentos do Processo Administrativo: conceito, finalidade, transpar\u00eancia e controle
Atos Administrativos: requisitos, atributos e esp\u00e9cies
Modelos de Administra\u00e7\u00e3o P\u00fablica: gest\u00e3o p\u00fablica, modelo racional-legal, modelo burocr\u00e1tico e paradigma p\u00f3s-burocr\u00e1tico
Poderes da Administra\u00e7\u00e3o P\u00fablica: hier\u00e1rquico, disciplinar, regulamentar e de pol\u00edcia
Organiza\u00e7\u00e3o Administrativa: centraliza\u00e7\u00e3o, descentraliza\u00e7\u00e3o e desconcentra\u00e7\u00e3o
Agentes P\u00fablicos: cargo, emprego e fun\u00e7\u00e3o p\u00fablica
Responsabilidade Civil do Estado: responsabilidade objetiva e excludentes
Pol\u00edticas P\u00fablicas: formula\u00e7\u00e3o, monitoramento e avalia\u00e7\u00e3o

MAT\u00c9RIA: Direito Financeiro
Receita P\u00fablica: classifica\u00e7\u00e3o e est\u00e1gios
MAT\u00c9RIA: Controle Externo
Fiscaliza\u00e7\u00e3o: controle externo e presta\u00e7\u00e3o de contas
MAT\u00c9RIA: Contabilidade P\u00fablica
Patrim\u00f4nio P\u00fablico: varia\u00e7\u00f5es patrimoniais
MAT\u00c9RIA: Auditoria
Auditoria Governamental: evid\u00eancias e relat\u00f3rios
MAT\u00c9RIA: Direito Constitucional
Direitos Fundamentais: garantias constitucionais
MAT\u00c9RIA: Legisla\u00e7\u00e3o
Lei Org\u00e2nica: estrutura e compet\u00eancias
MAT\u00c9RIA: Racioc\u00ednio L\u00f3gico
Proposi\u00e7\u00f5es: conectivos e equival\u00eancias
MAT\u00c9RIA: Tecnologia da Informa\u00e7\u00e3o
Seguran\u00e7a da Informa\u00e7\u00e3o: conceitos e boas pr\u00e1ticas
`;

const rows = parser.parseProgramContent(tcePeFixture);
const subjects = [...new Set(rows.map((row) => row.materia))];
assert.equal(subjects.length, 10, "Fixture do TCE-PE deve resultar em 10 materias.");

const administrationThemes = rows.filter((row) => row.materia === "Administra\u00e7\u00e3o Geral e P\u00fablica").map((row) => row.assunto.split(":")[0]);
[
  "Administra\u00e7\u00e3o e Processo Administrativo",
  "Fundamentos do Processo Administrativo",
  "Atos Administrativos",
  "Modelos de Administra\u00e7\u00e3o P\u00fablica",
  "Poderes da Administra\u00e7\u00e3o P\u00fablica",
  "Organiza\u00e7\u00e3o Administrativa",
  "Agentes P\u00fablicos",
  "Responsabilidade Civil do Estado",
  "Pol\u00edticas P\u00fablicas",
].forEach((theme) => assert.ok(administrationThemes.includes(theme), `Tema esperado: ${theme}`));

const labels = parser.parseProgramContent("MAT\u00c9RIA: Administra\u00e7\u00e3o\nASSUNTO 1\nAssunto: planejamento, organiza\u00e7\u00e3o e controle");
assert.equal(new Set(labels.map((row) => row.materia)).size, 1, "ASSUNTO 1 nao pode abrir materia.");
assert.ok(!labels.some((row) => /^Assunto:/i.test(row.assunto)), "Assunto nao pode virar nome repetido de tema.");

const model = parser.parseProgramContent("MAT\u00c9RIA: Administra\u00e7\u00e3o\nModelos de Administra\u00e7\u00e3o P\u00fablica: gest\u00e3o p\u00fablica, modelo burocr\u00e1tico");
assert.equal(model.length, 1);
assert.equal(model[0].assunto.split(":")[0], "Modelos de Administra\u00e7\u00e3o P\u00fablica");
assert.ok(model[0].assunto.includes("gest\u00e3o p\u00fablica, modelo burocr\u00e1tico"), "Virgulas devem permanecer no conteudo do tema.");

const normalized = parser.formatImportedProgramText(tcePeFixture);
assert.deepEqual(parser.parseProgramContent(normalized), rows, "Texto colado e texto normalizado de arquivo devem gerar o mesmo resultado.");
assert.ok(!/parseProgramContent\(text\)/.test(source.slice(source.indexOf("els.fileInput"), source.indexOf("els.processButton"))), "Selecionar arquivo nao pode processar state.rows.");

const subjectsInOpenContext = parser.parseProgramContent("L\u00cdNGUA PORTUGUESA\nInterpreta\u00e7\u00e3o de textos: coes\u00e3o e coer\u00eancia\nRACIOC\u00cdNIO L\u00d3GICO-MATEM\u00c1TICO\nProposi\u00e7\u00f5es: conectivos e equival\u00eancias\nMODELOS DE ADMINISTRA\u00c7\u00c3O P\u00daBLICA: gest\u00e3o p\u00fablica e governan\u00e7a");
assert.deepEqual([...new Set(subjectsInOpenContext.map((row) => row.materia))], ["L\u00cdNGUA PORTUGUESA", "RACIOC\u00cdNIO L\u00d3GICO-MATEM\u00c1TICO"], "Nova materia conhecida deve ser reconhecida com outra materia aberta, sem promover titulo interno.");

console.log(`OK - parser TCE-PE: ${subjects.length} materias e ${rows.length} temas.`);
console.log("OK - marcadores genericos, temas explicitos, virgulas e normalizacao.");
