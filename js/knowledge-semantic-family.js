"use strict";

(function initKnowledgeSemanticFamily(global) {
  const normalize = (value = "") => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const FAMILIES = Object.freeze([
    ["portugues", /\b(portugues|lingua portuguesa|gramatica|interpretacao de textos?)\b/],
    ["rlm-matematica", /\b(rlm|raciocinio logico|raciocinio logico matematico|matematica)\b/],
    ["controle-externo", /\b(controle externo|tribunais? de contas|auditoria governamental)\b/],
    ["direito-constitucional", /\b(direito constitucional|constitucional)\b/],
    ["direito-tributario", /\b(direito tributario|legislacao tributaria|tributario)\b/],
    ["direito-administrativo", /\b(direito administrativo)\b/],
    ["administracao-gestao", /\b(administracao geral|administracao publica|administracao geral e publica|gestao|governanca)\b/],
    ["afo-financas-publicas", /\b(afo|administracao financeira e orcamentaria|financas publicas|orcamento publico|direito financeiro)\b/],
    ["economia", /\b(economia|economia e financas)\b/],
    ["contabilidade", /\b(contabilidade|contabil)\b/],
    ["auditoria", /\b(auditoria)\b/],
    ["ti-dados", /\b(tecnologia da informacao|ti|dados|informatica|seguranca da informacao)\b/],
    ["previdenciario", /\b(previdenciario|previdencia)\b/],
    ["direito-penal", /\b(direito penal|penal|processo penal)\b/],
    ["licitacoes-contratos", /\b(licitacoes?|contratos administrativos)\b/],
    ["legislacao-especifica", /\b(legislacao|lei|estatuto)\b/],
  ]);
  // Bridges only widen the candidate search. They never replace the thematic anchor gate.
  const BRIDGES = new Set(["afo-financas-publicas|economia"]);

  function semanticFamilyForSubject(subject = "") {
    const value = normalize(subject);
    return FAMILIES.find(([, pattern]) => pattern.test(value))?.[0] || "unknown";
  }

  function semanticFamiliesForConcept(concept = {}) {
    return new Set((concept.subjects || concept.sourceSubjects || []).map(semanticFamilyForSubject).filter((family) => family !== "unknown"));
  }

  function semanticCompatibility(target = {}, concept = {}) {
    const targetSubject = normalize(target.subject || target);
    const targetFamily = semanticFamilyForSubject(targetSubject);
    const sourceFamilies = [...semanticFamiliesForConcept(concept)].sort();
    const sameSubject = targetSubject && (concept.subjects || []).some((subject) => normalize(subject) === targetSubject);
    const bridge = sourceFamilies.some((sourceFamily) => BRIDGES.has([targetFamily, sourceFamily].sort().join("|")));
    const allowed = Boolean(sameSubject || (targetFamily !== "unknown" && sourceFamilies.includes(targetFamily)) || bridge);
    return { allowed, targetFamily, sourceFamilies, basis: sameSubject ? "same-subject" : bridge ? "controlled-bridge" : allowed ? "family-intersection" : "incompatible-family" };
  }

  global.KnowledgeSemanticFamily = { semanticFamilyForSubject, semanticFamiliesForConcept, semanticCompatibility, FAMILIES: FAMILIES.map(([id]) => id), BRIDGES: [...BRIDGES] };
  if (typeof module !== "undefined" && module.exports) module.exports = global.KnowledgeSemanticFamily;
})(typeof window !== "undefined" ? window : globalThis);
