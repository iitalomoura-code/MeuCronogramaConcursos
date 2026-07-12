(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});

  importer.normalizeText = function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .trim();
  };

  importer.normalizeHeading = function normalizeHeading(value) {
    return importer.normalizeText(value)
      .replace(/^\s*(?:\d+(?:\.\d+)*|[IVXLCDM]+)[.)\-:]\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  importer.hierarchyLevel = function hierarchyLevel(text) {
    const match = String(text || "").match(/^\s*(\d+(?:\.\d+)*)[.)\-:]/);
    return match ? match[1].split(".").length : null;
  };

  function normalizedKey(value) {
    return importer.normalizeText(value).toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
  }

  function repeatedHeaderFooterKeys(blocks) {
    const byPage = new Map();
    blocks.forEach((block) => {
      if (!block.page || !block.normalizedText) return;
      const list = byPage.get(block.page) || [];
      list.push(block);
      byPage.set(block.page, list);
    });
    const counts = new Map();
    byPage.forEach((pageBlocks) => {
      if (pageBlocks.length < 6) return;
      const edgeBlocks = [pageBlocks[0], pageBlocks[pageBlocks.length - 1]];
      new Set(edgeBlocks.map((block) => normalizedKey(block.normalizedText)).filter((key) => key.length > 3 && key.length < 130)).forEach((key) => {
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    const threshold = Math.max(2, Math.ceil(byPage.size * 0.6));
    return new Set([...counts.entries()].filter(([, count]) => count >= threshold).map(([key]) => key));
  }

  importer.normalizeDocument = function normalizeDocument(documentData) {
    const inputBlocks = Array.isArray(documentData?.blocks) ? documentData.blocks : [];
    const normalizedBlocks = inputBlocks.map((block, index) => {
      const originalText = String(block.text || "");
      const normalizedText = importer.normalizeText(originalText);
      return {
        id: block.id || `block-${index + 1}`,
        page: Number(block.page) || null,
        type: block.type || "unknown",
        text: originalText,
        normalizedText,
        level: block.level ?? importer.hierarchyLevel(normalizedText),
        position: block.position || null,
        source: block.source || {},
      };
    });
    const repeated = repeatedHeaderFooterKeys(normalizedBlocks);
    const blocks = normalizedBlocks.filter((block) => !repeated.has(normalizedKey(block.normalizedText)));
    return {
      metadata: { ...(documentData?.metadata || {}), removedRepeatedHeaders: normalizedBlocks.length - blocks.length },
      blocks,
      originalBlocks: normalizedBlocks,
    };
  };
})(window);
