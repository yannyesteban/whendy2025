/**
 * Dispara un evento personalizado en el elemento especificado.
 * @param element - Elemento HTML que dispara el evento.
 * @param name - Nombre del evento.
 * @param detail - Datos asociados al evento.
 * @param options - Opciones del evento, como burbujeo.
 */
export const fire = (element, name, detail, options = { bubbles: true }) => {
  const event = new CustomEvent(name, { detail, ...options });
  element.dispatchEvent(event);
};

/**
 * Crea un manejador para un Proxy que observa cambios en las propiedades.
 * @param element - Elemento que dispara los eventos.
 * @param config - Configuración para eventos específicos y generales.
 */
const _handler = (element, config = { specificEvent: true, generalEvent: true }) => {
  return {
    set(target, key, value) {
      if (typeof key !== 'string') {
        console.warn(`Invalid key type: ${typeof key}`);
        return false;
      }
      const oldValue = target[key];
      target[key] = value;
      const mode = oldValue !== value ? 'change' : 'set';

      if (config.specificEvent) {
        fire(element, `${key}-change`, { key, value, mode });
      }
      if (config.generalEvent) {
        fire(element, 'change', { key, value, mode });
      }
      return true;
    },
  };
};

/**
 * Web Component para almacenar y observar datos reactivos.
 */
class Store extends HTMLElement {
  data;

  static get observedAttributes() {
    return ['type', 'name'];
  }

  constructor() {
    super();
  }

  connectedCallback() {
    this.data = new Proxy({}, _handler(this));
    const initialData = this.getAttribute('data-initial');
    if (initialData) {
      try {
        const parsed = JSON.parse(initialData);
        Object.entries(parsed).forEach(([key, value]) => this.add(key, value));
      } catch (e) {
        console.error('Invalid initial data:', e);
      }
    }
  }

  disconnectedCallback() {
    this.data = null;
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal !== newVal) {
      console.log(`${name} changed from ${oldVal} to ${newVal}`);
    }
  }

  setAttributeValue(attr, value) {
    if (value != null && value !== '') {
      this.setAttribute(attr, String(value));
    } else {
      this.removeAttribute(attr);
    }
  }

  set type(value) {
    this.setAttributeValue('type', value);
  }

  get type() {
    return this.getAttribute('type');
  }

  set name(value) {
    this.setAttributeValue('name', value);
  }

  get name() {
    return this.getAttribute('name');
  }

  add(name, value) {
    this.data[name] = value;
  }

  get(name) {
    return this.data[name];
  }

  remove(name) {
    delete this.data[name];
  }

  clear() {
    this.data = new Proxy({}, _handler(this));
  }
}

customElements.define('data-store', Store);

/*
El código original es funcional, pero puede mejorarse en términos de robustez, claridad y flexibilidad. Las mejoras sugeridas incluyen:

Tipado estricto (en TypeScript).
Eliminación de console.log en producción.
Validación más robusta para atributos.
Métodos adicionales para manipular datos.
Soporte para inicialización desde atributos.
Optimización de eventos y limpieza de recursos.


*/