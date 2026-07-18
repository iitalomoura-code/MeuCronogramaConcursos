(function attachPedagogicalGrouping(global) {
  "use strict";

  const taxonomy = global.ContentTaxonomy;
  if (!taxonomy) return;

  const genericTerms = new Set(["principio", "principios", "conceito", "conceitos", "aspecto", "aspectos", "nocao", "nocoes", "procedimento", "procedimentos", "organizacao", "gestao", "aplicacao", "aplicacoes"]);
  const normalize = taxonomy.normalize;
  const textTokens = (value) => normalize(value).split(/\s+/).filter((term) => term.length > 3 && !genericTerms.has(term));
  const unique = (values) => [...new Set(values.filter(Boolean))];

  function splitContents(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return [];
    const parts = text.split(/[;\n]+/).map((item) => item.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
    const words = text.split(/\s+/).length;
    return words <= 20 && text.includes(",")
      ? text.split(/\s*,\s*/).map((item) => item.trim()).filter(Boolean)
      : [text];
  }

  function rowOriginalItems(row) {
    if (Array.isArray(row.originalItems) && row.originalItems.length) return row.originalItems;
    const raw = String(row.assunto || "").trim();
    const colon = raw.indexOf(":");
    const title = colon > 4 ? raw.slice(0, colon).trim() : "";
    const details = colon > 4 ? raw.slice(colon + 1).trim() : raw;
    return unique([...(title ? [title] : []), ...splitContents(details)]);
  }

  function macroMatch(subject, row) {
    const source = rowOriginalItems(row).join(" ");
    const normalized = normalize(source);
    const tokens = new Set(textTokens(source));
    const matches = subject.macroThemes.map((macroTheme) => {
      const included = macroTheme.includeTerms.filter((term) => {
        const normalizedTerm = normalize(term);
        return normalized.includes(normalizedTerm) || normalizedTerm.split(" ").some((part) => tokens.has(part));
      });
      const excluded = macroTheme.excludeTerms.filter((term) => normalized.includes(normalize(term)));
      const score = included.length * 3 + (included.some((term) => normalize(term).includes(" ")) ? 2 : 0) - excluded.length * 6;
      return { macroTheme, score, included, excluded };
    }).filter((match) => match.score > 0 && !match.excluded.length);
    return matches.sort((left, right) => right.score - left.score || left.macroTheme.name.localeCompare(right.macroTheme.name))[0] || null;
  }

  function rowIsAutonomous(row, match) {
    const title = normalize(String(row.assunto || "").split(":")[0]);
    const contents = rowOriginalItems(row);
    if (match?.macroTheme.autonomous && contents.length <= 2) return true;
    if (row.temaExplicito && contents.length <= 2 && title === normalize(match?.macroTheme.name)) return true;
    return contents.length > 8 || String(row.assunto || "").split(/\s+/).length > 58;
  }

  function confidenceFor(group) {
    const items = unique(group.rows.flatMap(rowOriginalItems));
    if (group.rows.length >= 2 && items.length >= 3) return "alta";
    if (items.length >= 3 || group.score >= 6) return "média";
    return "baixa";
  }

  function suggestedDetails(title, items) {
    const normalizedTitle = normalize(title);
    const visible = items.filter((item) => normalize(item) !== normalizedTitle);
    return (visible.length ? visible : items).join("; ");
  }

  function groupedRow(subject, group, order) {
    const originalItems = unique(group.rows.flatMap(rowOriginalItems));
    const confidence = confidenceFor(group);
    const title = group.macroTheme.name;
    const first = group.rows[0];
    return {
      ...first,
      materia: subject.name,
      assunto: `${title}: ${suggestedDetails(title, originalItems)}`,
      ordem: order,
      temaExplicito: true,
      macrotema: { id: group.macroTheme.id, nome: title },
      taxonomia: { materiaId: subject.id, macrotemaId: group.macroTheme.id, nome: title },
      agrupamentoPedagogico: true,
      agrupamentoConfianca: confidence,
      originalItems,
      normalizedItems: originalItems.map(normalize),
      sourceIndexes: group.rows.map((row) => row.__sourceIndex).filter(Number.isInteger),
      originalRows: group.rows.map((row) => {
        const { __sourceIndex, ...source } = row;
        return source;
      }),
      editadoManualmente: false,
    };
  }

  function passthroughRow(row, order, subject) {
    const { __sourceIndex, ...source } = row;
    const originalItems = rowOriginalItems(source);
    return {
      ...source,
      materia: subject?.name || source.materia,
      ordem: order,
      macrotema: source.macrotema || null,
      taxonomia: source.taxonomia || null,
      agrupamentoPedagogico: Boolean(source.agrupamentoPedagogico),
      agrupamentoConfianca: source.agrupamentoConfianca || "",
      originalItems: source.originalItems || originalItems,
      normalizedItems: source.normalizedItems || originalItems.map(normalize),
      sourceIndexes: source.sourceIndexes || [row.__sourceIndex].filter(Number.isInteger),
      originalRows: source.originalRows || [source],
    };
  }

  function groupSubjectRows(subject, rows) {
    const candidates = new Map();
    const standalone = [];
    rows.forEach((row) => {
      const match = macroMatch(subject, row);
      if (!match || rowIsAutonomous(row, match)) {
        standalone.push(row);
        return;
      }
      const key = match.macroTheme.id;
      if (!candidates.has(key)) candidates.set(key, { ...match, rows: [] });
      const group = candidates.get(key);
      group.rows.push(row);
      group.score += match.score;
    });

    const output = [];
    candidates.forEach((group) => {
      const confidence = confidenceFor(group);
      if (confidence === "baixa" && group.rows.length === 1) standalone.push(...group.rows);
      else output.push({ type: "group", row: groupedRow(subject, group, 0), sourceIndex: Math.min(...group.rows.map((row) => row.__sourceIndex)) });
    });
    standalone.forEach((row) => output.push({ type: "single", row: passthroughRow(row, 0, subject), sourceIndex: row.__sourceIndex }));
    return output.sort((left, right) => left.sourceIndex - right.sourceIndex).map((entry, index) => ({ ...entry.row, ordem: index + 1 }));
  }

  function groupRows(rows = []) {
    const bySubject = new Map();
    const loose = [];
    const seen = new Set();
    rows.forEach((raw, index) => {
      const row = { ...raw, __sourceIndex: index };
      const duplicateKey = `${normalize(row.materia)}::${normalize(row.assunto)}`;
      if (duplicateKey !== "::" && seen.has(duplicateKey)) return;
      seen.add(duplicateKey);
      const subject = taxonomy.subjectFor(row.materia);
      if (!subject || !row.materia || !row.assunto || row.estudar === "Nao" || row.editadoManualmente || row.agrupamentoPedagogico) {
        loose.push(row);
        return;
      }
      if (!bySubject.has(subject.id)) bySubject.set(subject.id, { subject, rows: [] });
      bySubject.get(subject.id).rows.push(row);
    });

    const grouped = [];
    bySubject.forEach(({ subject, rows: subjectRows }) => grouped.push(...groupSubjectRows(subject, subjectRows)));
    loose.sort((left, right) => left.__sourceIndex - right.__sourceIndex).forEach((row) => grouped.push(passthroughRow(row, Number(row.ordem) || 1, null)));
    return grouped;
  }

  function restoreOriginalRows(rows = []) {
    const restored = [];
    rows.forEach((row) => {
      if (row.agrupamentoPedagogico && Array.isArray(row.originalRows) && row.originalRows.length) restored.push(...row.originalRows);
      else restored.push(row);
    });
    const counters = new Map();
    return restored.map((row) => {
      const key = normalize(row.materia);
      counters.set(key, (counters.get(key) || 0) + 1);
      return { ...row, ordem: counters.get(key) };
    });
  }

  global.PedagogicalGrouping = { groupRows, restoreOriginalRows, rowOriginalItems, macroMatch };
})(window);
