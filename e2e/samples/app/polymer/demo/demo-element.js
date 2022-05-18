import { PolymerElement, html } from "@polymer/polymer/polymer-element.js";
import "@polymer/iron-icons/iron-icons.js";
import "../icon-toggle.js";

class DemoElement extends PolymerElement {
  static get template() {
    return html`
      <style>
        :host {
          font-family: sans-serif;
        }
      </style>

      <h3>Statically-configured icon-toggles</h3>
      <icon-toggle toggle-icon="star"></icon-toggle>
      <icon-toggle toggle-icon="star" pressed></icon-toggle>

      <h3>Data-bound icon-toggle</h3>
      <!-- use a computed binding to generate the message -->
      <div><span>[[_message(isFav)]]</span></div>
      <!-- curly brackets ({{}}} allow two-way binding -->
      <icon-toggle toggle-icon="favorite" pressed="{{isFav}}"></icon-toggle>
    `;
  }
  _message(fav) {
    if (fav) {
      return "You really like me!";
    } else {
      return "Do you like me?";
    }
  }
}
customElements.define("demo-element", DemoElement);
