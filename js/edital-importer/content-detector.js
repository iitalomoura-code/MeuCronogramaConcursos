(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});
  const CONTENT_TERMS = /\b(?:CONHECIMENTOS|CONTEÚDO PROGRAMÁTICO|PROGRAMA|DISCIPLINAS|MATÉRIAS)\b/i;

  function scopeFor(text, cargoName) {
    const value = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
    const cargo = String(cargoName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
    if (cargo && value.includes(cargo)) return "cargo";
    if (/\b(?:TODOS OS CARGOS|COMUM A TODOS|CONHECIMENTOS COMUNS)\b/.test(value)) return "common";
    if (/\b(?:NIVEL MEDIO|NIVEL SUPERIOR|ESCOLARIDADE|ENSINO MEDIO|ENSINO SUPERIOR)\b/.test(value)) return "education";
    if (/\b(?:GRUPO DE CARGOS|AREA(?:S)? DE |EIXO)\b/.test(value)) return "area";
    if (/\b(?:ESPECIALIDADE)\b/.test(value)) return "specialty";
    if (/\b(?:ESPECIFICOS?|ESPECIFICAS?)\b/.test(value)) return "specific";
    if (/\b(?:GERAIS?|BASICOS?)\b/.test(value)) return "general";
    return "unknown";
  }

  importer.detectContentBlocks = function detectContentBlocks(documentData, cargoName) {
    const blocks = documentData?.blocks || [];
    const sections = documentData?.layout?.sections || importer.analyzeLayout(documentData).sections;
    let activeScope = "unknown";
    let inContent = false;
    const detected = blocks.map((block) => {
      const text = block.normalizedText || importer.normalizeText(block.text);
      const section = sections.find((item) => item.startBlockId === block.id);
      const contextText = section ? text : `${activeScope} ${text}`;
      const directScope = scopeFor(text, cargoName);
      if (CONTENT_TERMS.test(text) || directScope !== "unknown") inContent = true;
      if (directScope !== "unknown") activeScope = directScope;
      const scope = directScope !== "unknown" ? directScope : activeScope;
      return { ...block, scope, applicable: inContent || scope !== "unknown", sectionTitle: section?.title || null, sourceText: contextText };
    });
    if (!detected.some((block) => block.applicable)) {
      return detected.map((block) => ({ ...block, applicable: true, scope: block.scope || "unknown" }));
    }
    return detected.filter((block) => block.applicable);
  };
})(window);
