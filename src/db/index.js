// src/db/index.js
// SQLite via sql.js — pure JavaScript, no native compilation needed.
// Persists to disk by loading/saving the database file manually.

const initSqlJs = require('sql.js');
const path = require('path');
const fs   = require('fs');

const DB_PATH = process.env.DB_PATH
  || path.join(__dirname, '..', '..', 'data', 'startline.db');

let _db   = null;
let _SQL  = null;

async function getDb() {
  if (_db) return _db;

  _SQL = await initSqlJs();

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new _SQL.Database(fileBuffer);
  } else {
    _db = new _SQL.Database();
  }

  // Wrap sql.js API to match better-sqlite3's synchronous interface
  // so the rest of the codebase doesn't need changing.
  _db._prepare = _db.prepare.bind(_db);

  // Persist to disk after every write
  _db._save = () => {
    const data = _db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  };

  // Thin compatibility layer: prepare(sql).all(params) / .get(params) / .run(params)
  _db.prepare = (sql) => {
    return {
      all: (params = {}) => {
        const results = [];
        const stmt = _db._prepare(sql);
        stmt.bind(toSqlJsParams(params));
        while (stmt.step()) results.push(stmt.getAsObject());
        stmt.free();
        return results;
      },
      get: (params = {}) => {
        const stmt = _db._prepare(sql);
        stmt.bind(toSqlJsParams(params));
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row;
      },
      run: (params = {}) => {
        _db.run(sql, toSqlJsParams(params));
        _db._save();
        return { changes: _db.getRowsModified() };
      },
    };
  };

  // Transaction helper — runs callback then saves once
  _db.transaction = (fn) => (items) => {
    _db.run('BEGIN');
    try {
      fn(items);
      _db.run('COMMIT');
    } catch (e) {
      _db.run('ROLLBACK');
      throw e;
    }
    _db._save();
  };

  _db.exec = (sql) => {
    _db.run(sql);
    _db._save();
  };

  return _db;
}

// sql.js wants named params as { ':name': value } or positional as [value]
function toSqlJsParams(params) {
  if (Array.isArray(params)) return params;
  if (!params || typeof params !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k.startsWith('@') || k.startsWith(':') || k.startsWith('$') ? k : `@${k}`] = v;
  }
  return out;
}

module.exports = { getDb, DB_PATH };
