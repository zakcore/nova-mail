// mysql2 connection pool, all dates in UTC.
const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: config.db.ssl ? { rejectUnauthorized: true } : undefined,
  timezone: 'Z',
  charset: 'utf8mb4',
  connectionLimit: 10,
  // BIGINT ids and COUNT(*) as JS numbers (values stay far below 2^53)
  supportBigNumbers: true,
  bigNumberStrings: false,
});

pool.pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+00:00'");
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// Runs fn(conn) inside a transaction: commit on success, rollback on error, always release.
async function transaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function close() {
  return pool.end();
}

module.exports = { pool, query, transaction, close };
