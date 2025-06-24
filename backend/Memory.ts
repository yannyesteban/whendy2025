import { IMachine, ISession } from './Manager';

/**
 * Clase que implementa una sesión en memoria.
 */
export class Session implements ISession {
  public id: string;
  public data: { [key: string]: any };

  constructor(id: string) {
    if (!id) {
      throw new Error("Session ID is required");
    }
    this.id = id;
    this.data = {};
  }

  set(key: string, value: any): void {
    this.data[key] = value;
  }

  get(key: string): any {
    return this.data[key];
  }

  getSessionId(): string {
    return this.id;
  }

  delete(key: string): void {
    delete this.data[key];
  }

  loadSession(data: { [key: string]: any }): void {
    this.data = { ...data };
  }

  getData(): { [key: string]: any } {
    return { ...this.data };
  }
}

/**
 * Máquina de almacenamiento de sesiones en memoria.
 */
export class Memory implements IMachine {
  sessions: { [key: string]: ISession } = {};

  init(sessionId: string): ISession {
    if (!this.sessions[sessionId]) {
      this.sessions[sessionId] = new Session(sessionId);
    }
    return this.sessions[sessionId];
  }

  read(sessionId: string): ISession | undefined {
    return this.sessions[sessionId];
  }

  destroy(sessionId: string): void {
    delete this.sessions[sessionId];
  }
}

// Registrar la máquina Memory por defecto
//register("memory", Memory);