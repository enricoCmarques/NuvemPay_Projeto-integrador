const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const DB_PATH = path.join(DB_DIR, 'aegispay.sqlite');
const LEGACY_PATH = path.join(DB_DIR, 'database.json');

class DatabaseRepository {
    static _queue = Promise.resolve();
    static _db = null;

    static getDbPath() {
        return DB_PATH;
    }

    static async _ensureDir() {
        await fs.mkdir(DB_DIR, { recursive: true });
    }

    static async _openDatabase() {
        if (this._db) {
            return this._db;
        }

        await this._ensureDir();

        const db = await new Promise((resolve, reject) => {
            const connection = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(connection);
            });
        });

        this._db = db;
        return db;
    }

    static async _run(sql, params = []) {
        const db = await this._openDatabase();
        return new Promise((resolve, reject) => {
            db.run(sql, params, function onRun(err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({ changes: this.changes, lastID: this.lastID });
            });
        });
    }

    static async _get(sql, params = []) {
        const db = await this._openDatabase();
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(row);
            });
        });
    }

    static async _readLegacyJson() {
        try {
            const raw = await fs.readFile(LEGACY_PATH, 'utf8');
            return JSON.parse(raw);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }

            throw error;
        }
    }

    static async _normalizeState(data) {
        if (!data || typeof data !== 'object') {
            return { users: [], transactions: [] };
        }

        const normalized = { users: [], transactions: [] };
        if (Array.isArray(data.users)) normalized.users = data.users;
        if (Array.isArray(data.transactions)) normalized.transactions = data.transactions;
        return normalized;
    }

    static async init() {
        const db = await this._openDatabase();
        await this._run('CREATE TABLE IF NOT EXISTS app_data (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

        const existing = await this._get("SELECT value FROM app_data WHERE key = 'state'");
        if (!existing) {
            const legacy = await this._readLegacyJson();
            const state = legacy ? this._normalizeState(legacy) : { users: [], transactions: [] };

            await this._run(
                "INSERT INTO app_data (key, value) VALUES ('state', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [JSON.stringify(state, null, 2)]
            );
        }

        return db;
    }

    static async readData() {
        await this.init();
        const row = await this._get("SELECT value FROM app_data WHERE key = 'state'");

        if (!row) {
            const empty = { users: [], transactions: [] };
            await this.writeData(empty);
            return empty;
        }

        return this._normalizeState(JSON.parse(row.value));
    }

    static async transaction(work) {
        const result = this._queue.then(async () => {
            const db = await this.readData();
            const output = await work(db);
            await this._writeState(db);
            return output;
        });

        this._queue = result.catch(() => {});
        return result;
    }

    static async writeData(data) {
        const result = this._queue.then(async () => {
            await this._writeState(data);
        });

        this._queue = result.catch(() => {});
        return result;
    }

    static async _writeState(data) {
        const normalized = this._normalizeState(data);
        await this.init();
        await this._run(
            "INSERT INTO app_data (key, value) VALUES ('state', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [JSON.stringify(normalized, null, 2)]
        );
    }
}

module.exports = DatabaseRepository;