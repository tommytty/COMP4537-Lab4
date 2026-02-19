/**
 * server.js — Server2 HTTP API
 * Lab 5: Patient DB
 *
 * Attribution: Initial DB connection logic assisted by ChatGPT (OpenAI);
 * substantially revised and restructured by the development team.
 *
 * Architecture:
 *   Config          — centralises all environment-derived constants (top of file)
 *   DatabaseService — owns connection factories and the table-bootstrap query
 *   SqlGuard        — validates that submitted SQL is SELECT-only
 *   ResponseHelper  — stateless helpers for writing HTTP responses + CORS headers
 *   Router          — matches method + path to handler functions
 *   Server          — composes all classes and starts the HTTP server
 */

'use strict';

const http = require('http');
const mysql = require('mysql2/promise');
const { URL } = require('url');

/* ─── Config ─────────────────────────────────────────────────────────────── */

/**
 * All runtime configuration sourced from environment variables.
 * Fallbacks are provided for local development only —
 * production deployments must set real env vars.
 */
const Config = Object.freeze({
  PORT: process.env.PORT || 3001,
  ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || '*',

  DB_HOST: process.env.DB_HOST || 'maglev.proxy.rlwy.net',
  DB_PORT: Number(process.env.DB_PORT || 30731),
  DB_NAME: process.env.DB_NAME || 'railway',

  DB_WRITE_USER: process.env.DB_WRITE_USER || 'root',
  DB_WRITE_PASS: process.env.DB_WRITE_PASS || '',

  DB_READ_USER: process.env.DB_READ_USER || 'readonly_user',
  DB_READ_PASS: process.env.DB_READ_PASS || '',

  DB_SSL: { rejectUnauthorized: false },

  /** Rows inserted on every POST /insert request. */
  SEED_ROWS: [
    ['Sara Brown', '1901-01-01'],
    ['John Smith', '1941-01-01'],
    ['Jack Ma', '1961-01-30'],
    ['Elon Musk', '1999-01-01'],
  ],

  /** DDL keyword blocklist used by SqlGuard (defence-in-depth layer). */
  BLOCKED_SQL_KEYWORDS: Object.freeze([
    'insert',
    'update',
    'delete',
    'drop',
    'create',
    'alter',
    'truncate',
    'replace',
    'grant',
    'revoke',
    'set ',
    'call',
    'exec',
    'execute',
    'prepare',
  ]),
});

/* ─── DatabaseService ────────────────────────────────────────────────────── */

/**
 * Owns all database concerns:
 *   - Creating write and read-only connections
 *   - Bootstrapping the patient table (CREATE IF NOT EXISTS)
 *   - Inserting seed rows
 *   - Running arbitrary (pre-validated) SELECT queries
 *
 * Connections are opened per-request and closed in a finally block so that
 * no connection is ever leaked even when an error is thrown mid-query.
 */
class DatabaseService {
  constructor() {
    this._baseConfig = {
      host: Config.DB_HOST,
      port: Config.DB_PORT,
      database: Config.DB_NAME,
      ssl: Config.DB_SSL,
    };
  }

  /**
   * Opens a connection authenticated as the privileged write user.
   * @returns {Promise<mysql.Connection>}
   */
  async _openWriteConnection() {
    return mysql.createConnection({
      ...this._baseConfig,
      user: Config.DB_WRITE_USER,
      password: Config.DB_WRITE_PASS,
    });
  }

  /**
   * Opens a connection authenticated as the restricted read-only user.
   * This user has SELECT privileges only — enforced at the DB-user level.
   * @returns {Promise<mysql.Connection>}
   */
  async _openReadConnection() {
    return mysql.createConnection({
      ...this._baseConfig,
      user: Config.DB_READ_USER,
      password: Config.DB_READ_PASS,
    });
  }

  /**
   * Creates the patient table if it does not already exist.
   * Called before every insert operation per the lab specification.
   * @param {mysql.Connection} conn - An open write connection.
   */
  async _ensurePatientTable(conn) {
    const ddl = `
      CREATE TABLE IF NOT EXISTS patient (
        patientid   INT(11)      NOT NULL AUTO_INCREMENT,
        name        VARCHAR(100) NOT NULL,
        dateOfBirth DATETIME     NOT NULL,
        PRIMARY KEY (patientid)
      ) ENGINE=InnoDB;
    `;
    await conn.execute(ddl);
  }

  /**
   * Ensures the patient table exists then bulk-inserts all seed rows.
   * @returns {Promise<{affectedRows: number}>}
   */
  async insertSeedRows() {
    const conn = await this._openWriteConnection();
    try {
      await this._ensurePatientTable(conn);
      const [result] = await conn.query(
        'INSERT INTO patient (name, dateOfBirth) VALUES ?',
        [Config.SEED_ROWS],
      );
      return { affectedRows: result.affectedRows };
    } finally {
      await conn.end();
    }
  }

  /**
   * Executes a pre-validated SELECT query using the read-only user.
   * @param {string} sql - A validated SELECT-only SQL string.
   * @returns {Promise<object[]>} Array of result rows.
   */
  async runSelectQuery(sql) {
    const conn = await this._openReadConnection();
    try {
      const [rows] = await conn.query(sql);
      return rows;
    } finally {
      await conn.end();
    }
  }
}

/* ─── SqlGuard ───────────────────────────────────────────────────────────── */

