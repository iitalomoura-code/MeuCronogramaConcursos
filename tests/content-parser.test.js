"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const documentStructureParser = require(path.resolve(__dirname, "..", "js", "document-structure-parser.js"));

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
    window: { DocumentStructureParser: documentStructureParser },
  };
  vm.createContext(context);
  vm.runInContext("let lastProgramParseMeta = { subjects: [], subjectsWithoutTopics: [] };\n" + source.slice(start, end) + "\nthis.getLastProgramParseMeta = () => lastProgramParseMeta;", context);
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

const cebraspeOutline = parser.parseProgramContent(`
CONHECIMENTOS ESPEC\u00cdFICOS
ADMINISTRA\u00c7\u00c3O FINANCEIRA E OR\u00c7AMENT\u00c1RIA
1 Or\u00e7amento p\u00fablico.
1.1 Conceito.
1.2 Princ\u00edpios or\u00e7ament\u00e1rios.
1.3 Ciclo or\u00e7ament\u00e1rio.
2 Receita p\u00fablica.
2.1 Conceito.
2.2 Classifica\u00e7\u00f5es.
2.3 Est\u00e1gios da receita.
3 Despesa p\u00fablica.
3.1 Conceito.
3.2 Classifica\u00e7\u00f5es.
3.3 Est\u00e1gios da despesa.
3.3.1 Empenho.
3.3.2 Liquida\u00e7\u00e3o.
3.3.3 Pagamento.

DIREITO ADMINISTRATIVO
1 Organiza\u00e7\u00e3o administrativa.
1.1 Administra\u00e7\u00e3o direta e indireta.
1.2 Autarquias.
2 Atos administrativos.
2.1 Conceito.
2.2 Requisitos.
`);
assert.equal(cebraspeOutline.length, 5, "Itens principais devem virar temas, sem criar tema para cada subitem.");
const expense = cebraspeOutline.find((row) => row.materia === "ADMINISTRA\u00c7\u00c3O FINANCEIRA E OR\u00c7AMENT\u00c1RIA" && row.assunto.startsWith("Despesa p\u00fablica"));
assert.ok(expense, "Despesa p\u00fablica deve permanecer como tema principal.");
["Conceito", "Classifica\u00e7\u00f5es", "Est\u00e1gios da despesa", "Empenho", "Liquida\u00e7\u00e3o", "Pagamento"].forEach((content) => assert.ok(expense.assunto.includes(content), `Conte\u00fado hier\u00e1rquico esperado: ${content}`));
assert.equal(expense.origemEdital.parsedStructure.number, "3", "A origem deve preservar o n\u00famero do tema principal.");
assert.equal(expense.origemEdital.parsedStructure.children[2].children[0].number, "3.3.1", "A \u00e1rvore original deve preservar o v\u00ednculo pai-filho.");

