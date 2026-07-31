// src/index.js
const cron           = require('node-cron');
const app            = require('./api/server');
const { getDb }      = require('./db');
const { runHarvest } = require('./harvester');

const PORT = process.env.PORT || 3001;

async function start() {
  // Initialise DB and run setup
  const db = await getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, source_feed TEXT NOT NULL, modified INTEGER NOT NULL,
      name TEXT, description TEXT, activity TEXT, activity_raw TEXT,
      start_date TEXT, end_date TEXT, duration TEXT,
      location_name TEXT, street_address TEXT, city TEXT, postcode TEXT,
      lat REAL, lng REAL, price REAL, price_currency TEXT DEFAULT 'GBP',
      url TEXT, organiser_name TEXT, organiser_url TEXT,
      max_attendees INTEGER, remaining_spots INTEGER,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_lat_lng    ON events(lat, lng);
    CREATE INDEX IF NOT EXISTS idx_start_date ON events(start_date);
    CREATE INDEX IF NOT EXISTS idx_activity   ON events(activity);
    CREATE INDEX IF NOT EXISTS idx_status     ON events(status);
    CREATE TABLE IF NOT EXISTS feed_cursors (
      feed_url TEXT PRIMARY KEY, next_url TEXT NOT NULL,
      last_synced TEXT, items_total INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS submitted_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      sport TEXT, event_date TEXT, location TEXT, price TEXT,
      spaces TEXT, reg_link TEXT, description TEXT,
      status TEXT DEFAULT 'pending',
      submitted_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Start API
  app.listen(PORT, () => {
    console.log(`\n🏁 Startline API → http://localhost:${PORT}/api/health\n`);
  });

  // Schedule hourly harvest
  cron.schedule('0 * * * *', () => runHarvest().catch(console.error));

  // Run harvest immediately on startup
  if (process.env.SKIP_INITIAL_HARVEST !== 'true') {
    runHarvest().catch(console.error);
  }
}

start().catch(err => { console.error('Startup failed:', err); process.exit(1); });
