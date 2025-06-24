import * as fs from 'fs';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);

export enum LoadMode {
    TEXT = 'TEXT', // Modo por defecto - devuelve texto
    JSON = 'JSON', // Parsea como JSON
    LINES = 'LINES' // Divide por líneas (implementa el ARRAY original)
}

export interface FileLoadOptions {
    mode?: LoadMode;
    encoding?: BufferEncoding;
}

/**
 * Carga un archivo con diferentes modos de procesamiento
 * @param filePath Ruta del archivo a cargar
 * @param options Opciones de carga (modo y codificación)
 * @returns Contenido del archivo procesado según el modo
 * @throws {Error} Si el archivo no existe o hay errores de lectura/parsing
 */
export async function loadFile(filePath: string, options: FileLoadOptions = {}): Promise<any> {
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
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to load file "${filePath}": ${error.message}`);
        } else {
            throw new Error(`Failed to load file "${filePath}": ${String(error)}`);
        }
    }
}

/**
 * Versión síncrona de loadFile
 */
export function loadFileSync(filePath: string, options: FileLoadOptions = {}): any {
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
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to load file "${filePath}": ${error.message}`);
        } else {
            throw new Error(`Failed to load file "${filePath}": ${String(error)}`);
        }
       
    }
}

// Funciones de conveniencia
export const loadJsonFile = (filePath: string) => loadFile(filePath, { mode: LoadMode.JSON });
export const loadJsonFileSync = (filePath: string) => loadFileSync(filePath, { mode: LoadMode.JSON });