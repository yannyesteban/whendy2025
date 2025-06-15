"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWT = void 0;
//import exp from "node:constants";
const node_crypto_1 = require("node:crypto");
const node_buffer_1 = require("node:buffer");
class JWT {
    header = {
        alg: "HS256",
        typ: "JWT",
    };
    key = "your-256-bit-secret";
    expiresIn;
    issuer;
    audience;
    constructor(opt) {
        if (opt) {
            for (let key in opt) {
                this[key] = opt[key];
            }
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
    verify(token) {
        try {
            const parts = token.split(".");
            if (parts.length !== 3)
                return null;
            const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
            const msg = `${headerEncoded}.${payloadEncoded}`;
            const signature = node_buffer_1.Buffer.from(signatureEncoded, "base64url");
            const expected = node_buffer_1.Buffer.from(this.getSignature(msg), "base64url");
            if (signature.length != expected.length || !(0, node_crypto_1.timingSafeEqual)(signature, expected)) {
                throw new Error("Firma JWT inválida");
            }
            const payload = JSON.parse(node_buffer_1.Buffer.from(payloadEncoded, "base64url").toString("utf8"));
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
        }
        catch (error) {
            console.error("Error al verificar el token:", error);
            return null;
        }
    }
    /**
     * Genera un token JWT con el payload proporcionado.
     * @param payload El payload del JWT.
     * @returns El token JWT generado.
     */
    generate(payload) {
        try {
            const now = Math.floor(Date.now() / 1000);
            // Agregar claims estándar
            const finalPayload = {
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
        }
        catch (error) {
            throw new Error(`Error generando JWT: ${error.message}`);
        }
    }
    getSignature(msg) {
        return (0, node_crypto_1.createHmac)("sha256", this.key).update(msg).digest("base64url");
    }
}
exports.JWT = JWT;
function base64Encode(msg) {
    return node_buffer_1.Buffer.from(msg).toString("base64url");
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
//# sourceMappingURL=JWT.js.map