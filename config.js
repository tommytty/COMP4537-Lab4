// config.js
module.exports = {
  // Use Railway's internal variables for your production server
  host: process.env.MYSQLHOST || 'mysql.railway.internal',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'leGVMOvChJYwyoankrMWrxquSuTyWxMy',
  database: process.env.MYSQLDATABASE || 'patient',
  port: process.env.MYSQLPORT || 3306,
};
