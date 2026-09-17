const fs = require('fs').promises;
const path = require('path');

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const DB_PATH = path.join(DB_DIR, 'database.json');
const TEMP_PATH = path.join(DB_DIR, 'database.temp.json');

class DatabaseRepository {
    static _queue = Promise.resolve();

    static async _ensureDir() {
        await fs.mkdir(DB_DIR, { recursive: true });
    }

    static async _readRaw() {
        try {
            await this._ensureDir();
            const data = await fs.readFile(DB_PATH, 'utf8');
            return JSON.parse(data);
        } catch (e) {
            if (e.code === 'ENOENT') return { users: [], transactions: [] };
            throw e;
        }
    }

    static async _writeRaw(data) {
        await this._ensureDir();
        const json = JSON.stringify(data, null, 2);
        await fs.writeFile(TEMP_PATH, json, { encoding: 'utf8', mode: 0o600 });
        await fs.rename(TEMP_PATH, DB_PATH);
        await fs.chmod(DB_PATH, 0o600);
    }

    static async readData() { return this._readRaw(); }

    static async transaction(work) {
        const result = this._queue.then(async () => {
            const db = await this._readRaw();
            const output = await work(db);
            await this._writeRaw(db);
            return output;
        });
        this._queue = result.catch(() => {});
        return result;
    }

    static async writeData(data) {
        const result = this._queue.then(async () => {
            await this._writeRaw(data);
        });
        this._queue = result.catch(() => {});
        return result;
    }
}
module.exports = DatabaseRepository;