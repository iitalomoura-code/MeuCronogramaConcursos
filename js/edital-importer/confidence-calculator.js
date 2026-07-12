(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});

  importer.confidenceLabel = function confidenceLabel(score) {
    if (score >= 0.72) return "Alta";
    if (score >= 0.45) return "Média";
    return "Baixa";
  };

  importer.calculateConfidence = function calculateConfidence(result) {
    const items = result?.items || result?.rows || [];
    const cargos = result?.cargos || [];
    const blockCount = result?.document?.blocks?.length || 0;
    const evidences = [];
    let score = 0.2;
    if (blockCount) { score += 0.18; evidences.push("texto estruturado encontrado"); }
    if (items.length) { score += Math.min(0.35, items.length / 40); evidences.push(`${items.length} itens identificados`); }
    if (cargos.length) { score += 0.14; evidences.push("possíveis cargos encontrados"); }
    const finalScore = Number(Math.min(1, score).toFixed(2));
    return { score: finalScore, label: importer.confidenceLabel(finalScore), evidences };
  };
})(window);
