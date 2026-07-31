// src/harvester/normalise.js
const { normaliseActivity } = require('./feeds');

function normaliseItem(item, feedMeta) {
  const d = item.data;
  if (!d) return null;

  const activityRaw = extractActivity(d);
  const activity    = feedMeta.activity === 'general'
    ? normaliseActivity(activityRaw)
    : feedMeta.activity;

  const startDate = d.startDate || d.startTime || null;
  if (startDate && new Date(startDate) < new Date()) return null;

  const loc  = d.location || d.place || {};
  const addr = loc.address || {};
  const geo  = loc.geo || {};

  // ── Name resolution ───────────────────────────────────────────────────────
  // OpenActive ScheduledSessions often have no name of their own — it lives on
  // the parent SessionSeries. We try several fallbacks before giving up.
  const resolvedName = resolveName(d, activityRaw, loc, startDate);

  return {
    id:             d['@id'] || item.id,
    source_feed:    feedMeta.name,
    modified:       item.modified || 0,
    name:           resolvedName,
    description:    d.description || null,
    activity,
    activity_raw:   activityRaw,
    start_date:     startDate,
    end_date:       d.endDate || d.endTime || null,
    duration:       d.duration || null,
    location_name:  loc.name || addr.streetAddress || null,
    street_address: addr.streetAddress || null,
    city:           addr.addressLocality || addr.addressRegion || null,
    postcode:       addr.postalCode || null,
    lat:            parseFloat(geo.latitude)  || null,
    lng:            parseFloat(geo.longitude) || null,
    price:          extractPrice(d),
    price_currency: 'GBP',
    url:            d.url || d['@id'] || null,
    organiser_name: (d.organizer || d.provider || d.organiser || {}).name || null,
    organiser_url:  (d.organizer || d.provider || d.organiser || {}).url  || null,
    max_attendees:  d.maximumAttendeeCapacity || null,
    remaining_spots: d.remainingAttendeeCapacity || null,
    status: 'active',
  };
}

function resolveName(d, activityRaw, loc, startDate) {
  // 1. Direct name on the item
  if (d.name && d.name.trim()) return d.name.trim();

  // 2. Name on a superEvent (parent SessionSeries reference)
  if (d.superEvent?.name && d.superEvent.name.trim()) return d.superEvent.name.trim();

  // 3. Name on a referenced event
  if (d.event?.name && d.event.name.trim()) return d.event.name.trim();

  // 4. Build a descriptive name from activity + location + time
  const parts = [];

  // Activity label
  const actLabel = activityRaw
    ? activityRaw.charAt(0).toUpperCase() + activityRaw.slice(1)
    : null;
  if (actLabel) parts.push(actLabel);

  // Location
  const place = loc?.name || loc?.address?.addressLocality || null;
  if (place) parts.push(`at ${place}`);

  // Day + time
  if (startDate) {
    const dt   = new Date(startDate);
    const day  = dt.toLocaleDateString('en-GB', { weekday: 'short' });
    const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    parts.push(`— ${day} ${time}`);
  }

  if (parts.length > 0) return parts.join(' ');

  // 5. Last resort
  return 'Activity session';
}

function extractActivity(d) {
  if (Array.isArray(d.activity) && d.activity.length > 0)
    return d.activity[0].prefLabel || d.activity[0].id || '';
  if (typeof d.activity === 'string') return d.activity;
  return d['@type'] || '';
}

function extractPrice(d) {
  const offers = Array.isArray(d.offers) ? d.offers : d.offers ? [d.offers] : [];
  if (!offers.length) return null;
  const prices = offers.map(o => parseFloat(o.price)).filter(p => !isNaN(p));
  return prices.length ? Math.min(...prices) : null;
}

module.exports = { normaliseItem };
