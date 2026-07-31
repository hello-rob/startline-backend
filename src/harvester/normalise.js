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

  return {
    id:             d['@id'] || item.id,
    source_feed:    feedMeta.name,
    modified:       item.modified || 0,
    name:           d.name || 'Unnamed event',
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
