// backend/db.js
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

let db;

async function initDB() {
  db = await open({
    filename: "./notifications.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS followers (
      follower_id TEXT,
      following_id TEXT,
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS likes (
      post_id INTEGER,
      user_id TEXT,
      liked BOOLEAN,
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT,
      recipient_id TEXT,
      type TEXT,
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read BOOLEAN DEFAULT 0
    );
  `);
}

module.exports = {
  initDB,
  run: (...args) => db.run(...args),
  all: (...args) => db.all(...args),
  get: (...args) => db.get(...args),
};
