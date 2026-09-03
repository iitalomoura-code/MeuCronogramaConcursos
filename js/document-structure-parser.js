(function (global) {
  "use strict";

  const GENERIC_SECTIONS = [
    "conhecimentos gerais", "conhecimentos especificos", "conhecimentos basicos",
    "conhecimentos complementares", "prova objetiva", "conteudos programaticos",
  ];

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function isGenericSection(value) {
    const text = normalize(value).replace(/[.:]+$/, "");
    return GENERIC_SECTIONS.some((section) => text === section || text.includes(section));
  }

  function isEditorialNote(value) {
    const text = normalize(value);
    return /^(para o seu sistema|aqui eu recomendo|tambem consolidaria|tambem recomendo|observacao(?: editorial)?|nota(?: editorial)?|sugestao para)/.test(text);
  }

  function outlineInfo(value) {
    const match = clean(value).match(/^(\d+(?:\.\d+)*)(?:\.)?\s+(.+)$/);
    if (!match) return null;
    return { number: match[1], level: match[1].split(".").length, text: clean(match[2]) };
  }

  function isAllCaps(value) {
    const text = clean(value);
    const letters = (text.match(/[A-Za-zÀ-ÿ]/g) || []);
    if (letters.length < 4) return false;
    return letters.filter((letter) => letter === letter.toUpperCase()).length / letters.length >= 0.82;
  }

  function isAcronymLike(value) {
    const text = clean(value);
    const letters = (text.match(/[A-Za-zÀ-ÿ]/g) || []);
    if (!letters.length || letters.length > 12) return false;
    const uppercase = letters.filter((letter) => letter === letter.toUpperCase()).length / letters.length;
    return uppercase >= 0.82 && text.split(/\s+/).length <= 3;
  }

  function hasSubjectLabelShape(value) {
    const words = clean(value).split(/\s+/).filter(Boolean);
    return words.length >= 2 && !isAcronymLike(value);
  }

  function isLikelySubject(value, node, { hasOpenSubject = false, nextNode = null, hasFollowingTopLevelItem = false } = {}) {
    const text = clean(value);
    if (!text || isGenericSection(text) || outlineInfo(text)) return false;
    if (node?.kind === "heading" || node?.bold) return !isAcronymLike(text) || !hasOpenSubject;
    // Plain uppercase paragraphs are only a supporting signal. They need a
    // section-shaped label and a following top-level item before they can open
    // or switch a subject; short acronyms remain viable topic titles.
    if (!isAllCaps(text) || !hasSubjectLabelShape(text)) return false;
    if (!hasOpenSubject && hasFollowingTopLevelItem) return true;
    return Boolean(nextNode && outlineInfo(nextNode.text)?.level === 1);
  }

  function documentNodesFromText(text) {
    return String(text || "").split(/\r?\n/).map((value, index) => ({
      kind: "paragraph",
      text: clean(value),
      sourceLine: index + 1,
      level: 0,
      listLevel: 0,
      bold: false,
    })).filter((node) => node.text);
  }

  function extractHtmlNodes(html) {
    if (typeof document === "undefined") return { text: "", nodes: [] };
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    const root = template.content;
    const nodes = [];
    let sourceLine = 0;
    const textWithBreaks = (element) => {
      const copy = element.cloneNode(true);
      copy.querySelectorAll("br").forEach((breakNode) => breakNode.replaceWith("\n"));
      return copy.textContent || "";
    };
    root.querySelectorAll("table").forEach((table) => {
      table.querySelectorAll("tr").forEach((row) => {
        const text = [...row.children].map((cell) => clean(textWithBreaks(cell))).filter(Boolean).join(" | ");
        if (text) nodes.push({ kind: "paragraph", text, sourceLine: ++sourceLine, level: 0, listLevel: 0, bold: false });
      });
      table.remove();
    });
    root.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li").forEach((element) => {
      const tag = element.tagName.toLowerCase();
      const kind = tag.startsWith("h") ? "heading" : tag === "li" ? "list" : "paragraph";
      let listLevel = 0;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (/^(UL|OL)$/i.test(parent.tagName)) listLevel += 1;
      }
      listLevel = kind === "list" ? Math.max(0, listLevel - 1) : 0;
      textWithBreaks(element).split(/\n+/).map(clean).filter(Boolean).forEach((text) => {
        nodes.push({
          kind,
          text,
          sourceLine: ++sourceLine,
          level: kind === "heading" ? Number(tag.slice(1)) : 0,
          listLevel,
          bold: Boolean(element.querySelector("strong,b")),
        });
      });
    });
    return { text: nodes.map((node) => node.text).join("\n"), nodes };
  }

  function normalizeNodes(text, suppliedNodes) {
    const source = Array.isArray(suppliedNodes) && suppliedNodes.length ? suppliedNodes : documentNodesFromText(text);
    return source.flatMap((node, index) => String(node?.text || "").split(/\r?\n/).map(clean).filter(Boolean).map((line) => ({
      kind: node.kind || "paragraph",
      text: line,
      sourceLine: Number(node.sourceLine) || index + 1,
      level: Number(node.level) || 0,
      listLevel: Number(node.listLevel) || 0,
      bold: Boolean(node.bold),
    })));
  }

  function hasStructuredPattern(nodes) {
    const numbered = nodes.map((node, index) => ({ node, index, outline: outlineInfo(node.text) })).filter((item) => item.outline);
    const topLevel = numbered.filter((item) => item.outline.level === 1);
    const descriptions = numbered.filter(({ index }) => {
      const next = nodes[index + 1];
      return next && !outlineInfo(next.text) && !isLikelySubject(next.text, next, { nextNode: nodes[index + 2] }) && !isEditorialNote(next.text);
    });
    const headingSignals = nodes.filter((node) => node.kind === "heading" || node.bold).length;
    const subjectSignals = nodes.filter((node, index) => isLikelySubject(node.text, node, {
      nextNode: nodes[index + 1],
      hasFollowingTopLevelItem: nodes.slice(index + 1).some((entry) => outlineInfo(entry.text)?.level === 1),
    })).length;
    const confidence = Math.min(1,
      (topLevel.length >= 2 ? 0.4 : topLevel.length ? 0.18 : 0)
      + (descriptions.length ? 0.3 : 0)
      + (headingSignals ? 0.15 : 0)
      + (subjectSignals ? 0.15 : 0));
    const consistentTopics = topLevel.length >= 2 || (topLevel.length === 1 && headingSignals > 0);
    return { structured: consistentTopics && descriptions.length >= 1 && confidence >= 0.7, confidence, numbered };
  }

  function makeTopic(subject, section, subarea, item, descriptions, order) {
    const detailText = descriptions.map((entry) => entry.text).filter(Boolean);
    const assunto = detailText.length ? `${item.text}: ${detailText.join(" ")}` : item.text;
    return {
      materia: subject,
      assunto,
      ordem: order,
      estudar: "Sim",
      observacoes: "",
      temaExplicito: true,
      structureSource: "user-structured",
      subarea: subarea || "",
      conteudosOriginais: detailText.length ? detailText.slice() : [item.text],
      outlineNumber: item.number,
      outlineLevel: item.level,
      sourceBlockType: "numbered-item",
      origemEdital: {
        type: "documento-estruturado",
        structureSource: "user-structured",
        section: section || "",
        subarea: subarea || "",
        outlineNumber: item.number,
        originalText: [item.originalText, ...detailText].join("\n"),
        parsedStructure: { type: "topic", number: item.number, text: item.text, descriptions: detailText.slice() },
      },
    };
  }

  function parseStructured(nodes) {
    const rows = [];
    const tree = [];
    const problems = [];
    let section = "";
    let subject = "";
    let subjectHeadingLevel = 0;
    let subarea = "";
    let pendingTopic = null;
    let orderBySubject = new Map();

    const addTree = (type, node, extra = {}) => tree.push({ type, text: node.text, sourceLine: node.sourceLine, ...extra });
    const finishTopic = () => {
      if (!pendingTopic) return;
      if (!subject) {
        problems.push({ type: "topic-without-subject", text: pendingTopic.item.text, sourceLine: pendingTopic.item.sourceLine });
      } else {
        const nextOrder = (orderBySubject.get(normalize(subject)) || 0) + 1;
        orderBySubject.set(normalize(subject), nextOrder);
        rows.push(makeTopic(subject, section, subarea, pendingTopic.item, pendingTopic.descriptions, nextOrder));
      }
      pendingTopic = null;
    };

    nodes.forEach((node, index) => {
      const item = outlineInfo(node.text);
      if (isEditorialNote(node.text)) {
        finishTopic();
        problems.push({ type: "editorial-note", text: node.text, sourceLine: node.sourceLine });
        addTree("note", node, { ignored: true });
        return;
      }
      if (isGenericSection(node.text)) {
        finishTopic();
        section = node.text;
        addTree("section", node);
        return;
      }
      if (isLikelySubject(node.text, node, {
        hasOpenSubject: Boolean(subject),
        nextNode: nodes[index + 1],
        hasFollowingTopLevelItem: nodes.slice(index + 1).some((entry) => outlineInfo(entry.text)?.level === 1),
      }) && !item) {
        const next = nodes[index + 1];
        const followsTopic = Boolean(next && outlineInfo(next.text));
        const opensSubject = !subject
          || (isAllCaps(node.text) && followsTopic && hasSubjectLabelShape(node.text))
          || (node.kind === "heading" && subjectHeadingLevel && node.level <= subjectHeadingLevel);
        if (opensSubject) {
          finishTopic();
          subject = node.text;
          subjectHeadingLevel = node.kind === "heading" ? node.level : 0;
          subarea = "";
          addTree("subject", node, { section });
          return;
        }
        if (followsTopic) {
          finishTopic();
          subarea = node.text;
          addTree("subarea", node, { subject });
          return;
        }
      }
      if (!item && subject) {
        const next = nodes[index + 1];
        if (next && outlineInfo(next.text) && node.text.length <= 90 && !/[.;:]$/.test(node.text)) {
          finishTopic();
          subarea = node.text;
          addTree("subarea", node, { subject });
          return;
        }
      }
      if (item) {
        if (item.level === 1) {
          finishTopic();
          pendingTopic = { item: { ...item, originalText: node.text, sourceLine: node.sourceLine }, descriptions: [] };
          addTree("topic", node, { number: item.number, subject, subarea });
        } else if (pendingTopic) {
          pendingTopic.descriptions.push({ text: item.text, sourceLine: node.sourceLine });
          addTree("description", node, { number: item.number, parent: pendingTopic.item.number });
        } else {
          problems.push({ type: "orphan-outline", text: node.text, sourceLine: node.sourceLine, number: item.number });
          addTree("description", node, { number: item.number, orphan: true });
        }
        return;
      }
      if (pendingTopic) {
        pendingTopic.descriptions.push({ text: node.text, sourceLine: node.sourceLine });
        addTree("description", node, { parent: pendingTopic.item.number });
      } else if (node.text) {
        problems.push({ type: "orphan-description", text: node.text, sourceLine: node.sourceLine });
        addTree("description", node, { orphan: true });
      }
    });
    finishTopic();
    return { rows, tree, problems };
  }

  function analyze({ text = "", nodes = [] } = {}) {
    const normalizedNodes = normalizeNodes(text, nodes);
    const detection = hasStructuredPattern(normalizedNodes);
    if (!detection.structured) {
      return { mode: "raw", confidence: detection.confidence, structureSource: "parser", rows: [], tree: [], problems: [] };
    }
    const parsed = parseStructured(normalizedNodes);
    return {
      mode: "structured",
      confidence: detection.confidence,
      structureSource: "user-structured",
      message: "Estrutura reconhecida no documento. Os títulos e agrupamentos originais foram preservados.",
      ...parsed,
    };
  }

  const api = { GENERIC_SECTIONS, analyze, extractHtmlNodes, isEditorialNote, isGenericSection, outlineInfo };
  global.DocumentStructureParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
