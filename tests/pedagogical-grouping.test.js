"use strict";

const assert = require("assert");
const grouping = require("../js/pedagogical-grouping.js");

function row(materia, assunto) {
  return { materia, assunto, estudar: "Sim" };
}

function titles(rows) {
  return rows.map((item) => item.assunto.split(":")[0]);
}

const portuguese = grouping.groupRows([
  row("Língua Portuguesa", "Ortografia: grafia e emprego das letras"),
  row("Língua Portuguesa", "Acentuação: regras gerais"),
  row("Língua Portuguesa", "Pontuação: emprego da vírgula"),
  row("Língua Portuguesa", "Sintaxe: termos da oração"),
]);
assert.equal(portuguese.length, 2, "Ortografia, acentuação e pontuação devem formar um tema.");
assert.ok(titles(portuguese).includes("Ortografia, acentuação e pontuação"));
assert.ok(portuguese[0].conteudosOriginais.every(Boolean), "O agrupamento deve preservar cada texto de origem.");

const wordClasses = grouping.groupRows([
  row("Língua Portuguesa", "Substantivo"),
  row("Língua Portuguesa", "Adjetivo"),
  row("Língua Portuguesa", "Pronome"),
  row("Língua Portuguesa", "Concordância verbal"),
]);
assert.equal(wordClasses.length, 2);
assert.ok(titles(wordClasses).includes("Classes de palavras"));

const technology = grouping.groupRows([
  row("Tecnologia da Informação", "Internet"),
  row("Tecnologia da Informação", "Navegadores"),
  row("Tecnologia da Informação", "Mecanismos de busca"),
  row("Tecnologia da Informação", "Computação em nuvem"),
  row("Tecnologia da Informação", "Segurança da Informação"),
]);
assert.equal(technology.length, 2);
assert.ok(titles(technology).includes("Internet, arquivos e serviços digitais"));

const planning = grouping.groupRows([
  row("Administração Geral e Pública", "Missão"),
  row("Administração Geral e Pública", "Visão"),
  row("Administração Geral e Pública", "Valores"),
  row("Administração Geral e Pública", "Metas"),
  row("Administração Geral e Pública", "Modelos de Administração Pública"),
]);
assert.equal(planning.length, 2);
assert.ok(titles(planning).includes("Planejamento estratégico"));

const expense = grouping.groupRows([
  row("Administração Financeira e Orçamentária", "Conceito de despesa"),
  row("Administração Financeira e Orçamentária", "Classificação da despesa"),
  row("Administração Financeira e Orçamentária", "Empenho"),
  row("Administração Financeira e Orçamentária", "Liquidação"),
  row("Administração Financeira e Orçamentária", "Pagamento"),
  row("Administração Financeira e Orçamentária", "Receita pública"),
]);
assert.equal(expense.length, 2);
assert.ok(titles(expense).includes("Despesa pública"));
assert.ok(titles(expense).includes("Receita pública"));

const contracting = grouping.groupRows([
  row("Licitações e Contratos", "PCA"),
  row("Licitações e Contratos", "Estudo Técnico Preliminar"),
  row("Licitações e Contratos", "Termo de referência"),
  row("Licitações e Contratos", "Matriz de riscos"),
  row("Licitações e Contratos", "Contratos administrativos"),
]);
assert.equal(contracting.length, 2);
assert.ok(titles(contracting).includes("Planejamento das contratações"));

const administrativeOrganization = grouping.groupRows([
  row("Direito Administrativo", "Administração direta"),
  row("Direito Administrativo", "Autarquias"),
  row("Direito Administrativo", "Fundações públicas"),
  row("Direito Administrativo", "Atos administrativos"),
]);
assert.equal(administrativeOrganization.length, 2);
assert.ok(titles(administrativeOrganization).includes("Organização administrativa"));
assert.ok(titles(administrativeOrganization).includes("Atos administrativos"));

const law = grouping.groupRows([
  row("Direito Administrativo", "Atos administrativos"),
  row("Direito Administrativo", "Poderes administrativos"),
  row("Direito Administrativo", "Agentes públicos"),
  row("Direito Administrativo", "Responsabilidade civil do Estado"),
]);
assert.equal(law.length, 4, "Temas jurídicos autônomos devem permanecer separados.");

console.log("OK - agrupamento pedagógico conservador preserva conteúdos e temas autônomos.");
