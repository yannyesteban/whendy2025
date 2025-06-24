//import exp from "node:constants";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

interface JwtHeader {
    alg: string;
    typ: string;
}

export interface JwtOptions {
    key?: string;
    header?: Partial<JwtHeader>;
    expiresIn?: number; // en segundos
    issuer?: string;
    audience?: string;
}

export interface JwtPayload {
    [key: string]: any;
    iat?: number; // issued at
    exp?: number; // expiration time
    iss?: string; // issuer
    aud?: string; // audience
}
export class JWT {
    private header: JwtHeader = {
        alg: "HS256",
        typ: "JWT",
    };

    private key = "your-256-bit-secret";
    private expiresIn?: number;
    private issuer?: string;
    private audience?: string;

    constructor(opt?: JwtOptions) {
        if (opt) {
            if (opt.key !== undefined) this.key = opt.key;
            if (opt.header !== undefined) this.header = { ...this.header, ...opt.header };
            if (opt.expiresIn !== undefined) this.expiresIn = opt.expiresIn;
            if (opt.issuer !== undefined) this.issuer = opt.issuer;
            if (opt.audience !== undefined) this.audience = opt.audience;
        }

        if (!this.key || this.key.length < 32) {
            throw new Error("La clave debe tener al menos 32 caracteres.");
        }
    }
    /**
     * Verifica un token JWT y devuelve su payload si es válido.
     * @param token El token JWT a verificar.
     * @returns El payload del JWT si es válido, o null si no lo es.
     */
    verify(token: string): JwtPayload | null {

        try {
            const parts = token.split(".");
            if (parts.length !== 3) return null;

            const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
            const msg = `${headerEncoded}.${payloadEncoded}`;

            const signature = Buffer.from(signatureEncoded, "base64url");
            const expected = Buffer.from(this.getSignature(msg), "base64url");

            if (signature.length != expected.length || !timingSafeEqual(signature, expected)) {
                throw new Error("Firma JWT inválida");
            }

            const payload = JSON.parse(Buffer.from(payloadEncoded, "base64url").toString("utf8"));
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                throw new Error("Token expirado");
            }
            // Verificar issuer si está configurado
            if (this.issuer && payload.iss !== this.issuer) {
                throw new Error("Issuer JWT inválido");
            }

            // Verificar audience si está configurado
            if (this.audience && payload.aud !== this.audience) {
                throw new Error("Audience JWT inválido");
            }

            return payload;

        } catch (error) {
            console.error("Error al verificar el token:", error);
            return null;

        }
    }
    /**
     * Genera un token JWT con el payload proporcionado.
     * @param payload El payload del JWT.
     * @returns El token JWT generado.
     */
    generate(payload: JwtPayload): string {
        try {
            const now = Math.floor(Date.now() / 1000);

            // Agregar claims estándar
            const finalPayload: JwtPayload = {
                ...payload,
                iat: now, // issued at
            };

            // Agregar expiración si está configurada
            if (this.expiresIn) {
                finalPayload.exp = now + this.expiresIn;
            }

            // Agregar issuer si está configurado
            if (this.issuer) {
                finalPayload.iss = this.issuer;
            }

            // Agregar audience si está configurado
            if (this.audience) {
                finalPayload.aud = this.audience;
            }

            const header = base64Encode(JSON.stringify(this.header));
            const encodedPayload = base64Encode(JSON.stringify(finalPayload));
            const signature = this.getSignature(header + "." + encodedPayload);
            return `${header}.${encodedPayload}.${signature}`;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Error generando JWT: ${error.message}`);
            } else {
                throw new Error("Error generando JWT: error desconocido");
            }
        }
    }

    getSignature(msg: string): string {
        return createHmac("sha256", this.key).update(msg).digest("base64url");

    }
}



function base64Encode(msg: string): string {
    return Buffer.from(msg).toString("base64url");
}

/*
const jwt = new JWT({
    key: "una-clave-secreta-muy-larga-y-compleja",
});

const token = jwt.generate({ userId: 123, role: "admin" });
console.log("Token: ", token);

const payload = jwt.verify(token);
console.log("Payload: ", payload);


const jwt2 = new JWT({
    key: "una-clave-secreta-muy-larga-y-compleja",
    expiresIn: 60, // 1 hora
});

console.log("jwt2.verify ", jwt2.verify("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywicm9sZSI6ImFkbWluIiwiaWF0IjoxNzUwMDIxNzQ0LCJleHAiOjE3NTAwMjE4MDR9.wBP5X0cp6Wnzutb9HosPh0b8dmTsq_v5gWairUwlMc4"))
const token2 = jwt2.generate({ userId: 123, role: "admin" });
console.log("Token: ", token2);

const payload2 = jwt2.verify(token2);
console.log("Payload: ", payload2);
*/