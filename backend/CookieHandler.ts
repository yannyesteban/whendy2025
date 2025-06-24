import { IncomingMessage, ServerResponse } from "node:http";

// Tipos para SameSite
type SameSite = "Strict" | "Lax" | "None";

// Interfaz para opciones de CookieVar
interface CookieOptions {
    domain?: string;
    path?: string;
    expires?: Date;
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: SameSite;
    priority?: "Low" | "Medium" | "High";
    signed?: boolean;
    encode?: (value: string) => string;
}

/**
 * Parsea una cadena de cookies en un objeto de instancias CookieVar.
 * @param str - Cadena de cookies en formato "name=value; name2=value2".
 * @returns Objeto con nombres de cookies como claves y CookieVar como valores.
 * @throws Error si la cadena tiene un formato inválido.
 */
export function cookieParse(str: string): { [key: string]: CookieVar } {
    const cookies: { [key: string]: CookieVar } = {};

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
export class CookieVar {
    public name: string;
    public value: string;
    public domain?: string;
    public path: string = "/";
    public expires?: Date;
    public maxAge?: number;
    public secure: boolean = false;
    public httpOnly: boolean = false;
    public sameSite?: SameSite;
    public priority?: "Low" | "Medium" | "High";
    public signed: boolean = false;
    public encode: (value: string) => string = encodeURIComponent;

    constructor(name: string, value: string, options: CookieOptions = {}) {
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
    get(): string {
        const attributes: string[] = [`${this.name}=${this.encode(this.value)}`];

        if (this.domain) attributes.push(`Domain=${this.domain}`);
        if (this.path) attributes.push(`Path=${this.path}`);
        if (this.expires) attributes.push(`Expires=${this.expires.toUTCString()}`);
        if (this.maxAge !== undefined) attributes.push(`Max-Age=${this.maxAge}`);
        if (this.secure) attributes.push("Secure");
        if (this.httpOnly) attributes.push("HttpOnly");
        if (this.sameSite) attributes.push(`SameSite=${this.sameSite}`);
        if (this.priority) attributes.push(`Priority=${this.priority}`);
        if (this.signed) attributes.push("Signed");

        return attributes.join("; ");
    }

    /**
     * Obtiene el valor de la cookie.
     * @returns Valor de la cookie.
     */
    getValue(): string {
        return this.value;
    }
}

/**
 * Clase para manejar cookies en solicitudes y respuestas HTTP.
 */
export class CookieHandler {
    private req: IncomingMessage;
    private res: ServerResponse;
    public cookies: { [key: string]: CookieVar } = {};

    constructor(req: IncomingMessage, res: ServerResponse) {
        this.req = req;
        this.res = res;
        this.cookies = cookieParse(req.headers.cookie || "");
    }

    /**
     * Agrega o actualiza una cookie.
     * @param cookie - Instancia de CookieVar.
     */
    add(cookie: CookieVar): void {
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
    get(name: string): CookieVar | undefined {
        return this.cookies[name];
    }

    /**
     * Verifica si una cookie existe.
     * @param name - Nombre de la cookie.
     * @returns true si la cookie existe, false en caso contrario.
     */
    has(name: string): boolean {
        return name in this.cookies;
    }

    /**
     * Convierte las cookies en un array de cadenas serializadas.
     * @returns Array de cadenas en formato Set-Cookie.
     */
    toArray(): string[] {
        return Object.values(this.cookies).map((cookie) => cookie.get());
    }

    /**
     * Configura una o más cookies en la respuesta HTTP.
     * @param cookie - Instancia de CookieVar o cadena válida para Set-Cookie.
     */
    setCookie(cookie: CookieVar | string): void {
        const cookieString = typeof cookie === "string" ? cookie : cookie.get();
        const currentCookies = this.res.getHeader("Set-Cookie");

        // Normalizamos currentCookies a un array de strings
        const normalizedCookies: string[] = Array.isArray(currentCookies)
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
    remove(name: string, options: Partial<CookieOptions> = {}): void {
        const cookie = new CookieVar(name, "", {
            ...options,
            expires: new Date(0), // Fecha en el pasado
            maxAge: 0,
        });
        this.setCookie(cookie);
        delete this.cookies[name];
    }
}