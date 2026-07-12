(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});

  importer.reconstructPdfLines = function reconstructPdfLines(items, pageNumber) {
    const sorted = (items || [])
      .filter((item) => String(item.str || "").trim())
      .map((item) => ({
        text: String(item.str || ""),
        x: Number(item.transform?.[4]) || 0,
        y: Number(item.transform?.[5]) || 0,
        width: Number(item.width) || 0,
        height: Math.abs(Number(item.height || item.transform?.[0])) || 0,
      }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    sorted.forEach((item) => {
      const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2.5, item.height * 0.35));
      if (line) line.items.push(item);
      else lines.push({ y: item.y, items: [item] });
    });
    return lines.map((line, index) => {
      const ordered = line.items.sort((a, b) => a.x - b.x);
      const text = ordered.reduce((result, item, itemIndex) => {
        const previous = ordered[itemIndex - 1];
        const spacing = previous && item.x - (previous.x + previous.width) > 1.5 ? " " : "";
        return `${result}${spacing}${item.text}`;
      }, "").replace(/\s+/g, " ").trim();
      return {
        id: `pdf-${pageNumber}-line-${index + 1}`,
        page: pageNumber,
        type: "unknown",
        text,
        position: { x: ordered[0]?.x || 0, y: line.y, width: Math.max(...ordered.map((item) => item.x + item.width)) - (ordered[0]?.x || 0), height: Math.max(...ordered.map((item) => item.height)) },
        source: { format: "pdf", itemCount: ordered.length },
      };
    }).filter((line) => line.text);
  };

  importer.extractPdf = async function extractPdf(file, onProgress) {
    const moduleUrl = new URL("./vendor/pdf.min.mjs", global.document.baseURI).href;
    const workerUrl = new URL("./vendor/pdf.worker.min.mjs", global.document.baseURI).href;
    const pdfjs = await import(moduleUrl);
    if (pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const blocks = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress?.({ stage: "reading", label: `Lendo página ${pageNumber} de ${pdf.numPages}...`, current: pageNumber, total: pdf.numPages });
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      blocks.push(...importer.reconstructPdfLines(content.items, pageNumber));
    }
    return { blocks, pageCount: pdf.numPages };
  };
})(window);
