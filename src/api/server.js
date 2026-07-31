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
    const d = await db();
    const { count } = d.prepare(`SELECT COUNT(*) as count FROM events WHERE status = 'active'`).get({});
    const cursor    = d.prepare(`SELECT MAX(last_synced) as last FROM feed_cursors`).get({});
    res.json({ status: 'ok', activeEvents: count, lastHarvest: cursor?.last || null });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/events
// Geo filter is OPTIONAL — if no lat/lng provided, returns all events
app.get('/api/events', async (req, res) => {
  try {
    const d = await db();
    const {
      lat, lng, radius = 40, activity,
      from = new Date().toISOString().split('T')[0],
      to, free, sort = 'date', limit = 50, offset = 0,
    } = req.query;

    const maxLimit = Math.min(parseInt(limit) || 50, 200);
    const toDate   = to || new Date(Date.now() + 180 * 86400000).toISOString();
    const params   = { from, to: toDate };

    let conditions = [`status = 'active'`];

    // Only filter by date if events have dates
    conditions.push(`(start_date IS NULL OR start_date >= @from)`);
    conditions.push(`(start_date IS NULL OR start_date <= @to)`);

    if (activity && activity !== 'all') {
      conditions.push(`activity = @activity`);
      params.activity = activity;
    }

    if (free === 'true') conditions.push(`price = 0`);

    // Geo filter only applied if lat AND lng provided AND events have coordinates
    if (lat && lng) {
      const latNum = parseFloat(lat), lngNum = parseFloat(lng), r = parseFloat(radius);
      const latD = r / 111;
      const lngD = r / (111 * Math.cos(latNum * Math.PI / 180));
      params.latMin = latNum - latD; params.latMax = latNum + latD;
      params.lngMin = lngNum - lngD; params.lngMax = lngNum + lngD;
      params.lat = latNum; params.lng = lngNum;
      // Only geo-filter events that HAVE coordinates; show all others regardless
      conditions.push(`(lat IS NULL OR lng IS NULL OR (lat BETWEEN @latMin AND @latMax AND lng BETWEEN @lngMin AND @lngMax))`);
    }

    const where   = conditions.join(' AND ');
    const orderBy = sort === 'price' ? 'CASE WHEN price IS NULL THEN 1 ELSE 0 END, price ASC' : 'CASE WHEN start_date IS NULL THEN 1 ELSE 0 END, start_date ASC';

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
    res.status(500).json({ error: err.message });
  }
});

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

app.get('/api/summary', async (req, res) => {
  try {
    const d    = await db();
    const rows = d.prepare(`
      SELECT activity, COUNT(*) as count FROM events
      WHERE status = 'active'
      GROUP BY activity ORDER BY count DESC
    `).all({});
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
