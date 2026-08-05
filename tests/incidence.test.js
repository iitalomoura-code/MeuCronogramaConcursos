"use strict";

const assert = require("assert");
const path = require("path");

global.MeuCronogramaIncidenceData = {
  fgvV1: require(path.resolve(__dirname, "..", "data", "incidence", "fgv-incidence-base-v1.json")),
};
const incidence = require(path.resolve(__dirname, "..", "js", "incidence.js"));

const portuguese = incidence.resolve({
  board: "FGV",
  subject: "L\u00edngua Portuguesa",
  title: "Interpreta\u00e7\u00e3o de textos",
});
assert.strictEqual(portuguese.applied, true, "Tema presente no edital deve receber incidÃªncia quando a banca Ã© FGV.");
assert.strictEqual(portuguese.kind, "fgv", "Base especÃ­fica deve ser identificada como FGV.");
assert.strictEqual(portuguese.topicId, "interpretacao-reescrita", "Alias de interpretaÃ§Ã£o deve localizar o tÃ³pico FGV correto.");
assert.strictEqual(portuguese.percent, 34.93, "O percentual importado nÃ£o pode ser alterado.");

const afo = incidence.resolve({
  board: "FGV",
  subject: "Administra\u00e7\u00e3o Financeira e Or\u00e7ament\u00e1ria",
  title: "Despesa P\u00fablica: est\u00e1gios, empenho, liquida\u00e7\u00e3o e pagamento",
});
assert.strictEqual(afo.topicId, "despesa-publica", "Alias AFO deve localizar Despesa PÃºblica.");
assert.strictEqual(afo.percent, 20.43, "A incidÃªncia de Despesa PÃºblica deve respeitar a base fornecida.");

const macroChild = incidence.resolve({
  board: "FGV",
  subject: "Racioc\u00ednio L\u00f3gico-Matem\u00e1tico",
  title: "Equival\u00eancias l\u00f3gicas",
});
assert.strictEqual(macroChild.matchLevel, "macro-child", "Filhos de macrotema devem ser reconhecidos sem aplicar o peso integral do pai.");
assert.ok(Math.abs(macroChild.percent - (23.71 * 78.13 / 100)) < .0001, "A incidÃªncia do filho deve ser proporcional ao macrotema.");

const otherBoard = incidence.resolve({
  board: "Cebraspe",
  subject: "L\u00edngua Portuguesa",
  title: "Interpreta\u00e7\u00e3o de textos",
});
assert.strictEqual(otherBoard.applied, false, "Dados FGV nÃ£o podem ser aplicados a outra banca.");

const generalWithoutBoard = incidence.resolve({
  board: "",
  subject: "Banco de Dados e Business Intelligence",
  title: "SQL",
});
assert.strictEqual(generalWithoutBoard.applied, true, "A base geral deve estar disponÃ­vel quando nÃ£o houver banca definida.");
assert.strictEqual(generalWithoutBoard.kind, "general", "Base sem banca nÃ£o pode ser rotulada como FGV.");

const unknownTopic = incidence.resolve({
  board: "FGV",
  subject: "LÃ­ngua Portuguesa",
  title: "Tema inexistente do edital",
});
assert.strictEqual(unknownTopic.applied, false, "Um tÃ³pico ausente da base nÃ£o deve receber prioridade artificial.");

console.log("OK - base local FGV aplica apenas correspondÃªncias compatÃ­veis e preserva percentuais.");
