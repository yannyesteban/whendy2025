"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadJsonFileSync = exports.loadJsonFile = exports.LoadMode = void 0;
exports.loadFile = loadFile;
exports.loadFileSync = loadFileSync;
const fs = __importStar(require("fs"));
const util_1 = require("util");
const readFileAsync = (0, util_1.promisify)(fs.readFile);
var LoadMode;
(function (LoadMode) {
    LoadMode["TEXT"] = "TEXT";
    LoadMode["JSON"] = "JSON";
    LoadMode["LINES"] = "LINES"; // Divide por líneas (implementa el ARRAY original)
})(LoadMode || (exports.LoadMode = LoadMode = {}));
/**
 * Carga un archivo con diferentes modos de procesamiento
 * @param filePath Ruta del archivo a cargar
 * @param options Opciones de carga (modo y codificación)
 * @returns Contenido del archivo procesado según el modo
 * @throws {Error} Si el archivo no existe o hay errores de lectura/parsing
 */
async function loadFile(filePath, options = {}) {
    if (!filePath?.trim()) {
        throw new Error('File path is required');
    }
    const { mode = LoadMode.TEXT, encoding = 'utf8' } = options;
    try {
        const content = await readFileAsync(filePath, { encoding });
        switch (mode) {
            case LoadMode.JSON:
                return JSON.parse(content);
            case LoadMode.LINES:
                return content.split(/\r?\n/).filter(line => line.trim() !== '');
            case LoadMode.TEXT:
            default:
                return content;
        }
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load file "${filePath}": ${error.message}`);
        }
        else {
            throw new Error(`Failed to load file "${filePath}": ${String(error)}`);
        }
    }
}
/**
 * Versión síncrona de loadFile
 */
function loadFileSync(filePath, options = {}) {
    if (!filePath?.trim()) {
        throw new Error('File path is required');
    }
    const { mode = LoadMode.TEXT, encoding = 'utf8' } = options;
    try {
        const content = fs.readFileSync(filePath, { encoding });
        switch (mode) {
            case LoadMode.JSON:
                return JSON.parse(content);
            case LoadMode.LINES:
                return content.split(/\r?\n/).filter(line => line.trim() !== '');
            case LoadMode.TEXT:
            default:
                return content;
        }
    }
    catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to load file "${filePath}": ${error.message}`);
        }
        else {
            throw new Error(`Failed to load file "${filePath}": ${String(error)}`);
        }
    }
}
// Funciones de conveniencia
const loadJsonFile = (filePath) => loadFile(filePath, { mode: LoadMode.JSON });
exports.loadJsonFile = loadJsonFile;
const loadJsonFileSync = (filePath) => loadFileSync(filePath, { mode: LoadMode.JSON });
exports.loadJsonFileSync = loadJsonFileSync;
//# sourceMappingURL=Tool.js.map