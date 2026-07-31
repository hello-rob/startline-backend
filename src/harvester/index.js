// src/harvester/index.js
const { getDb }                              = require('../db');
const { FEEDS }                              = require('./feeds');
const { harvestFeed }                        = require('./rpde');
const { normaliseItem, normaliseSeriesItem } = require('./normalise');

async function runHarvest() {
  const db        = await getDb();
  const startTime = Date.now();

  console.log('\n\uD83C\uDFC1 Startline harvester \u2014 ' + new Date().toISOString());
  console.log('   Processing ' + FEEDS.length + ' providers\n');

  const upsertEvent = db.prepare([
    'INSERT INTO events (',
    '  id, source_feed, modified, name, description, activity, activity_raw,',
    '  start_date, end_date, duration, location_name, street_address, city,',
    '  postcode, lat, lng, price, price_currency, url, organiser_name,',
    '  organiser_url, max_attendees, remaining_spots, status, updated_at',
    ') VALUES (',
    '  @id, @source_feed, @modified, @name, @description, @activity, @activity_raw,',
    '  @start_date, @end_date, @duration, @location_name, @street_address, @city,',
    '  @postcode, @lat, @lng, @price, @price_currency, @url, @organiser_name,',
    '  @organiser_url, @max_attendees, @remaining_spots, @status, datetime(\'now\')',
    ')',
    'ON CONFLICT(id) DO UPDATE SET',
    '  modified = excluded.modified, name = excluded.name,',
    '  description = excluded.description, activity = excluded.activity,',
    '  start_date = excluded.start_date, end_date = excluded.end_date,',
    '  location_name = excluded.location_name, city = excluded.city,',
    '  postcode = excluded.postcode, lat = excluded.lat, lng = excluded.lng,',
    '  price = excluded.price, url = excluded.url,',
    '  organiser_name = excluded.organiser_name,',
    '  max_attendees = excluded.max_attendees,',
    '  remaining_spots = excluded.remaining_spots,',
    '  status = excluded.status, updated_at = datetime(\'now\')',
    'WHERE excluded.modified > events.modified'
  ].join(' '));

  const deleteEvent  = db.prepare("UPDATE events SET status = 'deleted', updated_at = datetime('now') WHERE id = @id");
  const getCursor    = db.prepare('SELECT next_url FROM feed_cursors WHERE feed_url = @feed_url');
  const upsertCursor = db.prepare([
    'INSERT INTO feed_cursors (feed_url, next_url, last_synced, items_total)',
    'VALUES (@feed_url, @next_url, datetime(\'now\'), @items_total)',
    'ON CONFLICT(feed_url) DO UPDATE SET',
    '  next_url = excluded.next_url,',
    '  last_synced = excluded.last_synced,',
    '  items_total = feed_cursors.items_total + excluded.items_total'
  ].join(' '));

  // Simple non-transaction batch write — avoids sql.js transaction conflicts
  function writeBatch(items, seriesCache, feedMeta) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        if (item.state === 'deleted') {
          deleteEvent.run({ id: item.id });
          continue;
        }
        var n = normaliseItem(item, feedMeta, seriesCache);
        if (n) upsertEvent.run(n);
      } catch (e) {
        // skip bad items silently
      }
    }
  }

  var totalUpserted = 0;
  var feedErrors    = 0;

  for (var fi = 0; fi < FEEDS.length; fi++) {
    var feed = FEEDS[fi];
    console.log('\n\uD83D\uDCE1 ' + feed.name);

    // Step 1: harvest SessionSeries into cache
    var seriesCache = new Map();

    if (feed.seriesFeed) {
      console.log('   Series:   ' + feed.seriesFeed);
      try {
        var sCursor   = getCursor.get({ feed_url: feed.seriesFeed });
        var sStartUrl = (sCursor && sCursor.next_url) ? sCursor.next_url : feed.seriesFeed;

        var sResult = await harvestFeed({
          feedUrl:  feed.seriesFeed,
          startUrl: sStartUrl,
          onItem: async function(item) {
            if (item.state === 'deleted') return;
            var s = normaliseSeriesItem(item, feed);
            if (s) seriesCache.set(s.id, s);
          }
        });

        if (sResult.nextUrl) {
          upsertCursor.run({ feed_url: feed.seriesFeed, next_url: sResult.nextUrl, items_total: sResult.total });
        }
        console.log('   \u2713 ' + seriesCache.size + ' series cached');
      } catch (err) {
        console.error('   \u2717 Series feed failed: ' + err.message);
      }
    }

    // Step 2: harvest ScheduledSessions
    console.log('   Sessions: ' + feed.sessionsFeed);
    try {
      var pCursor   = getCursor.get({ feed_url: feed.sessionsFeed });
      var pStartUrl = (pCursor && pCursor.next_url) ? pCursor.next_url : feed.sessionsFeed;
      var batch     = [];
      var feedRef   = feed; // capture for closure

      var pResult = await harvestFeed({
        feedUrl:  feed.sessionsFeed,
        startUrl: pStartUrl,
        onItem: async function(item) {
          batch.push(item);
          if (batch.length >= 50) {
            var flush = batch.splice(0, 50);
            writeBatch(flush, seriesCache, feedRef);
            totalUpserted += flush.length;
          }
        },
        onProgress: function(p) {
          if (p.pages % 10 === 0) process.stdout.write('.');
        }
      });

      if (batch.length > 0) {
        writeBatch(batch, seriesCache, feedRef);
        totalUpserted += batch.length;
      }

      if (pResult.nextUrl) {
        upsertCursor.run({ feed_url: feed.sessionsFeed, next_url: pResult.nextUrl, items_total: pResult.total });
      }

      console.log('\n   \u2713 ' + pResult.total + ' sessions processed');
    } catch (err) {
      console.error('\n   \u2717 Sessions feed failed: ' + err.message);
      feedErrors++;
    }
  }

  var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n\u2705 Harvest complete in ' + elapsed + 's \u2014 ' + totalUpserted + ' items processed, ' + feedErrors + ' errors\n');
  return { totalUpserted: totalUpserted, feedErrors: feedErrors };
}

if (require.main === module) runHarvest().catch(console.error);
module.exports = { runHarvest: runHarvest };
