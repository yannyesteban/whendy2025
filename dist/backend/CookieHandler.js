"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CookieHandler = exports.CookieVar = void 0;
exports.cookieParse = cookieParse;
/**
 * Parsea una cadena de cookies en un objeto de instancias CookieVar.
 * @param str - Cadena de cookies en formato "name=value; name2=value2".
 * @returns Objeto con nombres de cookies como claves y CookieVar como valores.
 * @throws Error si la cadena tiene un formato inválido.
 */
function cookieParse(str) {
    const cookies = {};
    if (!str || typeof str !== "string") {
        return cookies;
    }
    const lines = str.split(";");
    for (const line of lines) {
        const [key, ...valueParts] = line.split("=");
        const trimmedKey = key.trim();
        if (!trimmedKey) {
            throw new Error(`Invalid cookie format: empty key in "${line}"`);
        }
        const value = valueParts.length > 0 ? decodeURIComponent(valueParts.join("=").trim()) : trimmedKey;
        cookies[trimmedKey] = new CookieVar(trimmedKey, value);
    }
    return cookies;
}
/**
 * Clase que representa una cookie con sus atributos.
 */
class CookieVar {
    name;
    value;
    domain;
    path = "/";
    expires;
    maxAge;
    secure = false;
    httpOnly = false;
    sameSite;
    priority;
    signed = false;
    encode = encodeURIComponent;
    constructor(name, value, options = {}) {
        if (!name || typeof name !== "string") {
            throw new Error("Cookie name must be a non-empty string");
        }
        this.name = name;
        this.value = value;
        this.domain = options.domain;
        this.path = options.path ?? "/";
        this.expires = options.expires;
        this.maxAge = options.maxAge;
        this.secure = options.secure ?? false;
        this.httpOnly = options.httpOnly ?? false;
        this.sameSite = options.sameSite;
        this.priority = options.priority;
        this.signed = options.signed ?? false;
        this.encode = options.encode ?? encodeURIComponent;
    }
    /**
     * Serializa la cookie en una cadena válida para el encabezado Set-Cookie.
     * @returns Cadena en formato "name=value;attr1=value1;attr2".
     */
    get() {
        const attributes = [`${this.name}=${this.encode(this.value)}`];
        if (this.domain)
            attributes.push(`Domain=${this.domain}`);
        if (this.path)
            attributes.push(`Path=${this.path}`);
        if (this.expires)
            attributes.push(`Expires=${this.expires.toUTCString()}`);
        if (this.maxAge !== undefined)
            attributes.push(`Max-Age=${this.maxAge}`);
        if (this.secure)
            attributes.push("Secure");
        if (this.httpOnly)
            attributes.push("HttpOnly");
        if (this.sameSite)
            attributes.push(`SameSite=${this.sameSite}`);
        if (this.priority)
            attributes.push(`Priority=${this.priority}`);
        if (this.signed)
            attributes.push("Signed");
        return attributes.join("; ");
    }
    /**
     * Obtiene el valor de la cookie.
     * @returns Valor de la cookie.
     */
    getValue() {
        return this.value;
    }
}
exports.CookieVar = CookieVar;
/**
 * Clase para manejar cookies en solicitudes y respuestas HTTP.
 */
class CookieHandler {
    req;
    res;
    cookies = {};
    constructor(req, res) {
        this.req = req;
        this.res = res;
        this.cookies = cookieParse(req.headers.cookie || "");
    }
    /**
     * Agrega o actualiza una cookie.
     * @param cookie - Instancia de CookieVar.
     */
    add(cookie) {
        if (!(cookie instanceof CookieVar)) {
            throw new Error("Parameter must be an instance of CookieVar");
        }
        this.cookies[cookie.name] = cookie;
    }
    /**
     * Obtiene una cookie por su nombre.
     * @param name - Nombre de la cookie.
     * @returns Instancia de CookieVar o undefined si no existe.
     */
    get(name) {
        return this.cookies[name];
    }
    /**
     * Verifica si una cookie existe.
     * @param name - Nombre de la cookie.
     * @returns true si la cookie existe, false en caso contrario.
     */
    has(name) {
        return name in this.cookies;
    }
    /**
     * Convierte las cookies en un array de cadenas serializadas.
     * @returns Array de cadenas en formato Set-Cookie.
     */
    toArray() {
        return Object.values(this.cookies).map((cookie) => cookie.get());
    }
    /**
     * Configura una o más cookies en la respuesta HTTP.
     * @param cookie - Instancia de CookieVar o cadena válida para Set-Cookie.
     */
    setCookie(cookie) {
        const cookieString = typeof cookie === "string" ? cookie : cookie.get();
        const currentCookies = this.res.getHeader("Set-Cookie");
        // Normalizamos currentCookies a un array de strings
        const normalizedCookies = Array.isArray(currentCookies)
            ? currentCookies.map(String) // Convertimos cada elemento a string
            : currentCookies
                ? [String(currentCookies)] // Convertimos a array si es un string
                : []; // Array vacío si es undefined
        // Agregamos la nueva cookie al array
        const newCookies = [...normalizedCookies, cookieString];
        // Configuramos el encabezado Set-Cookie
        this.res.setHeader("Set-Cookie", newCookies);
    }
    /**
     * Elimina una cookie configurando una fecha de expiración en el pasado.
     * @param name - Nombre de la cookie a eliminar.
     * @param options - Opciones adicionales como path o domain.
     */
    remove(name, options = {}) {
        const cookie = new CookieVar(name, "", {
            ...options,
            expires: new Date(0), // Fecha en el pasado
            maxAge: 0,
        });
        this.setCookie(cookie);
        delete this.cookies[name];
    }
}
exports.CookieHandler = CookieHandler;
//# sourceMappingURL=CookieHandler.js.map