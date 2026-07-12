(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});
  const CATEGORY_TITLE = /^(?:CONHECIMENTOS|CONTEÚDO|PROGRAMA|DISCIPLINAS|MATÉRIAS|ANEXO)\b/i;

  function key(value) {
    return importer.normalizeText(value).toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  importer.splitTopics = function splitTopics(text) {
    const value = importer.normalizeHeading(text);
    if (!value) return [];
    const numbered = value.split(/\s+(?=(?:\d+(?:\.\d+)*[.)]|[a-z][.)])\s+)/i).map((item) => item.trim()).filter(Boolean);
    if (numbered.length > 1) return numbered;
    const semicolon = value.split(/;\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9])/).map((item) => item.trim()).filter(Boolean);
    return semicolon.length ? semicolon : [value];
  };

  importer.parseSubjects = function parseSubjects(blocks) {
    const rows = [];
    const seen = new Set();
    let currentSubject = "Conteúdo programático";
    let currentScope = "unknown";
    (blocks || []).forEach((block) => {
      const text = importer.normalizeText(block.normalizedText || block.text);
      if (!text) return;
      const heading = importer.isLikelyHeading(block);
      const category = CATEGORY_TITLE.test(text);
      if (heading && !category) {
        currentSubject = importer.normalizeHeading(text);
        currentScope = block.scope || currentScope;
        return;
      }
      if (heading && category) {
        currentScope = block.scope || currentScope;
        return;
      }
      importer.splitTopics(text).forEach((topic) => {
        const topicKey = `${key(currentSubject)}::${key(topic)}`;
        if (!topic || seen.has(topicKey)) return;
        seen.add(topicKey);
        rows.push({
          id: `item-${rows.length + 1}`,
          materia: currentSubject,
          assunto: topic,
          scope: block.scope || currentScope,
          selected: true,
          confidence: { score: heading ? 0.8 : 0.62, label: heading ? "Alta" : "Média", evidences: [heading ? "matéria identificada em título" : "tema encontrado no trecho"] },
          origin: { page: block.page || null, blockId: block.id, excerpt: block.text || text, section: block.sectionTitle || null },
        });
      });
    });
    return rows;
  };
})(window);
