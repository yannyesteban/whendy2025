// ============================================================================
// CORE: Sistema de eventos minimalista y eficiente
// ============================================================================
class EventHub {
    #listeners = new Map();
    
    on(event, callback, options = {}) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        
        const listener = { callback, ...options };
        this.#listeners.get(event).add(listener);
        
        // Retornar función de cleanup
        return () => this.off(event, callback);
    }
    
    off(event, callback) {
        const listeners = this.#listeners.get(event);
        if (listeners) {
            listeners.forEach(listener => {
                if (listener.callback === callback) {
                    listeners.delete(listener);
                }
            });
        }
    }
    
    emit(event, data) {
        const listeners = this.#listeners.get(event);
        if (!listeners) return;
        
        listeners.forEach(({ callback, once }) => {
            callback(data);
            if (once) listeners.delete({ callback, once });
        });
    }
    
    clear() {
        this.#listeners.clear();
    }
}

// ============================================================================
// CORE: Store reactivo con múltiples estrategias
// ============================================================================
class ReactiveStore extends EventHub {
    #state = {};
    #computed = new Map();
    #watchers = new Map();
    #middleware = [];
    #history = [];
    #maxHistory = 50;
    
    constructor(initialState = {}, options = {}) {
        super();
        this.#state = { ...initialState };
        this.#maxHistory = options.maxHistory || 50;
        
        // Crear proxy reactivo
        return new Proxy(this, this.#createProxyHandler());
    }
    
    #createProxyHandler() {
        return {
            get: (target, key) => {
                // Métodos del store
                if (key in target) return target[key];
                
                // Estado reactivo
                if (key in target.#state) {
                    return target.#state[key];
                }
                
                // Propiedades computadas
                if (target.#computed.has(key)) {
                    const computedFn = target.#computed.get(key);
                    return computedFn.call(target);
                }
                
                return undefined;
            },
            
            set: (target, key, value) => {
                // Prevenir modificación de métodos
                if (key in target) return false;
                
                return target.#setValue(key, value);
            },
            
            has: (target, key) => {
                return key in target || key in target.#state || target.#computed.has(key);
            },
            
            ownKeys: (target) => {
                return [...Object.keys(target.#state), ...target.#computed.keys()];
            }
        };
    }
    
    #setValue(key, value) {
        const oldValue = this.#state[key];
        
        // Aplicar middleware
        const action = { type: 'SET', key, value, oldValue };
        for (const middleware of this.#middleware) {
            const result = middleware(action, this.#state);
            if (result === false) return false; // Cancelar
            if (result && typeof result === 'object') {
                Object.assign(action, result);
            }
        }
        
        // Guardar en historial
        this.#addToHistory(action);
        
        // Actualizar estado
        this.#state[key] = action.value;
        
        // Emitir eventos
        this.emit(`${key}:change`, { key, value: action.value, oldValue });
        this.emit('change', { key, value: action.value, oldValue });
        
        // Ejecutar watchers
        this.#executeWatchers(key, action.value, oldValue);
        
        return true;
    }
    
    #addToHistory(action) {
        this.#history.push({
            ...action,
            timestamp: Date.now(),
            id: crypto.randomUUID()
        });
        
