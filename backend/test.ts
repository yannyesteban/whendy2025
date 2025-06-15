import { JWT } from './JWT'; // Ajusta el path según donde esté tu clase

describe('JWT', () => {
    const key = "clave-super-secreta-con-mas-de-32-caracteres";
    const jwt = new JWT({ key, expiresIn: 3600, issuer: "myapp", audience: "users" });

    it('debería generar un token válido y verificarlo correctamente', () => {
        const payload = { userId: 1, role: "admin" };
        const token = jwt.generate(payload);

        expect(typeof token).toBe("string");

        const decoded = jwt.verify(token);
        expect(decoded).not.toBeNull();
        expect(decoded?.userId).toBe(1);
        expect(decoded?.role).toBe("admin");
        expect(decoded?.iss).toBe("myapp");
        expect(decoded?.aud).toBe("users");
    });

    it('debería devolver null si el token es modificado', () => {
        const payload = { userId: 1 };
        const token = jwt.generate(payload);

        // Alterar el token (cambiar un caracter del payload)
        const parts = token.split(".");
        const fakeToken = `${parts[0]}.${parts[1].slice(0, -1)}x.${parts[2]}`;

        const result = jwt.verify(fakeToken);
        expect(result).toBeNull();
    });

    it('debería lanzar error si el payload es inválido (circular)', () => {
        const circular: any = {};
        circular.self = circular;

        expect(() => jwt.generate(circular)).toThrow("Error generando JWT");
    });

    it('debería devolver null si el token está expirado', () => {
        const jwtShort = new JWT({ key, expiresIn: -1 }); // ya expiró
        const token = jwtShort.generate({ userId: 2 });

        const result = jwtShort.verify(token);
        expect(result).toBeNull();
    });
});
