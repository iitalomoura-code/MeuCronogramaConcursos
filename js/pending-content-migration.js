(function (global) {
  "use strict";

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function titleOf(value) {
    return String(value || "").split(/\s*:\s*/, 1)[0].trim();
  }

  function contentItems(row) {
    const stored = Array.isArray(row?.conteudosOriginais) ? row.conteudosOriginais : [];
    if (stored.length) return stored.map((item) => String(item || "").trim()).filter(Boolean);
    const detail = String(row?.assunto || "").split(/\s*:\s*/).slice(1).join(":").trim();
    return detail ? detail.split(/[;•\n]+/).map((item) => item.trim()).filter(Boolean) : [titleOf(row?.assunto)].filter(Boolean);
  }

  function hasAny(text, terms) {
    const value = normalize(text);
    return terms.some((term) => value.includes(normalize(term)));
  }

  function splitPublicExpense(row, stableMetaId) {
    const sourceItems = contentItems(row);
    const sourceText = `${row.assunto || ""}; ${sourceItems.join("; ")}`;
    if (!hasAny(row.materia, ["administracao financeira", "afo", "direito financeiro"]) || !hasAny(sourceText, ["despesa publica", "despesa pública"])) return null;

    const groups = [
      { title: "Conceito e classificações", terms: ["conceito", "classifica"] },
      { title: "Estágios da despesa", terms: ["estagio", "estágio"] },
      { title: "Empenho, liquidação e pagamento", terms: ["empenho", "liquidacao", "liquidação", "pagamento"] },
      { title: "Restos a pagar", terms: ["restos a pagar"] },
      { title: "Despesas de exercícios anteriores", terms: ["exercicios anteriores", "exercícios anteriores", "despesas de exerc"] },
      { title: "Suprimento de fundos", terms: ["suprimento de fundos"] },
    ].map((group) => ({ ...group, items: [] }));

    const unmatched = [];
    sourceItems.forEach((item) => {
      const group = groups.find((candidate) => hasAny(item, candidate.terms));
      if (group) group.items.push(item);
      else unmatched.push(item);
    });
    if (unmatched.length) groups[0].items.push(...unmatched);
    const usable = groups.filter((group) => group.items.length);
    if (usable.length < 2) return null;

    return usable.map((group, index) => ({
      ...row,
      assunto: `${group.title}: ${group.items.join("; ")}`,
      conteudosOriginais: group.items.slice(),
      metaId: stableMetaId,
      metaTitulo: "Despesa pública",
      metaPartKey: String(index + 1),
      metaRequiredBlocks: usable.length,
      blocosSugeridos: 1,
      migracaoPedagogica: {
        tipo: "divisao-tema-amplo",
        temaOriginal: row.assunto,
        motivo: "Tema amplo dividido em unidades estudáveis, preservando a mesma meta temática.",
      },
    }));
  }

  function stableMetaId(row) {
    return row.metaId || `tema::${normalize(row.materia)}::${normalize(titleOf(row.assunto))}`;
  }

  function annotateGroupedRows(rows) {
    return rows.map((row) => {
      const grouped = row.agrupamentoPedagogico;
      if (!grouped) return row;
      const items = contentItems(row);
      return {
        ...row,
        conteudosOriginais: items,
        metaId: stableMetaId({ ...row, assunto: grouped.macrotema || titleOf(row.assunto) }),
        metaTitulo: grouped.macrotema || titleOf(row.assunto),
        metaPartKey: "1",
        metaRequiredBlocks: Math.max(1, Number(row.blocosSugeridos) || 1),
      };
    });
  }

  function buildPlan(rows, statusForRow, groupRows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const preserved = [];
    const candidates = [];
    const ambiguities = [];

    safeRows.forEach((row, index) => {
      const status = statusForRow(row, index);
      if (status === "completed") {
        preserved.push({ row, index, reason: "Tema já concluído: permanecerá sem alterações." });
      } else if (status === "in-progress") {
        preserved.push({ row, index, reason: "Tema em andamento: a divisão depende de confirmar quais conteúdos internos já foram estudados." });
        ambiguities.push({ row, index, reason: "Tema em andamento" });
      } else {
        candidates.push({ row, index, status });
      }
    });

    const groupedRows = typeof groupRows === "function"
      ? groupRows(candidates.map((item) => item.row))
      : candidates.map((item) => item.row);
    const replacements = annotateGroupedRows(groupedRows)
      .flatMap((row) => splitPublicExpense(row, stableMetaId(row)) || [row]);
    const changed = replacements.filter((row) => row.agrupamentoPedagogico || row.migracaoPedagogica);
    const candidateKeys = new Set(candidates.map((item) => item.index));
    const untouched = safeRows.filter((_, index) => !candidateKeys.has(index));

    return {
      createdAt: new Date().toISOString(),
      sourceRows: safeRows,
      preserved,
      ambiguities,
      candidates,
      replacements,
      changed,
      nextRows: [...untouched, ...replacements],
    };
  }

  global.PendingContentMigration = { buildPlan, contentItems, titleOf };
  if (typeof module !== "undefined" && module.exports) module.exports = global.PendingContentMigration;
})(typeof window !== "undefined" ? window : globalThis);
