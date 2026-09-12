"use strict";

const assert = require("node:assert/strict");
const semantic = require("../js/knowledge-semantic-family.js");
const mapping = require("../js/knowledge-mapping.js");
const knowledge = require("../js/knowledge-base.js");

function fixture(items) {
  const base = knowledge.migrateKnowledgeMappings({ schemaVersion: 2, concepts: [], evidence: [], topicMappings: [] });
  items.forEach((item, index) => {
    const key = mapping.normalize(item.title);
    base.concepts.push({ id: `concept:${key}`, canonicalKey: key, canonicalTitle: item.title });
    base.evidence.push({ id: `e-${index}`, canonicalKey: key, canonicalTitle: item.title, originalTopic: item.title, originalDetails: item.details || "", originalSubject: item.subject, questions: 20, correctAnswers: 15, studiedMinutes: 30 });
  });
  return knowledge.migrateKnowledgeMappings(base);
}
function match(base, subject, title, details = "") { return mapping.matchTopicToConcepts({ materia: subject, assunto: title, descricao: details }, base); }

let base = fixture([{ title: "Atos Administrativos", subject: "Administração Geral e Pública" }]);
assert.equal(match(base, "Direito Administrativo", "Atos Administrativos").status, "auto-confirmed");

base = fixture([{ title: "Crase", subject: "Língua Portuguesa" }, { title: "Pontuação", subject: "Língua Portuguesa" }]);
assert.equal(match(base, "Português", "Crase e Pontuação").relationship, "composite");

base = fixture([{ title: "Proposições e Conectivos", subject: "RLM", details: "proposições conectivos negação conjunção" }, { title: "Equivalências e Implicações Lógicas", subject: "RLM", details: "equivalências implicações" }]);
const rlm = match(base, "Raciocínio Lógico-Matemático", "Lógica Proposicional", "proposições conectivos equivalências implicações quantificadores predicados");
assert.equal(rlm.status, "suggested");
assert.equal(rlm.relationship, "composite");
assert.ok(rlm.coverage < 1);

base = fixture([{ title: "Gestão de Processos", subject: "Administração Geral", details: "processos organizacionais" }]);
const process = match(base, "Administração Pública", "Gestão de Processos e BPM");
assert.equal(process.status, "suggested");
assert.equal(process.relationship, "partial");

base = fixture([{ title: "Direitos e Garantias Fundamentais", subject: "Direito Constitucional", details: "direitos fundamentais individuais coletivos" }]);
assert.ok(["suggested", "auto-confirmed"].includes(match(base, "Direito Constitucional", "Direitos Fundamentais", "direitos fundamentais individuais coletivos").status));

const negatives = [
  ["Raciocínio Lógico-Matemático", "Grandezas e Medidas", "Controle Externo", "Medidas Cautelares"],
  ["Economia e Finanças Públicas", "Setor Externo e Câmbio", "Controle Externo", "Controle Externo no Brasil"],
  ["Economia", "Política Fiscal e Ciclos Econômicos", "Direito Administrativo", "Agentes Públicos"],
  ["Economia", "Política Fiscal e Ciclos Econômicos", "Legislação Específica", "políticas estaduais da pessoa com deficiência"],
  ["Direito Tributário", "Administração Tributária", "Administração Pública", "Administração Pública"],
  ["Direito Administrativo", "Atos Administrativos", "Direito Administrativo", "Contratos Administrativos"],
  ["Direito Constitucional", "Controle da Administração Pública", "Direito Constitucional", "Controle de Constitucionalidade"],
];
negatives.forEach(([targetSubject, targetTitle, sourceSubject, sourceTitle]) => {
  const result = match(fixture([{ title: sourceTitle, subject: sourceSubject, details: sourceTitle }]), targetSubject, targetTitle, targetTitle);
  assert.equal(result.status, "unmatched", `${targetTitle} não deve sugerir ${sourceTitle}`);
  assert.equal(result.conceptKeys.length, 0);
});

assert.equal(semantic.semanticCompatibility({ subject: "Raciocínio Lógico-Matemático" }, { subjects: ["Controle Externo"] }).allowed, false);
assert.equal(semantic.semanticCompatibility({ subject: "Economia" }, { subjects: ["Controle Externo"] }).allowed, false);
assert.equal(semantic.semanticCompatibility({ subject: "Português" }, { subjects: ["Língua Portuguesa"] }).allowed, true);
assert.equal(semantic.semanticCompatibility({ subject: "RLM" }, { subjects: ["Raciocínio Lógico-Matemático"] }).allowed, true);
assert.equal(match(fixture([{ title: "Gestão Estratégica", subject: "Administração Geral" }]), "Direito Administrativo", "Responsabilidade Civil do Estado").status, "unmatched");

