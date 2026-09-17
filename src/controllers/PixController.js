const PixService = require('../services/PixService');

class PixController {
    static async sendPix(req, res) {
        try {
            const { recipientId, amount, pin } = req.body;
            const result = await PixService.sendPix(req.user.id, recipientId, amount, pin);
            return res.json(result);
        } catch (error) { return res.status(400).json({ error: error.message }); }
    }

    static async getHistory(req, res) {
        try {
            const history = await PixService.getHistory(req.user.id);
            return res.json(history);
        } catch (error) { return res.status(500).json({ error: "Erro interno." }); }
    }
}
module.exports = PixController;