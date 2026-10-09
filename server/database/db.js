'use strict';

const { Pool } = require('pg');

let pool = null;
let enabled = false;

async function initDatabase() {
  if (!process.env.DATABASE_URL) {
    enabled = false;
    return;
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    enabled = true;
  } finally {
    client.release();
  }
}

function isDatabaseEnabled() {
  return enabled;
}

function getPool() {
  if (!enabled || !pool) {
    const err = new Error('Database is not configured. Running in guest mode.');
    err.status = 503;
    throw err;
  }
  return pool;
}

async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

module.exports = { initDatabase, isDatabaseEnabled, getPool, query };
