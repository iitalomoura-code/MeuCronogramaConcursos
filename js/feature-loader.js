"use strict";

// Funcionalidades que não participam da primeira decisão de estudo são
// carregadas somente quando a pessoa realmente abre a respectiva interface.
(function initializeDeferredFeatureLoader(global) {
  const loads = new Map();

  function scriptsFor(feature) {
    const template = document.querySelector(`[data-deferred-feature="${feature}"]`);
    return [...(template?.content?.querySelectorAll("script[data-deferred-src]") || [])]
      .map((script) => script.dataset.deferredSrc)
      .filter(Boolean);
  }

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-deferred-loaded-src="${CSS.escape(source)}"]`);
      if (existing) {
        if (existing.dataset.deferredLoaded === "true") resolve();
        else existing.addEventListener("load", resolve, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = source;
      script.async = false;
      script.dataset.deferredLoadedSrc = source;
      script.onload = () => { script.dataset.deferredLoaded = "true"; resolve(); };
      script.onerror = () => reject(new Error(`Não foi possível carregar o recurso opcional: ${source}`));
      document.head.append(script);
    });
  }

  global.loadDeferredFeature = (feature) => {
    if (loads.has(feature)) return loads.get(feature);
    const sources = scriptsFor(feature);
    const load = sources.reduce((chain, source) => chain.then(() => loadScript(source)), Promise.resolve());
    loads.set(feature, load);
    return load;
  };
})(window);