/**
 * Provides a defence-in-depth validation layer on top of the DB-user
 * privilege restrictions. Even if DB user permissions were misconfigured,
 * this guard prevents non-SELECT statements from being forwarded at all.
 *
 * NOTE: Database-user privilege restriction (least-privilege principle)
 * is the PRIMARY security control. This class is a secondary safeguard only.
 */
class SqlGuard {
  /**
   * Returns true only if the SQL string starts with SELECT and contains
   * none of the blocked DDL/DML keywords.
   * @param {string} sql
   * @returns {boolean}
   */
  static isSelectOnly(sql) {
    const normalised = sql.trim().toLowerCase();

    if (!normalised.startsWith('select')) return false;

    return !Config.BLOCKED_SQL_KEYWORDS.some((keyword) =>
      normalised.includes(keyword),
    );
  }
}

/* ─── ResponseHelper ─────────────────────────────────────────────────────── */

/**
 * Stateless helpers for writing HTTP responses and CORS headers.
 * Kept as static methods so no instance is needed.
 */
class ResponseHelper {
  /**
   * Writes CORS headers onto the response.
   * Reflects the request Origin when ALLOWED_ORIGIN is a specific domain,
   * otherwise falls back to the wildcard value in Config.
   * @param {http.ServerResponse} res
   * @param {http.IncomingMessage} req
   */
  static setCorsHeaders(res, req) {
    const requestOrigin = req.headers.origin;
    const allowed =
      Config.ALLOWED_ORIGIN === '*'
        ? '*'
        : requestOrigin && requestOrigin === Config.ALLOWED_ORIGIN
          ? requestOrigin
          : Config.ALLOWED_ORIGIN;

    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  /**
   * Serialises obj to JSON and writes it with correct Content-Length.
   * @param {http.ServerResponse} res
   * @param {number} statusCode
   * @param {object} obj
   */
  static sendJson(res, statusCode, obj) {
    const body = JSON.stringify(obj, null, 2);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    });
    res.end(body);
  }

  /**
   * Writes a plain-text response.
   * @param {http.ServerResponse} res
   * @param {number} statusCode
   * @param {string} text
   */
  static sendText(res, statusCode, text) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(text);
  }
}

/* ─── Router ─────────────────────────────────────────────────────────────── */

/**
 * Matches incoming requests by method and path, then delegates to the
 * appropriate handler. Each handler is a standalone async method.
 *
 * No external routing library is used per lab requirements.
 */
class Router {
  /**
   * @param {DatabaseService} db - Injected data layer.
   */
  constructor(db) {
    this._db = db;
  }

  /**
   * Main dispatch entry point — called once per request.
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse}  res
   */
  async dispatch(req, res) {
    ResponseHelper.setCorsHeaders(res, req);

    // Preflight — respond immediately, no further processing needed.
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    try {
      if (req.method === 'GET' && pathname === '/') {
        return this._handleHealth(res);
      }

      if (req.method === 'POST' && pathname === '/insert') {
        return await this._handleInsert(res);
      }

      if (req.method === 'GET' && pathname.startsWith('/api/v1/sql/')) {
        return await this._handleSqlQuery(req, res, pathname);
      }

      ResponseHelper.sendJson(res, 404, {
        ok: false,
        error: 'Route not found.',
      });
    } catch (err) {
      console.error('[Server error]', err);
      ResponseHelper.sendJson(res, 500, {
        ok: false,
        error: err.message ?? String(err),
      });
    }
  }

  /* ── Individual Route Handlers ── */

  /**
   * GET / — health check endpoint.
   * @param {http.ServerResponse} res
   */
  _handleHealth(res) {
    ResponseHelper.sendText(res, 200, 'Server2 is running.');
  }

  /**
   * POST /insert — ensures the patient table exists then inserts seed rows.
   * @param {http.ServerResponse} res
   */
  async _handleInsert(res) {
    const { affectedRows } = await this._db.insertSeedRows();
    ResponseHelper.sendJson(res, 200, {
      ok: true,
      message: `Inserted ${affectedRows} rows.`,
      affectedRows,
    });
  }

  /**
   * GET /api/v1/sql/<encoded-sql> — runs a validated SELECT-only query
   * through the read-only database user.
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse}  res
   * @param {string}               pathname
   */
  async _handleSqlQuery(req, res, pathname) {
    const encoded = pathname.slice('/api/v1/sql/'.length);
    const sql = decodeURIComponent(encoded);

    if (!SqlGuard.isSelectOnly(sql)) {
      return ResponseHelper.sendJson(res, 403, {
        ok: false,
        error: 'Only SELECT queries are permitted.',
      });
    }

    const rows = await this._db.runSelectQuery(sql);
    ResponseHelper.sendJson(res, 200, { ok: true, rows });
  }
}

/* ─── Server ─────────────────────────────────────────────────────────────── */

/**
 * Composes all application layers and starts the HTTP server.
 */
class Server {
  constructor() {
    this._db = new DatabaseService();
    this._router = new Router(this._db);
    this._server = http.createServer((req, res) =>
      this._router.dispatch(req, res),
    );
  }

  /** Binds the server to the configured port and logs startup info. */
  start() {
    this._server.listen(Config.PORT, () => {
      console.log(`[Server2] Listening on http://localhost:${Config.PORT}`);
      console.log(`[Server2] DB proxy: ${Config.DB_HOST}:${Config.DB_PORT}`);
    });
  }
}

/* ─── Bootstrap ──────────────────────────────────────────────────────────── */

const app = new Server();
app.start();
