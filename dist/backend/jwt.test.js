"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const JWT_1 = require("./JWT");
describe("JWT", () => {
    const secretKey = "una-clave-secreta-muy-larga-y-compleja";
    const defaultPayload = { userId: 123, role: "admin" };
    let jwt;
    let originalDateNow;
    beforeEach(() => {
        // Mock Date.now para controlar el tiempo
        originalDateNow = Date.now;
        Date.now = jest.fn(() => 1750021744000); // Fecha fija: 2025-06-15
        jwt = new JWT_1.JWT({ key: secretKey });
    });
    afterEach(() => {
        // Restaurar Date.now
        Date.now = originalDateNow;
        jest.clearAllMocks();
    });
    describe("constructor", () => {
        it("should throw an error if key is too short", () => {
            expect(() => new JWT_1.JWT({ key: "short" })).toThrow("La clave debe tener al menos 32 caracteres.");
        });
        it("should initialize with valid options", () => {
            const options = {
                key: secretKey,
                expiresIn: 3600,
                issuer: "test-issuer",
                audience: "test-audience",
            };
            const instance = new JWT_1.JWT(options);
            expect(instance).toBeInstanceOf(JWT_1.JWT);
        });
    });
    describe("generate", () => {
        it("should generate a valid JWT token", () => {
            const token = jwt.generate(defaultPayload);
            expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
            const parts = token.split(".");
            expect(parts.length).toBe(3);
        });
        it("should include iat and exp in payload when expiresIn is set", () => {
            const jwtWithExp = new JWT_1.JWT({ key: secretKey, expiresIn: 60 });
            const token = jwtWithExp.generate(defaultPayload);
            const payload = jwtWithExp.verify(token);
            expect(payload).toMatchObject({
                ...defaultPayload,
                iat: 1750021744,
                exp: 1750021744 + 60,
            });
        });
        it("should include issuer and audience when set", () => {
            const jwtWithOptions = new JWT_1.JWT({
                key: secretKey,
                issuer: "test-issuer",
                audience: "test-audience",
            });
            const token = jwtWithOptions.generate(defaultPayload);
            const payload = jwtWithOptions.verify(token);
            expect(payload).toMatchObject({
                ...defaultPayload,
                iss: "test-issuer",
                aud: "test-audience",
            });
        });
        it("should throw an error if payload is invalid", () => {
            expect(() => jwt.generate(null)).toThrow("Error generando JWT");
        });
    });
    describe("verify", () => {
        it("should verify a valid token and return payload", () => {
            const token = jwt.generate(defaultPayload);
            const payload = jwt.verify(token);
            expect(payload).toMatchObject({
                ...defaultPayload,
                iat: 1750021744,
            });
        });
        it("should return null for invalid token format", () => {
            expect(jwt.verify("invalid")).toBeNull();
            expect(jwt.verify("part1.part2")).toBeNull();
            expect(jwt.verify("part1.part2.part3.part4")).toBeNull();
        });
        it("should return null for invalid signature", () => {
            const token = jwt.generate(defaultPayload);
            const invalidToken = token.split(".").slice(0, 2).join(".") + ".invalidSignature";
            expect(jwt.verify(invalidToken)).toBeNull();
        });
        it("should return null for expired token", () => {
            const jwtWithExp = new JWT_1.JWT({ key: secretKey, expiresIn: 60 });
            const token = jwtWithExp.generate(defaultPayload);
            // Avanzar el tiempo más allá de la expiración
            Date.now.mockReturnValue(1750021744000 + 61 * 1000);
            expect(jwtWithExp.verify(token)).toBeNull();
        });
        it("should return null for invalid issuer", () => {
            const jwtWithIssuer = new JWT_1.JWT({ key: secretKey, issuer: "test-issuer" });
            const token = jwt.generate(defaultPayload); // Token sin issuer
            expect(jwtWithIssuer.verify(token)).toBeNull();
        });
        it("should return null for invalid audience", () => {
            const jwtWithAudience = new JWT_1.JWT({ key: secretKey, audience: "test-audience" });
            const token = jwt.generate(defaultPayload); // Token sin audience
            expect(jwtWithAudience.verify(token)).toBeNull();
        });
    });
    describe("getSignature", () => {
        it("should generate correct signature", () => {
            const message = "header.payload";
            const signature = jwt.getSignature(message);
            expect(signature).toMatch(/^[A-Za-z0-9-_]+$/);
        });
    });
});
//# sourceMappingURL=jwt.test.js.map