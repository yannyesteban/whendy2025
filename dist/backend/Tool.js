import * as fs from 'fs';
import { promisify } from 'util';
const readFileAsync = promisify(fs.readFile);
export var LoadMode;
(function (LoadMode) {
    LoadMode["TEXT"] = "TEXT";
    LoadMode["JSON"] = "JSON";
    LoadMode["LINES"] = "LINES"; // Divide por líneas (implementa el ARRAY original)
})(LoadMode || (LoadMode = {}));
/**
 * Carga un archivo con diferentes modos de procesamiento
 * @param filePath Ruta del archivo a cargar
 * @param options Opciones de carga (modo y codificación)
 * @returns Contenido del archivo procesado según el modo
 * @throws {Error} Si el archivo no existe o hay errores de lectura/parsing
 */
export async function loadFile(filePath, options = {}) {
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
export function loadFileSync(filePath, options = {}) {
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
export const loadJsonFile = (filePath) => loadFile(filePath, { mode: LoadMode.JSON });
export const loadJsonFileSync = (filePath) => loadFileSync(filePath, { mode: LoadMode.JSON });
//# sourceMappingURL=Tool.js.map