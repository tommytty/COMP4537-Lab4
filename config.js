// config.js
module.exports = {
  // Use Railway's internal variables for your production server
  host: process.env.MYSQLHOST || 'mysql.railway.internal',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'leGVMOvChJYwyoankrMWrxquSuTyWxMy',
  database: process.env.MYSQLDATABASE || 'patient',
  port: process.env.MYSQLPORT || 3306,
};

/**
 * For admin and user
  module.exports = {
  host: process.env.MYSQLHOST || 'localhost',
  database: process.env.MYSQLDATABASE || 'dbserver',
  adminUser: process.env.MYSQLUSER || 'root',
  adminPass: process.env.MYSQLPASSWORD || '',
  readerUser: process.env.MYSQLUSER || 'root',
  readerPass: process.env.MYSQLPASSWORD || '',
  dbPort: process.env.MYSQLPORT || 3306
};
 */