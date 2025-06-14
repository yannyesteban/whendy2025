export const fireEvent = (element, name, detail = {}) => {
    const event = new CustomEvent(name, {
        detail: {
            timestamp: Date.now(),
            ...detail
        },
        bubbles: true, // Permitir bubbling
        composed: true // Permitir cruzar shadow DOM
    });

    return element.dispatchEvent(event);
};

const createProxyHandler = (element) => {
    return {
        get(target, key) {
            // Mejor soporte para métodos de objeto
            if (typeof target[key] === 'function') {
                return target[key].bind(target);
            }
            return target[key];
        },
        set(target, key, value) {
            const oldValue = target[key];
            const hasChanged = oldValue !== value;
            
            target[key] = value;

            if (hasChanged) {
                const detail = { 
                    key, 
                    value, 
                    oldValue,
                    mode: oldValue === undefined ? 'init' : 'change'
                };
                
                fireEvent(element, `${String(key)}-change`, detail);
                fireEvent(element, 'store-change', detail);
            }
            
            return true;
        },
        deleteProperty(target, key) {
            if (key in target) {
                const oldValue = target[key];
                delete target[key];
                fireEvent(element, `${String(key)}-change`, {
                    key,
                    value: undefined,
                    oldValue,
                    mode: 'delete'
                });
                fireEvent(element, 'store-change', {
                    key,
                    value: undefined,
                    oldValue,
                    mode: 'delete'
                });
                return true;
            }
            return false;
        }
    };
};

class Store extends HTMLElement {
    #data; // Campo privado (nueva sintaxis)
    
    static get observedAttributes() {
        return ['type', 'name'];
    }
    
    constructor() {
        super();
        this.#data = new Proxy({}, createProxyHandler(this));
    }

    get data() {
        return this.#data;
    }

    connectedCallback() {
        // Inicialización adicional si es necesaria
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            fireEvent(this, `${name}-changed`, {
                attribute: name,
                oldValue,
                newValue
            });
        }
    }

    // Mejores getters/setters
    get type() {
        return this.getAttribute('type');
    }

    set type(value) {
        this.toggleAttribute('type', Boolean(value));
        if (value) this.setAttribute('type', value);
    }

    get name() {
        return this.getAttribute('name');
    }

    set name(value) {
        this.toggleAttribute('name', Boolean(value));
        if (value) this.setAttribute('name', value);
    }

    // Método para inicializar múltiples valores
    initialize(data) {
        if (typeof data === 'object' && data !== null) {
            Object.keys(data).forEach(key => {
                this.#data[key] = data[key];
            });
        }
    }
}

customElements.define('data-store', Store);