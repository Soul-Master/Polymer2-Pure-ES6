var containerhtml = '<h1>Hello from test-container</h1><div style="border: 1px solid red"><test-element></test-element></div>';
var containerTemplate = document.createElement('template');
containerTemplate.innerHTML = containerhtml;

console.info('Declaring test-container');

class TestContainer extends Polymer.Element {
    static get is() { return 'test-container'; }
    static get properties() {
      return {
        prop1: {
          type: String,
          value: 'Not Ready!'
        }
      };
    }
    static get template() {
        return containerTemplate;
    }

    constructor() {
      super();

      console.info(TestContainer.is + ': Created');
      this.prop1 = 'Created';
    }

    connectedCallback(){
      super.connectedCallback();

      console.info(TestContainer.is + ': Connected Callback');
      this.prop1 = 'Connected Callback';
    }

    ready(){
      super.ready();

      console.info(TestContainer.is + ': Ready');
      this.prop1 = 'Ready';
    }
  }

  window.customElements.define(TestContainer.is, TestContainer);