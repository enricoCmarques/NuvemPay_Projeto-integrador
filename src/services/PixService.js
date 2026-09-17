const crypto = require('crypto');
const DatabaseRepository = require('../repositories/DatabaseRepository');

class PixService {
    static getSecret() {
        const secret = process.env.AEGIS_SECRET || 'dev-secret-change-me';
        if (!process.env.AEGIS_SECRET) {
            console.warn('AEGIS_SECRET não configurada. Usando valor de desenvolvimento inseguro para assinatura de transações.');
        }
        return secret;
    }

    static generateTxSignature(tx) {
        const dataToHash = `${tx.senderId}|${tx.recipientId}|${tx.amount}|${tx.timestamp}|${tx.previousHash}`;
        return crypto.createHmac('sha256', this.getSecret()).update(dataToHash).digest('hex');
    }

    static async sendPix(senderId, recipientId, amount, pin) {
        return DatabaseRepository.transaction(async (db) => {
            const senderUser = db.users.find(u => u.id === senderId);
            const recipientUser = db.users.find(u => u.id === recipientId);

            if (!senderUser || !recipientUser) throw new Error('Usuário não encontrado.');
            if (senderId === recipientId) throw new Error('Operação inválida.');

            if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
                throw new Error('Valor da transação inválido.');
            }
            if (senderUser.balance < amount) throw new Error('Saldo insuficiente.');

            const trimmedPin = String(pin || '').trim();
            if (trimmedPin.length < 4 || trimmedPin.length > 6 || !/^\d+$/.test(trimmedPin)) {
                throw new Error('PIN inválido.');
            }

            const inputPinHash = crypto.scryptSync(trimmedPin, senderUser.pinSalt, 64).toString('hex');
            const storedPin = Buffer.from(senderUser.pin, 'hex');
            const providedPin = Buffer.from(inputPinHash, 'hex');
            if (storedPin.length !== providedPin.length || !crypto.timingSafeEqual(storedPin, providedPin)) {
                throw new Error('PIN incorreto.');
            }

            const lastTx = db.transactions[db.transactions.length - 1];
            const previousHash = lastTx ? lastTx.signature : 'GENESIS_BLOCK_0000000000000000000000000000000000';

            const newTx = {
                id: crypto.randomUUID(),
                senderId,
                recipientId,
                amount,
                timestamp: new Date().toISOString(),
                previousHash
            };
            newTx.signature = this.generateTxSignature(newTx);

            senderUser.balance -= amount;
            recipientUser.balance += amount;
            db.transactions.push(newTx);

            return { message: 'Pix realizado com sucesso!', newBalance: senderUser.balance };
        });
    }

    static async getHistory(userId) {
        const db = await DatabaseRepository.readData();
        let expectedPrevHash = 'GENESIS_BLOCK_0000000000000000000000000000000000';

        const auditedTransactions = db.transactions.map((tx) => {
            const expectedSignature = this.generateTxSignature(tx);
            const isTxValid = tx.signature === expectedSignature && tx.previousHash === expectedPrevHash;
            expectedPrevHash = tx.signature;
            return { ...tx, isValid: isTxValid };
        });

        return auditedTransactions.filter(tx => tx.senderId === userId || tx.recipientId === userId).reverse();
    }
}
module.exports = PixService;