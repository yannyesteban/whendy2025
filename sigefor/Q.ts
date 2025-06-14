// Tipos mejorados
interface ElementConfig {
    tagName: string;
    [key: string]: any;
}

interface EventOptions {
    once?: boolean;
    passive?: boolean;
    capture?: boolean;
}

type ElementInput = string | HTMLElement | QElement | Document | DocumentFragment;
type AttributeValue = string | number | boolean | null;
type StyleValue = string | number;

// Utilidades mejoradas
const utils = {};

const setProp = <T extends Record<string, any>>(
    obj: T, 
    attrs: string | Record<string, any>, 
    value?: any
): void => {
    if (typeof attrs === "object" && attrs !== null) {
        Object.assign(obj, attrs);
    } else if (typeof attrs === "string") {
        obj[attrs] = value;
    }
};

// Caché para mejorar performance
const elementCache = new WeakMap<HTMLElement, QElement>();

export class QElement {
    private readonly _element: HTMLElement;

    constructor(element: HTMLElement) {
        if (!element || !(element instanceof HTMLElement)) {
            throw new Error("QElement constructor requires a valid HTMLElement");
        }
        this._element = element;
        
        // Usar caché para evitar crear múltiples wrappers del mismo elemento
        if (elementCache.has(element)) {
            return elementCache.get(element)!;
        }
        elementCache.set(element, this);
    }

    // Getter mejorado con validación de tipos
    get<T extends HTMLElement = HTMLElement>(): T {
        return this._element as T;
    }

    // Gestión de eventos mejorada
    on(event: string, fn: EventListener, options?: EventOptions): this {
        const eventOptions = {
            capture: options?.capture ?? false,
            once: options?.once ?? false,
            passive: options?.passive ?? false
        };
        this._element.addEventListener(event, fn, eventOptions);
        return this;
    }

    off(event: string, fn: EventListener, capture = false): this {
        this._element.removeEventListener(event, fn, capture);
        return this;
    }

    // Método id con sobrecarga mejorada
    id(): string;
    id(id: string): this;
    id(id?: string): string | this {
        if (id === undefined) {
            return this._element.id;
        }
        this._element.id = id;
        return this;
    }

    // Append mejorado con mejor validación de tipos
    append(element: ElementInput | string): this {
        if (!element) return this;

        if (typeof element === "string") {
            this._element.insertAdjacentHTML('beforeend', element);
        } else if (element instanceof HTMLElement) {
            this._element.appendChild(element);
        } else if (element instanceof QElement) {
            this._element.appendChild(element.get());
        }
        return this;
    }

    // Métodos de creación optimizados
    add(config: ElementConfig | string): this {
        const element = Q.create(config);
        if (element) this.append(element);
        return this;
    }

    create(config: ElementConfig | string): QElement | null {
        const element = Q.create(config);
        if (element) this.append(element);
        return element;
    }

    findOrCreate(selector: string, tagName: string): QElement {
        const existing = this._element.querySelector(selector);
        if (existing) {
            return Q(existing);
        }

        const newElement = Q.create(tagName);
        if (newElement) {
            this.append(newElement);
            return newElement;
        }
        throw new Error(`Failed to create element: ${tagName}`);
    }

    // Métodos de contenido mejorados
    text(): string;
    text(text: string): this;
    text(text?: string): string | this {
        if (text === undefined) {
            return this._element.textContent || '';
        }
        this._element.textContent = text;
        return this;
    }

    html(): string;
    html(html: string): this;
    html(html?: string): string | this {
        if (html === undefined) {
            return this._element.innerHTML;
        }
        this._element.innerHTML = html;
        return this;
    }

    // Gestión de atributos mejorada
    attr(name: string): string | null;
    attr(name: string, value: AttributeValue): this;
    attr(attrs: Record<string, AttributeValue>): this;
    attr(nameOrAttrs: string | Record<string, AttributeValue>, value?: AttributeValue): string | null | this {
        if (typeof nameOrAttrs === "string" && value === undefined) {
            return this._element.getAttribute(nameOrAttrs);
        }

        const attrs = typeof nameOrAttrs === "string" 
            ? { [nameOrAttrs]: value } 
            : nameOrAttrs;

        Object.entries(attrs).forEach(([key, val]) => {
            if (val === null || val === false) {
                this._element.removeAttribute(key);
            } else if (val === true) {
                this._element.setAttribute(key, '');
            } else {
                this._element.setAttribute(key, String(val));
            }
        });

        return this;
    }

