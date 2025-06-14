export const fire = (element, name, detail) => {
    if (!element || typeof element.dispatchEvent !== 'function') {
        console.warn(`[data-store] Cannot fire event '${name}'. Invalid element provided.`, element);
        return;
    }
    const event = new CustomEvent(name, {
        detail,
        bubbles: true, // Permitir que el evento burbujee
        composed: true // Permitir que el evento atraviese Shadow DOM
    });
    element.dispatchEvent(event);
};

const _handler = (element) => {
    return {
        set(target, key, value) {
            let oldValue = target[key];
            
            // Solo loggear en desarrollo
            if (process.env.NODE_ENV !== 'production') {
                console.log({ target, key, value, oldValue, type: typeof value });
            }

            target[key] = value;
            let mode = "set";
            if (oldValue !== value) {
                mode = "change";
            }

            fire(element, `${String(key)}-change`, { key, value, mode });
            fire(element, "change", { key, value, mode });
            
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[data-store] Data property '${String(key)}' updated to:`, value);
            }
            return true;
        },
        // Opcional: añadir un getter para el proxy para depuración o lógica adicional
        get(target, key) {
            // console.log(`[data-store] Accessing data property '${String(key)}'`);
            return target[key];
        }
    };
};

class Store extends HTMLElement {
    data: { [key: string]: any } = {}; // Tipado si usas TypeScript y un valor inicial
    
    static get observedAttributes() {
        return ["type", "name"]; // Observar ambos atributos
    }

    constructor() {
        super();
    }

    public connectedCallback() {
        // Inicializar el proxy solo una vez
        if (!this.data || Object.keys(this.data).length === 0) { // Comprobar si ya está inicializado
             this.data = new Proxy({}, _handler(this));
        }
       
        // Opcional: inicializar 'name' y 'type' de los atributos HTML en la 'data' si es el comportamiento deseado
        // Esto los haría reactivos a través del proxy.
        // if (this.name) this.data.name = this.name;
        // if (this.type) this.data.type = this.type;
    }

    add(name: string, value: any) { // Tipado
        this.data[name] = value;
    }

    public disconnectedCallback() {
        // Limpiar listeners de eventos o referencias si es necesario
    }

    public attributeChangedCallback(name: string, oldVal: string, newVal: string) { // Tipado
        if (oldVal === newVal) return;

        if (process.env.NODE_ENV !== 'production') {
             console.log(`[data-store] Attribute '${name}' changed from '${oldVal}' to '${newVal}'`);
        }
       
        // Aquí podrías disparar un evento si un atributo HTML cambia
        fire(this, `attribute-${name}-changed`, { name, oldVal, newVal });

        // Si quieres que los atributos HTML también actualicen la data del proxy,
        // podrías hacerlo aquí, pero cuidado con los ciclos infinitos si la data también actualiza el atributo.
        // Por ejemplo, si tienes una propiedad 'storeName' en 'data' que refleja el atributo 'name':
        // if (name === 'name') {
        //     this.data.storeName = newVal;
        // }
    }

    set type(value: string | null) { // Tipado
        if (value !== null && value !== undefined) {
            this.setAttribute("type", value);
        } else {
            this.removeAttribute("type");
        }
    }

    get type(): string | null { // Tipado
        return this.getAttribute("type");
    }

    set name(value: string | null) { // Tipado
        if (value !== null && value !== undefined) {
            this.setAttribute("name", value);
        } else {
            this.removeAttribute("name");
        }
    }

    get name(): string | null { // Tipado
        return this.getAttribute("name");
    }
}

customElements.define("data-store", Store);