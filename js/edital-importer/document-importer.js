(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});
  const profiles = (importer.profiles = importer.profiles || {});
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  importer.registerProfile = function registerProfile(profile) {
    if (profile && profile.id) profiles[profile.id] = profile;
  };

  importer.getProfile = function getProfile(id) {
    return profiles[id] || profiles.generic || null;
  };

  importer.detectProfile = function detectProfile(text) {
    const source = String(text || "").toLocaleUpperCase("pt-BR");
    const profile = Object.values(profiles).find((item) => (item.aliases || []).some((alias) => source.includes(alias.toLocaleUpperCase("pt-BR"))));
    return profile || importer.getProfile("generic");
  };

  importer.validateFile = function validateFile(file) {
    if (!file || !file.name) throw new Error("Selecione um edital para continuar.");
    if (Number(file.size) > MAX_FILE_SIZE) throw new Error("O arquivo é grande demais para ser lido com segurança no navegador. Use um edital de até 25 MB.");
    const extension = String(file.name).split(".").pop().toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(extension)) throw new Error("Formato não suportado. Use PDF pesquisável, DOCX ou TXT. Arquivos .doc não são aceitos.");
    return extension;
  };

  importer.importDocument = async function importDocument(file, onProgress) {
    const extension = importer.validateFile(file);
    const report = typeof onProgress === "function" ? onProgress : () => {};
    report({ stage: "reading", label: "Lendo o arquivo..." });

    let extracted;
    if (extension === "pdf") extracted = await importer.extractPdf(file, report);
    else if (extension === "docx") extracted = await importer.extractDocx(file, report);
    else extracted = await importer.extractTxt(file, report);

    report({ stage: "normalizing", label: "Organizando o texto encontrado..." });
    const documentData = importer.normalizeDocument({
      metadata: {
        fileName: file.name,
        fileType: extension,
        fileSize: Number(file.size) || 0,
        importedAt: new Date().toISOString(),
        pageCount: extracted.pageCount || 0,
      },
      blocks: extracted.blocks || [],
    });

    if (!documentData.blocks.some((block) => block.normalizedText)) {
      const guidance = extension === "pdf"
        ? "Não foi possível encontrar texto no PDF. Ele pode ser uma imagem escaneada; use uma versão com texto pesquisável."
        : "O arquivo não possui conteúdo textual para importar.";
      throw new Error(guidance);
    }

    documentData.profile = importer.detectProfile(documentData.blocks.map((block) => block.normalizedText).join("\n"));
    documentData.layout = importer.analyzeLayout(documentData);
    report({ stage: "detecting", label: "Identificando cargos e conteúdos..." });
    return documentData;
  };
})(window);
