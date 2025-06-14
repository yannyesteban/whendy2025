// store-manager.js (Módulo para gestionar el singleton)
class StoreManager {
    constructor() {
        if (StoreManager.instance) {
            return StoreManager.instance;
        }
        this._data = {}; // El estado real
        this._subscribers = new Map(); // Para almacenar callbacks por key
        this._globalSubscribers = new Set(); // Para suscriptores a todos los cambios
        StoreManager.instance = this;
    }

    // Usamos Proxy para la reactividad en el set
    initProxy() {
        this._data = new Proxy(this._data, {
            set: (target, key, value) => {
                const oldValue = target[key];
                target[key] = value;
                this._notify(key, value, oldValue);
                return true;
            },
            // Considerar añadir deleteProperty para notificaciones al eliminar
        });
    }

    _notify(key, newValue, oldValue) {
        // Notificar suscriptores específicos
        if (this._subscribers.has(key)) {
            this._subscribers.get(key).forEach(callback => callback(newValue, oldValue));
        }
        // Notificar suscriptores globales
        this._globalSubscribers.forEach(callback => callback({ key, newValue, oldValue }));

        // Opcional: Disparar un CustomEvent en el documento o en un elemento "base"
        // para componentes que prefieran escuchar eventos DOM.
        fire(document.body, 'global-data-change', { key, newValue, oldValue });
    }

    get(key) {
        return this._data[key];
    }

    set(key, value) {
        this._data[key] = value; // Esto activará el Proxy.set
    }

    subscribe(keyOrFunction, callback) {
        if (typeof keyOrFunction === 'string') {
            if (!this._subscribers.has(keyOrFunction)) {
                this._subscribers.set(keyOrFunction, new Set());
            }
            this._subscribers.get(keyOrFunction).add(callback);
        } else if (typeof keyOrFunction === 'function') {
            // Suscripción global
            this._globalSubscribers.add(keyOrFunction);
        }
        return () => this.unsubscribe(keyOrFunction, callback); // Retornar función para desuscribirse
    }

    unsubscribe(keyOrFunction, callback) {
        if (typeof keyOrFunction === 'string' && this._subscribers.has(keyOrFunction)) {
            this._subscribers.get(keyOrFunction).delete(callback);
        } else if (typeof keyOrFunction === 'function') {
            this._globalSubscribers.delete(keyOrFunction);
        }
    }
}

// Inicializar y exportar el StoreManager como un singleton
export const store = new StoreManager();
store.initProxy(); // Activar el Proxy para la reactividad

// Custom Element (más ligero, solo interactúa con el StoreManager)
class GlobalDataStoreElement extends HTMLElement {
    constructor() {
        super();
        // Opcional: Proporcionar un alias para el store global si se desea acceder
        // a través de this.store en la instancia del elemento.
        // Pero idealmente, los componentes deberían importar 'store' directamente.
        // this.store = store; 
    }

    connectedCallback() {
        // Podría usar el 'name' o 'type' del atributo para auto-cargar datos iniciales
        // desde un servidor o configuración, y luego hacer un store.set()
    }

    // No necesita lógica de Proxy interna, solo delega a `store`
    static get observedAttributes() {
        return ['name']; // Opcional, si quieres que el elemento tenga un "nombre"
    }

    attributeChangedCallback(name, oldVal, newVal) {
        // Podrías reaccionar a cambios en los atributos del propio elemento,
        // pero estos atributos no controlarían el estado global directamente.
    }
}

customElements.define("global-data-store", GlobalDataStoreElement);

// fire.js (la función fire sigue siendo útil)
export const fire = (element, name, detail) => {
    // ... (código existente, con mejoras de robustez)
};