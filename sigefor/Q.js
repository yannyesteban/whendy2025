"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = exports.Q = exports.QElement = void 0;
exports.getParentElement = getParentElement;
// Utilidades mejoradas
const utils = {};
const setProp = (obj, attrs, value) => {
    if (typeof attrs === "object" && attrs !== null) {
        Object.assign(obj, attrs);
    }
    else if (typeof attrs === "string") {
        obj[attrs] = value;
    }
};
// Caché para mejorar performance
const elementCache = new WeakMap();
class QElement {
    _element;
    constructor(element) {
        if (!element || !(element instanceof HTMLElement)) {
            throw new Error("QElement constructor requires a valid HTMLElement");
        }
        this._element = element;
        // Usar caché para evitar crear múltiples wrappers del mismo elemento
        if (elementCache.has(element)) {
            return elementCache.get(element);
        }
        elementCache.set(element, this);
    }
    // Getter mejorado con validación de tipos
    get() {
        return this._element;
    }
    // Gestión de eventos mejorada
    on(event, fn, options) {
        const eventOptions = {
            capture: options?.capture ?? false,
            once: options?.once ?? false,
            passive: options?.passive ?? false
        };
        this._element.addEventListener(event, fn, eventOptions);
        return this;
    }
    off(event, fn, capture = false) {
        this._element.removeEventListener(event, fn, capture);
        return this;
    }
    id(id) {
        if (id === undefined) {
            return this._element.id;
        }
        this._element.id = id;
        return this;
    }
    // Append mejorado con mejor validación de tipos
    append(element) {
        if (!element)
            return this;
        if (typeof element === "string") {
            this._element.insertAdjacentHTML('beforeend', element);
        }
        else if (element instanceof HTMLElement) {
            this._element.appendChild(element);
        }
        else if (element instanceof QElement) {
            this._element.appendChild(element.get());
        }
        return this;
    }
    // Métodos de creación optimizados
    add(config) {
        const element = exports.Q.create(config);
        if (element)
            this.append(element);
        return this;
    }
    create(config) {
        const element = exports.Q.create(config);
        if (element)
            this.append(element);
        return element;
    }
    findOrCreate(selector, tagName) {
        const existing = this._element.querySelector(selector);
        if (existing) {
            return (0, exports.Q)(existing);
        }
        const newElement = exports.Q.create(tagName);
        if (newElement) {
            this.append(newElement);
            return newElement;
        }
        throw new Error(`Failed to create element: ${tagName}`);
    }
    text(text) {
        if (text === undefined) {
            return this._element.textContent || '';
        }
        this._element.textContent = text;
        return this;
    }
    html(html) {
        if (html === undefined) {
            return this._element.innerHTML;
        }
        this._element.innerHTML = html;
        return this;
    }
    attr(nameOrAttrs, value) {
        if (typeof nameOrAttrs === "string" && value === undefined) {
            return this._element.getAttribute(nameOrAttrs);
        }
        const attrs = typeof nameOrAttrs === "string"
            ? { [nameOrAttrs]: value }
            : nameOrAttrs;
        Object.entries(attrs).forEach(([key, val]) => {
            if (val === null || val === false) {
                this._element.removeAttribute(key);
            }
            else if (val === true) {
                this._element.setAttribute(key, '');
            }
            else {
                this._element.setAttribute(key, String(val));
            }
        });
        return this;
    }
    prop(nameOrAttrs, value) {
        if (typeof nameOrAttrs === "string" && value === undefined) {
            return this._element[nameOrAttrs];
        }
        setProp(this._element, nameOrAttrs, value);
        return this;
    }
    value(data) {
        if (data === undefined) {
            return this._element.value;
        }
        this._element.value = data;
        return this;
    }
    style(nameOrStyles, value) {
        if (typeof nameOrStyles === "string" && value === undefined) {
            return getComputedStyle(this._element)[nameOrStyles] || '';
        }
        setProp(this._element.style, nameOrStyles, value);
        return this;
    }
    ds(nameOrAttrs, value) {
        if (typeof nameOrAttrs === "string" && value === undefined) {
            return this._element.dataset[nameOrAttrs] || '';
        }
        setProp(this._element.dataset, nameOrAttrs, value);
        return this;
    }
    // Métodos condicionales
    doIf(condition, callback) {
        if (condition)
            callback(this);
        return this;
    }
    doIfElse(condition, ifCallback, elseCallback) {
        condition ? ifCallback(this) : elseCallback(this);
        return this;
    }
    // Gestión de clases optimizada
    processClasses(classes, action) {
        const classList = Array.isArray(classes)
            ? classes.filter(cls => cls && typeof cls === 'string')
            : [classes].filter(cls => cls && typeof cls === 'string');
        classList.forEach(cls => this._element.classList[action](cls));
        return this;
    }
    addClass(classes) {
        return this.processClasses(classes, 'add');
    }
    removeClass(classes) {
        return this.processClasses(classes, 'remove');
    }
    toggleClass(classes) {
        return this.processClasses(classes, 'toggle');
    }
    hasClass(className) {
        return this._element.classList.contains(className);
    }
    // Navegación del DOM
    children() {
        return Array.from(this._element.children)
            .filter((child) => child instanceof HTMLElement)
            .map(child => (0, exports.Q)(child));
    }
    query(selector) {
        const element = this._element.querySelector(selector);
        return element ? (0, exports.Q)(element) : null;
    }
    queryAll(selector) {
        return Array.from(this._element.querySelectorAll(selector))
            .filter((element) => element instanceof HTMLElement)
            .map(element => (0, exports.Q)(element));
    }
    parent() {
        const parent = this._element.parentElement;
        return parent ? (0, exports.Q)(parent) : null;
    }
    // Método appendTo mejorado
    appendTo(target) {
        if (target instanceof HTMLElement) {
            target.appendChild(this._element);
        }
        else if (target instanceof QElement) {
            target.append(this);
        }
        else if (typeof target === 'string') {
            const targetElement = document.querySelector(target);
            if (targetElement) {
                targetElement.appendChild(this._element);
            }
        }
        return this;
    }
    // Eliminación segura
    remove() {
        elementCache.delete(this._element);
        this._element.remove();
    }
    // Eventos personalizados
    fire(name, detail) {
        const event = new CustomEvent(name, {
            detail,
            cancelable: true,
            bubbles: true,
        });
        return this._element.dispatchEvent(event);
    }
    // Definición de propiedades
    define(prop, descriptor) {
        Object.defineProperty(this._element, prop, descriptor);
        return this;
    }
    // Buscar elemento padre por tag
    parentElement(tagName) {
        return getParentElement(this._element, tagName);
    }
    // Métodos de utilidad adicionales
    is(selector) {
        return this._element.matches(selector);
    }
    closest(selector) {
        const element = this._element.closest(selector);
        return element ? (0, exports.Q)(element) : null;
    }
    clone(deep = true) {
        const cloned = this._element.cloneNode(deep);
        return (0, exports.Q)(cloned);
    }
    empty() {
        this._element.innerHTML = '';
        return this;
    }
    show() {
        this._element.style.display = '';
        return this;
    }
    hide() {
        this._element.style.display = 'none';
        return this;
    }
}
exports.QElement = QElement;
// Función Q mejorada
const Q = (query) => {
    if (query instanceof QElement) {
        return query;
    }
    let element = null;
    if (!query || query === "") {
        element = document.body;
    }
    else if (query instanceof HTMLElement) {
        element = query;
    }
    else if (query instanceof Document) {
        element = query.documentElement;
    }
    else if (query instanceof DocumentFragment) {
        return null; // DocumentFragment no es HTMLElement
    }
    else if (typeof query === "string") {
        element = document.querySelector(query);
    }
    return element ? new QElement(element) : null;
};
exports.Q = Q;
exports.default = exports.Q;
// Métodos estáticos mejorados
exports.Q.id = (id) => {
    const element = document.getElementById(id);
    return element ? (0, exports.Q)(element) : null;
};
exports.Q.create = (config) => {
    let element;
    try {
        if (typeof config === "string") {
            element = document.createElement(config);
        }
        else if (typeof config === "object" && config.tagName) {
            element = document.createElement(config.tagName);
            Object.entries(config).forEach(([key, value]) => {
                if (key !== 'tagName' && value !== false && value !== null && value !== undefined) {
                    element.setAttribute(key, String(value));
                }
            });
        }
        else {
            return null;
        }
        return (0, exports.Q)(element);
    }
    catch (error) {
        console.error('Error creating element:', error);
        return null;
    }
};
exports.Q.query = (selector) => {
    const element = document.querySelector(selector);
    return element ? (0, exports.Q)(element) : null;
};
exports.Q.queryAll = (selector) => {
    return Array.from(document.querySelectorAll(selector))
        .filter((element) => element instanceof HTMLElement)
        .map(element => (0, exports.Q)(element));
};
// Función bind mejorada con mejor tipado
exports.Q.bind = (fn, context, ...args) => {
    if (typeof fn === "function") {
        return fn.bind(context, ...args);
    }
    else if (typeof fn === "string") {
        return Function(...args, fn).bind(context);
    }
    throw new Error("Invalid function parameter");
};
// Función fire global
exports.Q.fire = (element, eventName, detail) => {
    const targetElement = element instanceof QElement ? element.get() : element;
    const event = new CustomEvent(eventName, {
        detail,
        cancelable: true,
        bubbles: true,
    });
    targetElement.dispatchEvent(event);
};
// Utilidad para encontrar elemento padre (optimizada)
function getParentElement(child, parentTag) {
    const upperCaseTag = parentTag.toUpperCase();
    let current = child.parentElement;
    while (current) {
        if (current.tagName === upperCaseTag) {
            return current;
        }
        current = current.parentElement;
    }
    return null;
}
// Funciones de utilidad adicionales
exports.Q.ready = (callback) => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    }
    else {
        callback();
    }
};
exports.Q.each = (array, callback) => {
    array.forEach(callback);
};
//# sourceMappingURL=Q.js.map