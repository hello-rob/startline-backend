// src/api/server.js
const express   = require('express');
const cors      = require('cors');
const { getDb } = require('../db');

const app = express();
app.use(cors());
app.use(express.json());

async function db() { return getDb(); }

app.get('/api/health', async (req, res) => {
  try {
    const d      = await db();
    const active = d.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'active'").get({});
    const cursor = d.prepare('SELECT MAX(last_synced) as last FROM feed_cursors').get({});
    res.json({ status: 'ok', activeEvents: active.c, lastHarvest: cursor ? cursor.last : null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const d = await db();
    const { activity, sort = 'date', limit = 50, offset = 0 } = req.query;
    const maxLimit = Math.min(parseInt(limit) || 50, 200);

    var conditions = ["status = 'active'"];
    var params     = {};

    if (activity && activity !== 'all') {
      conditions.push('activity = @activity');
      params.activity = activity;
    }

    var where   = conditions.join(' AND ');
    var orderBy = sort === 'price'
      ? 'CASE WHEN price IS NULL THEN 1 ELSE 0 END, price ASC'
      : 'CASE WHEN start_date IS NULL THEN 1 ELSE 0 END, start_date ASC';

    var events = d.prepare(
      'SELECT id, name, activity, start_date, end_date, ' +
      'location_name, city, postcode, lat, lng, ' +
      'price, price_currency, url, organiser_name, ' +
      'max_attendees, remaining_spots, source_feed, status ' +
      'FROM events WHERE ' + where + ' ' +
      'ORDER BY ' + orderBy + ' ' +
      'LIMIT @limit OFFSET @offset'
    ).all(Object.assign({}, params, { limit: maxLimit, offset: parseInt(offset) }));

    var countRow = d.prepare('SELECT COUNT(*) as total FROM events WHERE ' + where).get(params);

    res.json({ total: countRow.total, limit: maxLimit, offset: parseInt(offset), events: events });
  } catch (err) {
    console.error('GET /api/events error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const d     = await db();
    const event = d.prepare('SELECT * FROM events WHERE id = @id').get({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const d    = await db();
    const rows = d.prepare(
      "SELECT activity, COUNT(*) as count FROM events WHERE status = 'active' GROUP BY activity ORDER BY count DESC"
    ).all({});
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/submit', async (req, res) => {
  try {
    const d = await db();
    const { name, sport, event_date, location, price, spaces, reg_link, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Event name is required' });
    d.prepare(
      'INSERT INTO submitted_events (name, sport, event_date, location, price, spaces, reg_link, description) ' +
      'VALUES (@name, @sport, @event_date, @location, @price, @spaces, @reg_link, @description)'
    ).run({ name: name, sport: sport, event_date: event_date, location: location, price: price, spaces: spaces, reg_link: reg_link, description: description });
    res.status(201).json({ message: 'Event submitted for review' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
