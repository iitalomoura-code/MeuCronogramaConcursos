"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("function subjectPlanningData");
const end = source.indexOf("function nearestAllowedDuration");
if (start < 0 || end < 0) throw new Error("Funções de meta pedagógica não encontradas.");

const subject = "Administração Financeira e Orçamentária";
const topic = "Despesa pública: conceito; classificação; estágios; empenho; liquidação; pagamento";
const context = {
  state: {
    rows: [],
    generatedBlocks: [],
    completedHistory: [],
    cycleHistory: [],
    cycleResults: [],
    planningBase: {
      materias: [{
        materia: subject,
        assuntos: [topic],
        temas: [{
          assunto: topic,
          conteudosOriginais: ["conceito", "classificação", "estágios", "empenho", "liquidação", "pagamento"],
          tamanhoEstimado: "Longo",
          blocosSugeridos: 2,
          dificuldadeEstimada: "Média",
        }],
      }],
    },
  },
  normalizeForMatch: (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(),
  normalizeTopic: (value) => String(value || "").trim(),
  topicKey: (materia, assunto) => `${String(materia || "").toLowerCase()}::${String(assunto || "").toLowerCase()}`,
  themeTitle: (value) => String(value || "").split(":")[0].trim(),
  themeDetails: (value) => String(value || "").includes(":") ? String(value).split(":").slice(1).join(":").trim() : String(value || "").trim(),
  topicAtoms: (value) => String(value || "").split(/;|,/).map((item) => item.trim()).filter(Boolean),
  estimateThemeBlocks: () => 1,
  estimateThemeSize: () => "Médio",
  estimateThemeDifficulty: () => "Média",
  topicMatches: (entry, materia, assunto) => String(entry?.materia || "") === materia && String(entry?.assunto || "") === assunto,
  normalizeStatus: (value) => value || "Não iniciado",
  availableStudyUnits: () => [topic],
  reviewAttentionUnitsForSubject: () => [],
};

vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const units = context.operationalStudyUnits({ materia: subject, assuntos: [topic] }, {});
assert.equal(units.length, 2, "Tema longo deve ser dividido em duas partes operacionais.");
assert.equal(units[0].metaId, units[1].metaId, "Partes do mesmo tema devem compartilhar a mesma meta.");
assert.equal(units[0].metaRequiredBlocks, 2, "A meta deve registrar quantas partes exige.");
assert.notEqual(units[0].metaPartKey, units[1].metaPartKey, "Cada parte operacional deve ter uma chave própria.");

context.state.generatedBlocks.push({ ...units[0], materia: subject, status: "Concluído" });
assert.equal(context.isMetaComplete(units[0]), false, "A conclusão parcial não deve concluir a meta temática.");
context.state.generatedBlocks.push({ ...units[1], materia: subject, status: "Concluído" });
assert.equal(context.isMetaComplete(units[1]), true, "A meta deve concluir somente após todas as partes.");

console.log("OK - temas pedagógicos geram partes operacionais vinculadas a uma única meta.");
