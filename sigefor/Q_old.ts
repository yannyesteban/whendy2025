const utils = {};

const setProp = (obj, attrs, value?) => {
    if (typeof attrs === "object") {
        for (let key in attrs) {
            obj[key] = attrs[key];
        }
    } else {
        obj[attrs] = value;
    }
};

export class QElement {
    public e: HTMLElement = null;

    constructor(element) {
        this.e = element;
    }

    get<T>(): T {
        return this.e as T;
    }

    on(event, fn) {
        this.e.addEventListener(event, fn, true);
        return this;
    }

    off(event, fn) {
        this.e.removeEventListener(event, fn, true);
        return this;
    }
    id(): string;
    id(id: string): QElement;
    id(id?: string): unknown {
        if (id === undefined) {
            return this.e.id;
        }

        if (id) {
            this.e.id = id;
        }

        return this;
    }

    append(element: QElement | HTMLElement) {
        if (element === undefined || element === null) {
            return this;
        }

        if (element instanceof HTMLElement) {
            this.e.appendChild(element);
        }

        if (element instanceof QElement) {
            this.e.appendChild(element.get() as HTMLElement);
        }

        if (typeof element === "string") {
            this.e.innerHTML += element;
        }

        return this;
    }

    add(config) {
        const element = Q.create(config);
        this.append(element);
        return this;
    }

    create(config) {
        const element = Q.create(config);
        this.append(element);
        return element;
    }

    findOrCreate(selector: string, tagName: string) {
        const ele = this.e.querySelector(selector);

        if (ele) {
            return Q(ele);
        }

        const element = Q.create(tagName);
        this.append(element);
        return element;
    }

    appendText(text) {
        this.e.innerHTML += text;
        return this;
    }

    text(text?) {
        if (text === undefined) {
            return this.e.textContent;
        }
        this.e.textContent = text;
        return this;
    }

    html(html?): QElement | any {
        if (html === undefined) {
            return this.e.innerHTML;
        }
        this.e.innerHTML = html;
        return this;
    }

    attr(attrs, value?): QElement | any {
        if (typeof attrs === "string" && value === undefined) {
            return this.e.getAttribute(attrs);
        }

        if (typeof attrs === "object") {
            for (const [key, value] of Object.entries(attrs as { key: string; value: boolean | string })) {
                if (typeof value === "boolean") {
                    if (value) {
                        this.e.setAttribute(key, "");
                    } else {
                        this.e.removeAttribute(key);
                    }
                } else {
                    this.e.setAttribute(key, value);
                }
            }
        } else {
            if (typeof value === "boolean") {
                if (value) {
                    this.e.setAttribute(attrs, "");
                } else {
                    this.e.removeAttribute(attrs);
                }
            } else {
                this.e.setAttribute(attrs, value);
            }
        }

        return this;
    }

    prop(attrs, value?) {
        if (typeof attrs === "string" && value === undefined) {
            return this.e[attrs];
        }
        if (attrs) {
            setProp(this.e, attrs, value);
        }

        return this;
    }

    value(data?) {
        if (data === undefined) {
            return this.e["value"];
        }

        this.e["value"] = data;

        return this;
    }

    style(attrs, value?) {
        if (typeof attrs === "string" && value === undefined) {
            return this.e.style[attrs];
        }

        setProp(this.e.style, attrs, value);
        return this;
    }
    ds(attrs): string;
    ds(attrs, value): QElement;
    ds(attrs, value?): unknown {
        if (typeof attrs === "string" && value === undefined) {
            return this.e.dataset[attrs];
        }

        setProp(this.e.dataset, attrs, value);
        return this;
    }

    doIf(cond: boolean, callback: Function) {
        if (cond) {
            callback(this);
        }
        return this;
    }

    addClass(classes) {
        if (Array.isArray(classes)) {
            classes.forEach((item) => this.e.classList.add(item));
        } else if (typeof classes === "string" && classes !== "") {
            this.e.classList.add(classes);
        }

        return this;
    }

    removeClass(classes) {
        if (Array.isArray(classes)) {
            classes.forEach((item) => this.e.classList.remove(item));
        } else if (typeof classes === "string" && classes !== "") {
            this.e.classList.remove(classes);
        }

        return this;
    }

    toggleClass(classes) {
        if (Array.isArray(classes)) {
            classes.forEach((item) => this.e.classList.toggle(item));
        } else if (typeof classes === "string" && classes !== "") {
            this.e.classList.toggle(classes);
        }

        return this;
    }

    hasClass(className) {
        return this.e.classList.contains(className);
    }

    children() {
        return Array.from(this.e.children).map((child) => Q(child));
    }

    query(selector) {
        return Q(this.e.querySelector(selector));
    }

    queryAll(selector) {
        return Array.from(this.e.querySelectorAll(selector)).map((child) => Q(child));
    }

    appendTo(target) {
        if (target instanceof HTMLElement) {
            target.appendChild(this.e);
        } else if (target instanceof QElement) {
            target.append(this.e);
        }

        return this;
    }

    remove() {
        if (this.e) {
            this.e.remove();
        }
    }
    fire(name, detail) {
        const event = new CustomEvent(name, {
            detail,
            cancelable: true,
            bubbles: true,
        });

        return this.e.dispatchEvent(event);
    }

    define(prop, descriptor) {
        Object.defineProperty(this.e, prop, descriptor);
        return this;
    }

    parentElement(tagName: string) {
        return getParentElement(this.e, tagName);
    }
}

export const Q = (query) => {
    if (query instanceof QElement) {
        return query;
    }

    let e: HTMLElement | DocumentFragment | Document = null;

    if (query === undefined || query === "") {
        e = document.body;
    } else if (query instanceof HTMLElement || query instanceof Document || query instanceof DocumentFragment) {
        e = query;
    } else {
        e = document.querySelector(query);
    }

    if (e === null) {
        return null;
    }

    return Object.assign(new QElement(e), utils);
};
Q.id = (id) => {
    return Q(document.getElementById(id));
};
Q.create = (config) => {
    let e;

    if (typeof config === "object") {
        e = document.createElement(config.tagName);

        for (let att in config) {
            if (config.hasOwnProperty(att) && config[att] !== false && config[att] !== null) {
                e.setAttribute(att, config[att]);
            }
        }
    } else if (typeof config === "string") {
        e = document.createElement(config);
    } else {
        return null;
    }

    return Q(e);
};

Q.query = (selector) => {
    return Q(document.body.querySelector(selector));
};

Q.queryAll = (selector) => {
    return Array.from(document.body.querySelectorAll(selector)).map((child) => Q(child));
};

Q.bind = (fn, context, ...arg) => {
    if (typeof fn === "function") {
        return fn.bind(context);
    } else if (typeof fn === "string") {
        if (arg) {
            return Function(...arg, fn).bind(context);
        }

        return Function(fn).bind(context);
    }
};

Q.fire = (element, eventName, detail) => {
    const event = new CustomEvent(eventName, {
        detail,
        cancelable: true,
        bubbles: true,
    });

    element.dispatchEvent(event);
};

export function getParentElement(child: HTMLElement, parentTag: string) {
    let parent: HTMLElement = child.parentNode as HTMLElement;

    while (parent !== null) {
        if (parent.tagName === parentTag.toLocaleUpperCase()) {
            return parent;
        }
        parent = parent.parentNode as HTMLElement;
    }

    return null;
}
