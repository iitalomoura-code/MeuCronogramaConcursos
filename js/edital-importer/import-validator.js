(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});

  importer.validateImport = function validateImport(result) {
    const errors = [];
    const warnings = [];
    const items = result?.items || result?.rows || [];
    if (!items.length) errors.push("Nenhuma matéria ou tema foi identificado. Tente outro trecho do edital ou adicione itens manualmente.");
    if (result?.confidence?.score < 0.45) warnings.push("A detecção tem confiança baixa. Revise cuidadosamente os itens antes de confirmar.");
    if (!result?.cargo) warnings.push("Nenhum cargo específico foi selecionado. A revisão pode conter apenas conteúdos comuns.");
    const lowConfidence = items.filter((item) => item.confidence?.label === "Baixa").length;
    if (lowConfidence) warnings.push(`${lowConfidence} item(ns) precisam de revisão por terem baixa confiança.`);
    return { valid: errors.length === 0, errors, warnings };
  };
})(window);
