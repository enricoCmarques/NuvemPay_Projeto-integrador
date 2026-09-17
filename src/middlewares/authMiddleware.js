const TokenSigner = require('../utils/tokenSigner');

module.exports = (req, res, next) => {
    const rawHeader = req.headers['authorization'];
    if (!rawHeader) {
        return res.status(401).json({ error: 'Token não fornecido.', expired: true });
    }

    try {
        const cleanToken = String(rawHeader).startsWith('Bearer ')
            ? String(rawHeader).replace('Bearer ', '').trim()
            : String(rawHeader).trim();

        if (!cleanToken) {
            throw new Error('Token vazio.');
        }

        req.user = TokenSigner.verify(cleanToken);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Sessão inválida ou adulterada.', expired: true });
    }
};