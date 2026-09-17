const crypto = require('crypto');
const DatabaseRepository = require('../repositories/DatabaseRepository');
const TokenSigner = require('../utils/tokenSigner');

const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

class AuthController {
    static sanitizeText(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    static normalizeUsername(value) {
        return this.sanitizeText(value).toLowerCase();
    }

    static validateCredentials({ name, username, password, pin }) {
        const cleanName = this.sanitizeText(name);
        const cleanUsername = this.normalizeUsername(username);
        const cleanPassword = this.sanitizeText(password);
        const cleanPin = this.sanitizeText(pin);

        if (!cleanName || cleanName.length < 2) {
            throw new Error('Nome inválido.');
        }
        if (!cleanUsername || cleanUsername.length < 3 || !/^[a-z0-9._-]+$/.test(cleanUsername)) {
            throw new Error('Nome de usuário inválido. Use apenas letras, números, ponto, underline e hífen.');
        }
        if (!cleanPassword || cleanPassword.length < 8) {
            throw new Error('A senha deve conter pelo menos 8 caracteres.');
        }
        if (!/^\d{4,6}$/.test(cleanPin)) {
            throw new Error('O PIN deve conter de 4 a 6 dígitos numéricos.');
        }

        return {
            name: cleanName,
            username: cleanUsername,
            password: cleanPassword,
            pin: cleanPin
        };
    }

    static encodeBase32(buffer) {
        let bits = 0; let value = 0; let output = '';
        for (let i = 0; i < buffer.length; i++) {
            value = (value << 8) | buffer[i]; bits += 8;
            while (bits >= 5) { output += base32chars[(value >>> (bits - 5)) & 31]; bits -= 5; }
        }
        if (bits > 0) output += base32chars[(value << (5 - bits)) & 31];
        return output;
    }

    static decodeBase32(input) {
        let bits = 0; let value = 0; let index = 0;
        const output = new Uint8Array(Math.ceil(input.length * 5 / 8));
        for (let i = 0; i < input.length; i++) {
            const val = base32chars.indexOf(input[i].toUpperCase());
            if (val === -1) continue;
            value = (value << 5) | val; bits += 5;
            if (bits >= 8) { output[index++] = (value >>> (bits - 8)) & 255; bits -= 8; }
        }
        return Buffer.from(output.buffer, 0, index);
    }

    static verifyTOTP(token, secret, window = 1) {
        try {
            const cleanToken = String(token || '').trim();
            if (!/^[0-9]{6}$/.test(cleanToken) || !secret) return false;

            const key = this.decodeBase32(secret);
            const epoch = Math.floor(Date.now() / 1000);
            const timeStep = 30;
            const counter = Math.floor(epoch / timeStep);

            for (let i = -window; i <= window; i++) {
                const buffer = Buffer.alloc(8);
                const currentCounter = counter + i;
                buffer.writeUInt32BE(0, 0);
                buffer.writeUInt32BE(currentCounter >>> 0, 4);

                const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
                const offset = hmac[hmac.length - 1] & 0xf;
                const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);

                if ((code % 1000000).toString().padStart(6, '0') === cleanToken) return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    }

    static async register(req, res) {
        try {
            const data = this.validateCredentials(req.body || {});

            return await DatabaseRepository.transaction(async (db) => {
                const username = this.normalizeUsername(data.username);
                if (db.users.some(u => this.normalizeUsername(u.username) === username)) {
                    throw new Error('Usuário já existe.');
                }

                const passwordSalt = crypto.randomBytes(16).toString('hex');
                const passwordHash = crypto.scryptSync(data.password, passwordSalt, 64).toString('hex');
                const pinSalt = crypto.randomBytes(16).toString('hex');
                const pinHash = crypto.scryptSync(data.pin, pinSalt, 64).toString('hex');

                db.users.push({
                    id: crypto.randomUUID(),
                    name: data.name,
                    username,
                    password: passwordHash,
                    passwordSalt,
                    pin: pinHash,
                    pinSalt,
                    balance: 1000.0,
                    twoFactorEnabled: false,
                    twoFactorSecret: null,
                    lastLogin: null
                });

                return res.status(201).json({ message: 'Conta criada com sucesso!' });
            });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async login(req, res) {
        try {
            const username = this.normalizeUsername(req.body?.username);
            const password = this.sanitizeText(req.body?.password);
            const totpCode = this.sanitizeText(req.body?.totpCode);

            if (!username || !password) return res.status(400).json({ error: 'Credenciais inválidas.' });

            const db = await DatabaseRepository.readData();
            const user = db.users.find(u => this.normalizeUsername(u.username) === username);
            if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });

            const inputPasswordHash = crypto.scryptSync(password, user.passwordSalt, 64).toString('hex');
            const storedPassword = Buffer.from(user.password, 'hex');
            const providedPassword = Buffer.from(inputPasswordHash, 'hex');

            if (storedPassword.length !== providedPassword.length || !crypto.timingSafeEqual(storedPassword, providedPassword)) {
                return res.status(401).json({ error: 'Credenciais inválidas.' });
            }

            if (user.twoFactorEnabled) {
                if (!totpCode) return res.status(401).json({ error: 'REQUIRE_2FA' });
                if (!AuthController.verifyTOTP(totpCode, user.twoFactorSecret)) {
                    return res.status(401).json({ error: 'Código 2FA incorreto.' });
                }
            }

            user.lastLogin = { date: new Date().toISOString(), ip: req.ip };
            await DatabaseRepository.writeData(db);

            const token = TokenSigner.sign({ id: user.id, username: user.username });
            return res.json({ message: 'Login sucesso!', token });
        } catch (error) {
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }

    static async me(req, res) {
        try {
            const db = await DatabaseRepository.readData();
            const user = db.users.find(u => u.id === req.user.id);
            if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

            const usersList = db.users.map(u => ({ id: u.id, name: u.name }));
            return res.json({
                id: user.id,
                name: user.name,
                username: user.username,
                balance: user.balance,
                lastLogin: user.lastLogin,
                twoFactorEnabled: user.twoFactorEnabled,
                usersList
            });
        } catch (error) {
            return res.status(500).json({ error: 'Erro interno.' });
        }
    }

    static async setup2FA(req, res) {
        const db = await DatabaseRepository.readData();
        const user = db.users.find(u => u.id === req.user.id);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const secretBuffer = crypto.randomBytes(20);
        const secretBase32 = AuthController.encodeBase32(secretBuffer);
        user.twoFactorSecret = secretBase32;
        await DatabaseRepository.writeData(db);
        const otpauthUrl = `otpauth://totp/AegisPay:${user.username}?secret=${secretBase32}&issuer=AegisPay`;
        return res.json({
            secret: secretBase32,
            qrCodeImageUrl: `https://quickchart.io/qr?text=${encodeURIComponent(otpauthUrl)}&size=200`
        });
    }

    static async verify2FASetup(req, res) {
        const db = await DatabaseRepository.readData();
        const user = db.users.find(u => u.id === req.user.id);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const code = this.sanitizeText(req.body?.totpCode);
        if (!AuthController.verifyTOTP(code, user.twoFactorSecret)) {
            return res.status(400).json({ error: 'Código inválido.' });
        }

        user.twoFactorEnabled = true;
        await DatabaseRepository.writeData(db);
        return res.json({ message: '2FA ativado!' });
    }
}
module.exports = AuthController;