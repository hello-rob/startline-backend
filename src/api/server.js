// src/api/server.js
const express   = require('express');
const cors      = require('cors');
const { getDb } = require('../db');

const app = express();
app.use(cors());
app.use(express.json());

async function db() { return getDb(); }

// Yesterday's date string — includes today's events safely
function cutoffDate() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

app.get('/api/health', async (req, res) => {
  try {
    const d      = await db();
    const cutoff = cutoffDate();
    const active = d.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'active'").get({});
    const future = d.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'active' AND (start_date IS NULL OR start_date >= @cutoff)").get({ cutoff });
    const cursor = d.prepare('SELECT MAX(last_synced) as last FROM feed_cursors').get({});
    res.json({ status: 'ok', activeEvents: active.c, futureEvents: future.c, lastHarvest: cursor ? cursor.last : null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const d = await db();
    const {
      lat, lng, radius = 40,
      activity,
      sort   = 'date',
      limit  = 50,
      offset = 0
    } = req.query;

    const maxLimit = Math.min(parseInt(limit) || 50, 200);
    const cutoff   = cutoffDate();
    const params   = { cutoff };

    var conditions = [
      "status = 'active'",
      "(start_date IS NULL OR start_date >= @cutoff)"
    ];

    if (activity && activity !== 'all') {
      conditions.push('activity = @activity');
      params.activity = activity;
    }

    if (lat && lng && radius !== 'all') {
      var latNum = parseFloat(lat);
      var lngNum = parseFloat(lng);
      var r      = parseFloat(radius);
      var latD   = r / 111;
      var lngD   = r / (111 * Math.cos(latNum * Math.PI / 180));
      params.latMin = latNum - latD; params.latMax = latNum + latD;
      params.lngMin = lngNum - lngD; params.lngMax = lngNum + lngD;
      conditions.push('(lat IS NULL OR lng IS NULL OR (lat BETWEEN @latMin AND @latMax AND lng BETWEEN @lngMin AND @lngMax))');
    }

    var where   = conditions.join(' AND ');
    var orderBy = sort === 'price'
      ? 'CASE WHEN price IS NULL THEN 1 ELSE 0 END, price ASC, CASE WHEN start_date IS NULL THEN 1 ELSE 0 END, start_date ASC'
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
    const d      = await db();
    const cutoff = cutoffDate();
    const rows   = d.prepare(
      "SELECT activity, COUNT(*) as count FROM events " +
      "WHERE status = 'active' AND (start_date IS NULL OR start_date >= @cutoff) " +
      "GROUP BY activity ORDER BY count DESC"
    ).all({ cutoff });
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
    ).run({ name, sport, event_date, location, price, spaces, reg_link, description });
    res.status(201).json({ message: 'Event submitted for review' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
