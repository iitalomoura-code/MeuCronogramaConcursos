(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});
  const CARGO_PREFIX = /^(?:CARGO|CARGOS|FUNÇÃO|FUNÇÕES|ESPECIALIDADE|ÁREA|ÁREAS)\s*(?:N[ºO.]?\s*\d+)?\s*[:\-]\s*(.+)$/i;
  const CARGO_CODE = /\b(?:CÓDIGO|COD)\s*(?:DO\s*)?CARGO\s*[:\-]?\s*([A-Z0-9.-]+)/i;

  function canonical(value) {
    return importer.normalizeHeading(value).toLocaleUpperCase("pt-BR").replace(/\s+/g, " ");
  }

  function addCandidate(map, name, evidence, block) {
    const cleanName = importer.normalizeHeading(name).replace(/^(?:CARGO|FUNÇÃO|ESPECIALIDADE)\s*[:\-]\s*/i, "");
    if (cleanName.length < 3 || cleanName.length > 120 || /^(?:CARGO|CARGOS|CONTEÚDO PROGRAMÁTICO)$/i.test(cleanName)) return;
    const key = canonical(cleanName);
    const item = map.get(key) || { name: cleanName, score: 0, evidences: [], origins: [] };
    item.score += evidence.weight;
    item.evidences.push(evidence.label);
    item.origins.push({ page: block.page || null, blockId: block.id, excerpt: block.text });
    map.set(key, item);
  }

  importer.detectCargos = function detectCargos(documentData) {
    const map = new Map();
    const blocks = documentData?.blocks || [];
    blocks.forEach((block, index) => {
      const text = importer.normalizeText(block.normalizedText || block.text);
      const explicit = text.match(CARGO_PREFIX);
      if (explicit) addCandidate(map, explicit[1], { weight: 4, label: "título explícito de cargo" }, block);
      if (importer.isLikelyHeading(block) && /\b(?:ANALISTA|TÉCNICO|AUDITOR|ASSISTENTE|ESPECIALISTA|PROCURADOR|AGENTE|CONTADOR|ENGENHEIRO|MÉDICO|ENFERMEIRO)\b/i.test(text)) {
        addCandidate(map, text, { weight: 2, label: "título em caixa alta" }, block);
      }
      const code = text.match(CARGO_CODE);
      if (code) {
        const nearby = blocks[index + 1] || blocks[index - 1];
        if (nearby) addCandidate(map, nearby.normalizedText || nearby.text, { weight: 2, label: `código de cargo ${code[1]}` }, block);
      }
    });
    return [...map.values()]
      .map((item) => {
        const score = Math.min(1, item.score / 7);
        return { ...item, score: Number(score.toFixed(2)), confidence: score >= 0.72 ? "Alta" : score >= 0.43 ? "Média" : "Baixa" };
      })
      .filter((item) => item.score >= 0.28)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "pt-BR"));
  };
})(window);
