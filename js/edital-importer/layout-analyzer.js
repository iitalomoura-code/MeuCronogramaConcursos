(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});
  const CONTENT_TITLE = /^(?:CONHECIMENTOS|CONTEÚDO|PROGRAMA|DISCIPLINAS|MATÉRIAS|ANEXO)\b/i;

  importer.isLikelyHeading = function isLikelyHeading(block) {
    const text = importer.normalizeText(block?.normalizedText || block?.text);
    if (!text || text.length > 145) return false;
    if (block?.type === "heading") return true;
    if (/^\d+(?:\.\d+)*[.)\-:]\s+/.test(text)) return true;
    const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, "");
    const uppercase = letters && letters === letters.toUpperCase();
    return uppercase && text.split(/\s+/).length <= 14;
  };

  importer.analyzeLayout = function analyzeLayout(documentData) {
    const blocks = Array.isArray(documentData?.blocks) ? documentData.blocks : [];
    const sections = [];
    let current = null;
    blocks.forEach((block, index) => {
      const text = block.normalizedText || importer.normalizeText(block.text);
      if (!text) return;
      if (importer.isLikelyHeading(block)) {
        current = {
          id: `section-${sections.length + 1}`,
          title: importer.normalizeHeading(text),
          startBlockId: block.id,
          startIndex: index,
          page: block.page,
          kind: CONTENT_TITLE.test(text) ? "content" : "heading",
          blockIds: [block.id],
        };
        sections.push(current);
      } else if (current) {
        current.blockIds.push(block.id);
      }
    });
    return { sections, pageCount: documentData?.metadata?.pageCount || 0 };
  };
})(window);
