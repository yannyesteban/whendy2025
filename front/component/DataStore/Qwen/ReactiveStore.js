class ReactiveStore extends HTMLElement {
    #state = new Proxy({}, {
        set: (target, key, value, receiver) => {
            const oldValue = target[key];
            if (oldValue !== value) {
                Reflect.set(target, key, value, receiver);
                this.#notifyChange(key, value, oldValue);
            }
            return true;
        }
    });

    #notifyChange(key, newValue, oldValue) {
        // Evento específico para la propiedad
        this.dispatchEvent(new CustomEvent(`${key}-change`, {
            detail: { key, newValue, oldValue },
            bubbles: true,
            composed: true
        }));

        // Evento general para cualquier cambio
        this.dispatchEvent(new CustomEvent('change', {
            detail: { key, newValue, oldValue },
            bubbles: true,
            composed: true
        }));
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' }); // Opcional: Shadow DOM
    }

    connectedCallback() {
        // Inicializa el estado desde atributos/data
        Object.entries(this.dataset).forEach(([key, value]) => {
            this.#state[key] = value;
        });
    }

    get state() {
        return this.#state;
    }
    static get observedAttributes() {
        return ['type', 'name', 'value']; // Atributos observados
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        if (oldVal !== newVal && this.#state[attrName] !== newVal) {
            this.#state[attrName] = newVal;
        }
    }

    // En el Proxy handler:
    set(target, key, value) {
        const oldValue = target[key];
        if (oldValue !== value) {
            Reflect.set(target, key, value);
            this.#notifyChange(key, value, oldValue);

            // Sincroniza con atributos solo si es necesario
            if (this.constructor.observedAttributes.includes(String(key))) {
                if (value == null) {
                    this.removeAttribute(key);
                } else {
                    this.setAttribute(key, String(value));
                }
            }
        }
        return true;
    }

    // Ejemplo de mixin para persistencia
const localStorageMixin = (baseClass) => class extends baseClass {
    connectedCallback() {
        super.connectedCallback();
        const saved = localStorage.getItem(this.type);
        if (saved) this.#state = JSON.parse(saved);
    }

    #notifyChange(key, newValue) {
        super.#notifyChange(...arguments);
        localStorage.setItem(this.type, JSON.stringify(this.#state));
    }
};

// Uso: class PersistentStore extends localStorageMixin(ReactiveStore) {}

}

