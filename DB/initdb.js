// DB/initdb.js
const mysql = require('mysql2/promise');
const createTables = require('./createTables');
require('dotenv').config();

async function initDatabase() {
  try {
    // Connect directly to the existing database
    const db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT, // important!
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false }, // Filess.io remote DB often needs this
      connectTimeout: 15000
    });

    console.log(`✅ Connected to MySQL database: ${process.env.DB_NAME}`);

    // Only create tables if needed
    await createTables(db);

    await db.end();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

module.exports = initDatabase;
