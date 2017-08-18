var elementHtml = '<h1>Hello from test-element</h1><p>[[prop1]]</p>';
var elementTemplate = document.createElement('template');
elementTemplate.innerHTML = elementHtml;

console.info('Declaring test-element');

class TestElement extends Polymer.Element {
    static get is() { return 'test-element'; }
    static get properties() {
      return {
        prop1: {
          type: String,
          value: 'Not Ready!'
        }
      };
    }
    static get template() {
        return elementTemplate;
    }

    constructor() {
      super();

      console.info(TestElement.is + ': Created');
      this.prop1 = 'Created';
    }

    connectedCallback() {
      super.connectedCallback();

      console.info(TestElement.is + ': Connected Callback');
      this.prop1 = 'Connected Callback';
    }

    ready() {
      super.ready();

      console.info(TestElement.is + ': Ready');
      this.prop1 = 'Ready';
    }
  }

  window.customElements.define(TestElement.is, TestElement);