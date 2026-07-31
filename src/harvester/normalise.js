// src/harvester/normalise.js
const { normaliseActivity } = require('./feeds');

function normaliseItem(item, feedMeta, seriesCache) {
  const d = item.data;
  if (!d) return null;

  const activityRaw = extractActivity(d);

  const loc  = d.location || d.place || {};
  const addr = loc.address || {};
  const geo  = loc.geo || {};

  // ── Resolve name from series cache ────────────────────────────────────────
  // ScheduledSessions reference their parent SessionSeries via superEvent @id
  const seriesId   = d.superEvent?.['@id'] || d.superEvent || null;
  const seriesData = seriesId && seriesCache ? seriesCache.get(seriesId) : null;

  // Merge series data onto session — series wins for name, description, activity, location
  const name        = resolveName(d, seriesData, activityRaw, loc, feedMeta);
  const description = d.description || seriesData?.description || null;
  const resolvedActivityRaw = activityRaw || extractActivity(seriesData || {});
  const activity    = feedMeta.activity === 'general'
    ? normaliseActivity(resolvedActivityRaw || seriesData?.activityRaw || '')
    : feedMeta.activity;

  // Location: prefer session's own location, fall back to series location
  const resolvedLoc  = (loc.name || addr.streetAddress) ? loc : (seriesData?.loc || loc);
  const resolvedAddr = resolvedLoc.address || addr;
  const resolvedGeo  = resolvedLoc.geo || geo;

  const startDate = d.startDate || d.startTime || null;
  if (startDate && new Date(startDate) < new Date()) return null;

  return {
    id:             d['@id'] || item.id,
    source_feed:    feedMeta.name,
    modified:       item.modified || 0,
    name,
    description,
    activity,
    activity_raw:   resolvedActivityRaw,
    start_date:     startDate,
    end_date:       d.endDate || d.endTime || null,
    duration:       d.duration || seriesData?.duration || null,
    location_name:  resolvedLoc.name || resolvedAddr.streetAddress || null,
    street_address: resolvedAddr.streetAddress || null,
    city:           resolvedAddr.addressLocality || resolvedAddr.addressRegion || null,
    postcode:       resolvedAddr.postalCode || null,
    lat:            parseFloat(resolvedGeo.latitude)  || null,
    lng:            parseFloat(resolvedGeo.longitude) || null,
    price:          extractPrice(d) ?? extractPrice(seriesData?.raw || {}),
    price_currency: 'GBP',
    url:            d.url || seriesData?.url || d['@id'] || null,
    organiser_name: extractOrganiser(d)?.name || extractOrganiser(seriesData?.raw || {})?.name || null,
    organiser_url:  extractOrganiser(d)?.url  || extractOrganiser(seriesData?.raw || {})?.url  || null,
    max_attendees:  d.maximumAttendeeCapacity || null,
    remaining_spots: d.remainingAttendeeCapacity || null,
    status: 'active',
  };
}

// Build a normalised series record to store in the cache
function normaliseSeriesItem(item, feedMeta) {
  const d = item.data;
  if (!d || !d['@id']) return null;

  const loc = d.location || d.place || {};

  return {
    id:          d['@id'],
    name:        d.name || null,
    description: d.description || null,
    activityRaw: extractActivity(d),
    loc,
    duration:    d.duration || null,
    url:         d.url || null,
    raw:         d,
  };
}

function resolveName(d, seriesData, activityRaw, loc, feedMeta) {
  // 1. Session's own name (if meaningful)
  if (d.name && d.name.trim() && isUsefulName(d.name)) return d.name.trim();

  // 2. Parent series name — the best source
  if (seriesData?.name && isUsefulName(seriesData.name)) return seriesData.name.trim();

  // 3. superEvent inline name
  if (d.superEvent?.name && isUsefulName(d.superEvent.name)) return d.superEvent.name.trim();

  // 4. Build from activity + location + time
  const activity = activityRaw || seriesData?.activityRaw || '';
  const actLabel = activity
    ? activity.charAt(0).toUpperCase() + activity.slice(1)
    : null;

  const place = loc?.name && isUsefulName(loc.name)
    ? loc.name
    : seriesData?.loc?.name && isUsefulName(seriesData.loc.name)
    ? seriesData.loc.name
    : loc?.address?.addressLocality || seriesData?.loc?.address?.addressLocality || null;

  const parts = [];
  if (actLabel) parts.push(actLabel);
  if (place) parts.push(`at ${place}`);

  if (parts.length > 1) return parts.join(' ');

  // 5. Provider fallback
  const provider = feedMeta.name.replace(/ — (Sessions|Courses)$/, '');
  if (actLabel) return `${actLabel} · ${provider}`;
  return `Activity · ${provider}`;
}

// Reject names that are just OpenActive type strings or URIs
function isUsefulName(name) {
  if (!name || !name.trim()) return false;
  if (name.startsWith('https://') || name.startsWith('http://')) return false;
  const lower = name.toLowerCase().trim();
  const useless = ['scheduledsession', 'sessionseries', 'courseinstance', 'event', 'session'];
  if (useless.includes(lower)) return false;
  return true;
}

function extractActivity(d) {
  if (!d) return '';
  if (Array.isArray(d.activity) && d.activity.length > 0)
    return d.activity[0].prefLabel || '';
  if (typeof d.activity === 'string') return d.activity;
  return '';
}

function extractPrice(d) {
  if (!d) return null;
  const offers = Array.isArray(d.offers) ? d.offers : d.offers ? [d.offers] : [];
  if (!offers.length) return null;
  const prices = offers.map(o => parseFloat(o.price)).filter(p => !isNaN(p));
  return prices.length ? Math.min(...prices) : null;
}

function extractOrganiser(d) {
  if (!d) return null;
  return d.organizer || d.provider || d.organiser || null;
}

module.exports = { normaliseItem, normaliseSeriesItem };