const strategicOutline = parser.parseProgramContent(`
ADMINISTRA\u00c7\u00c3O P\u00daBLICA
1 Gest\u00e3o estrat\u00e9gica.
1.1 Planejamento estrat\u00e9gico.
1.1.1 Miss\u00e3o, vis\u00e3o e valores.
1.1.2 An\u00e1lise SWOT.
1.1.3 Indicadores.
1.2 Gest\u00e3o de pessoas.
1.2.1 Lideran\u00e7a.
1.2.2 Motiva\u00e7\u00e3o.
1.2.3 Gest\u00e3o por compet\u00eancias.
`);
assert.equal(strategicOutline.length, 2, "Ramos aut\u00f4nomos de segundo n\u00edvel devem virar temas de estudo.");
const strategicPlanning = strategicOutline.find((row) => row.assunto.startsWith("Planejamento estrat\u00e9gico"));
const peopleManagement = strategicOutline.find((row) => row.assunto.startsWith("Gest\u00e3o de pessoas"));
assert.ok(strategicPlanning && peopleManagement, "Planejamento estrat\u00e9gico e gest\u00e3o de pessoas devem permanecer separados.");
["Miss\u00e3o, vis\u00e3o e valores", "An\u00e1lise SWOT", "Indicadores"].forEach((content) => assert.ok(strategicPlanning.assunto.includes(content), `Conte\u00fado esperado em planejamento: ${content}`));
["Lideran\u00e7a", "Motiva\u00e7\u00e3o", "Gest\u00e3o por compet\u00eancias"].forEach((content) => assert.ok(peopleManagement.assunto.includes(content), `Conte\u00fado esperado em gest\u00e3o de pessoas: ${content}`));
assert.equal(strategicPlanning.origemEdital.parsedStructure.number, "1.1", "A origem deve preservar a numera\u00e7\u00e3o do tema promovido.");
assert.equal(strategicPlanning.origemEdital.contextoEstrutural.number, "1", "O contexto estrutural do item pai deve ser preservado.");
assert.deepEqual(strategicOutline.map((row) => row.assunto.split(":")[0]), ["Planejamento estrat\u00e9gico", "Gest\u00e3o de pessoas"], "A ordem dos ramos aut\u00f4nomos deve seguir o edital.");

const orphanOutline = parser.detectOutlineProblems([{ text: "2.1 Item sem pai", sourceLine: 1 }]);
assert.ok(orphanOutline.problems.some((problem) => problem.type === "missing-parent" && problem.number === "2.1"), "Subitem sem pai deve ser registrado para revis\u00e3o manual.");

const continuation = parser.parseProgramContent(`
GEST\u00c3O ESTRAT\u00c9GICA GOVERNAMENTAL
1 Gest\u00e3o estrat\u00e9gica, planejamento institucional,
indicadores de desempenho e avalia\u00e7\u00e3o de resultados.
1.1 Miss\u00e3o e vis\u00e3o.
`);
assert.equal(continuation.length, 1, "Linha continuada deve permanecer no mesmo tema numerado.");
assert.ok(continuation[0].assunto.includes("indicadores de desempenho e avalia\u00e7\u00e3o de resultados"), "Continua\u00e7\u00e3o de PDF deve ser incorporada ao item anterior.");

const inlineOutline = parser.parseProgramContent("ADMINISTRA\u00c7\u00c3O P\u00daBLICA\n1 Administra\u00e7\u00e3o p\u00fablica. 1.1 Modelos. 1.2 Evolu\u00e7\u00e3o.");
assert.equal(inlineOutline.length, 1, "Marcadores na mesma linha devem gerar uma \u00fanica estrutura hier\u00e1rquica.");
assert.ok(inlineOutline[0].assunto.includes("Modelos") && inlineOutline[0].assunto.includes("Evolu\u00e7\u00e3o"), "Subitens na mesma linha devem ser associados ao tema principal.");
assert.equal(parser.parseOutlineNumber("10.1.2. Item" ).level, 3, "N\u00edveis devem aceitar ponto final opcional.");
assert.equal(parser.parseOutlineNumber("10").level, 1, "Marcador isolado deve preservar seu n\u00edvel para receber a linha seguinte.");
assert.equal(parser.parseOutlineNumber("Lei n\u00ba 14.133/2021"), null, "N\u00fameros de leis no texto n\u00e3o podem ser tratados como hierarquia.");

const structuredTaxonomy = parser.parseProgramContent(`
LÍNGUA PORTUGUESA
1. Interpretação, tipologia e organização textual
Gêneros literários e não literários; textos narrativos, descritivos e argumentativos.
2. Semântica e emprego vocabular
Sentido e emprego dos vocábulos; campos semânticos.
`);
assert.equal(structuredTaxonomy.length, 2, "Estrutura reconhecida deve preservar cada título numerado como tema.");
assert.equal(structuredTaxonomy[0].structureSource, "user-structured", "Documento estruturado não deve seguir o agrupamento de edital bruto.");
assert.equal(structuredTaxonomy[0].conteudosOriginais.length, 1, "Descrição estruturada com ponto e vírgula deve permanecer uma unidade original.");
assert.equal(parser.getLastProgramParseMeta().mode, "structured", "A prévia deve receber a interpretação estrutural do documento.");

