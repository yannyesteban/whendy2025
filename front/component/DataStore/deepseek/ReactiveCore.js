// 📦 Core Reactivo (independiente del DOM)
class ReactiveCore {
  #store = new Map(); // Almacenamiento tipo Map para mejor performance
  #proxies = new WeakMap(); // Cache de proxies para evitar recreación
  #listeners = new Map(); // Sistema de suscripción eficiente

  constructor(initialData = {}) {
    this.#createProxyTree(initialData);
  }

  // 🛠 Crea proxies recursivamente para objetos/arrays
  #createProxy(obj, path = []) {
    if (this.#proxies.has(obj)) return this.#proxies.get(obj);

    const handler = {
      get: (target, key) => {
        const value = Reflect.get(target, key);
        const fullPath = [...path, key];
        
        // Proxy anidados para objetos/arrays
        if (typeof value === 'object' && value !== null) {
          return this.#createProxy(value, fullPath);
        }
        
        return value;
      },
      set: (target, key, value) => {
        const oldValue = target[key];
        const fullPath = [...path, key];
        const result = Reflect.set(target, key, value);
        
        if (result && oldValue !== value) {
          this.#notify(fullPath, value, oldValue);
        }
        return result;
      },
      deleteProperty: (target, key) => {
        const fullPath = [...path, key];
        const result = Reflect.deleteProperty(target, key);
        this.#notify(fullPath, undefined, target[key]);
        return result;
      }
    };

    const proxy = new Proxy(obj, handler);
    this.#proxies.set(obj, proxy);
    return proxy;
  }

  // 🌳 Crea estructura de datos reactiva completa
  #createProxyTree(data) {
    for (const [key, value] of Object.entries(data)) {
      this.#store.set(key, this.#createProxy(value));
    }
  }

  // 🔔 Sistema de notificaciones optimizado
  #notify(path, newValue, oldValue) {
    const eventDetail = {
      path: path.join('.'),
      value: newValue,
      oldValue,
      timestamp: performance.now()
    };

    // Notificación específica por path
    this.#dispatch(`change:${path.join('.')}`, eventDetail);
    
    // Notificación global
    this.#dispatch('change', eventDetail);
  }

  #dispatch(event, detail) {
    const listeners = this.#listeners.get(event) || [];
    listeners.forEach(cb => cb(detail));
  }

  // 📡 API Pública
  subscribe(event, callback) {
    const events = this.#listeners.get(event) || [];
    this.#listeners.set(event, [...events, callback]);
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event, callback) {
    const events = this.#listeners.get(event)?.filter(cb => cb !== callback) || [];
    this.#listeners.set(event, events);
  }

  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.data);
  }

  set(path, value) {
    const keys = path.split('.');
    const finalKey = keys.pop();
    let obj = this.data;
    
    for (const key of keys) {
      obj = obj[key] = obj[key] || {};
    }
    
    obj[finalKey] = value;
  }

  get data() {
    return Object.fromEntries(this.#store);
  }
}

// 🧩 Web Component Mejorado
class DataStore extends HTMLElement {
  #core = new ReactiveCore();
  #subscriptions = new Set();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.#setupEventForwarding();
  }

  disconnectedCallback() {
    this.#subscriptions.forEach(unsub => unsub());
    this.#subscriptions.clear();
  }

  // 📡 Transmite eventos del core al DOM
  #setupEventForwarding() {
    const forwardEvent = (event, detail) => {
      this.dispatchEvent(new CustomEvent(event, {
        detail,
        bubbles: true,
        composed: true
      }));
    };

    this.#subscriptions.add(
      this.#core.subscribe('change', detail => 
        forwardEvent('store-change', detail)
      )
    );

    this.#subscriptions.add(
      this.#core.subscribe('change:*', detail => 
        forwardEvent(`store-${detail.path}-change`, detail)
      )
    );
  }

  // 🛠 API Pública
  get store() {
    return this.#core;
  }

  setData(data) {
    Object.entries(data).forEach(([key, value]) => {
      this.#core.set(key, value);
    });
  }

  // ⚡️ Optimización para atributos
  static get observedAttributes() {
    return ['initial-data'];
  }

  attributeChangedCallback(name, _, newValue) {
    if (name === 'initial-data') {
      try {
        this.setData(JSON.parse(newValue));
      } catch (e) {
        console.error('Invalid initial data:', e);
      }
    }
  }
}

customElements.define('advanced-store', DataStore);