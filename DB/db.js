// DB/db.js
const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "Blish123456789@",
  database: process.env.DB_NAME || "powerkey_erp",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: "+00:00",
  dateStrings: true,
  connectTimeout: 1800000
});


pool.on('connection', (connection) => {
  console.log('DB Connection established');
});

pool.on('acquire', (connection) => {
  console.log('DB Connection acquired');
});

pool.on('release', (connection) => {
  console.log('DB Connection released');
});

pool.on('enqueue', () => {
  console.log('DB Connection enqueued (pool exhausted?)');
});

module.exports = pool;

