(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});

  function blockType(tagName) {
    if (/^H[1-6]$/.test(tagName)) return "heading";
    if (tagName === "LI") return "listItem";
    if (tagName === "TR") return "tableRow";
    if (tagName === "P") return "paragraph";
    return "unknown";
  }

  importer.extractDocx = async function extractDocx(file, onProgress) {
    if (!global.mammoth) throw new Error("Leitor DOCX indisponível neste navegador.");
    onProgress?.({ stage: "reading", label: "Lendo o documento Word..." });
    const result = await global.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(result.value || "", "text/html");
    const nodes = [...documentNode.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,tr")];
    const blocks = nodes.map((node, index) => ({
      id: `docx-block-${index + 1}`,
      page: null,
      type: blockType(node.tagName),
      text: node.textContent || "",
      level: /^H[1-6]$/.test(node.tagName) ? Number(node.tagName.slice(1)) : null,
      position: null,
      source: { format: "docx", tag: node.tagName.toLowerCase() },
    })).filter((block) => String(block.text).trim());
    return { blocks, pageCount: 0 };
  };

  importer.extractTxt = async function extractTxt(file, onProgress) {
    onProgress?.({ stage: "reading", label: "Lendo o arquivo de texto..." });
    return {
      pageCount: 0,
      blocks: String(await file.text()).split(/\r?\n/).map((text, index) => ({ id: `txt-${index + 1}`, page: null, type: "paragraph", text, position: null, source: { format: "txt" } })),
    };
  };
})(window);
