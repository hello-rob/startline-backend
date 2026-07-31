// src/harvester/index.js
const { getDb }         = require('../db');
const { FEEDS }         = require('./feeds');
const { harvestFeed }   = require('./rpde');
const { normaliseItem } = require('./normalise');

async function runHarvest() {
  const db        = await getDb();
  const startTime = Date.now();

  console.log(`\n🏁 Startline harvester — ${new Date().toISOString()}`);
  console.log(`   Processing ${FEEDS.length} feeds\n`);

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
      modified = excluded.modified, name = excluded.name,
      start_date = excluded.start_date, activity = excluded.activity,
      lat = excluded.lat, lng = excluded.lng, price = excluded.price,
      url = excluded.url, status = excluded.status,
      updated_at = datetime('now')
    WHERE excluded.modified > events.modified
  `);

  const deleteEvent  = db.prepare(`UPDATE events SET status = 'deleted' WHERE id = @id`);
  const getCursor    = db.prepare(`SELECT next_url FROM feed_cursors WHERE feed_url = @feed_url`);
  const upsertCursor = db.prepare(`
    INSERT INTO feed_cursors (feed_url, next_url, last_synced, items_total)
    VALUES (@feed_url, @next_url, datetime('now'), @items_total)
    ON CONFLICT(feed_url) DO UPDATE SET
      next_url = excluded.next_url, last_synced = excluded.last_synced,
      items_total = feed_cursors.items_total + excluded.items_total
  `);

  const upsertBatch = db.transaction((items) => {
    for (const item of items) {
      if (item.state === 'deleted') { deleteEvent.run({ id: item.id }); continue; }
      const n = normaliseItem(item, item._feedMeta);
      if (n) upsertEvent.run(n);
    }
  });

  let totalInserted = 0, feedErrors = 0;

  for (const feed of FEEDS) {
    console.log(`📡 ${feed.name}`);
    try {
      const cursor   = getCursor.get({ feed_url: feed.url });
      const startUrl = cursor?.next_url || feed.url;
      const batch    = [];

      const { total, nextUrl } = await harvestFeed({
        feedUrl: feed.url, startUrl,
        onItem: async (item) => {
          item._feedMeta = feed;
          batch.push(item);
          if (batch.length >= 100) {
            upsertBatch(batch.splice(0, 100));
            totalInserted += 100;
          }
        },
        onProgress: ({ pages }) => { if (pages % 10 === 0) process.stdout.write('.'); },
      });

      if (batch.length) { upsertBatch(batch); totalInserted += batch.length; }
      if (nextUrl) upsertCursor.run({ feed_url: feed.url, next_url: nextUrl, items_total: total });

      console.log(` ✓ ${total} items\n`);
    } catch (err) {
      console.error(` ✗ ${err.message}\n`);
      feedErrors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Done in ${elapsed}s — ${totalInserted} events, ${feedErrors} errors\n`);
  return { totalInserted, feedErrors };
}

if (require.main === module) runHarvest().catch(console.error);
module.exports = { runHarvest };