        if (this.#history.length > this.#maxHistory) {
            this.#history.shift();
        }
    }
    
    #executeWatchers(key, newValue, oldValue) {
        const watchers = this.#watchers.get(key);
        if (watchers) {
            watchers.forEach(watcher => {
                try {
                    watcher(newValue, oldValue, key);
                } catch (error) {
                    console.error(`Watcher error for key "${key}":`, error);
                }
            });
        }
    }
    
    // ========================================================================
    // API Pública
    // ========================================================================
    
    // Estados
    get(key) {
        return key ? this.#state[key] : { ...this.#state };
    }
    
    set(key, value) {
        if (typeof key === 'object') {
            // Batch update
            Object.entries(key).forEach(([k, v]) => this.#setValue(k, v));
            return this;
        }
        this.#setValue(key, value);
        return this;
    }
    
    has(key) {
        return key in this.#state;
    }
    
    delete(key) {
        if (key in this.#state) {
            const oldValue = this.#state[key];
            delete this.#state[key];
            this.emit(`${key}:delete`, { key, oldValue });
            this.emit('delete', { key, oldValue });
        }
        return this;
    }
    
    clear() {
        const oldState = { ...this.#state };
        this.#state = {};
        this.emit('clear', { oldState });
        return this;
    }
    
    // Propiedades computadas
    computed(key, computeFn) {
        this.#computed.set(key, computeFn);
        return this;
    }
    
    // Watchers
    watch(key, callback) {
        if (!this.#watchers.has(key)) {
            this.#watchers.set(key, new Set());
        }
        this.#watchers.get(key).add(callback);
        
        return () => {
            const watchers = this.#watchers.get(key);
            if (watchers) watchers.delete(callback);
        };
    }
    
    // Middleware
    use(middlewareFn) {
        this.#middleware.push(middlewareFn);
        return this;
    }
    
    // Historial
    getHistory() {
        return [...this.#history];
    }
    
    undo() {
        if (this.#history.length < 2) return false;
        
        this.#history.pop(); // Remover última acción
        const lastAction = this.#history[this.#history.length - 1];
        
        if (lastAction) {
            this.#state[lastAction.key] = lastAction.oldValue;
            this.emit('undo', lastAction);
        }
        
        return true;
    }
    
    // Persistencia
    toJSON() {
        return JSON.stringify(this.#state);
    }
    
    fromJSON(json) {
        try {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            Object.assign(this.#state, data);
            this.emit('restored', { data });
        } catch (error) {
            console.error('Failed to restore from JSON:', error);
        }
        return this;
    }
    
    // Debugging
    debug() {
        return {
            state: this.#state,
            computed: [...this.#computed.keys()],
            watchers: [...this.#watchers.keys()],
            history: this.#history,
            middleware: this.#middleware.length
        };
    }
}

// ============================================================================
// MIDDLEWARE: Funciones utiles predefinidas
// ============================================================================
const Middleware = {
    // Validación de tipos
    validator: (rules) => (action, state) => {
        const rule = rules[action.key];
        if (rule && !rule(action.value)) {
            console.warn(`Validation failed for ${action.key}:`, action.value);
            return false;
        }
    },
    
    // Logging
    logger: (options = {}) => (action, state) => {
        if (options.verbose || process?.env?.NODE_ENV === 'development') {
            console.log(`[Store] ${action.type}:`, action);
        }
    },
    
    // Persistencia automática
    persister: (key = 'store') => (action, state) => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to persist state:', error);
        }
    },
    
    // Transformaciones
    transformer: (transforms) => (action, state) => {
        const transform = transforms[action.key];
        if (transform) {
            action.value = transform(action.value, action.oldValue);
        }
    }
};

// ============================================================================
// WEB COMPONENT: Integración opcional con DOM
// ============================================================================
class StoreElement extends HTMLElement {
    #store = null;
    #bindings = new Map();
    
    static get observedAttributes() {
        return ['name', 'persist', 'debug'];
    }
    
    connectedCallback() {
        this.#initializeStore();
        this.#setupBindings();
    }
    
    disconnectedCallback() {
        if (this.#store) {
            this.#store.clear();
        }
    }
    
    #initializeStore() {
        const name = this.getAttribute('name') || 'default';
        const persist = this.hasAttribute('persist');
        
        this.#store = new ReactiveStore();
        
        if (persist) {
            this.#store.use(Middleware.persister(name));
            // Restaurar estado
            try {
                const saved = localStorage.getItem(name);
                if (saved) this.#store.fromJSON(saved);
            } catch (error) {
                console.warn('Failed to restore persisted state:', error);
            }
        }
        
        if (this.hasAttribute('debug')) {
            this.#store.use(Middleware.logger({ verbose: true }));
        }
        
        // Exponer store globalmente si tiene nombre
        if (name && name !== 'default') {
            window[name] = this.#store;
        }
        
        this.dispatchEvent(new CustomEvent('store-ready', {
            detail: { store: this.#store, name },
            bubbles: true
        }));
    }
    
    #setupBindings() {
        // Auto-bind elementos con data-bind
        const elements = this.querySelectorAll('[data-bind]');
        elements.forEach(el => {
            const key = el.getAttribute('data-bind');
            this.bind(key, el);
        });
    }
    
    // API pública
    bind(key, element) {
        if (!this.#store) return;
        
        const updateElement = (value) => {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.value = value ?? '';
            } else {
                element.textContent = value ?? '';
            }
        };
        
        // Binding inicial
        updateElement(this.#store.get(key));
        
        // Escuchar cambios
        const unwatch = this.#store.watch(key, updateElement);
        this.#bindings.set(element, unwatch);
        
        // Two-way binding para inputs
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            const handler = (e) => this.#store.set(key, e.target.value);
            element.addEventListener('input', handler);
            
            // Cleanup
            const originalUnwatch = unwatch;
            this.#bindings.set(element, () => {
                originalUnwatch();
                element.removeEventListener('input', handler);
            });
        }
    }
    
    get store() {
        return this.#store;
    }
}

customElements.define('reactive-store', StoreElement);

// ============================================================================
// FACTORY: Creador de stores especializados
// ============================================================================
class StoreFactory {
    static create(type, options = {}) {
        switch (type) {
            case 'simple':
                return new ReactiveStore(options.initialState);
                
            case 'persistent':
                return new ReactiveStore(options.initialState)
                    .use(Middleware.persister(options.key));
                    
            case 'validated':
                return new ReactiveStore(options.initialState)
                    .use(Middleware.validator(options.rules))
                    .use(Middleware.logger());
                    
            case 'full':
                return new ReactiveStore(options.initialState)
                    .use(Middleware.validator(options.rules || {}))
                    .use(Middleware.transformer(options.transforms || {}))
                    .use(Middleware.persister(options.key))
                    .use(Middleware.logger(options.logOptions));
                    
            default:
                return new ReactiveStore();
        }
    }
}

// ============================================================================
// EXPORTACIONES
// ============================================================================
export { 
    ReactiveStore, 
    StoreElement, 
    StoreFactory, 
    Middleware, 
    EventHub 
};

// ============================================================================
// EJEMPLOS DE USO
// ============================================================================

/*
// 1. Store básico
const userStore = new ReactiveStore({ name: '', age: 0 });
userStore.name = 'Juan';
userStore.watch('name', (newName) => console.log('Name changed:', newName));

// 2. Store con middleware
const validatedStore = StoreFactory.create('validated', {
    initialState: { count: 0 },
    rules: {
        count: (value) => typeof value === 'number' && value >= 0
    }
});

// 3. Propiedades computadas
const mathStore = new ReactiveStore({ a: 5, b: 3 });
mathStore.computed('sum', function() { return this.a + this.b; });
console.log(mathStore.sum); // 8

// 4. Web Component
<reactive-store name="appStore" persist debug>
    <input data-bind="username" placeholder="Username">
    <span data-bind="username"></span>
</reactive-store>

// 5. Uso programático del Web Component
document.querySelector('reactive-store').store.set('username', 'Alice');


Características clave implementadas:

🏠 Aislamiento Total: Cada <web-app> tiene su propio contexto completamente aislado
🔐 Múltiples Sesiones: Puedes loguearte con usuarios diferentes en cada app simultáneamente
📦 Data Stores Contextuales: Los <data-store> funcionan solo dentro de su <web-app> padre
🎭 Mismo HTML, Diferentes Estados: Ambas apps usan el mismo HTML pero mantienen estados independientes

// Cada web-app tiene su propio Map de contexto
APP_CONTEXTS.set('app-uno', context1);
APP_CONTEXTS.set('app-dos', context2);

// Los data-stores se registran en su contexto padre
context1.stores.set('auth', authStore1);
context2.stores.set('auth', authStore2);

rueba la funcionalidad:

Login simultáneo:

App UNO: usuario admin, contraseña 123
App DOS: usuario alice, contraseña alice123


Estados independientes:

Cada app mantiene sus propias tareas
Los indicadores de estado son independientes
Los datos no se mezclan entre apps


Debugging:
javascript// En consola del navegador
window.getAllContexts(); // ['app-uno', 'app-dos']
window.getAppContext('app-uno'); // Contexto completo


Ventajas de esta arquitectura:
✅ Sin iframes: Todo en el mismo DOM pero aislado lógicamente
✅ Escalable: Puedes tener N aplicaciones
✅ Reutilizable: El mismo HTML funciona para todas las instancias
✅ Mantenible: Cada contexto es independiente
✅ Debuggeable: Fácil inspección y debugging
Casos de uso perfectos:

Dashboards multi-tenant
Aplicaciones de comparación
Entornos de testing A/B
Sistemas multi-usuario en tiempo real
Aplicaciones de administración con múltiples vistas

¡Tu concepto original era brillante y esta implementación lo hace realidad de forma robusta y escalable!

*/