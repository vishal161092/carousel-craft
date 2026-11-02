import { LightningElement, api } from "lwc";

/**
 * Presentational helper: injects pre-formatted WhatsApp HTML (bold/italic/strike/links/<br>)
 * produced by the parent's format.js. Uses lwc:dom="manual" because the HTML is built from
 * escaped text plus a known tag whitelist, and we need real <a target="_blank"> links that the
 * parent can intercept (payment click-to-confirm) via event delegation.
 */
export default class De_asterText extends LightningElement {
  _html = "";

  @api
  get htmlValue() {
    return this._html;
  }
  set htmlValue(v) {
    this._html = v || "";
    this.render_();
  }

  renderedCallback() {
    this.render_();
  }

  render_() {
    const el = this.template.querySelector(".rt");
    if (el && el.innerHTML !== this._html) {
      el.innerHTML = this._html;
    }
  }

  // The injected links live inside this component's (synthetic) shadow, so a click listener on
  // the parent would see the event retargeted to this host and never match the <a>. Catch the
  // click here where event.target is the real anchor, and re-dispatch the href up as a composed
  // event the parent can act on (payment click-to-confirm).
  handleClick(event) {
    const anchor = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!anchor) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent("linkclick", {
        detail: { href: anchor.getAttribute("href") || "" },
        bubbles: true,
        composed: true,
      })
    );
    // The anchor keeps its native target=_blank, so the link still opens in a new tab.
  }
}
