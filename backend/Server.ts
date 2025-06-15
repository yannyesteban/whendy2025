import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import { Tool } from './Tool.js';
import { register, Memory } from './Memory.js';
import { ClassManager } from './ClassManager.js';
import { Manager } from './Manager.js';
import { DBAdmin } from './DBAdmin.js';
import { Whendy } from './Whendy.js';
import { Authorization } from './Authorization.js';
import { Store } from './Store.js';
import { InfoClass, InfoElement, IConnectInfo } from './types.js';

interface ServerOptions {
    port?: number;
    classElement?: InfoClass[];
    constants?: { [key: string]: any };
    header?: { [key: string]: string | number };
    db?: IConnectInfo[];
    setApp?: InfoElement;
    apps?: { [name: string]: InfoElement };
    useModule?: boolean;
    init?: any;
    cors?: boolean;
    maxRequestSize?: number;
    timeout?: number;
    enableLogging?: boolean;
}

interface ModuleConfig {
    constants?: { [key: string]: any };
    db?: IConnectInfo[];
    init?: any;
    middleware?: string[];
    cache?: boolean;
}

interface RequestContext {
    req: http.IncomingMessage;
    res: http.ServerResponse;
    session: any;
    store: Store;
    moduleInfo?: ModuleConfig;
    startTime: number;
}

export class Server {
    private server: http.Server;
    private port: number = 8080;
    private classElement: InfoClass[] = [];
    private constants: { [key: string]: any } = {};
    private header: { [key: string]: string | number } = {};
    private db: IConnectInfo[] = [];
    private setApp: InfoElement;
    private apps: { [name: string]: InfoElement } = {};
    private useModule: boolean = true;
    private cors: boolean = true;
    private maxRequestSize: number = 10 * 1024 * 1024; // 10MB
    private timeout: number = 30000; // 30 seconds
    private enableLogging: boolean = true;
    
    // Managers
    private classManager: ClassManager;
    private sessionManager: Manager;
    
    // Cache para módulos
    private moduleCache: Map<string, ModuleConfig> = new Map();
    private lastModuleCheck: Map<string, number> = new Map();
    
    public init: any = {};

    constructor(options: ServerOptions = {}) {
        this.applyOptions(options);
        this.initializeComponents();
        this.setupServer();
    }

    private applyOptions(options: ServerOptions) {
        Object.assign(this, options);
        
        // Headers CORS por defecto
        if (this.cors) {
            this.header = {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Application-Name, Application-Id, Application-Mode',
                'Access-Control-Max-Age': '86400',
                ...this.header
            };
        }
    }

    private initializeComponents() {
        // Registrar memoria
        register("memory", Memory);
        
        // Inicializar managers
        this.classManager = new ClassManager(this.classElement);
        this.sessionManager = new Manager({
            cookieName: "whsessionid",
            machineType: "memory",
            maxLifeTime: 36000,
        });
    }

