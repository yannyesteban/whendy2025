// fire.js (La misma función fire)
export const fire = (element, name, detail) => {
    if (!element || typeof element.dispatchEvent !== 'function') {
        // Log solo en desarrollo
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`[data-store] Cannot fire event '${name}'. Invalid element provided.`, element);
        }
        return;
    }
    const event = new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true
    });
    element.dispatchEvent(event);
};

// store-handlers.js (Para encapsular la lógica del Proxy)
const createDataProxyHandler = (element) => {
    return {
        set(target, key, value) {
            const oldValue = target[key];
            if (oldValue === value) return true; // No hacer nada si el valor es el mismo

            target[key] = value;
            
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[data-store:${element.id || 'anon'}] Set:`, { key, value, oldValue });
            }

            // Notificar el cambio de propiedad específica
            fire(element, `${String(key)}-change`, { property: String(key), newValue: value, oldValue: oldValue });
            // Notificar el cambio general de la store
            fire(element, "data-change", { property: String(key), newValue: value, oldValue: oldValue, action: 'set' });
            
            return true;
        },
        deleteProperty(target, key) {
            if (!target.hasOwnProperty(key)) return true; // Si no existe, no hay nada que borrar

            const oldValue = target[key];
            delete target[key];
            
            if (process.env.NODE_ENV !== 'production') {
                console.log(`[data-store:${element.id || 'anon'}] Deleted:`, { key, oldValue });
            }

            fire(element, `${String(key)}-removed`, { property: String(key), oldValue: oldValue });
            fire(element, "data-change", { property: String(key), oldValue: oldValue, action: 'delete' });
            return true;
        },
        // Opcional: get() para depuración o lógica de acceso
        get(target, key) {
            // if (process.env.NODE_ENV !== 'production') {
            //     console.log(`[data-store:${element.id || 'anon'}] Get:`, key);
            // }
            return target[key];
        }
    };
};

// data-store.js (El Custom Element)
class Store extends HTMLElement {
    private _data: { [key: string]: any } = {}; // Usar un prefijo privado para evitar colisiones
    
    static get observedAttributes() {
        return ["type", "name", "src"]; // 'src' para cargar data de un endpoint
    }

    constructor() {
        super();
        this._data = new Proxy({}, createDataProxyHandler(this));
    }

    public connectedCallback() {
        // Cargar datos iniciales si se especifica un atributo 'src'
        if (this.hasAttribute('src')) {
            this.loadDataFromSrc(this.getAttribute('src')!);
        }

        // Si quisieras que el contenido interno (e.g., <div data-key="foo">bar</div>)
        // se convierta en parte de la store:
        // this.observeChildren();
    }

    public disconnectedCallback() {
        // Limpieza de MutationObservers o listeners si se implementan
    }

    public attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
        if (oldVal === newVal) return;
        
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[data-store:${this.id || 'anon'}] Attribute '${name}' changed from '${oldVal}' to '${newVal}'`);
        }

        // Reaccionar a cambios en atributos HTML relevantes
        switch (name) {
            case 'src':
                if (newVal) this.loadDataFromSrc(newVal);
                break;
            // Otros atributos si necesitas que afecten la data interna
            // case 'name': this.set('__name', newVal); break; // Ejemplo de usar el atributo 'name' en la data interna
        }
        fire(this, `attribute-changed`, { attribute: name, oldValue: oldVal, newValue: newVal });
    }

    async loadDataFromSrc(url: string) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            // Sobreescribir la data del proxy con los nuevos datos
            // Podrías querer fusionar en lugar de sobreescribir completamente
            Object.keys(data).forEach(key => {
                this.set(key, data[key]);
            });
            fire(this, 'data-loaded', { url, data });
        } catch (error) {
            console.error(`[data-store:${this.id || 'anon'}] Failed to load data from ${url}:`, error);
            fire(this, 'data-load-error', { url, error });
        }
    }

    // Métodos públicos para interactuar con la data
    set(key: string, value: any) {
        this._data[key] = value; // Esto activará el Proxy handler
    }

    get(key: string): any {
        return this._data[key];
    }

    delete(key: string) {
        delete this._data[key]; // Esto activará el Proxy handler
    }

    // Opcional: observer para el contenido interno
    // private _mutationObserver: MutationObserver | null = null;
    // private observeChildren() {
    //     this._mutationObserver = new MutationObserver(mutations => {
    //         mutations.forEach(mutation => {
    //             if (mutation.type === 'childList') {
    //                 mutation.addedNodes.forEach(node => {
    //                     if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.key) {
    //                         this.set((node as HTMLElement).dataset.key!, (node as HTMLElement).innerText);
    //                     }
    //                 });
    //                 mutation.removedNodes.forEach(node => {
    //                     if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset.key) {
    //                         this.delete((node as HTMLElement).dataset.key!);
    //                     }
    //                 });
    //             }
    //         });
    //     });
    //     this._mutationObserver.observe(this, { childList: true });
    // }
}

customElements.define("data-store", Store);