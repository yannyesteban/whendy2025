/**
 * Dispara un evento personalizado en un elemento HTML.
 * @param element - Elemento que dispara el evento.
 * @param name - Nombre del evento.
 * @param detail - Datos asociados al evento.
 * @param options - Opciones adicionales (burbujeo, cancelable, etc.).
 */
const fireEvent = (element, name, detail, options = { bubbles: true, cancelable: false }) => {
  const event = new CustomEvent(name, { detail, ...options });
  element.dispatchEvent(event);
};

/**
 * Crea un manejador para un Proxy que observa cambios en las propiedades.
 * @param element - Elemento que dispara los eventos.
 * @param config - Configuración para eventos y logging.
 */
const createProxyHandler = (element, config = {}) => {
  const { emitSpecificEvents = true, emitGeneralEvents = true, debug = false } = config;
  const log = (...args) => debug && console.log(...args);

  return {
    set(target, key, value) {
      if (typeof key !== 'string') {
        log(`Invalid key type: ${typeof key}`);
        return false;
      }
      const oldValue = target[key];
      const isChanged = oldValue !== value;
      target[key] = value;

      const detail = { key, value, mode: isChanged ? 'change' : 'set', instance: element.getAttribute('name') || 'unnamed' };
      log({ key, value, oldValue, type: typeof value, mode: detail.mode });

      if (emitSpecificEvents) {
        fireEvent(element, `${key}-change`, detail, { bubbles: false }); // No burbujea para aislar
      }
      if (emitGeneralEvents) {
        fireEvent(element, 'change', detail, { bubbles: false });
      }
      return true;
    },

    deleteProperty(target, key) {
      if (typeof key !== 'string') {
        log(`Invalid key type for deletion: ${typeof key}`);
        return false;
      }
      if (key in target) {
        const value = target[key];
        delete target[key];
        const detail = { key, value, instance: element.getAttribute('name') || 'unnamed' };
        fireEvent(element, `${key}-delete`, detail, { bubbles: false });
        fireEvent(element, 'delete', detail, { bubbles: false });
        log(`Deleted key: ${key}`);
      }
      return true;
    },
  };
};

/**
 * Web Component para un almacén de datos reactivo.
 */
class ReactiveStore extends HTMLElement {
  #data;
  #config;
  #subscriptions = new Map();

  static get observedAttributes() {
    return ['name', 'data-initial'];
  }

  constructor() {
    super();
    this.#config = {
      emitSpecificEvents: true,
      emitGeneralEvents: true,
      debug: false,
    };
  }

  connectedCallback() {
    this.#config.debug = this.hasAttribute('debug');
    this.#config.emitSpecificEvents = !this.hasAttribute('no-specific-events');
    this.#config.emitGeneralEvents = !this.hasAttribute('no-general-events');

    this.#data = new Proxy({}, createProxyHandler(this, this.#config));

    const initialData = this.getAttribute('data-initial');
    if (initialData) {
      this.loadInitialData(initialData);
    }
  }

  disconnectedCallback() {
    this.#data = null;
    this.#subscriptions.clear();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal) {
      if (name === 'data-initial' && newVal) {
        this.loadInitialData(newVal);
      } else if (name === 'name') {
        fireEvent(this, 'name-change', { name: newVal }, { bubbles: false });
      }
    }
  }

  loadInitialData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([key, value]) => this.set(key, value));
      } else {
        console.error('Initial data must be an object');
      }
    } catch (e) {
      console.error('Invalid JSON in data-initial:', e);
    }
  }

  set(key, value) {
    this.#data[key] = value;
  }

  get(key) {
    return this.#data[key];
  }

  remove(key) {
    delete this.#data[key];
  }

  clear() {
    Object.keys(this.#data).forEach((key) => this.remove(key));
  }

  subscribe(key, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    const handler = (e) => {
      if (e.detail.key === key && e.detail.instance === this.getAttribute('name')) {
        callback(e.detail.value, e.detail.mode);
      }
    };
    this.addEventListener(`${key}-change`, handler);
    this.#subscriptions.set(callback, handler);
    return () => {
      this.removeEventListener(`${key}-change`, handler);
      this.#subscriptions.delete(callback);
    };
  }

  set name(value) {
    if (value != null && value !== '') {
      this.setAttribute('name', String(value));
    } else {
      this.removeAttribute('name');
    }
  }

  get name() {
    return this.getAttribute('name');
  }
}

/**
 * Web Component que representa una aplicación con un sistema de login.
 */
class WebApp extends HTMLElement {
  constructor() {
    super();
    // Opcional: Usar Shadow DOM para aislar estilos
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const name = this.getAttribute('name') || 'unnamed';
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 20px;
          border: 1px solid #ccc;
          margin: 10px;
          background: #f9f9f9;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 300px;
        }
        input, button {
          padding: 8px;
          font-size: 16px;
        }
      </style>
      <h2>App: ${name}</h2>
      <reactive-store name="${name}" data-initial='{"user": null}'></reactive-store>
      <div class="login-form">
        <input type="text" placeholder="Username" id="username">
        <button id="login">Login</button>
        <p>User: <span id="user-display">Not logged in</span></p>
      </div>
    `;

    const store = this.shadowRoot.querySelector('reactive-store');
    const loginButton = this.shadowRoot.querySelector('#login');
    const usernameInput = this.shadowRoot.querySelector('#username');
    const userDisplay = this.shadowRoot.querySelector('#user-display');

    // Suscribirse a cambios en la clave 'user'
    store.subscribe('user', (value) => {
      userDisplay.textContent = value ? value : 'Not logged in';
    });

    // Manejar el login
    loginButton.addEventListener('click', () => {
      const username = usernameInput.value.trim();
      if (username) {
        store.set('user', username);
        usernameInput.value = '';
      }
    });
  }
}

// Registrar los componentes
customElements.define('reactive-store', ReactiveStore);
customElements.define('web-app', WebApp);