const crypto = require('crypto');

function getSecret() {
    const secret = process.env.AEGIS_SECRET || 'dev-secret-change-me';
    if (!process.env.AEGIS_SECRET) {
        console.warn('AEGIS_SECRET não configurada. Usando valor de desenvolvimento inseguro. Defina uma variável de ambiente em produção.');
    }
    return secret;
}

function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
    return `${body}.${sig}`;
}

function verify(token) {
    if (typeof token !== 'string' || !token.includes('.')) {
        throw new Error('Formato de token inválido.');
    }

    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Formato de token inválido.');
    }

    const [body, sig] = parts;
    const expected = crypto.createHmac('sha256', getSecret()).update(body).digest('base64url');
    const a = Buffer.from(sig, 'base64url');
    const b = Buffer.from(expected, 'base64url');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        throw new Error('Assinatura inválida.');
    }

    return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
}

module.exports = { sign, verify };