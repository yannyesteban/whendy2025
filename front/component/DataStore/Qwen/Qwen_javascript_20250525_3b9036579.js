export const fire = (element, name, detail) => {
    const event = new CustomEvent(name, { detail, bubbles: true, composed: true });
    element.dispatchEvent(event);
};

const _handler = (element) => ({
    set(target, key, value) {
        const oldValue = target[key];
        target[key] = value;

        if (oldValue !== value) {
            const mode = "change";
            fire(element, `${String(key)}-change`, { key, value, mode });
            fire(element, "change", { key, value, mode });
        }

        return true;
    },
});

class Store extends HTMLElement {
    static get observedAttributes() {
        return ["type", "name"];
    }

    #data = new Proxy({}, _handler(this));

    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Opcional: para Shadow DOM
    }

    connectedCallback() {
        Object.entries(this.dataset).forEach(([key, value]) => {
            this.#data[key] = value;
        });
    }

    add(name, value) {
        this.#data[name] = value;
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'type' || name === 'name') {
            this.#data[name] = newVal;
        }
    }

    // Getters/setters para atributos...
}

customElements.define("data-store", Store);