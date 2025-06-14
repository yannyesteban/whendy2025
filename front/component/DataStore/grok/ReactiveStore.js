/**
 * Dispara un evento personalizado en un elemento HTML.
 * @param element - Elemento que dispara el evento.
 * @param name - Nombre del evento.
 * @param detail - Datos asociados al evento.
 * @param options - Opciones adicionales (burbujeo, cancelable, etc.).
 * 
 * https://grok.com/chat/dc157d7f-2d66-40f4-bec4-4da0461162bf
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
  const {
    emitSpecificEvents = true, // Disparar eventos específicos (e.g., 'key-change')
    emitGeneralEvents = true, // Disparar evento general 'change'
    debug = false, // Habilitar logging
  } = config;

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

      const detail = { key, value, mode: isChanged ? 'change' : 'set' };
      log({ key, value, oldValue, type: typeof value, mode: detail.mode });

      if (emitSpecificEvents) {
        fireEvent(element, `${key}-change`, detail);
      }
      if (emitGeneralEvents) {
        fireEvent(element, 'change', detail);
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
        fireEvent(element, `${key}-delete`, { key, value });
        fireEvent(element, 'delete', { key, value });
        log(`Deleted key: ${key}`);
      }
      return true;
    },
  };
};

/**
 * Web Component para un almacén de datos reactivo.
 * @example
 * <reactive-store data-initial='{"count": 0, "name": "test"}' type="app"></reactive-store>
 */
class ReactiveStore extends HTMLElement {
  #data; // Propiedad privada para el almacén
  #config; // Configuración del componente
  #subscriptions = new Map(); // Suscripciones locales a claves específicas

  static get observedAttributes() {
    return ['type', 'data-initial'];
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
    // Inicializar configuración desde atributos
    this.#config.debug = this.hasAttribute('debug');
    this.#config.emitSpecificEvents = !this.hasAttribute('no-specific-events');
    this.#config.emitGeneralEvents = !this.hasAttribute('no-general-events');

    // Inicializar datos
    this.#data = new Proxy({}, createProxyHandler(this, this.#config));

    // Cargar datos iniciales desde atributo 'data-initial'
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
      } else if (name === 'type') {
        fireEvent(this, 'type-change', { type: newVal });
      }
    }
  }

  /**
   * Carga datos iniciales desde un string JSON.
   * @param jsonString - JSON con datos iniciales.
   */
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

  /**
   * Establece un valor en el almacén.
   * @param key - Clave a establecer.
   * @param value - Valor a asignar.
   */
  set(key, value) {
    this.#data[key] = value;
  }

  /**
   * Obtiene un valor del almacén.
   * @param key - Clave a consultar.
   * @returns Valor asociado o undefined.
   */
  get(key) {
    return this.#data[key];
  }

  /**
   * Elimina una clave del almacén.
   * @param key - Clave a eliminar.
   */
  remove(key) {
    delete this.#data[key];
  }

  /**
   * Limpia todo el almacén.
   */
  clear() {
    Object.keys(this.#data).forEach((key) => this.remove(key));
  }

  /**
   * Suscribe una función a cambios en una clave específica.
   * @param key - Clave a observar.
   * @param callback - Función a ejecutar en cambios.
   * @returns Función para cancelar la suscripción.
   */
  subscribe(key, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    const handler = (e) => {
      if (e.detail.key === key) {
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

  /**
   * Getter/setter para el atributo 'type'.
   */
  set type(value) {
    if (value != null && value !== '') {
      this.setAttribute('type', String(value));
    } else {
      this.removeAttribute('type');
    }
  }

  get type() {
    return this.getAttribute('type');
  }
}

// Registrar el componente
customElements.define('reactive-store', ReactiveStore);

/*
Mejoras y nuevas ideas
Configuración flexible desde atributos:
Atributos como debug, no-specific-events y no-general-events permiten configurar el comportamiento del componente directamente desde el HTML.
html

Copiar
<reactive-store debug no-specific-events></reactive-store>
Esto reduce la necesidad de configurar el componente mediante JavaScript.
Soporte para eliminación de propiedades:
El manejador del Proxy ahora intercepta deleteProperty, disparando eventos como ${key}-delete y delete cuando se elimina una clave.
Ejemplo: delete store.data.key dispara eventos con los detalles de la clave eliminada.
Suscripciones locales:
El método subscribe(key, callback) permite a los desarrolladores escuchar cambios en claves específicas sin necesidad de manejar eventos manualmente.
Devuelve una función para cancelar la suscripción, siguiendo el patrón de suscripciones moderno.
javascript

Copiar
const store = document.querySelector('reactive-store');
const unsubscribe = store.subscribe('count', (value, mode) => {
  console.log(`Count changed to ${value} (${mode})`);
});
store.set('count', 42); // Llama al callback
unsubscribe(); // Cancela la suscripción
Manejo robusto de datos iniciales:
El atributo data-initial permite inicializar el almacén con un objeto JSON.
Se valida que el JSON sea un objeto válido y se manejan errores de parseo.
html

Copiar
<reactive-store data-initial='{"count": 0, "name": "test"}'></reactive-store>
Propiedades privadas:
Uso de campos privados (#data, #config, #subscriptions) para encapsular el estado interno y evitar accesos no deseados.
Esto mejora la seguridad y claridad del código.
Eventos burbujeantes por defecto:
Los eventos ahora burbujean por defecto (bubbles: true), lo que facilita que otros elementos en el DOM los capturen.
Se pueden configurar opciones adicionales en fireEvent si es necesario.
API más completa:
Métodos como set, get, remove, clear y subscribe proporcionan una interfaz clara para interactuar con el almacén.
Ejemplo:
javascript

Copiar
const store = document.querySelector('reactive-store');
store.set('user', 'Alice');
console.log(store.get('user')); // 'Alice'
store.remove('user');
store.clear();
Validación estricta:
Se verifica que las claves sean strings en el manejador del Proxy.
Se valida que los callbacks de suscripción sean funciones.
Se manejan errores en el parseo de JSON para data-initial.
Soporte para cambios en atributos:
attributeChangedCallback dispara un evento type-change cuando el atributo type cambia.
También reacciona a cambios en data-initial para recargar datos si es necesario.
Limpieza en desconexión:
disconnectedCallback limpia #data y las suscripciones locales para evitar fugas de memoria.
Sin dependencias externas:
Todo el código usa APIs nativas del navegador (CustomEvent, Proxy, HTMLElement, customElements), garantizando que no quedará obsoleto por dependencias externas.

*/