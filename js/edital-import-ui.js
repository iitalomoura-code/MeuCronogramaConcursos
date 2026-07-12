(function (global) {
  "use strict";

  const importer = (global.EditalImporter = global.EditalImporter || {});
  const ui = (global.EditalImportUI = global.EditalImportUI || {});
  let options = {};
  let session = null;
  let host = null;

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function button(label, className, action) {
    const element = create("button", className, label);
    element.type = "button";
    element.dataset.importAction = action;
    return element;
  }

  function input(value, field, label) {
    const wrapper = create("label", "edital-field");
    wrapper.append(create("span", "edital-field-label", label));
    const element = create("input");
    element.value = value || "";
    element.dataset.importField = field;
    wrapper.append(element);
    return wrapper;
  }

  function isCommonScope(scope) {
    return ["general", "basic", "common", "education", "area", "unknown"].includes(scope);
  }

  function scopeLabel(scope) {
    return ({ general: "Geral", basic: "Básico", common: "Comum", education: "Escolaridade", area: "Área", cargo: "Cargo", specialty: "Especialidade", specific: "Específico", unknown: "A revisar" })[scope] || "A revisar";
  }

  function cloneItems(items) {
    return (items || []).map((item, index) => ({
      ...item,
      id: item.id || `review-item-${index + 1}`,
      selected: item.selected !== false,
      merge: false,
      origin: { ...(item.origin || {}) },
      confidence: { ...(item.confidence || { score: 0.5, label: "Média", evidences: [] }) },
    }));
  }

  function ensureHost() {
    if (host) return host;
    host = create("section", "edital-import-modal");
    host.hidden = true;
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-label", "Revisar importação do edital");
    document.body.append(host);
    return host;
  }

  function close() {
    if (!host) return;
    host.hidden = true;
    host.replaceChildren();
    session = null;
  }

  function renderProgress(progress) {
    const modal = ensureHost();
    modal.hidden = false;
    const backdrop = create("div", "edital-import-backdrop");
    const panel = create("section", "edital-import-drawer edital-import-progress");
    panel.append(create("span", "section-kicker", "Importação assistida"));
    panel.append(create("h2", "edital-import-title", "Lendo o edital"));
    panel.append(create("p", "edital-import-copy", progress.label || "Preparando a leitura do arquivo..."));
    const track = create("div", "edital-import-progress-track");
    const fill = create("span", "edital-import-progress-fill");
    if (progress.total) fill.style.width = `${Math.max(12, Math.round((progress.current || 0) / progress.total * 100))}%`;
    else fill.style.width = "42%";
    track.append(fill);
    panel.append(track);
    panel.append(create("p", "edital-import-note", "O arquivo é lido apenas neste navegador e não é salvo nos seus dados."));
    modal.replaceChildren(backdrop, panel);
  }

  function reviewItem(item) {
    const card = create("article", `edital-review-item ${item.confidence?.label === "Baixa" ? "is-low-confidence" : ""}`);
    card.dataset.itemId = item.id;
    const top = create("div", "edital-review-item-top");
    const select = create("input");
    select.type = "checkbox";
    select.checked = item.selected;
    select.dataset.importField = "selected";
    select.setAttribute("aria-label", "Importar este item");
    top.append(select);
    const merge = create("input");
    merge.type = "checkbox";
    merge.checked = Boolean(item.merge);
    merge.dataset.importField = "merge";
    merge.title = "Selecionar para unir";
    merge.setAttribute("aria-label", "Selecionar para unir itens");
    top.append(merge);
    top.append(create("span", "edital-item-number", String(item.id).replace(/^.*?(\d+)$/, "$1")));
    top.append(create("span", `edital-confidence is-${String(item.confidence?.label || "Média").toLowerCase()}`, `${item.confidence?.label || "Média"} confiança`));
    top.append(button("Dividir", "text-action", "split-item"));
    top.append(button("Excluir", "text-action danger", "delete-item"));
    card.append(top);
    const fields = create("div", "edital-review-fields");
    fields.append(input(item.materia, "materia", "Matéria"));
    fields.append(input(item.assunto, "assunto", "Tema / assunto"));
    const scopeWrap = create("label", "edital-field");
    scopeWrap.append(create("span", "edital-field-label", "Aplicação"));
    const scope = create("select");
    scope.dataset.importField = "scope";
    [["general", "Geral / comum"], ["education", "Por escolaridade"], ["area", "Por área"], ["specific", "Específico"], ["cargo", "Por cargo"], ["specialty", "Por especialidade"], ["unknown", "A revisar"]].forEach(([value, text]) => {
      const option = new Option(text, value, false, value === item.scope);
      scope.add(option);
    });
    scopeWrap.append(scope);
    fields.append(scopeWrap);
    card.append(fields);
    const source = create("details", "edital-item-source");
    source.append(create("summary", "", item.origin?.page ? `Ver origem: página ${item.origin.page}` : "Ver trecho de origem"));
    const excerpt = create("p", "", item.origin?.excerpt || "Origem não disponível para este item.");
    source.append(excerpt);
    card.append(source);
    return card;
  }

  function group(title, caption, items) {
    const section = create("section", "edital-review-group");
    const header = create("div", "edital-review-group-header");
    const text = create("div");
    text.append(create("h3", "", title));
    text.append(create("p", "", caption));
    header.append(text);
    header.append(create("span", "edital-group-count", `${items.length} item${items.length === 1 ? "" : "ns"}`));
    section.append(header);
    const list = create("div", "edital-review-list");
    items.forEach((item) => list.append(reviewItem(item)));
    section.append(list);
    return section;
  }

  function updateItemFromField(target) {
    const card = target.closest("[data-item-id]");
    const item = session?.items.find((entry) => entry.id === card?.dataset.itemId);
    if (!item) return;
    const field = target.dataset.importField;
    if (field === "selected" || field === "merge") item[field] = target.checked;
    else item[field] = target.value;
  }

  function resetItemsForCargo() {
    const result = importer.resolveContentForCargo(session.document, session.cargo || null);
    session.result = result;
    session.items = cloneItems(result.items);
  }

  function showError(error) {
    const modal = ensureHost();
    modal.hidden = false;
    const backdrop = create("div", "edital-import-backdrop");
    const panel = create("section", "edital-import-drawer edital-import-error");
    panel.append(create("span", "section-kicker", "Não foi possível importar"));
    panel.append(create("h2", "edital-import-title", "Confira o arquivo"));
    panel.append(create("p", "edital-import-copy", error?.message || "O edital não pôde ser lido."));
    panel.append(button("Fechar", "primary-button", "cancel"));
    modal.replaceChildren(backdrop, panel);
  }

  function renderReview() {
    const modal = ensureHost();
    const result = { ...session.result, items: session.items };
    const validation = importer.validateImport(result);
    modal.hidden = false;
    const backdrop = create("button", "edital-import-backdrop");
    backdrop.type = "button";
    backdrop.dataset.importAction = "cancel";
    backdrop.setAttribute("aria-label", "Cancelar importação");
    const panel = create("section", "edital-import-drawer edital-import-review");
    const header = create("header", "edital-import-review-header");
    const heading = create("div");
    heading.append(create("span", "section-kicker", "Revisão do edital"));
    heading.append(create("h2", "edital-import-title", "Confira cargos, matérias e temas"));
    heading.append(create("p", "edital-import-copy", `${session.document.metadata.fileName} · leitura ${session.document.profile?.name || "genérica"} · confiança ${session.result.confidence.label.toLowerCase()}`));
    header.append(heading);
    header.append(button("Cancelar", "ghost-button", "cancel"));
    panel.append(header);

    const cargoBar = create("section", "edital-cargo-bar");
    const cargoSelectField = create("label", "edital-field");
    cargoSelectField.append(create("span", "edital-field-label", "Cargo analisado"));
    const cargoSelect = create("select");
    cargoSelect.dataset.importControl = "cargo";
    cargoSelect.add(new Option("Somente conteúdos comuns", "", !session.cargo, !session.cargo));
    session.cargos.forEach((cargo) => cargoSelect.add(new Option(cargo.name, cargo.name, false, cargo.name === session.cargo)));
    cargoSelectField.append(cargoSelect);
    cargoBar.append(cargoSelectField);
    const addCargo = create("div", "edital-add-cargo");
    const cargoInput = create("input");
    cargoInput.placeholder = "Nome do cargo";
    cargoInput.dataset.importControl = "new-cargo";
    addCargo.append(cargoInput, button("Adicionar", "ghost-button compact-button", "add-cargo"), button("Renomear", "ghost-button compact-button", "rename-cargo"));
    cargoBar.append(addCargo);
    panel.append(cargoBar);

    validation.warnings.forEach((message) => panel.append(create("p", "edital-import-warning", message)));
    validation.errors.forEach((message) => panel.append(create("p", "edital-import-error-message", message)));

    const actions = create("div", "edital-review-actions");
    actions.append(button("Adicionar item", "ghost-button compact-button", "add-item"));
    actions.append(button("Unir itens selecionados", "ghost-button compact-button", "merge-items"));
    panel.append(actions);

    const common = session.items.filter((item) => isCommonScope(item.scope));
    const specific = session.items.filter((item) => !isCommonScope(item.scope));
    const groups = create("div", "edital-review-groups");
    groups.append(group("Conteúdos comuns", "Aplicáveis a todos, por escolaridade ou por área.", common));
    groups.append(group("Conteúdos específicos", "Relacionados ao cargo ou à especialidade selecionada.", specific));
    panel.append(groups);

    const footer = create("footer", "edital-import-footer");
    const modeField = create("label", "edital-field edital-import-mode");
    modeField.append(create("span", "edital-field-label", "Ao confirmar"));
    const mode = create("select");
    mode.dataset.importControl = "mode";
    const hasCurrentRows = Boolean(options.hasExistingRows?.());
    mode.add(new Option(hasCurrentRows ? "Adicionar ao conteúdo atual" : "Usar como conteúdo inicial", "append", true, true));
    if (hasCurrentRows) mode.add(new Option("Substituir a prévia atual", "replace"));
    modeField.append(mode);
    footer.append(modeField);
    footer.append(create("span", "edital-import-footer-note", "Nada é salvo até a confirmação."));
    footer.append(button("Confirmar conteúdo", "primary-button", "confirm"));
    panel.append(footer);
    modal.replaceChildren(backdrop, panel);
  }

  function mergeSelected() {
    const selected = session.items.filter((item) => item.merge);
    if (selected.length < 2) {
      global.alert("Marque pelo menos dois itens com a segunda caixa para uni-los.");
      return;
    }
    const first = selected[0];
    first.assunto = selected.map((item) => item.assunto).filter(Boolean).join("; ");
    first.confidence = { score: Math.min(...selected.map((item) => item.confidence?.score || 0.5)), label: "Média", evidences: ["itens unidos manualmente"] };
    session.items = session.items.filter((item) => !item.merge || item.id === first.id);
    first.merge = false;
    renderReview();
  }

  function splitItem(item) {
    const response = global.prompt("Separe os novos temas por ponto e vírgula.", item.assunto);
    if (response === null) return;
    const parts = importer.splitTopics(response);
    if (parts.length < 2) {
      global.alert("Informe pelo menos dois temas separados por ponto e vírgula.");
      return;
    }
    const at = session.items.findIndex((entry) => entry.id === item.id);
    const split = parts.map((assunto, index) => ({ ...item, id: `${item.id}-split-${index + 1}`, assunto, merge: false, confidence: { score: 0.55, label: "Média", evidences: ["item dividido manualmente"] } }));
    session.items.splice(at, 1, ...split);
    renderReview();
  }

  function confirm() {
    const mode = host.querySelector('[data-import-control="mode"]')?.value || "append";
    const result = { ...session.result, items: session.items };
    const validation = importer.validateImport(result);
    if (!validation.valid) {
      global.alert(validation.errors.join("\n"));
      return;
    }
    const rows = importer.toAppRows(result);
    if (!rows.length) {
      global.alert("Marque pelo menos um item antes de confirmar.");
      return;
    }
    options.onConfirm?.(rows, { mode, cargo: session.cargo, confidence: session.result.confidence, fileName: session.document.metadata.fileName });
    close();
  }

  function handleClick(event) {
    const target = event.target.closest("[data-import-action]");
    if (!target) return;
    const action = target.dataset.importAction;
    if (action === "cancel") { options.onCancel?.(); close(); return; }
    if (action === "add-item") {
      session.items.push({ id: `manual-${Date.now()}`, materia: "Nova matéria", assunto: "Novo tema", scope: "general", selected: true, merge: false, confidence: { score: 1, label: "Alta", evidences: ["adicionado manualmente"] }, origin: { excerpt: "Adicionado manualmente" } });
      renderReview();
      return;
    }
    if (action === "merge-items") { mergeSelected(); return; }
    if (action === "add-cargo") {
      const value = host.querySelector('[data-import-control="new-cargo"]')?.value.trim();
      if (!value) return;
      if (!session.cargos.some((cargo) => cargo.name.toLocaleLowerCase("pt-BR") === value.toLocaleLowerCase("pt-BR"))) session.cargos.push({ name: value, score: 1, confidence: "Alta", evidences: ["adicionado manualmente"], origins: [] });
      session.cargo = value;
      resetItemsForCargo();
      renderReview();
      return;
    }
    if (action === "rename-cargo") {
      const value = host.querySelector('[data-import-control="new-cargo"]')?.value.trim();
      const current = session.cargos.find((cargo) => cargo.name === session.cargo);
      if (!value || !current) {
        global.alert("Selecione um cargo encontrado antes de renomeá-lo.");
        return;
      }
      current.name = value;
      current.evidences = [...(current.evidences || []), "renomeado manualmente"];
      session.cargo = value;
      resetItemsForCargo();
      renderReview();
      return;
    }
    const item = session.items.find((entry) => entry.id === target.closest("[data-item-id]")?.dataset.itemId);
    if (action === "delete-item" && item) { session.items = session.items.filter((entry) => entry.id !== item.id); renderReview(); return; }
    if (action === "split-item" && item) { splitItem(item); return; }
    if (action === "confirm") confirm();
  }

  function handleChange(event) {
    if (event.target.dataset.importControl === "cargo") {
      session.cargo = event.target.value;
      resetItemsForCargo();
      renderReview();
      return;
    }
    if (event.target.matches("[data-import-field]")) updateItemFromField(event.target);
  }

  ui.configure = function configure(nextOptions) {
    options = { ...options, ...nextOptions };
    ensureHost();
    host.onclick = handleClick;
    host.onchange = handleChange;
    host.oninput = handleChange;
  };

  ui.start = async function start(file) {
    ensureHost();
    renderProgress({ label: "Preparando a leitura do edital..." });
    try {
      const documentData = await importer.importDocument(file, renderProgress);
      const cargos = importer.detectCargos(documentData);
      session = { document: documentData, cargos, cargo: cargos[0]?.name || "", items: [], result: null };
      resetItemsForCargo();
      renderReview();
    } catch (error) {
      showError(error);
    }
  };
})(window);
