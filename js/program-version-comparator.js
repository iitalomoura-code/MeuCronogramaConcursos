(function (global) {
  "use strict";

  const model = global.ProgramModel || (typeof require === "function" ? require("./program-model.js") : null);

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/(^|\s)\d+(?:\.\d+)*[.)-]?(?=\s|$)/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokens(value) {
    return new Set(normalize(value).split(" ").filter((token) => token.length > 1));
  }

  function overlap(left, right) {
    const a = tokens(left);
    const b = tokens(right);
    if (!a.size && !b.size) return 1;
    if (!a.size || !b.size) return 0;
    let common = 0;
    a.forEach((token) => { if (b.has(token)) common += 1; });
    return (2 * common) / (a.size + b.size);
  }

  function canonical(unit, index) {
    const value = model?.canonicalProgramUnit ? model.canonicalProgramUnit(unit) : { ...(unit || {}) };
    const title = clean(value.titulo || value.assunto || value.tema || value.nome);
    const description = clean(value.descricao);
    const contents = Array.isArray(value.conteudosOriginais) && value.conteudosOriginais.length
      ? value.conteudosOriginais.map(clean).filter(Boolean)
      : description ? [description] : [];
    return {
      ...value,
      titulo: title,
      assunto: title,
      descricao: description,
      conteudosOriginais: [...new Set(contents)],
      materia: clean(value.materia),
      subarea: clean(value.subarea),
      id: clean(value.id || value.unitId),
      key: model?.programUnitKey ? model.programUnitKey({ ...value, titulo: title, assunto: title }) : `${normalize(value.materia)}::${normalize(title)}`,
      index,
    };
  }

  function contentList(unit) {
    const values = Array.isArray(unit?.conteudosOriginais) ? unit.conteudosOriginais : [];
    return values.length ? values : unit?.descricao ? [unit.descricao] : [];
  }

  function diffContents(current, next) {
    const oldItems = contentList(current);
    const newItems = contentList(next);
    const oldMap = new Map(oldItems.map((item) => [normalize(item), item]));
    const newMap = new Map(newItems.map((item) => [normalize(item), item]));
    const retainedContents = [];
    const removedContents = [];
    const addedContents = [];
    oldMap.forEach((value, key) => (newMap.has(key) ? retainedContents : removedContents).push(value));
    newMap.forEach((value, key) => { if (!oldMap.has(key)) addedContents.push(value); });
    return { addedContents, removedContents, retainedContents };
  }

  function similarity(current, next) {
    const title = overlap(current.titulo, next.titulo);
    const subject = normalize(current.materia) === normalize(next.materia) ? 1 : overlap(current.materia, next.materia);
    const subarea = normalize(current.subarea) === normalize(next.subarea) ? 1 : overlap(current.subarea, next.subarea);
    const description = overlap(current.descricao, next.descricao);
    const content = overlap(contentList(current).join(" "), contentList(next).join(" "));
    const samePosition = Math.abs(current.index - next.index) <= 1 ? 0.04 : 0;
    return (title * 0.48) + (subject * 0.18) + (subarea * 0.08) + (description * 0.12) + (content * 0.10) + samePosition;
  }

  function equivalentText(current, next) {
    return normalize(current.titulo) === normalize(next.titulo)
      && normalize(current.materia) === normalize(next.materia)
      && normalize(current.subarea) === normalize(next.subarea)
      && overlap(current.descricao, next.descricao) >= 0.94
      && diffContents(current, next).addedContents.length === 0
      && diffContents(current, next).removedContents.length === 0;
  }

  function matchLabel(confidence) {
    if (confidence >= 0.86) return "safe";
    if (confidence >= 0.70) return "probable";
    return "review";
  }

  function compare(currentRows, nextRows, metadata = {}) {
    const current = (Array.isArray(currentRows) ? currentRows : []).map(canonical);
    const next = (Array.isArray(nextRows) ? nextRows : []).map(canonical);
    const currentByKey = new Map(current.map((unit) => [unit.key, unit]));
    const matchedCurrent = new Set();
    const matchedNext = new Set();
    const units = [];

    next.forEach((unit) => {
      const exact = currentByKey.get(unit.key);
      if (!exact) return;
      matchedCurrent.add(exact.key);
      matchedNext.add(unit.key);
      const contents = diffContents(exact, unit);
      units.push({
        type: equivalentText(exact, unit) ? "UNCHANGED" : "MODIFIED",
        confidence: "safe",
        confidenceValue: 1,
        current: exact,
        next: unit,
        addedContents: contents.addedContents,
        removedContents: contents.removedContents,
        retainedContents: contents.retainedContents,
        outlineChanged: clean(exact.outlineNumber) !== clean(unit.outlineNumber),
        identityPreserved: true,
      });
    });

    const unmatchedCurrent = current.filter((unit) => !matchedCurrent.has(unit.key));
    const unmatchedNext = next.filter((unit) => !matchedNext.has(unit.key));
    unmatchedNext.forEach((unit) => {
      const candidates = unmatchedCurrent
        .filter((candidate) => !matchedCurrent.has(candidate.key))
        .map((candidate) => ({ candidate, score: similarity(candidate, unit) }))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const second = candidates[1];
      const safeMatch = best && best.score >= 0.70 && (!second || best.score - second.score >= 0.12);
      if (safeMatch) {
        matchedCurrent.add(best.candidate.key);
        matchedNext.add(unit.key);
        const contents = diffContents(best.candidate, unit);
        const sameTitle = normalize(best.candidate.titulo) === normalize(unit.titulo);
        const sameContent = contents.addedContents.length === 0 && contents.removedContents.length === 0;
        const type = sameTitle && sameContent ? "MOVED" : sameContent ? "RENAMED" : "MODIFIED";
        units.push({
          type,
          confidence: matchLabel(best.score),
          confidenceValue: best.score,
          current: best.candidate,
          next: unit,
          addedContents: contents.addedContents,
          removedContents: contents.removedContents,
          retainedContents: contents.retainedContents,
          identityPreserved: true,
          candidates: candidates.slice(0, 3).map((item) => ({ key: item.candidate.key, title: item.candidate.titulo, score: item.score })),
        });
      } else if (best && best.score >= 0.48) {
        units.push({
          type: "POSSIBLE_MATCH",
          confidence: "review",
          confidenceValue: best.score,
          current: best.candidate,
          next: unit,
          candidates: candidates.slice(0, 3).map((item) => ({ key: item.candidate.key, title: item.candidate.titulo, score: item.score })),
          ...diffContents(best.candidate, unit),
          identityPreserved: false,
        });
      } else {
        units.push({ type: "ADDED", confidence: "safe", confidenceValue: 1, current: null, next: unit, ...diffContents(null, unit), identityPreserved: false });
      }
    });

    current.forEach((unit) => {
      if (!matchedCurrent.has(unit.key)) units.push({ type: "REMOVED", confidence: "safe", confidenceValue: 1, current: unit, next: null, ...diffContents(unit, null), identityPreserved: true });
    });

    const matchedPositions = units.filter((item) => item.current && item.next).some((item) => item.current.index !== item.next.index);
    const summary = units.reduce((result, item) => {
      result[item.type] = (result[item.type] || 0) + 1;
      return result;
    }, {});
    const subjects = {
      added: [...new Set(next.map((item) => item.materia))].filter((name) => name && !current.some((item) => normalize(item.materia) === normalize(name))),
      removed: [...new Set(current.map((item) => item.materia))].filter((name) => name && !next.some((item) => normalize(item.materia) === normalize(name))),
    };
    return {
      metadata: { ...metadata },
      currentSnapshot: current,
      nextSnapshot: next,
      units,
      subjects,
      reordered: matchedPositions,
      summary,
      needsReview: units.some((item) => item.type === "POSSIBLE_MATCH"),
      canApply: !units.some((item) => item.type === "POSSIBLE_MATCH"),
    };
  }

  function stableId(unit, fallbackKey) {
    return clean(unit?.programUnitId || unit?.id) || `program-unit:${fallbackKey}`;
  }

  function applyDiff(diff, decisions = {}) {
    const rows = [];
    const correspondences = [];
    const consumed = new Set();
    diff.units.forEach((item) => {
      if (item.type === "REMOVED") {
        rows.push({ ...item.current, activeInCurrentProgram: false, foraDoEditalAtual: true, estudar: "Nao", removedFromProgramAt: new Date().toISOString() });
        return;
      }
      const decision = decisions[item.next?.key] || "preserve";
      let source = item.current;
      if (item.type === "POSSIBLE_MATCH" && decision === "treat-as-new") source = null;
      if (item.type === "POSSIBLE_MATCH" && typeof decision === "string" && decision.startsWith("match:")) {
        const selected = diff.currentSnapshot.find((unit) => unit.key === decision.slice(6));
        source = selected || null;
      }
      const next = item.next;
      const id = stableId(source || next, next.key);
      const merged = {
        ...(source || {}),
        ...next,
        id,
        programUnitId: id,
        estudar: source ? source.estudar : (next.estudar || "Sim"),
        activeInCurrentProgram: true,
        foraDoEditalAtual: false,
        previousProgramUnitKey: source && source.key !== next.key ? source.key : source?.previousProgramUnitKey || "",
      };
      rows.push(merged);
      correspondences.push({ oldKey: source?.key || null, newKey: next.key, oldId: source?.id || source?.programUnitId || null, newId: id, type: item.type, decision });
      if (source) consumed.add(source.key);
    });
    return { rows, correspondences, removed: diff.units.filter((item) => item.type === "REMOVED").map((item) => item.current) };
  }

  const api = { compare, applyDiff, normalize, diffContents };
  global.ProgramVersionComparator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
