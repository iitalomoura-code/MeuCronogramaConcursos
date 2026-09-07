(function (global) {
  "use strict";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function splitLegacyTitleAndDescription(value) {
    const text = clean(value);
    const colonIndex = text.indexOf(":");
    if (colonIndex > 4 && colonIndex < 90) {
      return { title: clean(text.slice(0, colonIndex)), description: clean(text.slice(colonIndex + 1)) };
    }
    return { title: text, description: "" };
  }

  function programUnitTitle(unit = {}) {
    const explicit = clean(unit.titulo || unit.title);
    if (explicit) return explicit;
    return splitLegacyTitleAndDescription(unit.assunto || unit.tema || unit.nome).title;
  }

  function programUnitDescription(unit = {}) {
    const explicit = clean(unit.descricao);
    if (explicit) return explicit;
    return splitLegacyTitleAndDescription(unit.assunto || unit.tema || unit.nome).description;
  }

  function programUnitContents(unit = {}) {
    const source = Array.isArray(unit.conteudosOriginais) ? unit.conteudosOriginais : [];
    const contents = source.map(clean).filter(Boolean);
    if (contents.length) return [...new Set(contents)];
    const description = programUnitDescription(unit);
    return description ? [description] : [];
  }

  function programUnitKey(unit = {}) {
    const subject = normalize(unit.materia);
    const subarea = normalize(unit.subarea);
    const title = normalize(programUnitTitle(unit));
    // Mantém a chave dos planejamentos antigos quando não há subárea, mas
    // distingue títulos iguais assim que essa informação estrutural existe.
    return subarea ? [subject, subarea, title].join("::") : [subject, title].join("::");
  }

  function canonicalProgramUnit(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const title = programUnitTitle(source);
    const description = programUnitDescription(source);
    const outlineNumber = clean(source.outlineNumber);
    const outlineLevel = Number(source.outlineLevel) || (outlineNumber ? outlineNumber.split(".").filter(Boolean).length : 0);
    const origin = source.origemEdital && typeof source.origemEdital === "object"
      ? { ...source.origemEdital }
      : {};
    const section = clean(source.section || origin.section);
    const unit = {
      ...source,
      id: clean(source.id || source.unitId),
      section,
      materia: clean(source.materia),
      subarea: clean(source.subarea),
      titulo: title,
      assunto: title,
      descricao: description,
      conteudosOriginais: programUnitContents({ ...source, descricao: description }),
      outlineNumber,
      outlineLevel,
      ordem: Number(source.ordem) || 0,
      structureSource: clean(source.structureSource || origin.structureSource),
      sourceBlockType: clean(source.sourceBlockType || origin.sourceBlockType),
      origemEdital: origin,
    };
    return unit;
  }

  function validateProgramUnit(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const unit = canonicalProgramUnit(source);
    const warnings = [];
    const add = (code, message) => warnings.push({ code, message });
    const rawTitle = clean(source.titulo || source.title);
    const rawSubject = clean(source.assunto);
    const normalizedTitle = normalize(unit.titulo);
    const normalizedDescription = normalize(unit.descricao);

    if (!unit.materia) add("missing-subject", "Matéria não informada.");
    if (!unit.titulo) add("missing-title", "Título do tema não informado.");
    if (unit.subarea && !unit.materia) add("subarea-without-subject", "Subárea informada sem matéria.");
    if (unit.descricao && normalizedTitle === normalizedDescription) add("description-equals-title", "Descrição igual ao título do tema.");
    if (rawTitle && rawSubject && normalize(rawTitle) !== normalize(rawSubject)) add("title-subject-diverge", "Título e assunto possuem valores diferentes.");
    if (unit.outlineNumber && !/^\d+(?:\.\d+)*$/.test(unit.outlineNumber)) add("invalid-outline-number", "Numeração estrutural inválida.");
    if (unit.outlineNumber && unit.outlineLevel !== unit.outlineNumber.split(".").length) add("inconsistent-outline-level", "Nível estrutural incompatível com a numeração.");
    if (Object.prototype.hasOwnProperty.call(source, "conteudosOriginais") && !Array.isArray(source.conteudosOriginais)) add("invalid-original-contents", "Conteúdos originais precisam ser uma lista.");
    if (Array.isArray(source.conteudosOriginais) && source.conteudosOriginais.some((item) => typeof item !== "string")) add("invalid-original-content-item", "Cada conteúdo original precisa ser textual.");

    const descriptionLooksEmbedded = normalizedDescription.length >= 16 && normalizedTitle.includes(normalizedDescription);
    const titleLooksLong = unit.titulo.split(/\s+/).filter(Boolean).length > 18 || unit.titulo.length > 140;
    if (descriptionLooksEmbedded || (titleLooksLong && normalizedDescription && normalizedTitle.slice(-Math.min(normalizedDescription.length, 48)).includes(normalizedDescription.slice(0, 24)))) {
      add("title-contains-description", "O título parece conter também a descrição do tema.");
    }
    return { unit, valid: warnings.length === 0, warnings };
  }

  const api = {
    canonicalProgramUnit,
    programUnitTitle,
    programUnitDescription,
    programUnitContents,
    programUnitKey,
    validateProgramUnit,
  };
  global.ProgramModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
