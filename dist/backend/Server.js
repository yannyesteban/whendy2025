import * as http from 'http';
import * as url from 'url';
import { Tool } from './Tool';
import { register, Memory } from './Memory.js';
import { ClassManager } from './ClassManager.js';
import { Manager } from './Manager.js';
import { DBAdmin } from './DBAdmin.js';
import { Whendy } from './Whendy.js';
import { Authorization } from './Authorization.js';
import { Store } from './Store.js';
export class Server {
    server;
    port = 8080;
    classElement = [];
    constants = {};
    header = {};
    db = [];
    setApp;
    apps = {};
    useModule = true;
    cors = true;
    maxRequestSize = 10 * 1024 * 1024; // 10MB
    timeout = 30000; // 30 seconds
    enableLogging = true;
    // Managers
    classManager;
    sessionManager;
    // Cache para módulos
    moduleCache = new Map();
    lastModuleCheck = new Map();
    init = {};
    constructor(options = {}) {
        this.applyOptions(options);
        this.initializeComponents();
        this.setupServer();
    }
    applyOptions(options) {
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
    initializeComponents() {
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
    setupServer() {
        this.server = http.createServer(async (req, res) => {
            const startTime = Date.now();
            try {
                // Configurar timeout
                req.setTimeout(this.timeout);
                res.setTimeout(this.timeout);
                await this.handleRequest(req, res, startTime);
            }
            catch (error) {
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
    async handleRequest(req, res, startTime) {
        const context = {
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
    handleOptionsRequest(res) {
        res.writeHead(204, this.header);
        res.end();
    }
    isValidMethod(method) {
        return ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(method?.toUpperCase());
    }
    async loadModuleConfig(requestUrl) {
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
        }
        catch (error) {
            console.warn(`Failed to load module config: ${configPath}`, error.message);
            return null;
        }
    }
    validateModuleConfig(config) {
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
    async processRequest(context) {
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
        }
        catch (error) {
            throw error; // Re-throw para ser manejado por handleError
        }
    }
    async extractAppData(store, session) {
        const appStore = store.getReq("__app_store");
        let appRequest = store.getReq("__app_request");
        // Parse app request si es string
        if (typeof appRequest === "string") {
            try {
                appRequest = JSON.parse(appRequest);
            }
            catch (error) {
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
    determineInitialRequest(appRequest, store, moduleInfo) {
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
    sendSuccess(res, data) {
        res.writeHead(200, this.header);
        res.write(typeof data === 'string' ? data : JSON.stringify(data));
        res.end();
    }
    sendError(res, statusCode, message, details) {
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
    async handleError(error, req, res, startTime) {
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
        }
        else if (error.code === 'EACCES') {
            statusCode = 403;
            message = 'Access denied';
        }
        else if (error.name === 'ValidationError') {
            statusCode = 400;
            message = 'Validation error';
        }
        else if (error.name === 'AuthenticationError') {
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
    getModuleName(requestUrl) {
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
    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, (error) => {
                if (error) {
                    reject(error);
                }
                else {
                    console.log(`🚀 Server running on port ${this.port}`);
                    console.log(`📁 Module support: ${this.useModule ? 'enabled' : 'disabled'}`);
                    console.log(`🔧 CORS: ${this.cors ? 'enabled' : 'disabled'}`);
                    resolve();
                }
            });
        });
    }
    stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('Server stopped');
                resolve();
            });
        });
    }
    async restart() {
        await this.stop();
        await this.start();
    }
    // Métodos de configuración
    addConstant(key, value) {
        this.constants[key] = value;
    }
    addHeader(key, value) {
        this.header[key] = value;
    }
    addApp(name, config) {
        this.apps[name] = config;
    }
    clearModuleCache() {
        this.moduleCache.clear();
        this.lastModuleCheck.clear();
        console.log('Module cache cleared');
    }
    // Getters
    get isRunning() {
        return this.server.listening;
    }
    get serverPort() {
        return this.port;
    }
    get moduleCount() {
        return this.moduleCache.size;
    }
}
//# sourceMappingURL=Server.js.map