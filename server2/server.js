const http = require("http");
const mysql = require("mysql2/promise");
const { URL } = require("url");

// =======================
// CONFIG (use env vars)
// =======================
const PORT = process.env.PORT || 3001;

// IMPORTANT: set this to your Server1 origin (Netlify/Vercel/GitHub Pages URL)
// For local testing you can keep * (but for deployment, set the real origin)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

// Railway public proxy host/port:
const DB_HOST = process.env.DB_HOST || "maglev.proxy.rlwy.net";
const DB_PORT = Number(process.env.DB_PORT || 30731);

// Write user (table create + inserts)
const DB_WRITE_USER = process.env.DB_WRITE_USER || "root";
const DB_WRITE_PASS = process.env.DB_WRITE_PASS || "";
const DB_NAME = process.env.DB_NAME || "railway";

// Read-only user (SELECT only)
const DB_READ_USER = process.env.DB_READ_USER || "readonly_user";
const DB_READ_PASS = process.env.DB_READ_PASS || "";

// Railway typically needs TLS on public proxy
const DB_SSL = { rejectUnauthorized: false };

// Your lab’s fixed insert rows:
const SEED_ROWS = [
  ["Sara Brown", "1901-01-01"],
  ["John Smith", "1941-01-01"],
  ["Jack Ma", "1961-01-30"],
  ["Elon Musk", "1999-01-01"],
];

// =======================
// DB helpers
// =======================
async function getWriteConn() {
  return mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_WRITE_USER,
    password: DB_WRITE_PASS,
    database: DB_NAME,
    ssl: DB_SSL,
  });
}

async function getReadConn() {
  return mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_READ_USER,
    password: DB_READ_PASS,
    database: DB_NAME,
    ssl: DB_SSL,
  });
}

// Creates table if it doesn't exist (Engine=InnoDB)
async function ensurePatientTableExists(conn) {
  const createSql = `
    CREATE TABLE IF NOT EXISTS patient (
      patientid INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      dateOfBirth DATETIME NOT NULL,
      PRIMARY KEY (patientid)
    ) ENGINE=InnoDB;
  `;
  await conn.execute(createSql);
}

// =======================
// HTTP helpers
// =======================
function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain" });
  res.end(text);
}

function setCors(res, req) {
  // If you set ALLOWED_ORIGIN to a specific origin, reflect it.
  // If it's "*", just use "*".
  const origin = req.headers.origin;
  const allow =
    ALLOWED_ORIGIN === "*"
      ? "*"
      : origin && origin === ALLOWED_ORIGIN
        ? origin
        : ALLOWED_ORIGIN;

  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// Basic SQL safety: allow SELECT only
function isSelectOnly(sql) {
  const s = sql.trim().toLowerCase();

  // Must start with select
  if (!s.startsWith("select")) return false;

  // Block common write/ddl keywords anywhere
  const blocked = [
    "insert",
    "update",
    "delete",
    "drop",
    "create",
    "alter",
    "truncate",
    "replace",
    "grant",
    "revoke",
    "set ",
    "call",
    "exec",
    "execute",
    "prepare",
  ];

  return !blocked.some((kw) => s.includes(kw));
}

// =======================
// Server routes
// =======================
const server = http.createServer(async (req, res) => {
  setCors(res, req);

  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // Health
    if (req.method === "GET" && path === "/") {
      return sendText(res, 200, "Server2 is running");
    }

    // POST /insert
    if (req.method === "POST" && path === "/insert") {
      const conn = await getWriteConn();
      try {
        await ensurePatientTableExists(conn);

        // Bulk insert
        const [result] = await conn.query(
          "INSERT INTO patient (name, dateOfBirth) VALUES ?",
          [SEED_ROWS]
        );

        return sendJson(res, 200, {
          ok: true,
          message: "Inserted 4 rows",
          insertedRows: result.affectedRows,
        });
      } finally {
        await conn.end();
      }
    }

    // GET /api/v1/sql/<encoded sql>
    // Your client already calls this format :contentReference[oaicite:1]{index=1}
    if (req.method === "GET" && path.startsWith("/api/v1/sql/")) {
      const encoded = path.slice("/api/v1/sql/".length);
      const sql = decodeURIComponent(encoded);

      if (!isSelectOnly(sql)) {
        return sendJson(res, 403, {
          ok: false,
          error: "Only SELECT queries are allowed.",
        });
      }

      const conn = await getReadConn();
      try {
        // Note: read-only DB user should enforce least privilege too
        const [rows] = await conn.query(sql);
        return sendJson(res, 200, { ok: true, rows });
      } finally {
        await conn.end();
      }
    }

    // Not found
    return sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { ok: false, error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  console.log(`Server2 running on http://localhost:${PORT}`);
  console.log(`DB proxy: ${DB_HOST}:${DB_PORT}`);
});
