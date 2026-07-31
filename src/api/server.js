// src/api/server.js
const express   = require('express');
const cors      = require('cors');
const { getDb } = require('../db');

const app = express();
app.use(cors());
app.use(express.json());

// Helper — get db (async, cached after first call)
async function db() { return getDb(); }

// ── GET /api/health ────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const d = await db();
    const { count } = d.prepare(`SELECT COUNT(*) as count FROM events WHERE status = 'active'`).get({});
    const cursor    = d.prepare(`SELECT MAX(last_synced) as last FROM feed_cursors`).get({});
    res.json({ status: 'ok', activeEvents: count, lastHarvest: cursor?.last || null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ── GET /api/events ────────────────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  try {
    const d = await db();
    const {
      lat, lng, radius = 40, activity,
      from = new Date().toISOString(),
      to, free, sort = 'date', limit = 50, offset = 0,
    } = req.query;

    const maxLimit = Math.min(parseInt(limit) || 50, 200);
    const toDate   = to || new Date(Date.now() + 180 * 86400000).toISOString();
    const params   = { from, to: toDate };

    let conditions = [`status = 'active'`, `start_date >= @from`, `start_date <= @to`];

    if (activity && activity !== 'all') {
      conditions.push(`activity = @activity`);
      params.activity = activity;
    }
    if (free === 'true') conditions.push(`price = 0`);

    if (lat && lng) {
      const latNum = parseFloat(lat), lngNum = parseFloat(lng), r = parseFloat(radius);
      const latD = r / 111;
      const lngD = r / (111 * Math.cos(latNum * Math.PI / 180));
      conditions.push(`lat IS NOT NULL AND lng IS NOT NULL`);
      conditions.push(`lat BETWEEN @latMin AND @latMax`);
      conditions.push(`lng BETWEEN @lngMin AND @lngMax`);
      params.latMin = latNum - latD; params.latMax = latNum + latD;
      params.lngMin = lngNum - lngD; params.lngMax = lngNum + lngD;
      params.lat = latNum; params.lng = lngNum;
    }

    const where = conditions.join(' AND ');
    const orderBy = sort === 'price' ? 'price ASC' : 'start_date ASC';

    const events = d.prepare(`
      SELECT id, name, activity, start_date, end_date,
             location_name, city, postcode, lat, lng,
             price, price_currency, url, organiser_name,
             max_attendees, remaining_spots, source_feed, status
      FROM events WHERE ${where}
      ORDER BY ${orderBy} LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: maxLimit, offset: parseInt(offset) });

    const { total } = d.prepare(`SELECT COUNT(*) as total FROM events WHERE ${where}`).get(params);

    res.json({ total, limit: maxLimit, offset: parseInt(offset), events });
  } catch (err) {
    console.error('GET /api/events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/events/:id ────────────────────────────────────────────────────
app.get('/api/events/:id', async (req, res) => {
  try {
    const d     = await db();
    const event = d.prepare(`SELECT * FROM events WHERE id = @id`).get({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/summary ───────────────────────────────────────────────────────
app.get('/api/summary', async (req, res) => {
  try {
    const d    = await db();
    const rows = d.prepare(`
      SELECT activity, COUNT(*) as count FROM events
      WHERE status = 'active' AND start_date >= datetime('now')
      GROUP BY activity ORDER BY count DESC
    `).all({});
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/submit ───────────────────────────────────────────────────────
app.post('/api/submit', async (req, res) => {
  try {
    const d = await db();
    const { name, sport, event_date, location, price, spaces, reg_link, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Event name is required' });
    d.prepare(`
      INSERT INTO submitted_events (name, sport, event_date, location, price, spaces, reg_link, description)
      VALUES (@name, @sport, @event_date, @location, @price, @spaces, @reg_link, @description)
    `).run({ name, sport, event_date, location, price, spaces, reg_link, description });
    res.status(201).json({ message: 'Event submitted for review' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
