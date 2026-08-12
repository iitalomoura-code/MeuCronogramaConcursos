(function registerBrandLogo() {
  if (customElements.get("brand-logo")) return;

  class BrandLogo extends HTMLElement {
    static get observedAttributes() {
      return ["variant"];
    }

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback() {
      if (this.isConnected) this.render();
    }

    render() {
      const variant = ["compact", "default", "large"].includes(this.getAttribute("variant"))
        ? this.getAttribute("variant")
        : "default";

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            --brand-logo-ink: var(--text, #26323A);
            --brand-logo-muted: var(--muted, #697783);
            --brand-logo-accent: var(--primary, #D97706);
            display: inline-block;
            min-width: 0;
            color: var(--brand-logo-ink);
            font-family: Inter, "Segoe UI", Arial, sans-serif;
          }

          .brand-logo-component {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .brand-logo-mark {
            width: 44px;
            height: 44px;
            flex: 0 0 auto;
            overflow: visible;
          }

          .document-line,
          .clock-face,
          .clock-hand {
            fill: none;
            stroke: currentColor;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .document-line {
            stroke-width: 2.2;
          }

          .check-line,
          .clock-face,
          .clock-hand {
            color: var(--brand-logo-accent);
          }

          .check-line {
            fill: none;
            stroke: currentColor;
            stroke-width: 2.4;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .clock-backdrop {
            fill: var(--brand-logo-surface, var(--sidebar, var(--card, #FFFFFF)));
          }

          .clock-face {
            stroke-width: 2.4;
          }

          .clock-hand {
            stroke-width: 2.1;
          }

          .brand-logo-copy {
            display: grid;
            gap: 3px;
            min-width: 0;
            line-height: 1;
          }

          .brand-logo-name {
            color: var(--brand-logo-ink);
            font-size: 20px;
            font-weight: 700;
            line-height: 1.08;
            white-space: nowrap;
          }

          .brand-logo-category {
            color: var(--brand-logo-muted);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: .14em;
            line-height: 1.2;
            text-transform: uppercase;
          }

          :host([variant="compact"]) .brand-logo-component {
            gap: 8px;
          }

          :host([variant="compact"]) .brand-logo-mark {
            width: 36px;
            height: 36px;
          }

          :host([variant="compact"]) .brand-logo-name {
            font-size: 16px;
          }

          :host([variant="compact"]) .brand-logo-category {
            font-size: 9px;
            letter-spacing: .13em;
          }

          :host([variant="large"]) .brand-logo-component {
            gap: 13px;
          }

          :host([variant="large"]) .brand-logo-mark {
            width: 56px;
            height: 56px;
          }

          :host([variant="large"]) .brand-logo-name {
            font-size: 24px;
          }

          :host([variant="large"]) .brand-logo-category {
            font-size: 11px;
            letter-spacing: .16em;
          }
        </style>
        <span class="brand-logo-component brand-logo-component--${variant}" role="img" aria-label="Meu Cronograma Concursos">
          <svg class="brand-logo-mark" viewBox="0 0 52 52" aria-hidden="true">
            <path class="document-line" d="M10 4.5h24.5a4 4 0 0 1 4 4v31a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-31a4 4 0 0 1 4-4Z" />
            <path class="check-line" d="m11.5 14.8 2.2 2.2 4.1-4.6" />
            <path class="document-line" d="M21.5 15h10" />
            <path class="check-line" d="m11.5 24.3 2.2 2.2 4.1-4.6" />
            <path class="document-line" d="M21.5 24.5h10" />
            <path class="check-line" d="m11.5 33.8 2.2 2.2 4.1-4.6" />
            <path class="document-line" d="M21.5 34h6" />
            <circle class="clock-backdrop" cx="39" cy="39" r="11.5" />
            <circle class="clock-face" cx="39" cy="39" r="9.5" />
            <path class="clock-hand" d="M39 33.8v5.6l3.6 2" />
          </svg>
          <span class="brand-logo-copy">
            <span class="brand-logo-name">Meu Cronograma</span>
            <span class="brand-logo-category">CONCURSOS</span>
          </span>
        </span>`;
    }
  }

  customElements.define("brand-logo", BrandLogo);
})();
