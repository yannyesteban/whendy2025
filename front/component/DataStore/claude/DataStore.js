// Utility function para dispatch de eventos
export const fire = (element, name, detail) => {
    const event = new CustomEvent(name, {
        detail,
        bubbles: true, // Permite que el evento burbujee
        cancelable: true // Permite cancelar el evento
    });
    element.dispatchEvent(event);
};

// Handler mejorado para el Proxy
const createProxyHandler = (element) => {
    return {
        set(target, key, value) {
            // Evitar recursión infinita en propiedades internas
            if (key.startsWith('_')) {
                target[key] = value;
                return true;
            }

            const oldValue = target[key];
            const hasChanged = oldValue !== value;
            
            // Solo hacer log en modo desarrollo
            if (process?.env?.NODE_ENV === 'development' || element.debug) {
                console.log('DataStore change:', { 
                    element: element.tagName, 
                    key, 
                    value, 
                    oldValue, 
                    hasChanged 
                });
            }
            
            target[key] = value;
            
            // Solo disparar eventos si realmente cambió el valor
            if (hasChanged) {
                fire(element, `${String(key)}-change`, { 
                    key, 
                    value, 
                    oldValue,
                    timestamp: Date.now()
                });
                fire(element, 'data-change', { 
                    key, 
                    value, 
                    oldValue,
                    timestamp: Date.now()
                });
            }
            
            return true;
        },
        
        get(target, key) {
            return target[key];
        },
        
        deleteProperty(target, key) {
            if (key in target) {
                const oldValue = target[key];
                delete target[key];
                
                fire(element, `${String(key)}-delete`, { 
                    key, 
                    oldValue,
                    timestamp: Date.now()
                });
                fire(element, 'data-delete', { 
                    key, 
                    oldValue,
                    timestamp: Date.now()
                });
            }
            return true;
        },
        
        has(target, key) {
            return key in target;
        },
        
        ownKeys(target) {
            return Object.keys(target);
        }
    };
};

class DataStore extends HTMLElement {
    #data = null;
    #initialized = false;
    
    static get observedAttributes() {
        return ['type', 'name', 'debug'];
    }
    
    constructor() {
        super();
    }
    
    connectedCallback() {
        if (!this.#initialized) {
            this.#data = new Proxy({}, createProxyHandler(this));
            this.#initialized = true;
            
            // Evento de inicialización
            fire(this, 'store-ready', { store: this });
        }
    }
    
    disconnectedCallback() {
        // Cleanup si es necesario
        fire(this, 'store-destroyed', { store: this });
    }
    
    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal !== newVal) {
            fire(this, 'attribute-changed', { 
                attribute: name, 
                oldValue: oldVal, 
                newValue: newVal 
            });
        }
    }
    
    // Métodos mejorados para manipular datos
    set(key, value) {
        if (!this.#data) {
            throw new Error('DataStore not initialized');
        }
        this.#data[key] = value;
        return this;
    }
    
    get(key) {
        return this.#data?.[key];
    }
    
    has(key) {
        return this.#data ? key in this.#data : false;
    }
    
    delete(key) {
        if (this.#data && key in this.#data) {
            delete this.#data[key];
        }
        return this;
    }
    
    clear() {
        if (this.#data) {
            const keys = Object.keys(this.#data);
            keys.forEach(key => delete this.#data[key]);
            fire(this, 'store-cleared', { clearedKeys: keys });
        }
        return this;
    }
    
    toJSON() {
        return this.#data ? { ...this.#data } : {};
    }
    
    fromJSON(data) {
        if (typeof data === 'object' && data !== null) {
            Object.assign(this.#data, data);
        }
        return this;
    }
    
    // Método para obtener todos los datos
    get data() {
        return this.#data ? { ...this.#data } : {};
    }
    
    // Método legacy para compatibilidad
    add(name, value) {
        return this.set(name, value);
    }
    
    // Propiedades mejoradas con validación
    set type(value) {
        this.toggleAttribute('type', Boolean(value));
        if (value) this.setAttribute('type', value);
    }
    
    get type() {
        return this.getAttribute('type');
    }
    
    set name(value) {
        this.toggleAttribute('name', Boolean(value));
        if (value) this.setAttribute('name', value);
    }
    
    get name() {
        return this.getAttribute('name');
    }
    
    set debug(value) {
        this.toggleAttribute('debug', Boolean(value));
    }
    
    get debug() {
        return this.hasAttribute('debug');
    }
}

// Registrar el componente
customElements.define('data-store', DataStore);

// Exportar para uso programático
export { DataStore };
export default DataStore;

// Ejemplo de uso:
/*
HTML:
<data-store name="userStore" type="user" debug></data-store>

JavaScript:
const store = document.querySelector('data-store[name="userStore"]');

// Escuchar cambios
store.addEventListener('data-change', (e) => {
    console.log('Data changed:', e.detail);
});

// Manipular datos
store.set('username', 'john_doe')
     .set('email', 'john@example.com')
     .set('age', 30);

// Leer datos
console.log(store.get('username')); // 'john_doe'
console.log(store.data); // { username: 'john_doe', email: 'john@example.com', age: 30 }


Este archivo implementa un Custom Element llamado <data-store> que funciona como un almacén de datos reactivo. Analicemos qué hace:
Funcionalidad actual:

fire function: Dispara eventos personalizados en un elemento DOM
_handler function: Crea un proxy handler que intercepta cambios en las propiedades del objeto data
Store class: Un Web Component que:

Mantiene un objeto data reactivo usando Proxy
Emite eventos cuando los datos cambian
Permite agregar datos con el método add()
Tiene propiedades type y name que se sincronizan con atributos HTML

Principales mejoras implementadas:

Mejor manejo de eventos: Agregué bubbles y cancelable a los CustomEvents
Prevención de recursión: Evito loops infinitos con propiedades que empiezan con _
Logging condicional: Solo hace console.log en desarrollo o con debug activado
Más operaciones de Proxy: Agregué handlers para get, deleteProperty, has, y ownKeys
API más rica: Métodos get(), has(), delete(), clear(), toJSON(), fromJSON()
Campos privados: Uso #data y #initialized para encapsulación
Método chaining: Los métodos retornan this para encadenar operaciones
Mejor gestión de atributos: Uso toggleAttribute() y validaciones
Eventos más informativos: Incluyo timestamps y más contexto
Compatibilidad: Mantengo el método add() original
Documentación: Incluí ejemplo de uso completo

El componente ahora es más robusto, tiene mejor API y es más fácil de depurar y mantener.

*/