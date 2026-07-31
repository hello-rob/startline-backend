// src/harvester/index.js
// Orchestrates harvesting. For each provider:
//   1. Harvest SessionSeries feed → build name/description cache
//   2. Harvest ScheduledSessions feed → resolve names from cache → write to DB

const { getDb }                          = require('../db');
const { FEEDS }                          = require('./feeds');
const { harvestFeed }                    = require('./rpde');
const { normaliseItem, normaliseSeriesItem } = require('./normalise');

async function runHarvest() {
  const db        = await getDb();
  const startTime = Date.now();

  console.log(`\n🏁 Startline harvester — ${new Date().toISOString()}`);
  console.log(`   Processing ${FEEDS.length} providers\n`);

  // ── DB statements ──────────────────────────────────────────────────────────
  const upsertEvent = db.prepare(`
    INSERT INTO events (
      id, source_feed, modified, name, description, activity, activity_raw,
      start_date, end_date, duration, location_name, street_address, city,
      postcode, lat, lng, price, price_currency, url, organiser_name,
      organiser_url, max_attendees, remaining_spots, status, updated_at
    ) VALUES (
      @id, @source_feed, @modified, @name, @description, @activity, @activity_raw,
      @start_date, @end_date, @duration, @location_name, @street_address, @city,
      @postcode, @lat, @lng, @price, @price_currency, @url, @organiser_name,
      @organiser_url, @max_attendees, @remaining_spots, @status, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      modified        = excluded.modified,
      name            = excluded.name,
      description     = excluded.description,
      activity        = excluded.activity,
      start_date      = excluded.start_date,
      end_date        = excluded.end_date,
      location_name   = excluded.location_name,
      street_address  = excluded.street_address,
      city            = excluded.city,
      postcode        = excluded.postcode,
      lat             = excluded.lat,
      lng             = excluded.lng,
      price           = excluded.price,
      url             = excluded.url,
      organiser_name  = excluded.organiser_name,
      max_attendees   = excluded.max_attendees,
      remaining_spots = excluded.remaining_spots,
      status          = excluded.status,
      updated_at      = datetime('now')
    WHERE excluded.modified > events.modified
  `);

  const deleteEvent  = db.prepare(`UPDATE events SET status = 'deleted', updated_at = datetime('now') WHERE id = @id`);
  const getCursor    = db.prepare(`SELECT next_url FROM feed_cursors WHERE feed_url = @feed_url`);
  const upsertCursor = db.prepare(`
    INSERT INTO feed_cursors (feed_url, next_url, last_synced, items_total)
    VALUES (@feed_url, @next_url, datetime('now'), @items_total)
    ON CONFLICT(feed_url) DO UPDATE SET
      next_url    = excluded.next_url,
      last_synced = excluded.last_synced,
      items_total = feed_cursors.items_total + excluded.items_total
  `);

  const upsertBatch = db.transaction((items, seriesCache, feedMeta) => {
    for (const item of items) {
      if (item.state === 'deleted') { deleteEvent.run({ id: item.id }); continue; }
      const n = normaliseItem(item, feedMeta, seriesCache);
      if (n) upsertEvent.run(n);
    }
  });

  let totalUpserted = 0, feedErrors = 0;

  for (const feed of FEEDS) {
    console.log(`\n📡 ${feed.name}`);

    // ── Step 1: harvest SessionSeries into an in-memory cache ───────────────
    const seriesCache = new Map();

    if (feed.seriesFeed) {
      console.log(`   Series:   ${feed.seriesFeed}`);
      try {
        const cursor   = getCursor.get({ feed_url: feed.seriesFeed });
        const startUrl = cursor?.next_url || feed.seriesFeed;

        const { total, nextUrl } = await harvestFeed({
          feedUrl: feed.seriesFeed, startUrl,
          onItem: async (item) => {
            if (item.state === 'deleted') return;
            const s = normaliseSeriesItem(item, feed);
            if (s) seriesCache.set(s.id, s);
          },
        });

        if (nextUrl) upsertCursor.run({ feed_url: feed.seriesFeed, next_url: nextUrl, items_total: total });
        console.log(`   ✓ ${seriesCache.size} series cached`);
      } catch (err) {
        console.error(`   ✗ Series feed failed: ${err.message}`);
        // Continue anyway — sessions will use fallback names
      }
    }

    // ── Step 2: harvest ScheduledSessions, resolve names from cache ─────────
    console.log(`   Sessions: ${feed.sessionsFeed}`);
    try {
      const cursor   = getCursor.get({ feed_url: feed.sessionsFeed });
      const startUrl = cursor?.next_url || feed.sessionsFeed;
      const batch    = [];

      const { total, nextUrl } = await harvestFeed({
        feedUrl: feed.sessionsFeed, startUrl,
        onItem: async (item) => {
          batch.push(item);
          if (batch.length >= 100) {
            const flush = batch.splice(0, 100);
            upsertBatch(flush, seriesCache, feed);
            totalUpserted += flush.length;
          }
        },
        onProgress: ({ pages }) => { if (pages % 10 === 0) process.stdout.write('.'); },
      });

      if (batch.length) {
        upsertBatch(batch, seriesCache, feed);
        totalUpserted += batch.length;
      }

      if (nextUrl) upsertCursor.run({ feed_url: feed.sessionsFeed, next_url: nextUrl, items_total: total });
      console.log(`\n   ✓ ${total} sessions processed`);
    } catch (err) {
      console.error(`\n   ✗ Sessions feed failed: ${err.message}`);
      feedErrors++;
    }
  }

  // Clean up past events
  db.prepare(`
    DELETE FROM events
    WHERE start_date IS NOT NULL
    AND start_date < datetime('now', '-1 day')
  `).run();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Harvest complete in ${elapsed}s — ${totalUpserted} events processed, ${feedErrors} errors\n`);
  return { totalUpserted, feedErrors };
}

if (require.main === module) runHarvest().catch(console.error);
module.exports = { runHarvest };
