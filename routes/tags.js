'use strict';

const express = require('express');
const router  = express.Router();
const db      = require('../db');

// GET /api/tags — list all tags with note counts
router.get('/', (req, res) => {
  const tags = db.prepare(`
    SELECT t.id, t.name, COUNT(nt.note_id) AS note_count
    FROM tags t
    LEFT JOIN note_tags nt ON nt.tag_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `).all();
  res.json(tags);
});

module.exports = router;
