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

  function outlineForNode(node) {
    const number = clean(node?.outlineNumber);
    if (number) {
      return {
        number,
        level: Number(node.outlineLevel) || number.split(".").filter(Boolean).length,
        text: clean(node.text),
      };
    }
    return outlineInfo(node?.text);
  }

  function isGap(node) {
    return node?.type === "gap" || node?.kind === "gap";
  }

  function nextMeaningfulNode(nodes, index) {
    for (let cursor = index + 1; cursor < nodes.length; cursor += 1) {
      if (!isGap(nodes[cursor])) return nodes[cursor];
    }
    return null;
  }

  function hasGapBefore(nodes, index) {
    return index > 0 && isGap(nodes[index - 1]);
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
    if (!text || isGenericSection(text) || outlineForNode(node)) return false;
    if (node?.kind === "heading" || node?.bold) return !isAcronymLike(text) || !hasOpenSubject;
    // Plain uppercase paragraphs are only a supporting signal. They need a
    // section-shaped label and a following top-level item before they can open
    // or switch a subject; short acronyms remain viable topic titles.
    if (!isAllCaps(text) || !hasSubjectLabelShape(text)) return false;
    if (!hasOpenSubject && hasFollowingTopLevelItem) return true;
    return Boolean(nextNode && outlineForNode(nextNode)?.level === 1);
  }

  function documentNodesFromText(text) {
    return String(text || "").split(/\r?\n/).map((value, index) => {
      const content = clean(value);
      return content
        ? { type: "paragraph", kind: "paragraph", text: content, sourceLine: index + 1, sourceOrder: index, level: 0, listLevel: 0, bold: false }
        : { type: "gap", kind: "gap", text: "", sourceLine: index + 1, sourceOrder: index, size: 1 };
    });
  }

  function extractHtmlBlocks(html) {
    if (typeof document === "undefined") return { text: "", nodes: [] };
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    const root = template.content;
    const nodes = [];
    let sourceOrder = 0;
    const push = (block) => nodes.push({ sourceOrder: sourceOrder, sourceLine: sourceOrder++ + 1, ...block });
    const textWithBreaks = (element, { withoutLists = false } = {}) => {
      const copy = element.cloneNode(true);
      if (withoutLists) copy.querySelectorAll("ol,ul").forEach((list) => list.remove());
      copy.querySelectorAll("br").forEach((breakNode) => breakNode.replaceWith("\n"));
      return copy.textContent || "";
    };
    const pushParagraph = (element) => {
      const text = clean(textWithBreaks(element));
      if (!text) return push({ type: "gap", kind: "gap", text: "", size: 1 });
      const tag = element.tagName.toLowerCase();
      push({
        type: tag.startsWith("h") ? "heading" : "paragraph",
        kind: tag.startsWith("h") ? "heading" : "paragraph",
        text,
        headingLevel: tag.startsWith("h") ? Number(tag.slice(1)) : null,
        level: tag.startsWith("h") ? Number(tag.slice(1)) : 0,
        bold: Boolean(element.matches("strong,b") || element.querySelector("strong,b")),
      });
    };
    const walkList = (list, parentNumbers = []) => {
      const ordered = list.tagName.toLowerCase() === "ol";
      let counter = Number(list.getAttribute("start")) || 1;
      [...list.children].filter((child) => child.tagName?.toLowerCase() === "li").forEach((item) => {
        const explicitValue = Number(item.getAttribute("value"));
        if (Number.isFinite(explicitValue) && explicitValue > 0) counter = explicitValue;
        const numberParts = ordered ? [...parentNumbers, counter] : parentNumbers;
        const outlineNumber = ordered ? numberParts.join(".") : "";
        const text = clean(textWithBreaks(item, { withoutLists: true }));
        if (text) {
          push({
            type: ordered ? "numbered-item" : "list-item",
            kind: "list",
            text,
            outlineNumber,
            outlineLevel: ordered ? numberParts.length : 0,
            listIndex: counter,
            listLevel: parentNumbers.length,
            bold: Boolean(item.querySelector("strong,b")),
            sourceBlockType: ordered ? "docx-numbered" : "docx-list",
          });
        }
        [...item.children].filter((child) => /^(OL|UL)$/i.test(child.tagName)).forEach((child) => walkList(child, numberParts));
        counter += 1;
      });
    };
    const walk = (parent) => {
      [...parent.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          if (clean(child.textContent)) push({ type: "paragraph", kind: "paragraph", text: clean(child.textContent), bold: false });
          return;
        }
        if (child.nodeType !== 1) return;
        const tag = child.tagName.toLowerCase();
        if (/^h[1-6]$/.test(tag) || tag === "p") return pushParagraph(child);
        if (tag === "ol" || tag === "ul") return walkList(child);
        if (tag === "table") {
          [...child.querySelectorAll("tr")].forEach((row) => {
            const text = [...row.children].map((cell) => clean(textWithBreaks(cell))).filter(Boolean).join(" | ");
            if (text) push({ type: "paragraph", kind: "paragraph", text, bold: false, sourceBlockType: "table-row" });
          });
          return;
        }
        walk(child);
      });
    };
    walk(root);
    const text = nodes.map((node) => {
      if (isGap(node)) return "";
      return node.outlineNumber ? `${node.outlineNumber}. ${node.text}` : node.text;
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return { text, nodes };
  }

  const extractHtmlNodes = extractHtmlBlocks;

  function normalizeNodes(text, suppliedNodes) {
    const source = Array.isArray(suppliedNodes) && suppliedNodes.length ? suppliedNodes : documentNodesFromText(text);
    return source.flatMap((node, index) => {
      if (isGap(node)) return [{ type: "gap", kind: "gap", text: "", sourceLine: Number(node.sourceLine) || index + 1, sourceOrder: Number(node.sourceOrder) || index, size: Number(node.size) || 1 }];
      return String(node?.text || "").split(/\r?\n/).map(clean).filter(Boolean).map((line) => ({
        type: node.type || "paragraph",
        kind: node.kind || "paragraph",
        text: line,
        sourceLine: Number(node.sourceLine) || index + 1,
        sourceOrder: Number(node.sourceOrder) || index,
        level: Number(node.level ?? node.headingLevel) || 0,
        headingLevel: Number(node.headingLevel) || 0,
        listLevel: Number(node.listLevel) || 0,
        outlineNumber: clean(node.outlineNumber),
        outlineLevel: Number(node.outlineLevel) || 0,
        sourceBlockType: node.sourceBlockType || (node.type === "numbered-item" ? "docx-numbered" : ""),
        bold: Boolean(node.bold),
      }));
    });
  }

  function hasStructuredPattern(nodes) {
    const numbered = nodes.map((node, index) => ({ node, index, outline: outlineForNode(node) })).filter((item) => item.outline);
    const topLevel = numbered.filter((item) => item.outline.level === 1);
    const descriptions = numbered.filter(({ index }) => {
      const next = nextMeaningfulNode(nodes, index);
      return next && !outlineForNode(next) && !isLikelySubject(next.text, next, { nextNode: nextMeaningfulNode(nodes, nodes.indexOf(next)) }) && !isEditorialNote(next.text);
    });
    const headingSignals = nodes.filter((node) => node.kind === "heading" || node.bold).length;
    const subjectSignals = nodes.filter((node, index) => isLikelySubject(node.text, node, {
      nextNode: nextMeaningfulNode(nodes, index),
      hasFollowingTopLevelItem: nodes.slice(index + 1).some((entry) => outlineForNode(entry)?.level === 1),
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
      sourceBlockType: item.sourceBlockType || "numbered-item",
      sourceStructure: item.sourceBlockType === "docx-numbered" ? "docx-numbered" : "structured-numbered",
      sourceSubjectHeading: subject,
      origemEdital: {
        type: "documento-estruturado",
        structureSource: "user-structured",
        section: section || "",
        subarea: subarea || "",
        outlineNumber: item.number,
        outlineLevel: item.level,
        sourceBlockType: item.sourceBlockType || "numbered-item",
        sourceSubjectHeading: subject,
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

    const addTree = (type, node, extra = {}) => tree.push({ type, text: node.text, sourceLine: node.sourceLine, sourceOrder: node.sourceOrder, ...extra });
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
      if (isGap(node)) {
        addTree("gap", node, { size: node.size || 1 });
        return;
      }
      const item = outlineForNode(node);
      const next = nextMeaningfulNode(nodes, index);
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
        nextNode: next,
        hasFollowingTopLevelItem: nodes.slice(index + 1).some((entry) => outlineForNode(entry)?.level === 1),
      }) && !item) {
        const followsTopic = Boolean(next && outlineForNode(next)?.level === 1);
        const opensSubject = !subject
          || (isAllCaps(node.text) && followsTopic && hasSubjectLabelShape(node.text) && (hasGapBefore(nodes, index) || outlineForNode(next)?.number === "1" || node.kind === "heading"))
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
        if (next && outlineForNode(next) && node.text.length <= 90 && !/[.;:]$/.test(node.text)) {
          finishTopic();
          subarea = node.text;
          addTree("subarea", node, { subject });
          return;
        }
      }
      if (item) {
        if (item.level === 1) {
          finishTopic();
          pendingTopic = {
            item: {
              ...item,
              originalText: node.outlineNumber ? `${node.outlineNumber}. ${node.text}` : node.text,
              sourceLine: node.sourceLine,
              sourceBlockType: node.sourceBlockType,
            },
            descriptions: [],
          };
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

  const api = { GENERIC_SECTIONS, analyze, extractHtmlBlocks, extractHtmlNodes, isEditorialNote, isGenericSection, outlineInfo };
  global.DocumentStructureParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