    // Propiedades con mejor tipado
    prop<K extends keyof HTMLElement>(name: K): HTMLElement[K];
    prop<K extends keyof HTMLElement>(name: K, value: HTMLElement[K]): this;
    prop(attrs: Partial<HTMLElement>): this;
    prop(nameOrAttrs: any, value?: any): any {
        if (typeof nameOrAttrs === "string" && value === undefined) {
            return this._element[nameOrAttrs];
        }
        
        setProp(this._element, nameOrAttrs, value);
        return this;
    }

    // Value con tipado genérico
    value<T = string>(): T;
    value<T = string>(data: T): this;
    value<T = string>(data?: T): T | this {
        if (data === undefined) {
            return (this._element as any).value;
        }
        (this._element as any).value = data;
        return this;
    }

    // Estilos mejorados
    style(name: string): string;
    style(name: string, value: StyleValue): this;
    style(styles: Record<string, StyleValue>): this;
    style(nameOrStyles: string | Record<string, StyleValue>, value?: StyleValue): string | this {
        if (typeof nameOrStyles === "string" && value === undefined) {
            return getComputedStyle(this._element)[nameOrStyles as any] || '';
        }

        setProp(this._element.style, nameOrStyles, value);
        return this;
    }

    // Dataset mejorado
    ds(name: string): string;
    ds(name: string, value: string): this;
    ds(attrs: Record<string, string>): this;
    ds(nameOrAttrs: string | Record<string, string>, value?: string): string | this {
        if (typeof nameOrAttrs === "string" && value === undefined) {
            return this._element.dataset[nameOrAttrs] || '';
        }

        setProp(this._element.dataset, nameOrAttrs, value);
        return this;
    }

    // Métodos condicionales
    doIf(condition: boolean, callback: (element: this) => void): this {
        if (condition) callback(this);
        return this;
    }

    doIfElse(condition: boolean, ifCallback: (element: this) => void, elseCallback: (element: this) => void): this {
        condition ? ifCallback(this) : elseCallback(this);
        return this;
    }

    // Gestión de clases optimizada
    private processClasses(classes: string | string[], action: 'add' | 'remove' | 'toggle'): this {
        const classList = Array.isArray(classes) 
            ? classes.filter(cls => cls && typeof cls === 'string')
            : [classes].filter(cls => cls && typeof cls === 'string');
        
        classList.forEach(cls => this._element.classList[action](cls));
        return this;
    }

    addClass(classes: string | string[]): this {
        return this.processClasses(classes, 'add');
    }

    removeClass(classes: string | string[]): this {
        return this.processClasses(classes, 'remove');
    }

    toggleClass(classes: string | string[]): this {
        return this.processClasses(classes, 'toggle');
    }

    hasClass(className: string): boolean {
        return this._element.classList.contains(className);
    }

    // Navegación del DOM
    children(): QElement[] {
        return Array.from(this._element.children)
            .filter((child): child is HTMLElement => child instanceof HTMLElement)
            .map(child => Q(child));
    }

    query(selector: string): QElement | null {
        const element = this._element.querySelector(selector);
        return element ? Q(element as HTMLElement) : null;
    }

    queryAll(selector: string): QElement[] {
        return Array.from(this._element.querySelectorAll(selector))
            .filter((element): element is HTMLElement => element instanceof HTMLElement)
            .map(element => Q(element));
    }

    parent(): QElement | null {
        const parent = this._element.parentElement;
        return parent ? Q(parent) : null;
    }

    // Método appendTo mejorado
    appendTo(target: ElementInput): this {
        if (target instanceof HTMLElement) {
            target.appendChild(this._element);
        } else if (target instanceof QElement) {
            target.append(this);
        } else if (typeof target === 'string') {
            const targetElement = document.querySelector(target);
            if (targetElement) {
                targetElement.appendChild(this._element);
            }
        }
        return this;
    }

