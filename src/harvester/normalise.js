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

  const resolvedName = resolveName(d, activity, loc, startDate, feedMeta);

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

function resolveName(d, activity, loc, startDate, feedMeta) {
  // 1. Direct name on the item (ignore OpenActive type strings)
  if (d.name && d.name.trim() && !d.name.includes('Session') && !d.name.includes('Event'))
    return d.name.trim();

  // 2. Allow "Session" names if they have more context e.g. "Swim Session"
  if (d.name && d.name.trim() && d.name.trim().split(' ').length > 1)
    return d.name.trim();

  // 3. Parent SessionSeries name
  if (d.superEvent?.name && d.superEvent.name.trim())
    return d.superEvent.name.trim();

  // 4. Referenced event name
  if (d.event?.name && d.event.name.trim())
    return d.event.name.trim();

  // 5. Build from activity + location + time
  const parts = [];

  // Use the normalised activity label (running, cycling etc)
  const actLabel = activity
    ? activity.charAt(0).toUpperCase() + activity.slice(1)
    : null;

  // Location name (not a generic type string)
  const place = loc?.name && !loc.name.includes('https://')
    ? loc.name
    : loc?.address?.addressLocality || loc?.address?.addressRegion || null;

  if (actLabel) parts.push(actLabel);
  if (place) parts.push(`at ${place}`);

  if (startDate) {
    const dt   = new Date(startDate);
    const day  = dt.toLocaleDateString('en-GB', { weekday: 'short' });
    const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    parts.push(`— ${day} ${time}`);
  }

  if (parts.length > 1) return parts.join(' ');

  // 6. Fall back to the provider name + session
  const provider = feedMeta.name.replace(' — Sessions', '').replace(' — Courses', '');
  if (actLabel) return `${actLabel} session · ${provider}`;
  return `Session · ${provider}`;
}

function extractActivity(d) {
  // Only use prefLabel — never use @type as it returns "ScheduledSession" etc.
  if (Array.isArray(d.activity) && d.activity.length > 0)
    return d.activity[0].prefLabel || '';
  if (typeof d.activity === 'string') return d.activity;
  return '';
}

function extractPrice(d) {
  const offers = Array.isArray(d.offers) ? d.offers : d.offers ? [d.offers] : [];
  if (!offers.length) return null;
  const prices = offers.map(o => parseFloat(o.price)).filter(p => !isNaN(p));
  return prices.length ? Math.min(...prices) : null;
}

module.exports = { normaliseItem };
