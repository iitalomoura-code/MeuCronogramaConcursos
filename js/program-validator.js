(function (global) {
  "use strict";

  const ProgramModel = global.ProgramModel || (typeof module !== "undefined" && module.exports ? require("./program-model.js") : null);
  const GENERAL_SECTIONS = new Set([
    "conhecimentos gerais",
    "conhecimentos especificos",
    "conhecimentos basicos",
    "conhecimentos complementares",
    "prova objetiva",
    "conteudo programatico",
  ]);
  const EDITORIAL_PATTERN = /(?:para o seu sistema|aqui eu recomendo|tambem consolidaria|observacao editorial|sugestao\s*:)/i;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();
  }

  function titleOf(unit) {
    return ProgramModel?.programUnitTitle ? ProgramModel.programUnitTitle(unit) : clean(unit?.titulo || unit?.assunto);
  }

  function descriptionOf(unit) {
    return ProgramModel?.programUnitDescription ? ProgramModel.programUnitDescription(unit) : clean(unit?.descricao);
  }

  function canonical(unit) {
    return ProgramModel?.canonicalProgramUnit ? ProgramModel.canonicalProgramUnit(unit) : { ...unit, titulo: titleOf(unit), descricao: descriptionOf(unit) };
  }

  function isUppercaseHeading(value) {
    const text = clean(value);
    const letters = text.replace(/[^A-Za-z\u00c0-\u024f]/g, "");
    return letters.length >= 4 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  }

  function isAcronymLike(value) {
    const text = clean(value);
    return /^[A-Z]{2,8}$/.test(text)
      || (/^[A-Z]{2,8}(?:\s+E\s+[A-Z]{2,8})?$/.test(text) && text.length <= 24)
      || (/^[A-Z]{2,8}(?:\/[A-Za-z]{2,8})?(?:\s+e\s+[A-Z]{2,8})?$/.test(text) && text.length <= 28);
  }

  function outlineStartsAtOne(value) {
    return /^1(?:\.0+)?$/.test(clean(value));
  }

  function repeatedDescription(value) {
    const text = clean(value);
    if (!text) return false;
    const halves = text.split(/\s*[.;]\s*/).map(normalize).filter(Boolean);
    if (halves.length >= 2 && halves.length % 2 === 0) {
      const midpoint = halves.length / 2;
      if (halves.slice(0, midpoint).join("|") === halves.slice(midpoint).join("|")) return true;
    }
    const midpoint = Math.floor(text.length / 2);
    return text.length > 28 && normalize(text.slice(0, midpoint)) === normalize(text.slice(midpoint));
  }

  function issueId(type, units, suffix = "") {
    return [type, ...units.map((unit) => `${normalize(unit.materia)}:${normalize(titleOf(unit))}`), suffix].join("|");
  }

  function buildIssue(type, severity, units, message, suggestion, extra = {}) {
    return {
      id: issueId(type, units, extra.key || ""),
      type,
      severity,
      materia: clean(extra.materia || units[0]?.materia),
      titulo: clean(extra.titulo || titleOf(units[0])),
      message,
      suggestion,
      affectedUnits: units.map((unit) => Number(unit.__validatorIndex)).filter(Number.isInteger),
      autoFix: extra.autoFix || null,
    };
  }

  function primaryOutline(value) {
    const match = clean(value).match(/^(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function analyze(input = {}) {
    const sourceUnits = Array.isArray(input) ? input : input.units || [];
    const units = sourceUnits.map((unit, index) => ({ ...canonical(unit), __validatorIndex: index }));
    const issues = [];
    const add = (issue) => issues.push(issue);
    const grouped = new Map();

    units.forEach((unit) => {
      const subjectKey = normalize(unit.materia);
      if (!grouped.has(subjectKey)) grouped.set(subjectKey, { materia: unit.materia, units: [] });
      grouped.get(subjectKey).units.push(unit);

      const title = titleOf(unit);
      const description = descriptionOf(unit);
      const validation = ProgramModel?.validateProgramUnit?.(unit);
      if (!clean(unit.materia)) {
        add(buildIssue("topic-without-subject", "error", [unit], "Tema sem mat\u00e9ria associada.", "Associe o tema a uma mat\u00e9ria antes de confirmar."));
      }
      if (unit.subarea && !unit.materia) {
        add(buildIssue("invalid-subarea", "error", [unit], "Sub\u00e1rea sem estrutura v\u00e1lida.", "Associe a sub\u00e1rea a uma mat\u00e9ria."));
      }
      if (validation?.warnings?.some((warning) => warning.code === "title-contains-description") || title.split(/\s+/).length > 14 || title.length > 140) {
        add(buildIssue("title-contains-description", "warning", [unit], "T\u00edtulo parece conter a descri\u00e7\u00e3o do tema.", "Separar t\u00edtulo e conte\u00fado."));
      }
      if (description && (normalize(description).startsWith(normalize(title) + " ") || repeatedDescription(description))) {
        add(buildIssue("duplicated-description", "warning", [unit], "Conte\u00fado possivelmente duplicado.", "Remover a repeti\u00e7\u00e3o identificada.", {
          autoFix: { type: "deduplicate-description" },
        }));
      }
      if (EDITORIAL_PATTERN.test(normalize(`${title} ${description}`))) {
        add(buildIssue("editorial-comment", "warning", [unit], "Poss\u00edvel coment\u00e1rio editorial no conte\u00fado program\u00e1tico.", "Ignorar este trecho ou remov\u00ea-lo do tema."));
      }
      if (description && (/(?:\n|\s)1\.\s/.test(description) || /(?:^|\s)[A-Z\u00c0-\u024f][A-Z\u00c0-\u024f\s-]{8,}(?:\s|$)/.test(description))) {
        add(buildIssue("mixed-topics-description", "warning", [unit], "Poss\u00edvel mistura de mais de um tema na descri\u00e7\u00e3o.", "Revise a quebra estrutural deste conte\u00fado."));
      }
      if (description && /(?:^|\s)(?:L[I\u00cd]NGUA|RACIOC[I\u00cd]NIO|DIREITO|ADMINISTRA[C\u00c7][A\u00c3]O|CONTABILIDADE|LEGISLA[C\u00c7][A\u00c3]O)\s+[A-Z\u00c0-\u024f\s-]{4,}/.test(description)) {
        add(buildIssue("subject-inside-description", "warning", [unit], "Poss\u00edvel mudan\u00e7a de mat\u00e9ria dentro do conte\u00fado.", "Revise a partir deste trecho antes de confirmar."));
      }
    });

    const orderedGroups = [...grouped.values()].filter((group) => normalize(group.materia));
    orderedGroups.forEach((group, groupIndex) => {
      const subjectKey = normalize(group.materia);
      const titles = new Map();
      group.units.forEach((unit) => {
        const key = normalize(titleOf(unit));
        if (key) titles.set(key, [...(titles.get(key) || []), unit]);
      });
      titles.forEach((matches) => {
        if (matches.length > 1) {
          add(buildIssue("duplicate-topic", "warning", matches, "Poss\u00edveis temas duplicados nesta mat\u00e9ria.", "Revise e una apenas se tratarem do mesmo tema."));
        }
      });

      if (GENERAL_SECTIONS.has(subjectKey)) {
        add(buildIssue("general-section-as-subject", "warning", group.units, "Cabe\u00e7alho geral interpretado como disciplina.", "Transformar em se\u00e7\u00e3o antes de confirmar.", { materia: group.materia }));
      }

      const previous = orderedGroups[groupIndex - 1];
      const allNumbered = group.units.length > 0 && group.units.every((unit) => Boolean(unit.outlineNumber));
      if (previous && allNumbered && isAcronymLike(group.materia)) {
        add(buildIssue("possible-topic-as-subject", "warning", group.units, `${group.materia} parece fazer parte de ${previous.materia}.`, `Mover ${group.materia} para ${previous.materia}.`, { materia: group.materia }));
      }

      let prior = null;
      group.units.forEach((unit, index) => {
        const number = primaryOutline(unit.outlineNumber);
        if (number === 1 && prior !== null && index > 0) {
          add(buildIssue("unexpected-numbering-restart", "warning", [unit], "A sequ\u00eancia voltou ao item 1. Pode existir uma mudan\u00e7a de disciplina que n\u00e3o foi reconhecida.", "Revisar quebra estrutural."));
        }
        if (number !== null && prior !== null && number > prior + 1) {
          add(buildIssue("unusual-numbering", "info", [unit], "Sequ\u00eancia num\u00e9rica incomum.", "Confira a numera\u00e7\u00e3o original do edital."));
        }
        if (number !== null) prior = number;

        const next = group.units[index + 1];
        const looksLikeNewSubject = isUppercaseHeading(titleOf(unit)) && !unit.outlineNumber
          && (unit.sourceBlockType === "heading" || unit.origemEdital?.sourceBlockType === "heading" || outlineStartsAtOne(next?.outlineNumber));
        if (looksLikeNewSubject) {
          add(buildIssue("possible-subject-as-topic", "warning", [unit], `${titleOf(unit)} parece iniciar uma nova disciplina.`, "Transformar em mat\u00e9ria."));
        }
      });
    });

    const subjectsByNormalized = new Map();
    units.forEach((unit) => {
      const key = normalize(unit.materia);
      if (!key) return;
      if (!subjectsByNormalized.has(key)) subjectsByNormalized.set(key, []);
      subjectsByNormalized.get(key).push(unit);
    });
    subjectsByNormalized.forEach((matches) => {
      const variants = new Set(matches.map((unit) => clean(unit.materia)));
      if (variants.size > 1) {
        add(buildIssue("duplicate-subject", "warning", matches, "Poss\u00edveis mat\u00e9rias duplicadas.", "Unificar as varia\u00e7\u00f5es da mesma mat\u00e9ria."));
      }
    });

    (input.subjectsWithoutTopics || []).forEach((materia) => {
      add(buildIssue("subject-without-topics", "warning", [{ materia, titulo: materia, __validatorIndex: -1 }], "Mat\u00e9ria sem assuntos identificados.", "Revise a estrutura ou importe o trecho novamente."));
    });
    (input.parsingProblems || []).forEach((problem) => {
      if (problem?.type === "orphan-content" || problem?.type === "loose-content") {
        add(buildIssue("orphan-description", "warning", [{ materia: "", titulo: clean(problem.text), __validatorIndex: -1 }], "Conte\u00fado n\u00e3o associado a nenhum tema.", "Associe ao tema anterior, ao pr\u00f3ximo ou crie um novo tema."));
      }
    });

    const uniqueIssues = [...new Map(issues.map((issue) => [issue.id, issue])).values()];
    const errors = uniqueIssues.filter((issue) => issue.severity === "error");
    const warnings = uniqueIssues.filter((issue) => issue.severity === "warning");
    const subareas = new Set(units.map((unit) => normalize(unit.subarea)).filter(Boolean));
    return {
      units: units.map(({ __validatorIndex, ...unit }) => unit),
      issues: uniqueIssues,
      errors,
      warnings,
      summary: {
        subjects: new Set(units.map((unit) => normalize(unit.materia)).filter(Boolean)).size,
        topics: units.filter((unit) => titleOf(unit)).length,
        subareas: subareas.size,
        confidence: errors.length ? "A estrutura precisa de corre\u00e7\u00e3o antes de continuar" : warnings.length ? "A estrutura merece revis\u00e3o antes de continuar" : "Estrutura reconhecida com boa confian\u00e7a",
      },
    };
  }

  function deduplicateDescription(description, title = "") {
    const text = clean(description);
    const normalizedTitle = normalize(title);
    if (normalizedTitle && normalize(text).startsWith(normalizedTitle + " ")) {
      const words = text.split(/\s+/);
      const titleWords = clean(title).split(/\s+/).length;
      return words.slice(titleWords).join(" ").trim();
    }
    const pieces = text.split(/\s*[.;]\s*/).map(clean).filter(Boolean);
    if (pieces.length >= 2 && pieces.length % 2 === 0) {
      const midpoint = pieces.length / 2;
      if (pieces.slice(0, midpoint).map(normalize).join("|") === pieces.slice(midpoint).map(normalize).join("|")) return pieces.slice(0, midpoint).join("; ");
    }
    return text;
  }

  function applySafeCorrections(sourceUnits = [], issues = []) {
    const fixesByIndex = new Map();
    issues.filter((issue) => issue.autoFix?.type === "deduplicate-description").forEach((issue) => {
      issue.affectedUnits.forEach((index) => fixesByIndex.set(index, issue));
    });
    return sourceUnits.map((source, index) => {
      const issue = fixesByIndex.get(index);
      if (!issue) return source;
      const unit = canonical(source);
      const descricao = deduplicateDescription(unit.descricao, unit.titulo);
      return {
        ...unit,
        descricao,
        conteudosOriginais: descricao ? descricao.split(/\s*;\s*/).map(clean).filter(Boolean) : [],
        manualCorrection: true,
        previousValues: { ...(unit.previousValues || {}), descricao: unit.descricao },
      };
    });
  }

  const api = { analyze, applySafeCorrections, normalize, GENERAL_SECTIONS };
  global.ProgramValidator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