    // Eliminación segura
    remove(): void {
        elementCache.delete(this._element);
        this._element.remove();
    }

    // Eventos personalizados
    fire(name: string, detail?: any): boolean {
        const event = new CustomEvent(name, {
            detail,
            cancelable: true,
            bubbles: true,
        });
        return this._element.dispatchEvent(event);
    }

    // Definición de propiedades
    define(prop: string, descriptor: PropertyDescriptor): this {
        Object.defineProperty(this._element, prop, descriptor);
        return this;
    }

    // Buscar elemento padre por tag
    parentElement(tagName: string): HTMLElement | null {
        return getParentElement(this._element, tagName);
    }

    // Métodos de utilidad adicionales
    is(selector: string): boolean {
        return this._element.matches(selector);
    }

    closest(selector: string): QElement | null {
        const element = this._element.closest(selector);
        return element ? Q(element as HTMLElement) : null;
    }

    clone(deep = true): QElement {
        const cloned = this._element.cloneNode(deep) as HTMLElement;
        return Q(cloned);
    }

    empty(): this {
        this._element.innerHTML = '';
        return this;
    }

    show(): this {
        this._element.style.display = '';
        return this;
    }

    hide(): this {
        this._element.style.display = 'none';
        return this;
    }
}

// Función Q mejorada
export const Q = (query?: ElementInput): QElement | null => {
    if (query instanceof QElement) {
        return query;
    }

    let element: HTMLElement | null = null;

    if (!query || query === "") {
        element = document.body;
    } else if (query instanceof HTMLElement) {
        element = query;
    } else if (query instanceof Document) {
        element = query.documentElement;
    } else if (query instanceof DocumentFragment) {
        return null; // DocumentFragment no es HTMLElement
    } else if (typeof query === "string") {
        element = document.querySelector(query);
    }

    return element ? new QElement(element) : null;
};

// Métodos estáticos mejorados
Q.id = (id: string): QElement | null => {
    const element = document.getElementById(id);
    return element ? Q(element) : null;
};

Q.create = (config: ElementConfig | string): QElement | null => {
    let element: HTMLElement;

    try {
        if (typeof config === "string") {
            element = document.createElement(config);
        } else if (typeof config === "object" && config.tagName) {
            element = document.createElement(config.tagName);
            
            Object.entries(config).forEach(([key, value]) => {
                if (key !== 'tagName' && value !== false && value !== null && value !== undefined) {
                    element.setAttribute(key, String(value));
                }
            });
        } else {
            return null;
        }

        return Q(element);
    } catch (error) {
        console.error('Error creating element:', error);
        return null;
    }
};

Q.query = (selector: string): QElement | null => {
    const element = document.querySelector(selector);
    return element ? Q(element as HTMLElement) : null;
};

Q.queryAll = (selector: string): QElement[] => {
    return Array.from(document.querySelectorAll(selector))
        .filter((element): element is HTMLElement => element instanceof HTMLElement)
        .map(element => Q(element));
};

// Función bind mejorada con mejor tipado
Q.bind = <T extends Function>(fn: T | string, context: any, ...args: any[]): T => {
    if (typeof fn === "function") {
        return fn.bind(context, ...args) as T;
    } else if (typeof fn === "string") {
        return Function(...args, fn).bind(context) as T;
    }
    throw new Error("Invalid function parameter");
};

// Función fire global
Q.fire = (element: HTMLElement | QElement, eventName: string, detail?: any): void => {
    const targetElement = element instanceof QElement ? element.get() : element;
    const event = new CustomEvent(eventName, {
        detail,
        cancelable: true,
        bubbles: true,
    });
    targetElement.dispatchEvent(event);
};

// Utilidad para encontrar elemento padre (optimizada)
export function getParentElement(child: HTMLElement, parentTag: string): HTMLElement | null {
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
Q.ready = (callback: () => void): void => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
};

Q.each = <T>(array: T[], callback: (item: T, index: number) => void): void => {
    array.forEach(callback);
};

// Exportar utilidades
export { Q as default };