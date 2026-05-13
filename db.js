'use strict';

// Import the shared db instance from std-platform (base schema already applied)
const db = require('./std-platform/db');

// Add project-specific tables here, e.g.:
// db.exec(`
//   CREATE TABLE IF NOT EXISTS widgets (
//     id         INTEGER PRIMARY KEY AUTOINCREMENT,
//     name       TEXT NOT NULL,
//     created_at TEXT NOT NULL DEFAULT (datetime('now'))
//   );
// `);

module.exports = db;
