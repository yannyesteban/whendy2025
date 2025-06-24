
import { randomBytes } from "node:crypto";
import { IncomingMessage, ServerResponse } from "node:http";
import { CookieHandler, CookieVar } from "./CookieHandler";

// Tipos para SameSite (de CookieHandler)
type SameSite = "Strict" | "Lax" | "None";

// Interfaz para la configuración del manejador de sesiones
interface SessionConfig {
  cookieName: string;
  machineType?: string;
  cookieOptions?: {
    maxAge?: number;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: SameSite;
    path?: string;
    domain?: string;
  };
}

// Interfaz para una sesión
export interface ISession {
  id: string;
  data: { [key: string]: any };
  set(key: string, value: any): void;
  get(key: string): any;
  delete(key: string): void;
  getSessionId(): string;
  loadSession(data: { [key: string]: any }): void;
  getData(): { [key: string]: any };
}

// Interfaz para una máquina de almacenamiento de sesiones
export interface IMachine {
  sessions: { [id: string]: ISession };
  init(sessionId: string): ISession;
  read(sessionId: string): ISession | undefined;
  destroy(sessionId: string): void;
}

// Registro de máquinas de almacenamiento
const machines: Record<string, new () => IMachine> = {};

/**
 * Registra una máquina de almacenamiento de sesiones.
 * @param name - Nombre de la máquina.
 * @param machine - Constructor de la máquina (implementa IMachine).
 * @throws Error si la máquina ya está registrada.
 */
export function register(name: string, machine: new () => IMachine): void {
  if (machines[name]) {
    throw new Error(`Machine "${name}" already exists`);
  }
  machines[name] = machine;
}

/**
 * Genera un ID de sesión único.
 * @returns ID de sesión en formato base64url.
 */
function sessionId(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Clase para gestionar sesiones, integrando cookies y máquinas de almacenamiento.
 */
export class Manager {
  private cookieName: string;
  private machine: IMachine;
  private machineType: string;
  private cookieOptions: SessionConfig["cookieOptions"];

  constructor(config: SessionConfig) {
    if (!config.cookieName) {
      throw new Error("cookieName is required");
    }

    this.cookieName = config.cookieName;
    this.machineType = config.machineType ?? "memory";
    this.cookieOptions = {
      path: "/",
 ...config.cookieOptions,
    };

    const MachineClass = machines[this.machineType];
    if (!MachineClass) {
      throw new Error(`Machine type "${this.machineType}" not registered`);
    }

    this.machine = new MachineClass();
  }

  /**
   * Crea una nueva sesión con un ID específico o generado.
   * @param value - ID de sesión opcional.
   * @returns Instancia de ISession.
   */
  create(value?: string): ISession {
    let id = value || sessionId();
    // Verificar unicidad del ID
    while (this.machine.read(id)) {
      id = sessionId();
    }
    return this.machine.init(id);
  }

  /**
   * Inicia o recupera una sesión basada en la cookie de la solicitud.
   * @param req - Solicitud HTTP.
   * @param res - Respuesta HTTP.
   * @returns Instancia de ISession.
   */
  start(req: IncomingMessage, res: ServerResponse): ISession {
    const cookieHandler = new CookieHandler(req, res);
    let id = cookieHandler.get(this.cookieName)?.getValue();

    if (!id) {
      id = sessionId();
      while (this.machine.read(id)) {
        id = sessionId();
      }
      const sessionCookie = new CookieVar(this.cookieName, id, {
        ...this.cookieOptions,
        secure: (this.cookieOptions?.secure) ?? true,
        httpOnly: (this.cookieOptions?.httpOnly) ?? true,
        sameSite: (this.cookieOptions?.sameSite) ?? "Strict",
      });
      cookieHandler.setCookie(sessionCookie);
    }

    return this.machine.init(id);
  }

  /**
   * Destruye una sesión y elimina su cookie.
   * @param req - Solicitud HTTP.
   * @param res - Respuesta HTTP.
   * @param sessionId - ID de la sesión a destruir.
   */
  destroy(req: IncomingMessage, res: ServerResponse, sessionId: string): void {
    const cookieHandler = new CookieHandler(req, res);
    cookieHandler.remove(this.cookieName, this.cookieOptions);
    this.machine.destroy(sessionId);
  }

  /**
   * Crea una nueva instancia de Manager.
   * @param config - Configuración del manejador de sesiones.
   * @returns Nueva instancia de Manager.
   */
  static create(config: SessionConfig): Manager {
    return new Manager(config);
  }
}