const administrationFalsePositives = [
  ["Teorias e Processo Administrativo", "OKR"],
  ["Comportamento Organizacional", "Atos Administrativos"],
  ["Recrutamento, Seleção e Cargos", "Análise do Ambiente Organizacional"],
  ["Treinamento e Desenvolvimento", "OKR"],
  ["Desempenho e Competências", "Administração e Processo Administrativo"],
  ["Gestão da Qualidade", "Gestão Estratégica na Administração Pública"],
  ["Administração Financeira", "Indicadores e Metas"],
  ["Reforma do Serviço Civil", "Responsabilidade Civil do Estado"],
  ["Participação Social", "Fundamentos do Processo Administrativo"],
  ["Transparência e Acesso à Informação", "Fundamentos do Processo Administrativo"],
  ["Consórcios e Órgãos Públicos", "Agentes Públicos"],
  ["Serviços Públicos", "Agentes Públicos"],
  ["Delegação de Serviços Públicos", "Agentes Públicos"],
  ["Bens Públicos", "Atos Administrativos"],
  ["Uso dos Bens Públicos", "Agentes Públicos"],
  ["Gestão de Riscos", "Planejamento Estratégico"],
  ["Ciclo de Políticas Públicas", "OKR"],
  ["Ciclo de Políticas Públicas", "Indicadores e Metas"],
  ["Planejamento e Avaliação de Políticas", "Planejamento Estratégico"],
];
administrationFalsePositives.forEach(([targetTitle, sourceTitle]) => {
  const result = match(fixture([{ title: sourceTitle, subject: "Administração Geral e Pública", details: sourceTitle }]), "Administração Geral e Pública", targetTitle, targetTitle);
  assert.equal(result.status, "unmatched", `${targetTitle} não deve sugerir ${sourceTitle}`);
  assert.equal(result.conceptKeys.length, 0);
});

const preservedGoodMatches = [
  ["Poderes Administrativos", "Poderes da Administração Pública"],
  ["Responsabilidade do Estado", "Responsabilidade Civil do Estado"],
  ["Governança Pública", "Governança e Gestão Pública"],
  ["Gestão de Processos e BPM", "Gestão de Processos"],
];
preservedGoodMatches.forEach(([targetTitle, sourceTitle]) => {
  const result = match(fixture([{ title: sourceTitle, subject: "Administração Geral e Pública", details: sourceTitle }]), "Administração Geral e Pública", targetTitle, targetTitle);
  assert.notEqual(result.status, "unmatched", `${targetTitle} deve preservar a correspondência plausível`);
});

const indexed = mapping.buildKnowledgeMappingIndex(fixture([
  { title: "Gestão de Processos", subject: "Administração Geral", details: "processos" },
  { title: "Gestão Estratégica", subject: "Administração Geral", details: "estratégia" },
]));
assert.ok(indexed.tokenDocumentFrequencyByFamily.get("administracao-gestao").get("gestao") >= 2);
assert.ok(mapping.topicAnchorCompatibility(
  mapping.topicDescriptor({ materia: "Administração Geral", assunto: "Treinamento e Desenvolvimento", descricao: "desenvolvimento objetivos avaliação" }),
  mapping.conceptDescriptor({ canonicalTitle: "OKR" }, {}, indexed),
  indexed,
).allowed === false);
const audit = mapping.inspectTopicMapping(fixture([{ title: "Gestão de Processos", subject: "Administração Geral", details: "processos" }]), { materia: "Administração Geral", assunto: "Gestão de Processos e BPM" });
assert.ok(audit.candidates[0].semanticGate && audit.candidates[0].topicAnchorGate);
assert.equal(typeof audit.candidates[0].topicAnchorGate.titleAffinity, "number");

const broadDetails = fixture([
  { title: "Bancos de Dados e SQL", subject: "TI e Dados", details: "dados analytics governança segurança big data" },
  { title: "Segurança da Informação", subject: "TI e Dados", details: "dados analytics governança segurança big data" },
]);
const broadIndex = mapping.buildKnowledgeMappingIndex(broadDetails);
const broadDescriptor = mapping.conceptDescriptor(broadDetails.concepts[0], broadDetails, broadIndex);
assert.equal(broadIndex.detailFingerprintUsage.size, 1);
assert.equal(broadDescriptor.trustedDetails.length, 0);
assert.equal(broadDescriptor.ignoredBroadDetails.length, 1);
assert.equal(match(broadDetails, "TI e Dados", "Governança de Dados", "dados analytics governança").status, "unmatched");
assert.equal(match(broadDetails, "TI e Dados", "Programação para Dados", "dados programação").status, "unmatched");
assert.equal(match(broadDetails, "TI e Dados", "Bancos NoSQL", "bancos nosql").status, "unmatched");
assert.equal(match(broadDetails, "TI e Dados", "Ciclo de Vida em Ciência de Dados", "dados analytics").status, "unmatched");
const dataMatches = [
  ["Análise de Dados", "Noções de Análise de Dados"],
  ["Analytics e Inteligência Artificial", "Inteligência Artificial e Aprendizado de Máquina"],
  ["Computação em Nuvem e Big Data", "Computação em Nuvem"],
];
dataMatches.forEach(([targetTitle, sourceTitle]) => {
  const result = match(fixture([{ title: sourceTitle, subject: "TI e Dados", details: sourceTitle }]), "TI e Dados", targetTitle, targetTitle);
  assert.notEqual(result.status, "unmatched", `${targetTitle} deve preservar a correspondência de dados plausível`);
});

const localDetails = fixture([{ title: "Teoria Especial", subject: "RLM", details: "quantificadores predicados" }]);
const localResult = match(localDetails, "RLM", "Lógica Aplicada", "quantificadores predicados equivalências");
assert.equal(localResult.status, "suggested");
assert.equal(localResult.candidates[0].topicAnchorGate.strongDetailEvidence, true);
assert.equal(mapping.tokenDistinctiveness("nao-observado", "rlm-matematica", mapping.buildKnowledgeMappingIndex(localDetails), "detail"), 0);

console.log("OK - precision-first semantic gate bloqueia cross-domain e preserva matches plausíveis.");
