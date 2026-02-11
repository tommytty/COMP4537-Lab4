const http = require('http');
const mysql = require('mysql2/promise');
const dbConfig = require('./config');

const createTableQuery = `
CREATE TABLE IF NOT EXISTS patient (
    patientid INT(11) AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    dateOfBirth DATETIME
) ENGINE=InnoDB;`;

const insertPatientsQuery = `
INSERT INTO patient (name, dateOfBirth) VALUES 
('Sara Brown', '1901-01-01'),
('John Smith', '1941-01-01'),
('Jack Ma', '1961-01-30'),
('Elon Musk Jr.', '1999-01-01');`;

function isQuerySafe(sql) {
  if (!sql) return false;
  const forbidden = ['DROP', 'DELETE', 'UPDATE', 'CREATE', 'ALTER', 'TRUNCATE'];
  const decoded = decodeURIComponent(sql).toUpperCase().trim();
  if (!decoded.startsWith('SELECT')) return false;
  return !forbidden.some((word) => decoded.includes(word));
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // --- HANDLE POST (INSERT) ---
  if (req.method === 'POST' && url.pathname.includes('/insert')) {
    let connection;
    try {
      // Use ADMIN credentials for table creation and insertion
      connection = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.adminUser,
        password: dbConfig.adminPass,
        database: dbConfig.database,
        port: dbConfig.dbPort || 3306,
      });

      await connection.query(createTableQuery);
      await connection.query(insertPatientsQuery);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: 'Table checked/created and 4 patients inserted!',
        }),
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } finally {
      if (connection) await connection.end();
    }
    return;
  }

  // --- HANDLE GET (SELECT) ---
  if (req.method === 'GET' && url.pathname.includes('/api/v1/sql/')) {
    const rawQuery = url.pathname.split('/api/v1/sql/')[1];

    if (!isQuerySafe(rawQuery)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'Permission Denied: Only SELECT allowed.' }),
      );
      return;
    }

    let connection;
    try {
      const sqlQuery = decodeURIComponent(rawQuery);
      // Use RESTRICTED credentials for user-submitted queries
      connection = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.readerUser,
        password: dbConfig.readerPass,
        database: dbConfig.database,
        port: dbConfig.dbPort || 3306,
      });

      const [rows] = await connection.execute(sqlQuery);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } finally {
      if (connection) await connection.end();
    }
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// FIXED PORT: Don't use 3306 as a fallback for the web server!
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server 2 is live on port ${PORT}`);
});

const gracefulShutdown = async () => {
  console.log('\nShutting down...');
  server.close(() => {
    process.exit(0);
  });
};
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