    private setupServer() {
        this.server = http.createServer(async (req, res) => {
            const startTime = Date.now();
            
            try {
                // Configurar timeout
                req.setTimeout(this.timeout);
                res.setTimeout(this.timeout);
                
                await this.handleRequest(req, res, startTime);
                
            } catch (error) {
                await this.handleError(error, req, res, startTime);
            }
        });

        // Manejo de errores del servidor
        this.server.on('error', (error) => {
            console.error('Server error:', error);
        });

        this.server.on('clientError', (error, socket) => {
            console.error('Client error:', error);
            socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        });
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse, startTime: number) {
        const context: RequestContext = {
            req,
            res,
            session: null,
            store: null,
            startTime
        };

        // Log de request
        if (this.enableLogging) {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - ${req.headers['user-agent']}`);
        }

        // Manejar OPTIONS (CORS preflight)
        if (req.method?.toUpperCase() === "OPTIONS") {
            return this.handleOptionsRequest(res);
        }

        // Validar método
        if (!this.isValidMethod(req.method)) {
            return this.sendError(res, 405, 'Method Not Allowed');
        }

        // Inicializar sesión
        context.session = this.sessionManager.start(req, res);
        context.session.loadSession(this.constants);

        // Cargar configuración del módulo
        if (this.useModule) {
            context.moduleInfo = await this.loadModuleConfig(req.url);
            if (context.moduleInfo?.constants) {
                context.session.loadSession(context.moduleInfo.constants);
            }
        }

        // Procesar request
        await this.processRequest(context);
    }

    private handleOptionsRequest(res: http.ServerResponse) {
        res.writeHead(204, this.header);
        res.end();
    }

    private isValidMethod(method: string): boolean {
        return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method?.toUpperCase());
    }

    private async loadModuleConfig(requestUrl: string): Promise<ModuleConfig | null> {
        if (!requestUrl || requestUrl === '/') {
            return null;
        }

        const modulePath = this.getModuleName(requestUrl);
        const configPath = `./app/modules${modulePath}/config.json`;
        
        // Verificar cache
        const lastCheck = this.lastModuleCheck.get(modulePath) || 0;
        const now = Date.now();
        
        // Cache válido por 5 minutos en desarrollo, 1 hora en producción
        const cacheTime = process.env.NODE_ENV === 'production' ? 3600000 : 300000;
        
        if (now - lastCheck < cacheTime && this.moduleCache.has(modulePath)) {
            return this.moduleCache.get(modulePath);
        }

        try {
            const moduleInfo = Tool.loadJsonFile(configPath);
            
            // Validar estructura del módulo
            if (this.validateModuleConfig(moduleInfo)) {
                this.moduleCache.set(modulePath, moduleInfo);
                this.lastModuleCheck.set(modulePath, now);
                return moduleInfo;
            }
            
            console.warn(`Invalid module config: ${configPath}`);
            return null;
            
        } catch (error) {
            console.warn(`Failed to load module config: ${configPath}`, error.message);
            return null;
        }
    }

    private validateModuleConfig(config: any): boolean {
        if (!config || typeof config !== 'object') {
            return false;
        }

        // Validaciones básicas
        if (config.constants && typeof config.constants !== 'object') {
            return false;
        }

        if (config.db && !Array.isArray(config.db)) {
            return false;
        }

        return true;
    }

    private async processRequest(context: RequestContext) {
        const { req, res, session, moduleInfo } = context;

        try {
            // Inicializar base de datos
            const dbInfo = moduleInfo?.db || this.db;
            const db = new DBAdmin();
            db.init(dbInfo);

            // Crear instancia Whendy
            const whendy = new Whendy();
            whendy.classes = this.classManager;
            whendy.authorization = new Authorization();
            whendy.authorization.evalHeader(req, res);

            // Configurar Store
            const store = new Store();
            store.setSessionAdmin(session);
            store.setDBAdmin(db);
            await store.start(req, res);
            
            whendy.store = store;
            context.store = store;

            // Procesar datos de la aplicación
            const { appRequest, appStore } = await this.extractAppData(store, session);

            // Determinar request inicial
            const finalRequest = this.determineInitialRequest(appRequest, store, moduleInfo);

            // Renderizar respuesta
            const result = await whendy.render(finalRequest);

            // Enviar respuesta
            this.sendSuccess(res, result);

            // Log de éxito
            if (this.enableLogging) {
                const duration = Date.now() - context.startTime;
                console.log(`${req.method} ${req.url} - 200 - ${duration}ms`);
            }

        } catch (error) {
            throw error; // Re-throw para ser manejado por handleError
        }
    }

    private async extractAppData(store: Store, session: any) {
        const appStore = store.getReq("__app_store");
        let appRequest = store.getReq("__app_request");

        // Parse app request si es string
        if (typeof appRequest === "string") {
            try {
                appRequest = JSON.parse(appRequest);
            } catch (error) {
                console.warn('Failed to parse __app_request:', error);
                appRequest = null;
            }
        }

        // Cargar app store en sesión
        if (appStore && typeof appStore === 'object') {
            session.loadSession(appStore);
        }

        return { appRequest, appStore };
    }

    private determineInitialRequest(appRequest: any, store: Store, moduleInfo?: ModuleConfig) {
        // Si ya hay un request, usarlo
        if (appRequest) {
            return appRequest;
        }

        // Buscar en configuración inicial por nombre de aplicación
        const appName = store.getHeader("Application-Name")?.toString();
        
        if (appName) {
            // Buscar en init del módulo
            if (moduleInfo?.init?.[appName]) {
                return moduleInfo.init[appName];
            }
            
            // Buscar en init global
            if (this.init?.[appName]) {
                return this.init[appName];
            }
        }

        // Request por defecto
        return [{
            api: "system",
            method: "welcome",
            id: "welcome",
            do: "set-panel",
            to: "main"
        }];
    }

    private sendSuccess(res: http.ServerResponse, data: any) {
        res.writeHead(200, this.header);
        res.write(typeof data === 'string' ? data : JSON.stringify(data));
        res.end();
    }

    private sendError(res: http.ServerResponse, statusCode: number, message: string, details?: any) {
        const errorResponse = {
            error: true,
            message,
            statusCode,
            timestamp: new Date().toISOString(),
            ...(details && { details })
        };

        res.writeHead(statusCode, this.header);
        res.write(JSON.stringify(errorResponse));
        res.end();
    }

    private async handleError(error: any, req: http.IncomingMessage, res: http.ServerResponse, startTime: number) {
        console.error('Request error:', error);

        // Log del error
        if (this.enableLogging) {
            const duration = Date.now() - startTime;
            console.error(`${req.method} ${req.url} - ERROR - ${duration}ms:`, error.message);
        }

        // Determinar tipo de error
        let statusCode = 500;
        let message = 'Internal Server Error';

        if (error.code === 'ENOENT') {
            statusCode = 404;
            message = 'Resource not found';
        } else if (error.code === 'EACCES') {
            statusCode = 403;
            message = 'Access denied';
        } else if (error.name === 'ValidationError') {
            statusCode = 400;
            message = 'Validation error';
        } else if (error.name === 'AuthenticationError') {
            statusCode = 401;
            message = 'Authentication required';
        }

        // Enviar respuesta de error
        if (!res.headersSent) {
            this.sendError(res, statusCode, message, {
                type: error.name,
                code: error.code
            });
        }
    }

    private getModuleName(requestUrl: string): string {
        if (!requestUrl || requestUrl === '/') {
            return '';
        }

        const parsedUrl = url.parse(requestUrl);
        const pathname = parsedUrl.pathname || '';
        
        // Extraer el primer segmento del path
        const segments = pathname.split('/').filter(Boolean);
        return segments.length > 0 ? `/${segments[0]}` : '';
    }

    // Métodos públicos
    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, (error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`🚀 Server running on port ${this.port}`);
                    console.log(`📁 Module support: ${this.useModule ? 'enabled' : 'disabled'}`);
                    console.log(`🔧 CORS: ${this.cors ? 'enabled' : 'disabled'}`);
                    resolve();
                }
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('Server stopped');
                resolve();
            });
        });
    }

    public async restart(): Promise<void> {
        await this.stop();
        await this.start();
    }

    // Métodos de configuración
    public addConstant(key: string, value: any): void {
        this.constants[key] = value;
    }

    public addHeader(key: string, value: string | number): void {
        this.header[key] = value;
    }

    public addApp(name: string, config: InfoElement): void {
        this.apps[name] = config;
    }

    public clearModuleCache(): void {
        this.moduleCache.clear();
        this.lastModuleCheck.clear();
        console.log('Module cache cleared');
    }

    // Getters
    public get isRunning(): boolean {
        return this.server.listening;
    }

    public get serverPort(): number {
        return this.port;
    }

    public get moduleCount(): number {
        return this.moduleCache.size;
    }
}