(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});

  importer.resolveContentForCargo = function resolveContentForCargo(documentData, cargoName) {
    const cargos = importer.detectCargos(documentData);
    const blocks = importer.detectContentBlocks(documentData, cargoName);
    const items = importer.parseSubjects(blocks);
    const result = { document: documentData, cargo: cargoName || null, cargos, blocks, items };
    result.confidence = importer.calculateConfidence(result);
    return result;
  };

  importer.toAppRows = function toAppRows(result) {
    return (result?.items || result?.rows || [])
      .filter((item) => item.selected !== false && item.materia && item.assunto)
      .map((item, index) => ({
        materia: importer.normalizeHeading(item.materia),
        assunto: importer.normalizeHeading(item.assunto),
        ordem: index + 1,
        estudar: "Sim",
        observacoes: "",
        origemEdital: {
          pagina: item.origin?.page || null,
          trecho: item.origin?.excerpt || "",
          bloco: item.origin?.blockId || null,
          secao: item.origin?.section || null,
          escopo: item.scope || "unknown",
          confianca: item.confidence || null,
        },
      }));
  };
})(window);
