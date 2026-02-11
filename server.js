const http = require('http');
const mysql = require('mysql2/promise');
const config = require('./config'); // Your DB credentials

// The table creation query (Required: ENGINE=InnoDB)
const createTableQuery = `
CREATE TABLE IF NOT EXISTS patient (
    patientid INT(11) AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    dateOfBirth DATETIME
) ENGINE=InnoDB;
`;

// Bulk insert for the 4 required patients
const insertPatientsQuery = `
INSERT INTO patient (name, dateOfBirth) VALUES 
('Sara Brown', '1901-01-01'),
('John Smith', '1941-01-01'),
('Jack Ma', '1961-01-30'),
('Elon Musk Jr.', '1999-01-01');
`;

/**
 * Security check
 * @param {a sql query} sql 
 * @returns boolean True = safe
 */
function isQuerySafe(sql) {
  const forbidden = ['DROP', 'DELETE', 'UPDATE', 'CREATE', 'ALTER', 'TRUNCATE'];
  const upperSQL = decodeURIComponent(sql).toUpperCase().trim();

  // Only allow queries starting with SELECT
  if (!upperSQL.startsWith('SELECT')) return false;

  // Ensure no forbidden words exist anywhere in the string
  return !forbidden.some((word) => upperSQL.includes(word));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname.includes('/api/v1/sql/')) {
    const rawQuery = url.pathname.split('/api/v1/sql/')[1];

    if (!isQuerySafe(rawQuery)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'Permission Denied: Only SELECT allowed.' }),
      );
      return;
    }

    if (req.method === 'POST' && url.pathname.includes('/insert')) {
      let connection;
      try {
        // Connect to the DB
        connection = await mysql.createConnection(dbConfig);

        // Ensure table exists (Requirement: check every time)
        await connection.query(createTableQuery);

        // Step 2: Insert the 4 rows
        await connection.query(insertPatientsQuery);

        // 4. Send success response back to Server 1
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message:
              'Table checked/created and 4 patients inserted successfully!',
          }),
        );
      } catch (err) {
        // Handle errors (e.g., DB connection failure)
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      } finally {
        if (connection) await connection.end();
      }
    }

    // Proceed to DB query...
    try {
      // Connect to the database
      const connection = await mysql.createConnection(dbConfig);

      // Execute the query
      const [rows] = await connection.execute(sqlQuery);

      // Close connection and return results
      await connection.end();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
    } catch (err) {
      // Handle database-level errors (like syntax errors in the SQL)
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
});

server.listen(8080);