const uppercaseAcronymOutline = parser.parseProgramContent(`
LEGISLAÇÃO TRIBUTÁRIA
1. CSLL
Princípios; fato gerador; contribuinte; base de cálculo e apuração.
5. IPI e IOF
Princípios constitucionais; fato gerador; contribuinte; base de cálculo e apuração.
6. PIS/Pasep e COFINS
Regime cumulativo e não cumulativo.
`);
assert.deepEqual([...new Set(uppercaseAcronymOutline.map((row) => row.materia))], ["LEGISLAÇÃO TRIBUTÁRIA"], "Siglas numeradas não podem abrir matérias novas.");
assert.deepEqual(uppercaseAcronymOutline.map((row) => row.assunto.split(":")[0]), ["CSLL", "IPI e IOF", "PIS/Pasep e COFINS"], "Títulos com siglas devem permanecer como temas individuais.");
assert.equal(uppercaseAcronymOutline[0].outlineNumber, "1", "A numeração do tema deve permanecer no row final.");
assert.equal(uppercaseAcronymOutline[0].outlineLevel, 1, "O nível do tema deve permanecer no row final.");
assert.equal(uppercaseAcronymOutline[0].sourceBlockType, "numbered-item", "A origem do bloco numerado deve ser preservada.");

const uppercaseAcronymWithoutNumber = parser.parseProgramContent(`
LEGISLAÇÃO TRIBUTÁRIA
CSLL
Princípios; fato gerador; contribuinte; base de cálculo e apuração.
IPI e IOF
Princípios constitucionais; fato gerador; contribuinte; base de cálculo e apuração.
`);
assert.deepEqual([...new Set(uppercaseAcronymWithoutNumber.map((row) => row.materia))], ["LEGISLAÇÃO TRIBUTÁRIA"], "Título curto seguido de descrição deve permanecer na matéria aberta.");
assert.deepEqual(uppercaseAcronymWithoutNumber.map((row) => row.assunto.split(":")[0]), ["CSLL", "IPI e IOF"], "O padrão título e descrição deve produzir temas, mesmo sem numeração.");

const realSubjectTransition = parser.parseProgramContent(`
LEGISLAÇÃO TRIBUTÁRIA
8. CIDE
Contribuição de intervenção no domínio econômico.
LEGISLAÇÃO ADUANEIRA
1. Jurisdição e Administração Aduaneira
Competências e normas aplicáveis.
`);
assert.deepEqual([...new Set(realSubjectTransition.map((row) => row.materia))], ["LEGISLAÇÃO TRIBUTÁRIA", "LEGISLAÇÃO ADUANEIRA"], "Uma transição estrutural real deve abrir a nova matéria.");

const acronymInsideAdministration = parser.parseProgramContent(`
ADMINISTRAÇÃO GERAL E PÚBLICA
Balanced Scorecard — BSC
Indicadores, perspectivas e mapa estratégico.
`);
assert.deepEqual([...new Set(acronymInsideAdministration.map((row) => row.materia))], ["ADMINISTRAÇÃO GERAL E PÚBLICA"], "Sigla em título interno não pode virar matéria.");
assert.equal(acronymInsideAdministration[0].assunto.split(":")[0], "Balanced Scorecard — BSC", "O título interno deve ser preservado integralmente.");

console.log(`OK - parser TCE-PE: ${subjects.length} materias e ${rows.length} temas.`);
console.log("OK - marcadores gen\u00e9ricos, temas expl\u00edcitos, numera\u00e7\u00e3o hier\u00e1rquica, continua\u00e7\u00f5es e normaliza\u00e7\u00e3o.");
